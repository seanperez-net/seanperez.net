import { component$ } from "@qwik.dev/core";
import {
  DocumentHeadTags,
  RouterOutlet,
  useLocation,
  useQwikRouter,
} from "@qwik.dev/router";

import { ThemeModeScript } from "@seanperez/ui";

import "./global.css";

export default component$(() => {
  useQwikRouter();
  // Read the URL in the JSX below, not here: a read in the body subscribes the root, and a
  // client navigation would then re-render it (useQwikRouter throws). QWIK-DEFAULTS.md 2026-11-23.
  const loc = useLocation();

  /**
   * This is the root of a QwikRouter site. It contains the document's `<head>` and `<body>`. You can adjust them as you see fit.
   */

  return (
    <>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* The admin is never indexed (also `public/robots.txt`). */}
        <meta name="robots" content="noindex" />

        {/* The saved light / dark mode, applied before first paint (`dark` class on <html>). */}
        <ThemeModeScript />

        <DocumentHeadTags />

        <link rel="canonical" href={loc.url.href} />
      </head>
      <body>
        <RouterOutlet />
      </body>
    </>
  );
});
