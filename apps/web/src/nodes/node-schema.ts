import { z } from "zod";
import { STALE_MS } from "../components/map-nodes";
import type { MapNode, NodeKind } from "../components/map-nodes";
import type { LngLat } from "../components/map-url";

/**
 * The live nodes' wire formats (2026-11-24; design: PLAN.md "Maps NODES layer: live backend").
 * Server only for the zod part: the browser imports the TYPES below with `import type`, so zod
 * never reaches the client bundle.
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

const percent = z.number().min(0).max(100);
const pair = z.tuple([
  z.number().min(-50).max(500),
  z.number().min(0).max(500),
]);

const machineStatus = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("printer"),
    state: z.enum(["idle", "processing", "stopped"]),
    job: z.string().max(120).nullable(),
    pages: z
      .tuple([z.int().min(0).max(100_000), z.int().min(0).max(100_000)])
      .nullable(),
    toner: percent,
  }),
  z.strictObject({
    type: z.literal("printer3d"),
    state: z.enum(["idle", "heating", "printing", "finished"]),
    job: z.string().max(120).nullable(),
    progress: percent,
    nozzle: pair,
    bed: pair,
    secondsLeft: z.number().min(0).max(1e7).nullable(),
  }),
  z.strictObject({
    type: z.literal("cnc"),
    state: z.enum(["Idle", "Run", "Hold"]),
    job: z.string().max(120).nullable(),
    progress: percent,
    spindle: z.number().min(0).max(100_000),
    secondsLeft: z.number().min(0).max(1e7).nullable(),
  }),
]);

export const ingestReport = z.strictObject({
  /** Lower-case letters, digits, `-` `_` `.`; it is also the `?node=` in Maps URLs. */
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]*$/),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(KINDS),
  lngLat: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  heading: z.number().min(0).max(360).nullable().optional(),
  speed: z.number().min(0).max(400).optional(),
  altitude: z.number().min(-500).max(20_000).optional(),
  battery: percent.nullable().optional(),
  online: z.boolean().optional(),
  rssi: z.number().min(-200).max(0).optional(),
  snr: z.number().min(-50).max(50).optional(),
  status: machineStatus.optional(),
  ts: z.int().min(0).optional(),
});

export type IngestReport = z.infer<typeof ingestReport>;

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
