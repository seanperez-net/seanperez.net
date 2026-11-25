/**
 * Captures the manifest's install screenshots (`public/screenshots/`) from a RUNNING site with
 * headless Chrome, driven over the DevTools protocol (Node's own `WebSocket`, no Puppeteer).
 * Run by hand, NOT by the build: Workers Builds has neither a running site nor Chrome, so the
 * PNGs are COMMITTED. Re-run when the pages change, then check them with an image viewer:
 *
 *   pnpm build && pnpm --filter @seanperez/web exec wrangler dev   # one terminal
 *   pnpm --filter @seanperez/web screenshots http://localhost:8787 # another
 *
 * Use the built Worker, not `pnpm dev` (the dev server paints Qwik's "Click-to-Source" overlay).
 * Light theme always (`prefers-color-scheme: light` emulated, a fresh profile so no saved theme).
 *
 * Chrome's "richer install UI" rules (web.dev/articles/web-apps/richer-install-ui, read
 * 2026-11-24): PNG or JPEG; each side 320 to 3840px; the long side at most 2.3 times the short
 * one; screenshots of one `form_factor` share one aspect ratio; up to eight are shown; give
 * `sizes` and `type`. `wide` is shown on desktop, `narrow` on mobile. Checked below.
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.argv[2] ?? "http://localhost:8787";
const outDir = new URL("../public/screenshots/", import.meta.url);

/** Must match the `screenshots` entries in `public/manifest.json`. */
const SHOTS = [
  // 1280 x 720 (16:9).
  {
    file: "home-wide.png",
    path: "/",
    width: 1280,
    height: 720,
    scale: 1,
    mobile: false,
  },
  // 390 x 844 CSS px (a phone) at 2x: 780 x 1688 (ratio 2.16).
  {
    file: "maps-narrow.png",
    path: "/maps/",
    width: 390,
    height: 844,
    scale: 2,
    mobile: true,
  },
];

for (const shot of SHOTS) {
  const [w, h] = [shot.width * shot.scale, shot.height * shot.scale];
  const ratio = Math.max(w, h) / Math.min(w, h);
  if (Math.min(w, h) < 320 || Math.max(w, h) > 3840 || ratio > 2.3) {
    throw new Error(
      `screenshots: ${shot.file} ${w}x${h} breaks Chrome's limits`,
    );
  }
}

const profile = await mkdtemp(join(tmpdir(), "spn-shots-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--hide-scrollbars",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  // Chrome writes the port it chose into the profile.
  let port = "";
  for (let i = 0; i < 100 && !port; i++) {
    await new Promise((r) => setTimeout(r, 100));
    port = await readFile(join(profile, "DevToolsActivePort"), "utf8")
      .then((text) => text.split("\n")[0])
      .catch(() => "");
  }
  if (!port) throw new Error("screenshots: Chrome did not start");
  const targets = (await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json()) as { type: string; webSocketDebuggerUrl: string }[];
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("screenshots: no page target");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let id = 0;
  const pending = new Map<number, (result: unknown) => void>();
  const events = new Map<string, () => void>();
  socket.onmessage = (message) => {
    const data = JSON.parse(String(message.data));
    if (data.id)
      pending.get(data.id)?.(
        data.error ? Promise.reject(data.error) : data.result,
      );
    else events.get(data.method)?.();
  };
  const send = <T>(method: string, params: object = {}) =>
    new Promise<T>((resolve) => {
      pending.set(++id, resolve as (result: unknown) => void);
      socket.send(JSON.stringify({ id, method, params }));
    });
  const once = (method: string) =>
    new Promise<void>((resolve) => events.set(method, resolve));

  await send("Page.enable");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await mkdir(outDir, { recursive: true });

  for (const shot of SHOTS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: shot.width,
      height: shot.height,
      deviceScaleFactor: shot.scale,
      mobile: shot.mobile,
    });
    const loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url: new URL(shot.path, base).href });
    await loaded;
    // Fonts, then time for the map's tiles and Qwik's first tasks.
    await send("Runtime.evaluate", {
      expression:
        "document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 5000)))",
      awaitPromise: true,
    });
    const { data } = await send<{ data: string }>("Page.captureScreenshot", {
      format: "png",
    });
    const file = new URL(shot.file, outDir);
    await writeFile(file, Buffer.from(data, "base64"));
    console.log(`screenshots: ${fileURLToPath(file)}`);
  }
  socket.close();
} finally {
  // Chrome writes its profile until it has exited.
  const exited = new Promise((resolve) => chrome.once("exit", resolve));
  chrome.kill();
  await exited;
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
}
