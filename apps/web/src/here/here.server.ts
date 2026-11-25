import { parseHere, type Here } from "./here";

/**
 * This request's `request.cf` as `Here` (server only). Where `cf` is (VERIFIED in the installed
 * `@qwik.dev/router` 2.0.0-rc.5 `middleware/cloudflare-pages` and wrangler's `getPlatformProxy`,
 * `.claude/notes/contact-accounts-plan-2026-11-25.md` D.2):
 * - production: the adapter's `platform = { request, env, ctx }`, so `platform.request.cf`;
 * - `pnpm dev`: `platform` is the `getPlatformProxy()` object (`vite.config.ts`), so `platform.cf`
 *   (miniflare's copy of the DEVELOPER's own location, or its Austin fallback).
 * Read once, returned, never stored or logged.
 */
export function readHere(platform: unknown): Here {
  const p = (platform ?? {}) as {
    request?: { cf?: unknown };
    cf?: unknown;
  };
  return parseHere(p.request?.cf ?? p.cf);
}
