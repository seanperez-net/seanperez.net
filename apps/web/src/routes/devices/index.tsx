import {
  $,
  Fragment,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { Button, Card, Layout, List, useSnackbar } from "@seanperez/ui";
import {
  LocateError,
  PRECISE_TEXT,
  locatePrecise,
} from "../../components/locate";
import { createLiveNodeSource } from "../../components/map-nodes-live";
import {
  NODE_KINDS,
  formatAgo,
  statusLine,
  type MapNode,
} from "../../components/map-nodes";
import {
  THIS_DEVICE_EVENT,
  THIS_DEVICE_NODE_ID,
  loadThisDevice,
  locationText,
  refreshApprox,
  setPrecise,
  type ThisDevice,
} from "../../components/this-device";
import { readNodesSnapshot } from "../../nodes/node-api.server";
import { pageHead } from "../../seo";

/**
 * Real devices for the server render (and a visitor without JavaScript): the live hub's snapshot
 * (through the same 5 s cache as `GET /api/nodes`). Under `pnpm dev` (no Durable Object there)
 * or with no device reporting: none. Since 2026-11-25 there is no demo fleet to fall back to.
 */
export const useDeviceSnapshot = routeLoader$(
  async ({ platform, url }) =>
    (await readNodesSnapshot(platform.env, platform.ctx, url)) ?? [],
);

/** "Online · Battery 80% · Last seen now · Live: reported by the device" */
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

/** "25 Nov 2026" (UTC, as the rest of the site prints dates). */
const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Devices (account menu, 2026-11-24; reworked 2026-11-25, owner: "there should be no dummy device
 * the only device that should be there is this device ... if they want to make it percise
 * location they can enable it via the geo location but thats part of the devices and the default
 * device should be the one they first logged in on").
 *
 * - THIS DEVICE (`components/this-device.ts`): the visitor's own browser, recorded in it on the
 *   first visit and marked the default device. Placed approximately from `/api/here`; "Use
 *   precise location" asks the browser's Geolocation ONLY on that press (never on load) and keeps
 *   the fix in this browser; "Use approximate location" drops it. Denied / unavailable: a
 *   snackbar, and the device stays approximate.
 * - Real devices that report to the hub (`POST /api/nodes/ingest`), if any, under it.
 * Nothing here is linked to the site's owner. Library components through their props only.
 */
export default component$(() => {
  const snapshot = useDeviceSnapshot();
  const nodes = useSignal<MapNode[] | null>(null);
  const now = useSignal(0);
  const device = useSignal<ThisDevice | null>(null);
  const locating = useSignal(false);
  const { showSnackbar$ } = useSnackbar();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const reload = () => (device.value = loadThisDevice());
    reload();
    void refreshApprox().then((d) => (device.value = d));
    document.addEventListener(THIS_DEVICE_EVENT, reload);
    const source = createLiveNodeSource();
    const unsubscribe = source.subscribe((reports) => {
      nodes.value = reports;
      now.value = Date.now();
    });
    cleanup(() => {
      unsubscribe();
      document.removeEventListener(THIS_DEVICE_EVENT, reload);
    });
  });

  const preciseOn$ = $(async () => {
    locating.value = true;
    try {
      const fix = await locatePrecise();
      device.value = setPrecise({ ...fix, at: Date.now() });
      await showSnackbar$({
        message: "Precise location is on for this device.",
      });
    } catch (error) {
      await showSnackbar$({
        message:
          error instanceof LocateError
            ? error.message
            : PRECISE_TEXT.unavailable,
      });
    } finally {
      locating.value = false;
    }
  });

  const preciseOff$ = $(async () => {
    device.value = setPrecise(null);
    await showSnackbar$({
      message: "Precise location is off. This device is placed approximately.",
    });
  });

  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title="Devices" />
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid max-w-3xl content-start gap-4">
        <Card.Root variant="filled" data-device={THIS_DEVICE_NODE_ID}>
          <Card.Header>
            <Card.Title>{device.value?.name ?? "This device"}</Card.Title>
            <Card.Description>
              {device.value
                ? `${NODE_KINDS[device.value.kind].label}${
                    device.value.isDefault ? " · Default device" : ""
                  }`
                : "This browser"}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {/* A plain description list (label, value), as the map's device card: no library
                component has this shape; type tokens only. */}
            <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-medium">
              {(
                [
                  [
                    "Location",
                    device.value ? locationText(device.value) : "Finding…",
                  ],
                  [
                    "First seen",
                    device.value ? day(device.value.firstSeenAt) : "…",
                  ],
                ] as const
              ).map(([label, value]) => (
                <Fragment key={label}>
                  <dt class="text-on-surface-variant">{label}</dt>
                  <dd class="text-on-surface" data-field={label}>
                    {value}
                  </dd>
                </Fragment>
              ))}
            </dl>
            <p class="pt-4 text-body-small text-on-surface-variant">
              Approximate location comes from your connection (Cloudflare) and
              is not stored on the server. Precise location is asked from your
              browser only when you press the button, and kept in this browser.
            </p>
          </Card.Content>
          <Card.Footer>
            <Button
              type="link"
              href={`/maps/?node=${THIS_DEVICE_NODE_ID}`}
              look="text"
              label="Show on map"
            />
            {device.value?.precise ? (
              <Button
                look="tonal"
                label="Use approximate location"
                leadingIcon="location_off"
                onClick$={preciseOff$}
              />
            ) : (
              <Button
                look="filled"
                label="Use precise location"
                leadingIcon="my_location"
                isLoading={locating.value}
                disabled={!device.value}
                onClick$={preciseOn$}
              />
            )}
          </Card.Footer>
        </Card.Root>
        {(nodes.value ?? snapshot.value).length > 0 && (
          <List.Root aria-label="Connected devices">
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
        )}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = ({ url }) => pageHead("/devices/", url);
