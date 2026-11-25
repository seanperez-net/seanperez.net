/**
 * Draws the site's app icons: an "SP" monogram in the Material 3 theme's `primary` /
 * `on-primary` (the manifest's `theme_color`), with the same tools as the OG cards (`og.ts`):
 * satori turns the text into paths (the library's own Roboto 700), resvg-wasm renders the PNGs.
 * Run by the root `pnpm build` after `og`; the output is gitignored, like `public/og/`. Under
 * `pnpm dev` the icons 404 until `pnpm --filter @seanperez/web icons` has run once.
 *
 * Writes (sizes and rules from the sources below, read 2026-11-24):
 * - `public/icons/icon-192.png`, `icon-512.png`: manifest `purpose: "any"`. Like a favicon: a
 *   `primary` circle, transparent corners, no extra padding (web.dev "Adaptive icon support in
 *   PWAs with maskable icons", https://web.dev/articles/maskable-icon). Chromium's install
 *   criteria want a 192 and a 512 (https://web.dev/articles/add-manifest).
 * - `icon-maskable-512.png`: `purpose: "maskable"`. Opaque, full bleed; everything that matters
 *   inside the safe zone, the centred circle of radius 40% of the icon (W3C Web App Manifest,
 *   "purpose" member / icon masks, https://www.w3.org/TR/appmanifest/; web.dev above). The
 *   build checks the letters' box stays in that circle.
 * - `apple-touch-icon.png`, 180 x 180, OPAQUE (iOS rounds the corners itself, and draws black
 *   where a PNG is transparent): Apple, "Configuring Web Applications",
 *   https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
 * - `favicon.svg`: the circle as vector paths, with a `prefers-color-scheme: dark` style that
 *   swaps in the dark scheme's `primary` / `on-primary` (SVG favicons only; the PNGs stay light).
 * - `icon-monochrome-512.png`: manifest `purpose: "monochrome"` (added 2026-11-24). The UA keeps
 *   ONLY the alpha channel and fills it with its own colour (MDN manifest `icons`; W3C "purpose"
 *   member), e.g. Android's themed icons. So: the "SP" letters opaque on a TRANSPARENT square,
 *   at the maskable size, inside the same 40% safe circle (themed icons are cropped like
 *   maskable ones). Plain `"monochrome"`, NOT `"monochrome maskable"`: a list means the icon may
 *   serve EACH purpose, and this transparent image would be a wrong full-colour maskable icon.
 * - `shortcut-contacts-96.png`, `shortcut-maps-96.png`: the manifest `shortcuts` icons (96 x 96,
 *   web.dev "Add a web app manifest"; MDN manifest `shortcuts`). A `primary` circle with the
 *   rail's Material Symbols glyph (`contacts`, `explore`) in `on-primary`, its path read from the
 *   library's `components/icon/icon.tsx` so the shortcut and the rail never differ.
 * - The icons and the manifest keep the DEFAULT (token file) colours: a visitor's own theme colour
 *   lives in their browser only. The page's `theme-color` meta follows the live theme instead
 *   (`syncThemeColorMeta` in the library).
 * - `public/favicon.ico`: one 32 x 32 PNG inside an ICO. Browsers use `<link rel="icon">`
 *   (HTML spec: `/favicon.ico` only "in the absence of a link with the icon keyword"), but feed
 *   readers and crawlers still ask for it; served as a static asset it never reaches the Worker.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import satori from "satori";

const app = new URL("../", import.meta.url);
const publicDir = new URL("public/", app);
const outDir = new URL("icons/", publicDir);
const tokens = new URL(import.meta.resolve("@seanperez/ui/tokens"));

const MONOGRAM = "SP";

/** `--color-<role>: rgb(r g b);` from one of the library's scheme files, as `#rrggbb`. */
async function role(file: string, name: string): Promise<string> {
  const css = await readFile(new URL(`color/${file}`, tokens), "utf8");
  const match = new RegExp(
    `--color-${name}:\\s*rgb\\((\\d+) (\\d+) (\\d+)\\)`,
  ).exec(css);
  // A changed token format must fail the build, not draw an unthemed icon.
  if (!match) throw new Error(`icons: --color-${name} not found in ${file}`);
  return `#${match
    .slice(1, 4)
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("")}`;
}

interface El {
  type: "div";
  props: {
    style: Record<string, string | number>;
    children?: string;
  };
}

interface Icon {
  size: number;
  /** Background; the default is `primary`. `transparent` for the monochrome icon. */
  bg?: string;
  /** Letters; the default is `on-primary`. */
  fg?: string;
  /** `circle`: transparent corners ("any"); `square`: opaque full bleed. */
  shape: "circle" | "square";
  /** The letters' font size, as a share of the icon. */
  text: number;
}

/** Roboto 700's cap height and "SP" advance, per 1 of font size (measured from the paths). */
const CAP = 0.711;
const WIDTH = 1.27;

const element = (icon: Icon, bg: string, fg: string): El => ({
  type: "div",
  props: {
    style: {
      width: icon.size,
      height: icon.size,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: bg,
      borderRadius: icon.shape === "circle" ? icon.size / 2 : 0,
      color: fg,
      fontFamily: "Roboto",
      fontWeight: 700,
      fontSize: Math.round(icon.size * icon.text),
      lineHeight: 1,
    },
    children: MONOGRAM,
  },
});

const require = createRequire(import.meta.url);
await initWasm(
  await readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm")),
);
const [primary, onPrimary, darkPrimary, darkOnPrimary, bold] =
  await Promise.all([
    role("light.css", "primary"),
    role("light.css", "on-primary"),
    role("dark.css", "primary"),
    role("dark.css", "on-primary"),
    readFile(new URL("typeface/fonts/roboto-latin-700-normal.woff2", tokens)),
  ]);

const svgOf = (icon: Icon, bg = icon.bg ?? primary, fg = icon.fg ?? onPrimary) =>
  satori(element(icon, bg, fg) as unknown as Parameters<typeof satori>[0], {
    width: icon.size,
    height: icon.size,
    fonts: [{ name: "Roboto", data: bold, weight: 700, style: "normal" }],
  });

/** The PNG and its RGBA pixels (for the opaque check). */
function render(svg: string): { png: Uint8Array; pixels: Uint8Array } {
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  const image = resvg.render();
  try {
    return { png: image.asPng(), pixels: image.pixels };
  } finally {
    image.free();
    resvg.free();
  }
}

/** Width and height from the PNG's IHDR chunk. */
const ihdr = (data: Uint8Array) => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { w: view.getUint32(16), h: view.getUint32(20) };
};

/** Fails the build when the letters' box leaves the maskable safe circle (radius 40%). */
function checkSafeZone(icon: Icon) {
  const font = icon.size * icon.text;
  const halfDiagonal = Math.hypot((WIDTH * font) / 2, (CAP * font) / 2);
  if (halfDiagonal > icon.size * 0.4) {
    throw new Error(
      `icons: the monogram (${halfDiagonal.toFixed(0)}px from the centre) leaves the maskable safe zone (${icon.size * 0.4}px)`,
    );
  }
}

/** An ICO holding one PNG (PNG entries are valid in ICO since Windows Vista). */
function ico(image: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(6 + 16 + image.byteLength);
  const view = new DataView(out.buffer);
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, 1, true); // one image
  out[6] = size; // width (0 would mean 256)
  out[7] = size; // height
  view.setUint16(10, 1, true); // colour planes
  view.setUint16(12, 32, true); // bits per pixel
  view.setUint32(14, image.byteLength, true);
  view.setUint32(18, 22, true); // offset of the image data
  out.set(image, 22);
  return out;
}

const ICONS: Record<
  string,
  Icon & { opaque?: boolean; maskable?: boolean; alphaOnly?: boolean }
> = {
  "icon-192.png": { size: 192, shape: "circle", text: 0.42 },
  "icon-512.png": { size: 512, shape: "circle", text: 0.42 },
  "icon-maskable-512.png": {
    size: 512,
    shape: "square",
    text: 0.36,
    opaque: true,
    maskable: true,
  },
  "apple-touch-icon.png": {
    size: 180,
    shape: "square",
    text: 0.4,
    opaque: true,
  },
  // Only the alpha counts; black letters, so the PNG also reads in an image viewer.
  "icon-monochrome-512.png": {
    size: 512,
    shape: "square",
    text: 0.36,
    bg: "transparent",
    fg: "#000000",
    maskable: true,
    alphaOnly: true,
  },
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const [name, icon] of Object.entries(ICONS)) {
  if (icon.maskable) checkSafeZone(icon);
  const { png: data, pixels } = render(await svgOf(icon));
  const { w, h } = ihdr(data);
  if (w !== icon.size || h !== icon.size) {
    throw new Error(`icons: ${name} is ${w}x${h}, not ${icon.size}`);
  }
  // resvg always writes RGBA: an opaque icon must have no pixel that is not fully opaque.
  if (icon.opaque) {
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] !== 255) throw new Error(`icons: ${name} is not opaque`);
    }
  }
  // The monochrome icon must be a silhouette: transparent corners, some opaque letter pixels.
  if (icon.alphaOnly) {
    let opaque = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 255) opaque++;
    if (pixels[3] !== 0 || opaque === 0) {
      throw new Error(`icons: ${name} is not a silhouette on transparency`);
    }
  }
  const file = new URL(name, outDir);
  await writeFile(file, data);
  console.log(`icons: ${fileURLToPath(file)} (${data.byteLength} bytes)`);
}

// Shortcut icons: the rail's glyphs (Material Symbols, 960-unit viewBox) on a `primary` circle.
const iconSource = await readFile(
  new URL("../components/icon/icon.tsx", tokens),
  "utf8",
);
/** One glyph's path from the library's `icon.tsx` (`name:` then the quoted path). */
function glyph(name: string): string {
  const match = new RegExp(`\\n\\s*${name}:\\s*"([^"]+)"`).exec(iconSource);
  if (!match) throw new Error(`icons: glyph "${name}" not found in icon.tsx`);
  return match[1];
}
const SHORTCUTS = { contacts: "contacts", maps: "explore" } as const;
const SHORTCUT = 96;
for (const [shortcut, name] of Object.entries(SHORTCUTS)) {
  // The glyph at half the icon (M3's 24dp icon in a 48dp target), centred.
  const g = SHORTCUT / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHORTCUT}" height="${SHORTCUT}" viewBox="0 0 ${SHORTCUT} ${SHORTCUT}"><circle cx="${SHORTCUT / 2}" cy="${SHORTCUT / 2}" r="${SHORTCUT / 2}" fill="${primary}"/><svg x="${g / 2}" y="${g / 2}" width="${g}" height="${g}" viewBox="0 -960 960 960"><path d="${glyph(name)}" fill="${onPrimary}"/></svg></svg>`;
  const { png: data } = render(svg);
  const { w, h } = ihdr(data);
  if (w !== SHORTCUT || h !== SHORTCUT) {
    throw new Error(`icons: shortcut ${shortcut} is ${w}x${h}`);
  }
  const file = new URL(`shortcut-${shortcut}-96.png`, outDir);
  await writeFile(file, data);
  console.log(`icons: ${fileURLToPath(file)} (${data.byteLength} bytes)`);
}

// The favicon: the "any" circle as vector, light colours, dark ones under a media query.
// satori writes the colours as `fill="#rrggbb"` attributes; a CSS rule beats an attribute.
const favicon = { size: 64, shape: "circle", text: 0.46 } as const;
let svg = await svgOf(favicon);
for (const colour of [primary, onPrimary]) {
  if (!svg.includes(`fill="${colour}"`)) {
    throw new Error(`icons: favicon.svg has no fill="${colour}" to restyle`);
  }
}
svg = svg.replace(
  /^<svg([^>]*)>/,
  `<svg$1><style>@media (prefers-color-scheme: dark){[fill="${primary}"]{fill:${darkPrimary}}[fill="${onPrimary}"]{fill:${darkOnPrimary}}}</style>`,
);
await writeFile(new URL("favicon.svg", outDir), svg);
console.log(`icons: ${fileURLToPath(new URL("favicon.svg", outDir))}`);

const { png: small } = render(await svgOf({ size: 32, shape: "circle", text: 0.46 }));
await writeFile(new URL("favicon.ico", publicDir), ico(small, 32));
console.log(`icons: ${fileURLToPath(new URL("favicon.ico", publicDir))}`);
