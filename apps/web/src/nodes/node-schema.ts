import * as v from "valibot";
import { STALE_MS } from "../components/map-nodes";
import type { MapNode, NodeKind } from "../components/map-nodes";
import type { LngLat } from "../components/map-url";

/**
 * The live nodes' wire formats (2026-11-24; design: PLAN.md "Maps NODES layer: live backend").
 * Server only for the valibot part: the browser imports the TYPES below with `import type`, so
 * the schema never reaches the client bundle.
 *
 * INGEST (`POST /api/nodes/ingest`, a device or a bridge: an OctoPrint plugin, CNCjs, a The
 * Things Stack webhook relay, Node-RED): ONE report per request, JSON, at most `INGEST_MAX_BYTES`,
 * header `Authorization: Bearer <NODE_INGEST_TOKEN>`. The fields are `MapNode`'s, minus
 * `program` (the hub writes it); `ts` is optional (the hub's clock when absent or in the future);
 * `online` is optional (absent: online while the last report is under `STALE_MS` old). Unknown
 * fields are refused (strict), so a typo is an error, not silently dropped.
 */

export const INGEST_MAX_BYTES = 16 * 1024;

const KINDS = [
  "gateway",
  "sensor",
  "wifi",
  "truck",
  "drone",
  "boat",
  "printer",
  "printer3d",
  "cnc",
] as const satisfies readonly NodeKind[];

/** A bounded number (every bound here also refuses ±Infinity, which `v.number()` lets through). */
const num = (min: number, max: number) =>
  v.pipe(v.number(), v.minValue(min), v.maxValue(max));
/** zod 4's `z.int()` was a SAFE integer (2026-11-25 port). */
const int = (min: number, max: number) =>
  v.pipe(v.number(), v.safeInteger(), v.minValue(min), v.maxValue(max));
const job = v.nullable(v.pipe(v.string(), v.maxLength(120)));
const percent = num(0, 100);
// zod 4's tuples refuse extra items; valibot's `tuple` would drop them: `strictTuple`.
const pair = v.strictTuple([num(-50, 500), num(0, 500)]);

const machineStatus = v.variant("type", [
  v.strictObject({
    type: v.literal("printer"),
    state: v.picklist(["idle", "processing", "stopped"]),
    job,
    pages: v.nullable(v.strictTuple([int(0, 100_000), int(0, 100_000)])),
    toner: percent,
  }),
  v.strictObject({
    type: v.literal("printer3d"),
    state: v.picklist(["idle", "heating", "printing", "finished"]),
    job,
    progress: percent,
    nozzle: pair,
    bed: pair,
    secondsLeft: v.nullable(num(0, 1e7)),
  }),
  v.strictObject({
    type: v.literal("cnc"),
    state: v.picklist(["Idle", "Run", "Hold"]),
    job,
    progress: percent,
    spindle: num(0, 100_000),
    secondsLeft: v.nullable(num(0, 1e7)),
  }),
]);

export const ingestReport = v.strictObject({
  /** Lower-case letters, digits, `-` `_` `.`; it is also the `?node=` in Maps URLs. */
  id: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(64),
    v.regex(/^[a-z0-9][a-z0-9._-]*$/),
  ),
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  kind: v.picklist(KINDS),
  lngLat: v.strictTuple([num(-180, 180), num(-90, 90)]),
  heading: v.optional(v.nullable(num(0, 360))),
  speed: v.optional(num(0, 400)),
  altitude: v.optional(num(-500, 20_000)),
  battery: v.optional(v.nullable(percent)),
  online: v.optional(v.boolean()),
  rssi: v.optional(num(-200, 0)),
  snr: v.optional(num(-50, 50)),
  status: v.optional(machineStatus),
  ts: v.optional(int(0, Number.MAX_SAFE_INTEGER)),
});

export type IngestReport = v.InferOutput<typeof ingestReport>;

/** A valid ingest report as the map's `MapNode` (`now`: the hub's clock). */
export function toMapNode(report: IngestReport, now: number): MapNode {
  const ts = report.ts !== undefined && report.ts <= now ? report.ts : now;
  return {
    id: report.id,
    name: report.name,
    kind: report.kind,
    lngLat: report.lngLat,
    heading: report.heading ?? null,
    speed: report.speed ?? 0,
    ...(report.altitude !== undefined ? { altitude: report.altitude } : {}),
    battery: report.battery ?? null,
    online: report.online ?? now - ts < STALE_MS,
    ...(report.rssi !== undefined ? { rssi: report.rssi } : {}),
    ...(report.snr !== undefined ? { snr: report.snr } : {}),
    ...(report.status ? { status: report.status } : {}),
    ts,
    program: { label: "Live: reported by the device" },
  };
}

/**
 * What the hub sends a browser over `/api/nodes/live`, and what `GET /api/nodes` answers. Every
 * message is EVERY real node (a few KB for ten nodes): no diffs to get out of step. `trails`
 * (the last positions of each moving node) comes with the first message and the snapshot only.
 */
export type NodesMessage = {
  v: 1;
  type: "nodes";
  /** The hub's clock when it was sent (ms since the epoch). */
  at: number;
  nodes: MapNode[];
  trails?: Record<string, LngLat[]>;
};
