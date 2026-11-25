import { DurableObject } from "cloudflare:workers";
import type { MapNode } from "../components/map-nodes";
import { NODE_KINDS, STALE_MS } from "../components/map-nodes";
import type { LngLat } from "../components/map-url";
import type { NodesMessage } from "./node-schema";

/**
 * `NodeHub`: ONE Durable Object (`getByName("nodes")`, `node-api.server.ts`) that relays REAL
 * devices to every visitor's map (2026-11-24; design and cost math: PLAN.md "Maps NODES layer:
 * live backend"). SQLite-backed (`new_sqlite_classes`, the only kind on Workers Free).
 *
 * - 2026-11-25 (owner: "there should be no dummy device"): the demo fleet and its 3 s alarm are
 *   GONE. The hub only stores and broadcasts what devices report through `ingest()`. With no real
 *   devices it does nothing: no alarm, no writes. The visitor's own device is never sent here (it
 *   lives in their browser, `components/this-device.ts`), so no visitor sees another's location.
 * - REAL nodes are stored, one row each, so they survive eviction. At most `MAX_REAL`; rows older
 *   than `REAL_TTL_MS` are dropped.
 * - Browsers connect with the WebSocket HIBERNATION API (`ctx.acceptWebSocket`): the object is
 *   not billed for duration while it waits between events. They only listen: any message from
 *   a browser closes its socket (the site is read-only).
 * - Sockets older than `SOCKET_LIFETIME_MS` are closed (1000, "reconnect") whenever the hub wakes
 *   for a new socket or a report; the page opens a new one.
 */

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
  private real = new Map<string, MapNode>();
  private trails = new Map<string, LngLat[]>();
  private lastIngest = new Map<string, number>();
  private lastPersist = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
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

  /** Every real node now (stale ones offline), sorted by id. */
  private nodes(now: number): MapNode[] {
    return [...this.real.values()]
      .map((n) =>
        n.online && now - n.ts >= STALE_MS ? { ...n, online: false } : n,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private message(now: number, withTrails: boolean): string {
    const message: NodesMessage = {
      v: 1,
      type: "nodes",
      at: now,
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

  /** Closes sockets older than an hour (stuck or half-open ones; a visible page reconnects). */
  private closeOld(now: number) {
    for (const ws of this.ctx.getWebSockets()) {
      const since = (ws.deserializeAttachment() as { since?: number } | null)
        ?.since;
      if (since !== undefined && now - since > SOCKET_LIFETIME_MS)
        ws.close(1000, "reconnect");
    }
  }

  private broadcast(text: string) {
    this.closeOld(Date.now());
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // Closing or gone: its close event cleans up.
      }
    }
  }

  /** `GET /api/nodes`: every real node now, with trails (first paint, no-JS, the offline copy). */
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
  fetch(request: Request): Response {
    this.closeOld(Date.now());
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
    return new Response(null, { status: 101, webSocket: client });
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
