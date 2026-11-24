/**
 * Draws one Open Graph card per route in `src/pages.ts` into `public/og/` (1200 x 630 PNG),
 * with satori (element tree -> SVG, text as paths) and resvg (SVG -> PNG). Run by the root
 * `pnpm build` before the app build, so Vite copies the cards into `dist/` and every deploy
 * (Workers Builds included) has them. `public/og/` is build output, not committed; under
 * `pnpm dev` the cards 404 until `pnpm --filter @seanperez/web og` has run once.
 *
 * Pattern from e-store's `packages/og` (`render.ts`, `node.ts`): a plain element tree, no JSX;
 * the resvg wasm read from disk; system fonts off, since satori has already turned the text into
 * paths. The colours are the UI library's light Material 3 roles, read from its token file, and
 * the font is the library's own Roboto (satori 0.63 reads WOFF2), so the card follows the theme.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import satori from "satori";
import {
  OG_HEIGHT,
  OG_WIDTH,
  PAGES,
  SITE_HOST,
  SITE_NAME,
  ogImageSrc,
  type PageMeta,
} from "../src/pages.ts";

const app = new URL("../", import.meta.url);
const outDir = new URL("public/og/", app);

// The library's token entry (`@seanperez/ui/tokens` -> src/tokens/tokens.css) locates its
// colour and font files.
const tokens = new URL(import.meta.resolve("@seanperez/ui/tokens"));

/** The roles the card uses. */
const ROLES = [
  "surface",
  "surface-container",
  "primary",
  "primary-container",
  "on-primary-container",
  "on-surface",
  "on-surface-variant",
] as const;

/** The light scheme's colour roles, from `--color-<role>: rgb(r g b);` lines. */
async function lightColors(): Promise<Record<string, string>> {
  const css = await readFile(new URL("color/light.css", tokens), "utf8");
  const roles: Record<string, string> = {};
  for (const [, role, r, g, b] of css.matchAll(
    /--color-([a-z-]+):\s*rgb\((\d+) (\d+) (\d+)\)/g,
  )) {
    roles[role!] = `rgb(${r}, ${g}, ${b})`;
  }
  // A changed token format must fail the build, not draw an unthemed card.
  for (const role of ROLES) {
    if (!roles[role])
      throw new Error(`og: --color-${role} not found in light.css`);
  }
  return roles;
}

const fontFile = (weight: 400 | 500) =>
  new URL(`typeface/fonts/roboto-latin-${weight}-normal.woff2`, tokens);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** satori's element shape (React-element-like, built by hand as in e-store's `vdom.ts`). */
interface El {
  type: "div";
  props: {
    style: Record<string, string | number>;
    children?: (El | string)[] | string;
  };
}
const div = (
  style: El["props"]["style"],
  children?: El["props"]["children"],
): El => ({
  type: "div",
  props: { style, children },
});

/**
 * The card, after the GitHub Pages page's `og-image.svg`: a `surface` card with extra-large
 * corners (28px) on `surface-container`; a header row with the initials in a `primary-container`
 * circle and the host in `primary`; then the title and one line under it, each cut to two lines.
 * Sized so the longest text still fits: 96 + 24 + 2 x 88 + 16 + 2 x 52 = 416px of the card's
 * 418px inner height. Text is only ever a string child, which satori escapes.
 */
function card(page: PageMeta, c: Record<string, string>): El {
  const clamp = { display: "block", lineClamp: 2 } as const;
  return div(
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      display: "flex",
      backgroundColor: c["surface-container"]!,
      fontFamily: "Roboto",
    },
    [
      div(
        {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flexGrow: 1,
          gap: 24,
          // An inset, not padding on the root: satori adds a root's padding to its size.
          margin: 48,
          padding: 58,
          borderRadius: 28,
          backgroundColor: c["surface"]!,
        },
        [
          div({ display: "flex", alignItems: "center", gap: 24 }, [
            div(
              {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 96,
                height: 96,
                flexShrink: 0,
                borderRadius: 48,
                backgroundColor: c["primary-container"]!,
                color: c["on-primary-container"]!,
                fontSize: 40,
                fontWeight: 500,
              },
              initials(SITE_NAME),
            ),
            div({ fontSize: 32, color: c["primary"]! }, SITE_HOST),
          ]),
          div({ display: "flex", flexDirection: "column", gap: 16 }, [
            div(
              {
                ...clamp,
                fontSize: 80,
                fontWeight: 500,
                lineHeight: 1.1,
                color: c["on-surface"]!,
              },
              page.title,
            ),
            div(
              {
                ...clamp,
                fontSize: 40,
                lineHeight: 1.3,
                color: c["on-surface-variant"]!,
              },
              page.card ?? page.description,
            ),
          ]),
        ],
      ),
    ],
  );
}

/** Width and height from the PNG's IHDR chunk. */
const pngSize = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
};

const require = createRequire(import.meta.url);
await initWasm(
  await readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm")),
);
const [colors, regular, medium] = await Promise.all([
  lightColors(),
  readFile(fontFile(400)),
  readFile(fontFile(500)),
]);
const fonts = [
  { name: "Roboto", data: regular, weight: 400, style: "normal" },
  { name: "Roboto", data: medium, weight: 500, style: "normal" },
] as const;

async function render(page: PageMeta): Promise<Uint8Array> {
  const svg = await satori(
    card(page, colors) as unknown as Parameters<typeof satori>[0],
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [...fonts],
    },
  );
  const resvg = new Resvg(svg, {
    font: { loadSystemFonts: false },
  });
  const image = resvg.render();
  try {
    return image.asPng();
  } finally {
    image.free();
    resvg.free();
  }
}

await rm(outDir, { recursive: true, force: true });
for (const [path, page] of Object.entries(PAGES) as [string, PageMeta][]) {
  const file = new URL(`.${ogImageSrc(path).replace(/^\/og/, "")}`, outDir);
  const png = await render(page);
  const [w, h] = pngSize(png);
  if (w !== OG_WIDTH || h !== OG_HEIGHT) {
    throw new Error(`og: ${path} is ${w}x${h}, not ${OG_WIDTH}x${OG_HEIGHT}`);
  }
  await mkdir(new URL("./", file), { recursive: true });
  await writeFile(file, png);
  console.log(
    `og: ${path} -> ${fileURLToPath(file)} (${png.byteLength} bytes)`,
  );
}
