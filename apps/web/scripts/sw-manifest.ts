/**
 * Vite plugin: writes this build's file list and a version into `service-worker.js`
 * (`src/routes/service-worker.ts` reads it as `JSON.parse("__SPN_SW_MANIFEST__")`).
 *
 * Why: Qwik Router rc.5 bundles `routes/service-worker.ts` but gives it no list of the build's
 * files (read in `@qwik.dev/router/lib/vite/index.mjs` ~1205-1345), and a worker whose bytes do
 * not change is never reinstalled, so a new build would not reach visitors. Logged in
 * QWIK-DEFAULTS.md (2026-11-24, offline).
 *
 * Runs in the client build only, in `generateBundle` with `order: "post"`: after the router has
 * bundled and named the worker and after Qwik has emitted its bundle graph (`assets/*-bundle-
 * graph.json`, `vite-plugin-qwik-post`), so the list is complete. List it after `qwikVite()`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** Any quote: the client minifier writes string literals as template literals (`` `...` ``). */
const PLACEHOLDER = /(["'`])__SPN_SW_MANIFEST__\1/g;
/** Public files the worker stores; their bytes go into the version so a change reaches it. */
// The icons are drawn by `scripts/icons.ts` before this build (root `pnpm build`).
const PUBLIC_FILES = [
  "manifest.json",
  "favicon.ico",
  "icons/favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/icon-monochrome-512.png",
  "icons/shortcut-contacts-96.png",
  "icons/shortcut-maps-96.png",
];

export function swManifest(): Plugin {
  return {
    name: "spn-sw-manifest",
    apply: "build",
    // `enforce` AND `order`: Qwik's `vite-plugin-qwik-post` is itself `enforce: "post"` with a
    // `post` generateBundle; among post plugins the array order decides, so list this one last.
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        if (this.environment.config.consumer !== "client") return;
        const worker = bundle["service-worker.js"];
        if (!worker || worker.type !== "chunk") {
          this.error("service-worker.js is not in the client build");
        }
        const files = Object.keys(bundle)
          .filter(
            (name) =>
              (name.startsWith("build/") || name.startsWith("assets/")) &&
              !name.endsWith(".map"),
          )
          .sort();
        const hash = createHash("sha256").update(files.join("\n"));
        const publicDir = this.environment.config.publicDir;
        for (const file of PUBLIC_FILES) {
          hash.update(readFileSync(resolve(publicDir, file)));
        }
        const version = hash.digest("hex").slice(0, 12);
        const found = worker.code.match(PLACEHOLDER)?.length ?? 0;
        if (found !== 1) {
          this.error(
            `service-worker.js: expected the manifest placeholder once, found it ${found} times`,
          );
        }
        // A JSON string inside a JS string literal: `JSON.parse("...")` in the worker.
        worker.code = worker.code.replace(
          PLACEHOLDER,
          JSON.stringify(JSON.stringify({ version, files })),
        );
      },
    },
  };
}
