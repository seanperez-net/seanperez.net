import { z } from "zod";
import type { NodeHub } from "./node-hub.server";
import type { MapNode } from "../components/map-nodes";
import { INGEST_MAX_BYTES, ingestReport, toMapNode } from "./node-schema";
import type { NodesMessage } from "./node-schema";

/**
 * The live nodes' three routes, answered by the Worker BEFORE the Qwik router
 * (`entry.cloudflare-pages.tsx`; QWIK-DEFAULTS.md "live nodes"): Qwik's Cloudflare middleware
 * rebuilds every response as `new Response(readable, { status, headers })`, which drops a 101's
 * `webSocket`, and its `checkOrigin` refuses a POST with no `Origin` header, which is every
 * device's POST. Read in the installed `@qwik.dev/router` 2.0.0-rc.5
 * (`middleware/cloudflare-pages`, `chunks/user-response.mjs` `checkCSRF`).
 *
 * - `GET /api/nodes`: every real node as JSON (`NodesMessage` with trails), kept 5 s in this
 *   data centre's cache (Cache API) so page loads do not each wake the hub.
 * - `GET /api/nodes/live`: a WebSocket to the hub (read-only for visitors).
 * - `POST /api/nodes/ingest`: a device's report (`node-schema.ts`), behind the secret
 *   `NODE_INGEST_TOKEN`. Fails closed: no secret set (or one under 32 characters), no report in.
 *
 * Anything else: `null`, for the Qwik router. Not served under `pnpm dev` (Vite runs the Qwik
 * router only, and `getPlatformProxy` cannot run a Durable Object of this Worker): the page then
 * shows no real devices, only this device (`map-nodes-live.ts`, `this-device.ts`).
 */

const HUB = "nodes";
const SNAPSHOT_TTL_S = 5;
const MIN_TOKEN_LENGTH = 32;

/**
 * The one hub. `wrangler types` reads `main` (`dist/_worker.js`, plain JS) and so cannot name the
 * class: the namespace is typed with it here.
 */
const hub = (env: Env) =>
  (env.NODE_HUB as unknown as DurableObjectNamespace<NodeHub>).getByName(HUB);

const text = (status: number, body: string, headers?: HeadersInit) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });

/** SHA-256 of both, then a constant-time compare (equal lengths, so no length leak). */
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  // Workers-only (developers.cloudflare.com/workers/runtime-apis/web-crypto, "timingSafeEqual");
  // the app's `DOM` lib types `crypto.subtle` without it.
  const subtle = crypto.subtle as unknown as {
    timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean;
  };
  return subtle.timingSafeEqual(a, b);
}

/** The hub's snapshot as JSON; the hub itself answers once per data centre per 5 s. */
export async function nodesSnapshot(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
  url: URL,
): Promise<Response> {
  const cache = await caches.open("spn:nodes");
  const key = new Request(new URL("/api/nodes", url.origin));
  const cached = await cache.match(key);
  if (cached) return cached;
  const body = await hub(env).snapshot();
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${SNAPSHOT_TTL_S}`,
    },
  });
  ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

/**
 * The snapshot's nodes for a server render (`/devices/`), or `null` when the hub cannot be asked
 * in time: under `pnpm dev`, `getPlatformProxy` keeps the binding but cannot run this Worker's
 * own Durable Object (wrangler warns at start), so its calls fail or hang.
 */
export async function readNodesSnapshot(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
  url: URL,
): Promise<MapNode[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      nodesSnapshot(env, ctx, url),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("hub timeout")), 1500);
      }),
    ]);
    const message = (await response.json()) as NodesMessage;
    return Array.isArray(message.nodes) ? message.nodes : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function ingest(request: Request, env: Env): Promise<Response> {
  const secret = env.NODE_INGEST_TOKEN ?? "";
  if (secret.length < MIN_TOKEN_LENGTH)
    return text(503, "Ingest is not configured");
  const auth = request.headers.get("Authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!given || !(await sameSecret(given, secret)))
    return text(401, "Unauthorized", { "WWW-Authenticate": "Bearer" });

  if (!/^application\/json\b/i.test(request.headers.get("Content-Type") ?? ""))
    return text(415, "Send application/json");
  const length = Number(request.headers.get("Content-Length") ?? NaN);
  if (!Number.isFinite(length)) return text(411, "Content-Length required");
  if (length > INGEST_MAX_BYTES) return text(413, "Report too large");
  const raw = await request.text();
  if (raw.length > INGEST_MAX_BYTES) return text(413, "Report too large");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return text(400, "Invalid JSON");
  }
  const parsed = ingestReport.safeParse(json);
  if (!parsed.success)
    return text(400, `Invalid report\n${z.prettifyError(parsed.error)}`);

  const result = await hub(env).ingest(
    toMapNode(parsed.data, Date.now()),
  );
  if (!result.ok) return text(result.status, result.error);
  return new Response(null, { status: 204 });
}

/** A `/api/nodes*` request's response, or `null` for the Qwik router. */
export async function handleNodesApi(
  request: Request,
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== "/api/nodes" && !path.startsWith("/api/nodes/")) return null;

  if (path === "/api/nodes") {
    if (request.method !== "GET" && request.method !== "HEAD")
      return text(405, "Method not allowed", { Allow: "GET" });
    return nodesSnapshot(env, ctx, url);
  }

  if (path === "/api/nodes/live") {
    if (request.method !== "GET")
      return text(405, "Method not allowed", { Allow: "GET" });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return text(426, "Expected a WebSocket upgrade", {
        Upgrade: "websocket",
      });
    // Browsers always send Origin on a WebSocket: another site's page may not use this one's
    // quota. (A non-browser client can omit it; the data is public and read-only anyway.)
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return text(403, "Forbidden");
    return hub(env).fetch(request);
  }

  if (path === "/api/nodes/ingest") {
    if (request.method !== "POST")
      return text(405, "Method not allowed", { Allow: "POST" });
    return ingest(request, env);
  }

  return text(404, "Not found");
}
