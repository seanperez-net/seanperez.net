/**
 * `node scripts/node-ingest-demo.ts [base-url] [steps]`: POSTs a few fake reports to the live
 * nodes' ingest route, for testing and as the TEMPLATE a real bridge follows (an OctoPrint
 * plugin, CNCjs, a The Things Stack webhook relay, Node-RED: each turns its own message into
 * this shape and POSTs it). Message shape and auth: `src/nodes/node-schema.ts`, PLAN.md
 * "Maps NODES layer: live backend".
 *
 * Default base URL: `http://localhost:8799` (`wrangler dev --port 8799` on the built worker;
 * `pnpm dev` has no Durable Object). The token is `NODE_INGEST_TOKEN` from the environment, else
 * from `.dev.vars`. NEVER point this at the live site with the production token from a shared
 * machine: the token is a secret.
 *
 * It drives one TEST tracker, `test-bridge-1`, along a short line in San Francisco (an arbitrary
 * place), one report every 5 s (the hub refuses faster: one report every 5 s per node). Local
 * testing only: the site has no made-up devices (2026-11-25), and the hub drops a node a day after
 * its last report.
 */
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:8799";
const steps = Number(process.argv[3] ?? 12);
const GAP_MS = 5200;

function token(): string {
  if (process.env.NODE_INGEST_TOKEN) return process.env.NODE_INGEST_TOKEN;
  const vars = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8");
  const line = vars.split("\n").find((l) => l.startsWith("NODE_INGEST_TOKEN="));
  if (!line)
    throw new Error("NODE_INGEST_TOKEN is not in the environment or .dev.vars");
  return line.slice("NODE_INGEST_TOKEN=".length).trim();
}

/** A short straight line (Market Street, San Francisco), then back. */
const LINE: [number, number][] = [
  [-122.3949, 37.7946],
  [-122.3990, 37.7914],
  [-122.4031, 37.7881],
  [-122.4072, 37.7849],
];

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** Where the tracker is at step `i` (along the line and back, a little each step). */
function at(i: number): { lngLat: [number, number]; heading: number } {
  const legs = LINE.length - 1;
  const t = (i / 4) % (2 * legs);
  const forward = t < legs;
  const u = forward ? t : 2 * legs - t;
  const k = Math.min(legs - 1, Math.floor(u));
  const f = u - k;
  const [a, b] = [LINE[k], LINE[k + 1]];
  return {
    lngLat: [lerp(a[0], b[0], f), lerp(a[1], b[1], f)],
    heading: forward ? 170 : 350,
  };
}

async function post(report: unknown, secret: string): Promise<number> {
  const response = await fetch(new URL("/api/nodes/ingest", base), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(report),
  });
  const body = response.status === 204 ? "" : await response.text();
  console.log(`${response.status} ${body}`.trim());
  return response.status;
}

const secret = token();
for (let i = 0; i < steps; i++) {
  const { lngLat, heading } = at(i);
  await post(
    {
      id: "test-bridge-1",
      name: "Bridge tracker 1",
      kind: "truck",
      lngLat,
      heading,
      speed: 6,
      battery: 90 - i * 0.5,
      ts: Date.now(),
    },
    secret,
  );
  if (i < steps - 1) await new Promise((r) => setTimeout(r, GAP_MS));
}
