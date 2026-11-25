import { component$ } from "@qwik.dev/core";
import {
  DocumentHeadTags,
  RouterOutlet,
  ServiceWorkerRegister,
  useLocation,
  useQwikRouter,
} from "@qwik.dev/router";

import { ThemeModeScript } from "@seanperez/ui";
// The first screen's two Roboto weights, preloaded so the text does not paint in the fallback font
// and then swap (`font-display: swap`). Same files as the stylesheet's `@font-face`, so the same
// hashed URLs. See QWIK-DEFAULTS.md.
import roboto400 from "@seanperez/ui/fonts/roboto-latin-400-normal.woff2?url";
import roboto500 from "@seanperez/ui/fonts/roboto-latin-500-normal.woff2?url";

import "./global.css";

/**
 * Offline (2026-11-24): with no connection, a click on one of the site's own links becomes a
 * full page load, which the service worker answers (the saved page, or `/offline/`). A client
 * navigation would instead ask the server for the next page's loader data, and the router shows
 * an empty page when that fails (rc.5, `@qwik.dev/router` `chunks/head.qwik.mjs` ~455: "returned
 * empty response"). Capture phase on `window`, so it runs before qwikloader's listener on
 * `document`: stopping the event there leaves the browser's own navigation. Only when the
 * browser says it is offline (`navigator.onLine === false` is reliable; online, nothing
 * changes). Plain inline script like `ThemeModeScript`: it must work before Qwik resumes.
 */
const OFFLINE_LINKS = `addEventListener("click",function(e){if(navigator.onLine||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(a&&!a.target&&!a.hasAttribute("download")&&a.origin===location.origin)e.stopImmediatePropagation()},true)`;

export default component$(() => {
  useQwikRouter();
  // Read the URL in the JSX below, not here: a read in the body subscribes the root, and a
  // client navigation would then re-render it (useQwikRouter throws). See QWIK-DEFAULTS.md.
  const loc = useLocation();

  /**
   * This is the root of a QwikRouter site. It contains the document's `<head>` and `<body>`. You can adjust them as you see fit.
   */

  return (
    <>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* App icons, drawn at build time by `scripts/icons.ts` (sources cited there). The SVG
            follows light / dark itself; `/favicon.ico` is there for clients that ignore links.
            Apple: the link wins over the root lookup (Safari "Configuring Web Applications"). */}
        <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* The browser toolbar's colour: the scaffold's `surface-container`, default light / dark
            (token files `light.css` / `dark.css`). `media` per MDN "theme-color". BEFORE
            `ThemeModeScript`, which rewrites both to the saved theme before paint; the library's
            `syncThemeColorMeta` keeps them in step after a toggle or a new source colour. The
            manifest's `theme_color` stays the brand `primary` (QWIK-DEFAULTS.md, 2026-11-24). */}
        <meta
          name="theme-color"
          content="#ededf4"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#1d2024"
          media="(prefers-color-scheme: dark)"
        />
        <link rel="manifest" href="/manifest.json" />

        <link
          rel="preload"
          href={roboto400}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href={roboto500}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

        <ThemeModeScript />

        <DocumentHeadTags />

        <link rel="canonical" href={loc.url.href} />

        {/* Registers `routes/service-worker.ts` (offline, 2026-11-24; QWIK-DEFAULTS.md). */}
        <ServiceWorkerRegister />
        <script dangerouslySetInnerHTML={OFFLINE_LINKS} />
      </head>
      <body>
        <RouterOutlet />
      </body>
    </>
  );
});
