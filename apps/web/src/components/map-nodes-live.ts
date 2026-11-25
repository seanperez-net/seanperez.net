import type { NodesMessage } from "../nodes/node-schema";
import { STALE_MS } from "./map-nodes";
import type { MapNode, NodeSource } from "./map-nodes";
import type { LngLat } from "./map-url";

/**
 * The LIVE node source (2026-11-24): the `NodeHub` Durable Object, the same REAL devices for
 * every visitor (PLAN.md "Maps NODES layer: live backend"). Browser only. Since 2026-11-25 there
 * is no demo fleet behind it: with no real device reporting it has no nodes, and the map shows
 * only this device (`this-device.ts`, `withThisDevice`). Roles:
 *
 * - THIS PAGE holds the stream: one WebSocket to `/api/nodes/live` while the tab is visible. A
 *   service worker cannot (the WebSocket spec opens connections with service-workers mode
 *   "none", so it never sees them, and the browser may stop an idle service worker at any time);
 *   its job is the offline copy of `GET /api/nodes` (`routes/service-worker.ts`).
 * - MapLibre's web worker only re-tiles what `map-view.tsx` hands it with one `setData` per
 *   update; drawing is WebGL on the main thread. Neither talks to the network for nodes.
 *
 * What it shows, in order of preference: the hub's live messages; until the first one, the
 * `/api/nodes` snapshot (from the network, or the service worker's copy when offline); when the
 * socket is down, the last data it had, with nodes not heard from in `STALE_MS` shown offline;
 * when there is no data at all (`pnpm dev`, whose Vite server has no Durable Object; offline
 * before any visit), no nodes.
 *
 * Reconnects with backoff (2 s doubling to 60 s, with jitter, so a hub restart does not bring
 * every tab back at once); closes the socket while the tab is hidden and opens it again when it
 * is shown (a hidden tab costs the free plan nothing). Messages from the hub carry every node;
 * this source never sends any (the hub closes a socket that does).
 */

const FIRST_MESSAGE_MS = 5000;
const BACKOFF_MIN_MS = 2000;
const BACKOFF_MAX_MS = 60_000;

const isNodesMessage = (value: unknown): value is NodesMessage =>
  !!value &&
  typeof value === "object" &&
  (value as NodesMessage).v === 1 &&
  (value as NodesMessage).type === "nodes" &&
  Array.isArray((value as NodesMessage).nodes);

/** Nodes not heard from in `STALE_MS` as offline (shown while there is no live stream). */
const aged = (nodes: MapNode[], now: number) =>
  nodes.map((n) =>
    n.online && now - n.ts >= STALE_MS ? { ...n, online: false } : n,
  );

export function createLiveNodeSource(): NodeSource {
  const listeners = new Set<(nodes: MapNode[]) => void>();
  let reports: MapNode[] = [];
  let trails: Record<string, LngLat[]> = {};
  /** Live data has arrived on the current socket. */
  let live = false;
  let socket: WebSocket | null = null;
  let firstTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let snapshotAsked = false;

  const emit = (nodes: MapNode[]) => {
    reports = nodes;
    for (const l of listeners) l(nodes);
  };

  const accept = (message: NodesMessage, isLive: boolean) => {
    if (message.trails) trails = message.trails;
    if (isLive) {
      live = true;
      attempts = 0;
      emit(message.nodes);
    } else if (!live) {
      emit(aged(message.nodes, Date.now()));
    }
  };

  /** No live stream: the last data we had (aged), or no nodes. */
  function noStream() {
    emit(aged(reports, Date.now()));
  }

  async function askSnapshot() {
    if (snapshotAsked) return;
    snapshotAsked = true;
    try {
      const response = await fetch("/api/nodes", {
        headers: { Accept: "application/json" },
      });
      const type = response.headers.get("Content-Type") ?? "";
      if (!response.ok || !type.includes("application/json"))
        throw new Error("no snapshot");
      const message: unknown = await response.json();
      if (!isNodesMessage(message)) throw new Error("no snapshot");
      if (listeners.size) accept(message, false);
    } catch {
      // Dev server (no hub), or offline with no stored copy.
      if (listeners.size && !live) noStream();
    }
  }

  function clearTimers() {
    clearTimeout(firstTimer);
    clearTimeout(retryTimer);
    firstTimer = retryTimer = undefined;
  }

  function retry(delay?: number) {
    clearTimeout(retryTimer);
    const backoff = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** attempts);
    attempts++;
    const wait = delay ?? backoff * (0.5 + Math.random() * 0.5);
    retryTimer = setTimeout(connect, wait);
  }

  function connect() {
    if (socket || !listeners.size || document.visibilityState === "hidden")
      return;
    const url = new URL("/api/nodes/live", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      noStream();
      retry();
      return;
    }
    socket = ws;
    live = false;
    firstTimer = setTimeout(() => {
      // Open but silent (or never answering, as a dev server's socket does): give up on it.
      if (socket === ws && !live) ws.close();
    }, FIRST_MESSAGE_MS);
    ws.addEventListener("message", (event) => {
      if (socket !== ws || typeof event.data !== "string") return;
      let message: unknown;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isNodesMessage(message)) return;
      clearTimeout(firstTimer);
      accept(message, true);
    });
    ws.addEventListener("close", (event) => {
      if (socket !== ws) return;
      socket = null;
      clearTimeout(firstTimer);
      // The hub's hourly "reconnect": straight back (a little jitter), not a failure.
      const reconnectNow = event.code === 1000 && event.reason === "reconnect";
      const hadLive = live;
      live = false;
      if (!listeners.size || document.visibilityState === "hidden") return;
      if (!reconnectNow) noStream();
      if (reconnectNow || hadLive) attempts = 0;
      retry(reconnectNow ? Math.random() * 1000 : undefined);
    });
  }

  function disconnect() {
    clearTimers();
    const ws = socket;
    socket = null;
    live = false;
    ws?.close(1000, "hidden");
  }

  function onVisibility() {
    if (document.visibilityState === "hidden") disconnect();
    else {
      attempts = 0;
      connect();
    }
  }

  return {
    snapshot: () => reports,
    trails: () => trails,
    subscribe(callback) {
      listeners.add(callback);
      if (reports.length) callback(reports);
      if (listeners.size === 1) {
        document.addEventListener("visibilitychange", onVisibility);
        snapshotAsked = false;
        void askSnapshot();
        connect();
      }
      return () => {
        listeners.delete(callback);
        if (listeners.size) return;
        document.removeEventListener("visibilitychange", onVisibility);
        disconnect();
      };
    },
  };
}
