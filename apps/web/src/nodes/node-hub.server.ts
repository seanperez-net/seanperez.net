import { DurableObject } from "cloudflare:workers";
import type { MapNode } from "../components/map-nodes";
import { NODE_KINDS, STALE_MS } from "../components/map-nodes";
import { createFleet } from "../components/map-nodes-fleet";
import type { Fleet } from "../components/map-nodes-fleet";
import type { LngLat } from "../components/map-url";
import type { NodesMessage } from "./node-schema";

/**
 * `NodeHub`: ONE Durable Object (`getByName("fleet")`, `node-api.ts`) that every visitor's map
 * reads, so all of them see the SAME nodes moving (2026-11-24; design and cost math: PLAN.md
 * "Maps NODES layer: live backend"). SQLite-backed (`new_sqlite_classes`, the only kind on
 * Workers Free).
 *
 * - The DEMO fleet runs HERE, in memory (`createFleet()`, the same programs as the browser's
 *   dummy). The truck drives the bundled copy of its OSRM route: the hub never calls OSRM.
 *   Lost when the object is evicted (nobody watching for a while); it starts again from its
 *   first positions. Nothing of it is stored.
 * - REAL nodes (from `ingest()`) are stored, one row each, so they survive eviction; a real node
 *   with a demo node's id replaces it on the map. At most `MAX_REAL` real nodes; rows older
 *   than `REAL_TTL_MS` are dropped.
 * - Browsers connect with the WebSocket HIBERNATION API (`ctx.acceptWebSocket`): the object is
 *   not billed for duration while it waits between events. They only listen: any message from
 *   a browser closes its socket (the demo is read-only).
 * - TIME is ONE alarm, every `TICK_MS`, armed when a socket connects and re-armed by each tick
 *   only while a socket is still open. No sockets: no alarm, the object goes idle, then away.
 */

/** One tick every 3 s while someone watches (the map glides between ticks; cost: PLAN.md). */
export const TICK_MS = 3000;
const TRAIL_LENGTH = 30;
const MAX_SOCKETS = 500;
/** Sockets per visitor IP (`CF-Connecting-IP`, a tag in memory only, never stored). */
const MAX_SOCKETS_PER_IP = 6;
/** A socket is closed after this (1000, "reconnect"); the page opens a new one. */
const SOCKET_LIFETIME_MS = 60 * 60 * 1000;
const MAX_REAL = 50;
const REAL_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * One report every 5 s per node at most, and its row rewritten at most once a minute: the
 * Workers Free quotas are 100,000 requests and 100,000 rows written a day (PLAN.md cost math).
 */
const INGEST_GAP_MS = 5000;
const PERSIST_GAP_MS = 60 * 1000;

/** Where a node has been: moving kinds only (trackers, drones and boats). */
const moves = (n: MapNode) => {
  const group = NODE_KINDS[n.kind].group;
  return group === "tracker" || group === "drone";
};

export type IngestResult =
  | { ok: true }
  | { ok: false; status: 429 | 507; error: string };

type RealRow = { id: string; report: string; trail: string; at: number };

export class NodeHub extends DurableObject<Env> {
  private fleet: Fleet;
  private real = new Map<string, MapNode>();
  private trails = new Map<string, LngLat[]>();
  private lastIngest = new Map<string, number>();
  private lastPersist = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.fleet = createFleet();
    // No route context: the truck keeps its bundled road line (`roadLoop`'s fallback).
    this.fleet.start({ route: () => Promise.resolve(null) });
    const sql = ctx.storage.sql;
    // Schema only (synchronous SQL; nothing to await).
    sql.exec(
      `CREATE TABLE IF NOT EXISTS real_node (
        id TEXT PRIMARY KEY, report TEXT NOT NULL, trail TEXT NOT NULL, at INTEGER NOT NULL
      )`,
    );
    this.prune();
    for (const row of sql
      .exec<RealRow>("SELECT id, report, trail, at FROM real_node")
      .toArray()) {
      this.real.set(row.id, JSON.parse(row.report) as MapNode);
      this.trails.set(row.id, JSON.parse(row.trail) as LngLat[]);
    }
  }

  /** Drops real nodes not heard from in a day (on start and when the cap is reached). */
  private prune() {
    const before = Date.now() - REAL_TTL_MS;
    this.ctx.storage.sql.exec("DELETE FROM real_node WHERE at < ?", before);
    for (const [id, n] of this.real)
      if (n.ts < before) {
        this.real.delete(id);
        this.trails.delete(id);
      }
  }

  /** Every node now: the demo fleet with the real nodes over it (same id) or after it. */
  private nodes(now: number): MapNode[] {
    const real = [...this.real.values()].map((n) =>
      n.online && now - n.ts >= STALE_MS ? { ...n, online: false } : n,
    );
    const byId = new Map(real.map((n) => [n.id, n]));
    const demo = this.fleet
      .reports()
      .map((n) => byId.get(n.id) ?? n)
      .filter((n) => !this.real.has(n.id) || byId.get(n.id) === n);
    const demoIds = new Set(demo.map((n) => n.id));
    return [
      ...demo,
      ...real
        .filter((n) => !demoIds.has(n.id))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ];
  }

  private message(now: number, withTrails: boolean): string {
    const message: NodesMessage = {
      v: 1,
      type: "nodes",
      at: now,
      tickMs: TICK_MS,
      nodes: this.nodes(now),
      ...(withTrails ? { trails: Object.fromEntries(this.trails) } : {}),
    };
    return JSON.stringify(message);
  }

  private remember(node: MapNode) {
    if (!moves(node)) return;
    const points = this.trails.get(node.id) ?? [];
    const last = points[points.length - 1];
    if (last?.[0] === node.lngLat[0] && last[1] === node.lngLat[1]) return;
    points.push(node.lngLat);
    if (points.length > TRAIL_LENGTH) points.shift();
    this.trails.set(node.id, points);
  }

  private broadcast(text: string) {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // Closing or gone: its close event cleans up.
      }
    }
  }

  /** `GET /api/nodes`: the fleet now, with trails (first paint, no-JS, the offline copy). */
  snapshot(): string {
    return this.message(Date.now(), true);
  }

  /** `POST /api/nodes/ingest` (already authenticated and validated by the Worker). */
  ingest(node: MapNode): IngestResult {
    const now = Date.now();
    const last = this.lastIngest.get(node.id) ?? 0;
    if (now - last < INGEST_GAP_MS)
      return { ok: false, status: 429, error: "one report every 5 s per node" };
    if (!this.real.has(node.id) && this.real.size >= MAX_REAL) {
      this.prune();
      if (this.real.size >= MAX_REAL)
        return { ok: false, status: 507, error: "too many nodes" };
    }
    this.lastIngest.set(node.id, now);
    this.remember(node);
    // A new node is stored at once; a known one at most once a minute (an eviction in between
    // loses under a minute of its reports, and the next report brings it back up to date).
    if (now - (this.lastPersist.get(node.id) ?? 0) >= PERSIST_GAP_MS) {
      this.lastPersist.set(node.id, now);
      this.ctx.storage.sql.exec(
        `INSERT INTO real_node (id, report, trail, at) VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET report = excluded.report, trail = excluded.trail, at = excluded.at`,
        node.id,
        JSON.stringify(node),
        JSON.stringify(this.trails.get(node.id) ?? []),
        now,
      );
    }
    this.real.set(node.id, node);
    this.broadcast(this.message(now, false));
    return { ok: true };
  }

  /** `GET /api/nodes/live` (the Worker checked the upgrade and the origin). */
  async fetch(request: Request): Promise<Response> {
    const ip = `ip:${request.headers.get("CF-Connecting-IP") ?? "unknown"}`;
    if (
      this.ctx.getWebSockets().length >= MAX_SOCKETS ||
      this.ctx.getWebSockets(ip).length >= MAX_SOCKETS_PER_IP
    )
      return new Response("Too many viewers, try again later", { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [ip]);
    server.serializeAttachment({ since: Date.now() });
    server.send(this.message(Date.now(), true));
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
      console.log("node-hub: ticking (a viewer connected)");
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm(): Promise<void> {
    if (this.ctx.getWebSockets().length === 0) {
      console.log("node-hub: stopped ticking (no viewers)");
      return;
    }
    const now = Date.now();
    try {
      // Sockets older than an hour are closed (a visible page reconnects at once): stuck or
      // half-open connections, and clients that never close, do not keep the hub ticking.
      for (const ws of this.ctx.getWebSockets()) {
        const since = (ws.deserializeAttachment() as { since?: number } | null)
          ?.since;
        if (since !== undefined && now - since > SOCKET_LIFETIME_MS)
          ws.close(1000, "reconnect");
      }
      for (const node of this.fleet.step(now)) this.remember(node);
      this.broadcast(this.message(now, false));
    } finally {
      // Re-armed even if a step threw: an alarm that throws is retried, a missing one stops.
      await this.ctx.storage.setAlarm(now + TICK_MS);
    }
  }

  /** Visitors only listen: anything they send closes their socket. */
  webSocketMessage(ws: WebSocket): void {
    ws.close(1008, "read-only");
  }

  /** Completes the close handshake (compatibility_date 2025-12-28 predates auto-reply). */
  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    try {
      if (
        code >= 1000 &&
        code < 5000 &&
        ![1004, 1005, 1006, 1015].includes(code)
      )
        ws.close(code, reason);
      else ws.close();
    } catch {
      // Already closed.
    }
  }

  webSocketError(ws: WebSocket): void {
    try {
      ws.close(1011, "error");
    } catch {
      // Already closed.
    }
  }
}
