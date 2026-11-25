/*
 * WHAT IS THIS FILE?
 *
 * It's the entry point for Cloudflare Workers when building for production.
 *
 * Learn more about the Cloudflare Workers integration here:
 * - https://qwik.dev/docs/deployments/cloudflare-workers/
 *
 */
import {
  createQwikRouter,
  type PlatformCloudflarePages as PlatformCloudflareWorkers,
} from "@qwik.dev/router/middleware/cloudflare-pages";
import {
  ADMIN_SECURITY_HEADERS,
  withSecurityHeaders,
} from "@seanperez/server/http/security-headers";
import render from "./entry.ssr";

declare global {
  // `Env` is generated from wrangler.jsonc into worker-configuration.d.ts (`pnpm cf-typegen`).
  // `Omit` first: the adapter types `env` as `Record<string, any>`, and intersecting with that
  // would keep every unknown binding name valid (QWIK-DEFAULTS.md, as apps/web).
  type QwikRouterPlatform = Omit<PlatformCloudflareWorkers, "env"> & {
    env: Env;
  };
}

const qwikRouter = createQwikRouter({ render });

/**
 * Departure (QWIK-DEFAULTS.md 2026-11-25, "security headers"): every Worker response gets the
 * security headers (the page's own `Cache-Control: private, no-store` from `routes/layout.tsx`
 * is kept). Assets served before the Worker get them from `public/_headers`.
 */
const fetch: typeof qwikRouter = async (request, env, ctx) =>
  withSecurityHeaders(
    await qwikRouter(request, env, ctx),
    ADMIN_SECURITY_HEADERS,
  );

export { fetch };
