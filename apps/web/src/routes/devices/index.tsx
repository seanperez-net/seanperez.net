import { component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { Layout, List } from "@seanperez/ui";
import { createDummyNodeSource } from "../../components/map-nodes-dummy";
import { createLiveNodeSource } from "../../components/map-nodes-live";
import {
  NODE_KINDS,
  formatAgo,
  statusLine,
  type MapNode,
} from "../../components/map-nodes";
import { DEMO } from "../../demo/demo";
import { readNodesSnapshot } from "../../nodes/node-api.server";
import { pageHead } from "../../seo";

/**
 * The fleet's reports for the server render (and for a visitor without JavaScript): the live
 * hub's snapshot (through the same 5 s cache as `GET /api/nodes`), or, where the hub cannot be
 * asked (`pnpm dev`: no Durable Object there), the dummy fleet's first reports (creating it
 * touches no browser API; its programs start only on `subscribe`).
 */
export const useDeviceSnapshot = routeLoader$(
  async ({ platform, url }) =>
    (await readNodesSnapshot(platform.env, platform.ctx, url)) ??
    createDummyNodeSource().snapshot(),
);

/** "Online · Battery 80% · now · Road loop: 4 stops by OSRM" */
function detail(node: MapNode, now: number) {
  return [
    node.online ? "Online" : "Offline",
    ...(node.status ? [statusLine(node.status)] : []),
    node.battery === null
      ? "Mains power"
      : `Battery ${Math.round(node.battery)}%`,
    `Last seen ${formatAgo(node.ts, now)}`,
    node.program.label,
  ].join(" · ");
}

/**
 * Devices (owner, 2026-11-24: "I assume we would need a devices in the user account menu"): the
 * account's "your devices" screen. The devices ARE the Maps nodes (the dummy fleet, one of each
 * kind, `components/map-nodes-fleet.ts`, run by the live hub), read-only: no add, pair or remove yet. Each row opens
 * Maps on that node (`/maps/?node=<id>`: selected, the Nodes panel open). New, not in e-store.
 *
 * Live in the browser: the same `NodeSource` the map uses (`map-nodes-live.ts`), started here
 * while the page is open and stopped on leaving (its unsubscribe closes the socket).
 */
export default component$(() => {
  const snapshot = useDeviceSnapshot();
  const nodes = useSignal<MapNode[] | null>(null);
  const now = useSignal(0);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const source = createLiveNodeSource();
    const unsubscribe = source.subscribe((reports) => {
      nodes.value = reports;
      now.value = Date.now();
    });
    cleanup(unsubscribe);
  });

  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title="Devices" />
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid max-w-3xl content-start gap-4">
        {/* DEMO: the visitor-facing "Demo devices" line; off, the plain app's hint. */}
        <p class="text-body-large text-on-surface-variant">
          {DEMO
            ? "Demo devices, live: everyone sees the same ones. Open one to see it on the map."
            : "Open a device to see it on the map."}
        </p>
        <List.Root aria-label="Devices">
          {(nodes.value ?? snapshot.value).map((node) => (
            <List.Item
              key={node.id}
              href={`/maps/?node=${node.id}`}
              // Not on sight: the Maps route carries MapLibre (perf audit, 2026-11-24).
              prefetchBundles="intent"
              startIcon={NODE_KINDS[node.kind].icon}
              overline={NODE_KINDS[node.kind].label}
              headline={node.name}
              supportingText={detail(node, nodes.value ? now.value : node.ts)}
              data-device={node.id}
              data-online={node.online ? "true" : "false"}
            />
          ))}
        </List.Root>
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = ({ url }) => pageHead("/devices/", url);
