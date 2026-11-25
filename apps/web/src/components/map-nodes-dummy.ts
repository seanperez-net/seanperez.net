import type { MapNode, NodeSource } from "./map-nodes";
import { createFleet } from "./map-nodes-fleet";
import { routeContext } from "./map-nodes-routes";

export { NODES_CITY } from "./map-nodes-fleet";

/**
 * The DUMMY source: the demo fleet (`map-nodes-fleet.ts`) simulated IN THIS BROWSER. Used when
 * there is no live source to read (`createLiveNodeSource()` in `map-nodes-live.ts` falls back to
 * it: `pnpm dev`, whose Vite server has no Durable Object; offline with no stored snapshot), and
 * for the server render's first reports where the hub cannot be asked.
 *
 * Browser only; one `setInterval` (1 s) that starts with the first subscriber and stops with the
 * last, which also aborts a route request still waiting (the truck's OSRM route, asked once and
 * cached, `map-nodes-routes.ts`). A tick after the tab was hidden (the browser slows timers
 * there) counts as at most 5 s (the fleet's own cap), so nothing jumps across town.
 */

const TICK_MS = 1000;

export function createDummyNodeSource(): NodeSource {
  const fleet = createFleet();
  const listeners = new Set<(nodes: MapNode[]) => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | undefined;

  return {
    snapshot: () => fleet.reports(),
    subscribe(callback) {
      listeners.add(callback);
      if (timer) callback(fleet.reports());
      else {
        controller = new AbortController();
        fleet.start(routeContext(controller.signal));
        // Catch up at once (the gap since a stop counts as at most 5 s, the fleet's cap).
        callback(fleet.step(Date.now()));
        timer = setInterval(() => {
          const reports = fleet.step(Date.now());
          for (const l of listeners) l(reports);
        }, TICK_MS);
      }
      return () => {
        listeners.delete(callback);
        if (listeners.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
          controller?.abort();
        }
      };
    },
  };
}
