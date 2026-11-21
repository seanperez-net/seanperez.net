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
import render from "./entry.ssr";

declare global {
  // `Env` is generated from wrangler.jsonc into worker-configuration.d.ts (`pnpm cf-typegen`).
  // `Omit` first: the adapter types `env` as `Record<string, any>`, and intersecting with that
  // would keep every unknown binding name valid.
  type QwikRouterPlatform = Omit<PlatformCloudflareWorkers, "env"> & {
    env: Env;
  };
}

const fetch = createQwikRouter({ render });

export { fetch };
