import { readPref, writePref } from "../local-store";
import { fetchRouteThrough } from "./map-services";
import type { ProgramContext } from "./map-nodes-programs";
import type { LngLat, TravelMode } from "./map-url";

/**
 * Road routes for the dummy nodes' programs, polite to the public OSRM server (FOSSGIS: "One
 * request per second max", `map-services.ts`): ONE request per vehicle for its whole loop, a
 * queue that keeps requests at least 1.1 s apart, the answer kept in this browser (`local-store.ts`, so a reload
 * asks nothing), and no retry: an error or a 429 means the bundled copy for this page's life.
 * Never per tick. New, not in e-store.
 */

/** `spn.v1.maps.nodeRoutes`. The Berlin routes (before 2026-11-24) were under other keys. */
const CACHE_NAME = "maps.nodeRoutes";
const GAP_MS = 1100;
/** Kept routes (oldest dropped first); a few vehicles need a few. */
const MAX_ROUTES = 6;

type Cache = Record<string, { at: number; line: LngLat[] }>;

function readCache(): Cache {
  return (
    readPref(CACHE_NAME, (raw) =>
      raw && typeof raw === "object" ? (raw as Cache) : null,
    ) ?? {}
  );
}

function writeCache(cache: Cache) {
  const kept = Object.entries(cache)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, MAX_ROUTES);
  // Storage full or blocked: not kept, the route still works now.
  writePref(CACHE_NAME, Object.fromEntries(kept));
}

/** 5 decimals (about 1 m), to keep the stored line small. */
const trim = ([lng, lat]: LngLat): LngLat => [
  Math.round(lng * 1e5) / 1e5,
  Math.round(lat * 1e5) / 1e5,
];

const keyOf = (stops: LngLat[], mode: TravelMode) =>
  `${mode}:${stops.map((p) => trim(p).join(",")).join(";")}`;

/** The queue's tail: each request starts 1.1 s after the previous one started. */
let queue: Promise<unknown> = Promise.resolve();

/** A `ProgramContext` whose requests stop when `signal` aborts (leaving /maps/). */
export function routeContext(signal: AbortSignal): ProgramContext {
  return {
    route(stops, mode) {
      const key = keyOf(stops, mode);
      const cached = readCache()[key];
      if (cached && Array.isArray(cached.line) && cached.line.length > 1)
        return Promise.resolve(cached.line);
      const turnInQueue = queue.then(
        () => new Promise((resolve) => setTimeout(resolve, GAP_MS)),
      );
      const result = queue.then(async () => {
        if (signal.aborted) return null;
        try {
          const route = await fetchRouteThrough(stops, mode, signal, {
            steps: false,
            radius: 200,
            straight: true,
          });
          const line = route.coordinates.map(trim);
          writeCache({ ...readCache(), [key]: { at: Date.now(), line } });
          return line;
        } catch {
          return null;
        }
      });
      queue = turnInQueue;
      return result;
    },
  };
}
