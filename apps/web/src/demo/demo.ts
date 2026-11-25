/**
 * THE DEMO LAYER SWITCH (owner, 2026-11-24: "the things that are specific for this like the
 * contact me thing make those things known map all the places ... have that be behind some sort
 * of trigger ... its default should be how it is now").
 *
 * The site is the real app (Contacts, Messages, Maps, Devices, the layout) plus a SHOWCASE LAYER
 * that exists only because seanperez.net is the owner's portfolio: the "Contact me" companion
 * (open on every route, the contact form and its Turnstile, the social icon row), the
 * signed-in look (the name; presence left the layer 2026-11-24: it is the visitor's own status,
 * `presence/`), the "This is a demo account" snackbars (`/profile/` Edit left the layer
 * 2026-11-24: its Save is real and local, `profile/profile-local.ts`), the canned
 * assistant reply, and copy that talks to visitors about the demo.
 *
 * Every place the layer touches reads `DEMO` and carries a `DEMO:` comment, so
 * `grep -rn "DEMO:" apps/web/src` lists them. The map (file, what it does, what the app does
 * with the layer off) is `.claude/notes/demo-layer-map-2026-11-24.md` at the workspace root.
 *
 * ON unless the BUILD sets `VITE_DEMO=off`, so the site stays as it is today:
 * - locally: `VITE_DEMO=off pnpm dev` (or a gitignored `apps/web/.env.local` with the line),
 *   then restart the dev server; `VITE_DEMO=off pnpm build` for a built Worker;
 * - production: a Workers Builds BUILD variable `VITE_DEMO` = `off` (Worker > Settings >
 *   Builds > Variables and secrets), then a new build. NOT a `wrangler.jsonc` var: those exist
 *   only at run time, and this is read at build time.
 *
 * Why a build-time constant (second agent, 2026-11-24): it reads the same on the server, in
 * client handlers, in `useSignal` initial values and in the service worker, with no loader to
 * re-export or serialise; Vite replaces it, so the unused branch is dropped from the bundles.
 * A Worker var would avoid a rebuild only on paper: on Workers Builds a var change is a push,
 * which rebuilds anyway. No `?demo=off` query or cookie override: client navigation drops the
 * query, and a cookie would make pages vary per visitor under the service worker's page cache.
 * `import.meta.env` (Vite 8.2.4 `loadEnv`: `VITE_*` from `.env*` files and from `process.env`,
 * the process winning) is the same mechanism `feed/access.server.ts` uses for `DEV`.
 */
export const DEMO: boolean =
  String(import.meta.env.VITE_DEMO ?? "on").toLowerCase() !== "off";
