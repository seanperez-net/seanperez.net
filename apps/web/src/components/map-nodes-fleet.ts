import type { MapNode, NodeKind } from "./map-nodes";
import paths from "./map-nodes-paths.json";
import {
  airLoop,
  cncProgram,
  fixedProgram,
  pathLoop,
  printer3dProgram,
  printerProgram,
  roadLoop,
} from "./map-nodes-programs";
import type { NodeProgram, ProgramContext } from "./map-nodes-programs";
import type { LngLat } from "./map-url";

/**
 * The DEMO fleet and the engine that steps it, RUNTIME-NEUTRAL (no DOM, no storage, no timers,
 * no fetch): the browser's dummy source (`map-nodes-dummy.ts`, one `setInterval`) and the
 * server's `NodeHub` Durable Object (`src/nodes/node-hub.server.ts`, one alarm every few seconds) both
 * drive the SAME fleet through `createFleet()`. Whoever owns time calls `step(now)`; whatever a
 * program needs from outside (a road route) comes through the `ProgramContext` given to
 * `start()` (the browser's asks OSRM once and caches it; the server's gives none, so the truck
 * drives the bundled copy of that same OSRM route, `map-nodes-paths.json`).
 *
 * The nodes (owner, 2026-11-24: "one truck one drone one base station one sensor etc ... keep the
 * demo working with simple things"; "pin the dummy routes to real roads in one city"; "open maps
 * on cuba"). One node of each kind, all in ONE fixed city, Havana, each driven by its own program
 * (`map-nodes-programs.ts`):
 *
 * - LoRa gateway on the FOCSA building, Vedado (mains power, heartbeat every 30 s);
 * - LoRa sensor in the Plaza de Armas, Old Havana (uplink every 15 s, fresh RSSI / SNR, battery);
 * - Wi-Fi node in Parque Central (reports every 5 s; drops out 20 s in every 90 s);
 * - truck: a road loop Parque Central, La Rampa, Plaza de la Revolucion, Estacion Central, back
 *   (it loses GPS for 10 s every 2 minutes: its report freezes, it keeps driving);
 * - drone: an air loop from the Plaza de la Revolucion over the Malecon, El Morro and the
 *   Capitolio at 80 m;
 * - boat: offshore along the Malecon and through the harbour mouth into the bay, there and back
 *   (a bundled water path, checked to lie inside the water polygons);
 * - machines (owner, later 2026-11-24, "another device type printers"), on mains power, each
 *   running jobs in turn: a network printer at the University of Havana (IPP-style status), a
 *   3D printer at the Fabrica de Arte Cubano (OctoPrint-style: heat, print, cool), a CNC router
 *   at the Almacenes San Jose crafts market (GRBL-style: Idle, Run, Hold).
 */

/** Where the dummy fleet lives (the map's fallback start, `map-view.tsx`). */
export const NODES_CITY: LngLat = [-82.37, 23.135];

/** A tick after a long gap (a hidden tab, a server that was not ticking) counts as at most 5 s. */
const MAX_DT = 5;

type Line = { coordinates: number[][] };
const bundled = (id: string): LngLat[] =>
  (paths.features as { properties: { id: string }; geometry: Line }[])
    .find((f) => f.properties.id === id)
    ?.geometry.coordinates.map(([lng, lat]) => [lng, lat] as LngLat) ?? [];

type DummyNode = {
  id: string;
  name: string;
  kind: NodeKind;
  at: LngLat;
  battery: number | null;
  program: NodeProgram;
  /** Off the air for `for` seconds of every `every` (its report freezes). */
  outage?: { every: number; for: number };
};

const TRUCK_STOPS: LngLat[] = [
  [-82.3577, 23.1378], // Parque Central
  [-82.3832, 23.1395], // La Rampa / Hotel Nacional
  [-82.3846, 23.123], // Plaza de la Revolucion
  [-82.351, 23.1298], // Estacion Central
  [-82.3577, 23.1378],
];

function fleet(): DummyNode[] {
  const truckPath = bundled("truck");
  const boatPath = bundled("boat");
  const droneBase: LngLat = [-82.3858, 23.1225]; // Plaza de la Revolucion
  return [
    {
      id: "gw-1",
      name: "Gateway FOCSA",
      kind: "gateway",
      at: [-82.385, 23.141],
      battery: null,
      program: fixedProgram({ every: 30, rssi: [-45, -38], snr: [9, 12] }),
    },
    {
      id: "sensor-7",
      name: "Air sensor 7",
      kind: "sensor",
      at: [-82.3503, 23.1405],
      battery: 78,
      program: fixedProgram({
        every: 15,
        rssi: [-108, -92],
        snr: [2, 9],
        battery: [78, 0.002],
      }),
    },
    {
      id: "wifi-2",
      name: "Wi-Fi Parque Central",
      kind: "wifi",
      at: [-82.3574, 23.1372],
      battery: 64,
      program: fixedProgram({
        every: 5,
        rssi: [-70, -55],
        battery: [64, 0.003],
      }),
      outage: { every: 90, for: 20 },
    },
    {
      id: "truck-4",
      name: "Truck 4",
      kind: "truck",
      at: truckPath[0] ?? TRUCK_STOPS[0],
      battery: 71,
      program: roadLoop({
        stops: TRUCK_STOPS,
        mode: "car",
        fallback: truckPath.length > 1 ? truckPath : TRUCK_STOPS,
        speed: [7, 13],
        battery: [71, 0.01],
      }),
      outage: { every: 120, for: 10 },
    },
    {
      id: "drone-a",
      name: "Drone A",
      kind: "drone",
      at: droneBase,
      battery: 86,
      program: airLoop({
        base: droneBase,
        waypoints: [
          [-82.3895, 23.144], // Malecon by the Hotel Nacional
          [-82.3567, 23.1502], // El Morro
          [-82.3597, 23.1352], // Capitolio
        ],
        cruise: 80,
        speed: 12,
        climb: 3,
        wait: 10,
        battery: [86, 0.12],
      }),
    },
    {
      id: "boat-1",
      name: "Boat Bahia 1",
      kind: "boat",
      at: boatPath[0] ?? NODES_CITY,
      battery: 90,
      program: pathLoop({
        path: boatPath,
        label:
          "Water run: the Malecon, the harbour mouth and the bay, there and back (bundled path)",
        speed: [2, 4],
        battery: [90, 0.004],
      }),
    },
    {
      id: "printer-1",
      name: "Printer Universidad",
      kind: "printer",
      at: [-82.3819, 23.1364], // Nominatim, 2026-11-24
      battery: null,
      program: printerProgram({
        jobs: ["timetable.pdf", "lab-notes.pdf", "poster-a3.pdf"],
        idle: 25,
        pageSeconds: 2,
        toner: 62,
      }),
    },
    {
      id: "printer3d-1",
      name: "Ender 3 Pro",
      kind: "printer3d",
      at: [-82.4097, 23.1277], // Nominatim, 2026-11-24
      battery: null,
      program: printer3dProgram({
        jobs: ["benchy.gcode", "cable-clip.gcode", "phone-stand.gcode"],
        idle: 20,
        printSeconds: 150,
        finishedSeconds: 20,
        nozzle: 215,
        bed: 60,
      }),
    },
    {
      id: "cnc-1",
      name: "LowRider2 CNC",
      kind: "cnc",
      at: [-82.3489, 23.1305], // Nominatim, 2026-11-24
      battery: null,
      program: cncProgram({
        jobs: ["sign-pocket.nc", "box-joints.nc"],
        idle: 20,
        runSeconds: 100,
        holdSeconds: 8,
        spindle: 12000,
      }),
    },
  ];
}

/** The fleet: its reports now, and one step of every program. */
export type Fleet = {
  reports(): MapNode[];
  /** Starts the programs' outside work (a road route); call once, before the first step. */
  start(ctx: ProgramContext): void;
  /** Steps every program to `now` (ms since the epoch); returns the new reports. */
  step(now: number): MapNode[];
};

export function createFleet(start = Date.now()): Fleet {
  const nodes = fleet();
  let reports: MapNode[] = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    lngLat: n.at,
    heading: null,
    speed: 0,
    battery: n.battery,
    online: true,
    ts: start,
    program: { ...n.program.info },
    ...n.program.initial,
  }));
  let last = start;
  /** Seconds of simulated time (the outages are on this clock, whatever the tick rate). */
  let elapsed = 0;

  return {
    reports: () => reports,
    start(ctx) {
      for (const n of nodes) n.program.start?.(ctx);
    },
    step(now) {
      const dt = Math.max(0, Math.min(MAX_DT, (now - last) / 1000));
      last = now;
      elapsed += dt;
      reports = reports.map((report, i) => {
        const { program, outage } = nodes[i];
        const change = program.step(now, dt);
        const offline =
          outage && elapsed % outage.every >= outage.every - outage.for;
        const info = { ...program.info };
        if (offline) return { ...report, online: false, program: info };
        return { ...report, ...change, online: true, program: info };
      });
      return reports;
    },
  };
}
