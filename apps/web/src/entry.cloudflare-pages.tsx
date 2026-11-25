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
import { handleNodesApi } from "./nodes/node-api.server";

declare global {
  // `Env` is generated from wrangler.jsonc into worker-configuration.d.ts (`pnpm cf-typegen`).
  // `Omit` first: the adapter types `env` as `Record<string, any>`, and intersecting with that
  // would keep every unknown binding name valid.
  type QwikRouterPlatform = Omit<PlatformCloudflareWorkers, "env"> & {
    env: Env;
  };
}

const qwikRouter = createQwikRouter({ render });

/**
 * Departure (QWIK-DEFAULTS.md 2026-11-24, "live nodes"): `/api/nodes*` is answered here, before
 * the Qwik router (WebSocket upgrades and device POSTs; `src/nodes/node-api.server.ts`).
 */
const fetch: typeof qwikRouter = async (request, env, ctx) =>
  (await handleNodesApi(request, env as unknown as Env, ctx)) ??
  qwikRouter(request, env, ctx);

export { fetch };
// The Durable Object class must be exported from the Worker's main module (`public/_worker.js`).
export { NodeHub } from "./nodes/node-hub.server";
