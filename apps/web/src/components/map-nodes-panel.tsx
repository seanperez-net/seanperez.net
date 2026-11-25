import { $, Fragment, component$, useContext } from "@qwik.dev/core";
import { Button, Card, List, Switch } from "@seanperez/ui";
import { DEMO } from "../demo/demo";
import {
  NODE_KINDS,
  formatAgo,
  formatSpeed,
  statusLine,
  statusRows,
} from "./map-nodes";
import type { MapNode } from "./map-nodes";
import { mapsContextId } from "./map-state";

/**
 * The Nodes companion (owner, 2026-11-24: devices "like lora nodes or wifi nodes ... gps fleet
 * management"): the layer's show / hide switch, the chosen node's details, and every node as a
 * selection list (a row flies the map to it). New, not in e-store. Library components through
 * their props only (no `class=` on them).
 *
 * The rows re-render once a second with the source's tick (Qwik updates the changed text only).
 */

/** "Online · now" / "Offline · last seen 2 min ago". */
const statusText = (n: MapNode, now: number) =>
  n.online
    ? `Online · ${formatAgo(n.ts, now)}`
    : `Offline · last seen ${formatAgo(n.ts, now)}`;

const batteryText = (n: MapNode) =>
  n.battery === null ? "Mains power" : `${Math.round(n.battery)}%`;

/** The detail rows for one node (label, value). */
function details(n: MapNode, now: number): [string, string][] {
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
  rows.push([
    "Program",
    n.program.status === "loading"
      ? `${n.program.label} (getting the route)`
      : n.program.label,
  ]);
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

  // Fits the map to every node (the map opens on Cuba or a saved view; the fleet is in Havana).
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
              <Card.Description>{statusText(node, now)}</Card.Description>
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
              n.status && n.online
                ? `${NODE_KINDS[n.kind].label} · ${statusLine(n.status)}`
                : n.heading !== null && n.online
                  ? `${NODE_KINDS[n.kind].label} · ${formatSpeed(n.speed)}${
                      n.altitude ? ` · ${n.altitude} m` : ""
                    }`
                  : `${NODE_KINDS[n.kind].label} · ${n.online ? "Online" : "Offline"}`
            }
            startIcon={NODE_KINDS[n.kind].icon}
            trailingSupportingText={batteryText(n)}
          />
        ))}
      </List.Root>
      {/* DEMO: the visitor-facing note on the demo fleet; off, only the offline behaviour. */}
      <p class="text-body-small text-on-surface-variant">
        {DEMO
          ? "Demo devices, one of each kind in Havana, shared live by everyone watching (the printers and the CNC machine run made-up jobs in turn). Without a connection the map shows the last known positions, or runs the same demo in this browser."
          : "Without a connection the map shows the last known positions."}
      </p>
    </div>
  );
});
