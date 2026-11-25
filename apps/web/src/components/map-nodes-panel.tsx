import { $, Fragment, component$, useContext } from "@qwik.dev/core";
import { Button, Card, List, Switch } from "@seanperez/ui";
import {
  NODE_KINDS,
  formatAgo,
  formatSpeed,
  statusLine,
  statusRows,
} from "./map-nodes";
import type { MapNode } from "./map-nodes";
import { mapsContextId } from "./map-state";
import { THIS_DEVICE_NODE_ID } from "./this-device";

/**
 * The Devices companion (owner, 2026-11-24: devices "like lora nodes or wifi nodes"): the layer's
 * show / hide switch, the chosen device's details, and every device as a selection list (a row
 * flies the map to it). New, not in e-store. Library components through their props only (no
 * `class=` on them).
 *
 * Since 2026-11-25 the list is THIS device (`this-device.ts`) plus any real device that reports
 * to the hub; no made-up ones. Precise location is turned on in Devices (`/devices/`), not here.
 */

/** "Online · now" / "Offline · last seen 2 min ago". */
const statusText = (n: MapNode, now: number) =>
  n.online
    ? `Online · ${formatAgo(n.ts, now)}`
    : `Offline · last seen ${formatAgo(n.ts, now)}`;

const own = (n: MapNode) => NODE_KINDS[n.kind].group === "self";

const batteryText = (n: MapNode) =>
  n.battery === null ? "Mains power" : `${Math.round(n.battery)}%`;

/** The detail rows for one node (label, value). */
function details(n: MapNode, now: number): [string, string][] {
  if (own(n)) {
    // This device (its location is the card's subhead): the point at the precision it has
    // (an approximate one is rounded to 2 decimals by `/api/here`; more digits would claim more).
    const approximate = n.program.label.startsWith("Approximate");
    const digits = approximate ? 2 : 5;
    return [
      ["Kind", NODE_KINDS[n.kind].label],
      [
        "Position",
        `${n.lngLat[1].toFixed(digits)}, ${n.lngLat[0].toFixed(digits)}`,
      ],
    ];
  }
  const rows: [string, string][] = [
    ["Kind", NODE_KINDS[n.kind].label],
    ["Status", statusText(n, now)],
    ["Battery", batteryText(n)],
  ];
  if (n.status) rows.push(...statusRows(n.status));
  if (n.heading !== null) {
    rows.push(["Speed", formatSpeed(n.speed)]);
    rows.push(["Heading", `${Math.round(n.heading)}°`]);
  }
  if (n.altitude !== undefined) rows.push(["Altitude", `${n.altitude} m`]);
  if (n.rssi !== undefined) rows.push(["Signal", `${n.rssi} dBm`]);
  if (n.snr !== undefined) rows.push(["SNR", `${n.snr} dB`]);
  rows.push([
    "Position",
    `${n.lngLat[1].toFixed(5)}, ${n.lngLat[0].toFixed(5)}`,
  ]);
  rows.push(["Source", n.program.label]);
  return rows;
}

export const NodesPanel = component$(() => {
  const state = useContext(mapsContextId);

  const show = $((id: string) => {
    state.selectedNode = id;
    const node = state.nodes.find((n) => n.id === id);
    if (!node) return;
    // MapLibre skips the animation itself under prefers-reduced-motion (no `essential`).
    state.flyTo = {
      center: node.lngLat,
      zoom: Math.max(state.camera?.zoom ?? 0, 15),
      seq: Date.now(),
    };
  });

  // Fits the map to every node (one node: flies to it).
  const showAll = $(() => {
    const points = state.nodes.map((n) => n.lngLat);
    if (!points.length) return;
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    state.flyTo = {
      center: points[0],
      zoom: 15,
      bbox: [
        Math.min(...lngs),
        Math.min(...lats),
        Math.max(...lngs),
        Math.max(...lats),
      ],
      seq: Date.now(),
    };
  });

  return (
    // Spacing between the panel's parts (placement only; no library component is restyled).
    <div class="grid gap-4">
      <Switch
        label="Show devices on the map"
        checked={state.nodesShown}
        onChange$={(_, el) => (state.nodesShown = el.checked)}
      />
      <Button
        look="tonal"
        label="Show all devices"
        leadingIcon="my_location"
        onClick$={showAll}
      />
      {(() => {
        const node = state.nodes.find((n) => n.id === state.selectedNode);
        if (!node) return null;
        const now = Date.now();
        return (
          <Card.Root variant="filled">
            <Card.Header>
              <Card.Title>{node.name}</Card.Title>
              <Card.Description>
                {own(node) ? node.program.label : statusText(node, now)}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {/* A plain description list (label, value): no library component has this
                  shape; type tokens only. */}
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-medium">
                {details(node, now).map(([label, value]) => (
                  <Fragment key={label}>
                    <dt class="text-on-surface-variant">{label}</dt>
                    <dd class="text-on-surface tabular-nums">{value}</dd>
                  </Fragment>
                ))}
              </dl>
            </Card.Content>
            <Card.Footer>
              <Button
                look="text"
                label="Clear"
                onClick$={() => (state.selectedNode = null)}
              />
              <Button
                look="filled"
                label="Show on map"
                leadingIcon="my_location"
                onClick$={() => show(node.id)}
              />
            </Card.Footer>
          </Card.Root>
        );
      })()}
      <List.Root
        interactive
        aria-label="Devices"
        value={state.selectedNode ?? ""}
        onValueChange$={show}
      >
        {state.nodes.map((n) => (
          <List.Item
            key={n.id}
            value={n.id}
            headline={n.name}
            supportingText={
              own(n)
                ? `${NODE_KINDS[n.kind].label} · ${n.program.label}`
                : n.status && n.online
                ? `${NODE_KINDS[n.kind].label} · ${statusLine(n.status)}`
                : n.heading !== null && n.online
                  ? `${NODE_KINDS[n.kind].label} · ${formatSpeed(n.speed)}${
                      n.altitude ? ` · ${n.altitude} m` : ""
                    }`
                  : `${NODE_KINDS[n.kind].label} · ${n.online ? "Online" : "Offline"}`
            }
            startIcon={NODE_KINDS[n.kind].icon}
            // This device: no battery reading (the site does not ask the browser for one).
            trailingSupportingText={own(n) ? undefined : batteryText(n)}
          />
        ))}
      </List.Root>
      {/* No point for this device (Tor, no location in the request, first visit offline). */}
      {!state.nodes.some((n) => n.id === THIS_DEVICE_NODE_ID) && (
        <p class="text-body-medium text-on-surface">
          This device: Location unknown.
        </p>
      )}
      {/* Not DEMO-gated: how this device is placed is true of the real app too. */}
      <p class="text-body-small text-on-surface-variant">
        This device is placed from your connection's approximate location
        (Cloudflare); that guess is not stored on the server. For a precise
        position, turn it on in Devices.
      </p>
    </div>
  );
});
