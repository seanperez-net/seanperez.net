import type { IconName } from "@seanperez/ui";
import type { LngLat } from "./map-url";

/**
 * The Maps app's NODES layer (owner, 2026-11-24: devices "like lora nodes or wifi nodes ... gps
 * fleet management"): what a node is, and the source the map reads reports from. New, not in
 * e-store (its maps app has no device layer).
 *
 * Since 2026-11-25 (owner: "there should be no dummy device the only device that should be there
 * is this device") there are NO made-up nodes. A node is either:
 * - THIS DEVICE, the visitor's own browser (`this-device.ts`), placed from the connection's
 *   approximate location (`/api/here`, Cloudflare's `request.cf`) or, if the visitor turns it on in
 *   Devices, the browser's Geolocation;
 * - a REAL device that reports to the live hub (`map-nodes-live.ts`, `POST /api/nodes/ingest`).
 * A source is anything with `snapshot()` and `subscribe()`; `withThisDevice()` puts this device
 * in front of the live source's nodes, and the map does not care which is which.
 *
 * Plain JSON only (it goes into the Qwik store): no class instances, no functions, no Dates.
 */

export type NodeKind =
  | "gateway"
  | "sensor"
  | "wifi"
  | "truck"
  | "drone"
  | "boat"
  | "printer"
  | "printer3d"
  | "cnc"
  /** This device (`this-device.ts`), from the browser's user agent. */
  | "phone"
  | "computer";

/**
 * A machine's own status (owner, 2026-11-24: "another device type printers ... 3d printers ...
 * cnc machine"), one shape per kind, as the real protocols report it (research: `PLAN.md` "Printers,
 * 3D printers and CNC as nodes"):
 *
 * - `printer`: a network printer over IPP (RFC 8011): `printer-state` idle / processing /
 *   stopped, the job's pages, `marker-levels` (toner %);
 * - `printer3d`: OctoPrint / Moonraker style: state, job file, progress %, nozzle and bed
 *   temperatures [actual, target] in Celsius, seconds left;
 * - `cnc`: GRBL style: its state words Idle / Run / Hold, job file, progress %, spindle rpm.
 */
export type MachineStatus =
  | {
      type: "printer";
      state: "idle" | "processing" | "stopped";
      job: string | null;
      pages: [done: number, total: number] | null;
      toner: number;
    }
  | {
      type: "printer3d";
      state: "idle" | "heating" | "printing" | "finished";
      job: string | null;
      progress: number;
      nozzle: [actual: number, target: number];
      bed: [actual: number, target: number];
      secondsLeft: number | null;
    }
  | {
      type: "cnc";
      state: "Idle" | "Run" | "Hold";
      job: string | null;
      progress: number;
      spindle: number;
      secondsLeft: number | null;
    };

/** Where a node's position comes from, for the detail card and the Devices rows. */
export type NodeProgramInfo = {
  /** "Live: reported by the device", "Approximate (from your network)". */
  label: string;
};

/** One node as the map and the panel see it (its latest report). */
export type NodeReport = {
  id: string;
  name: string;
  kind: NodeKind;
  /** [lng, lat], WGS 84. */
  lngLat: LngLat;
  /** Degrees clockwise from true north; null for a node that does not move. */
  heading: number | null;
  /** Metres per second over the ground. */
  speed: number;
  /** Metres above the ground (aerial nodes only). */
  altitude?: number;
  /** 0 to 100; null for a mains-powered node (a gateway). */
  battery: number | null;
  online: boolean;
  /** Radio nodes: the last report's signal (dBm) and, LoRa only, signal-to-noise ratio (dB). */
  rssi?: number;
  snr?: number;
  /** Printers and CNC machines: their own status (`MachineStatus`). */
  status?: MachineStatus;
  /** When the node last reported (ms since the epoch). */
  ts: number;
  program: NodeProgramInfo;
};

/** Kept as the map's name for a node (one name across the Maps files). */
export type MapNode = NodeReport;

/** A live report older than this counts as offline (when the report does not say). */
export const STALE_MS = 2 * 60 * 1000;

/** Where live node reports come from. */
export type NodeSource = {
  /** The latest report of every node. */
  snapshot(): MapNode[];
  /**
   * Called with every node's latest report each time anything changes. Returns the
   * unsubscribe; the live source closes its socket when no one listens.
   */
  subscribe(callback: (nodes: MapNode[]) => void): () => void;
  /** Where each moving node has been, when the source knows (the live hub sends it). */
  trails?(): Record<string, LngLat[]>;
};

/**
 * Each kind: its label, icon, and color group on the map (`radio`: LoRa, `wifi`, `tracker`: a
 * GPS-tracked vehicle, `drone`, `machine`: a printer or CNC machine).
 */
// Labels name the DEVICE that reports, not what it rides on (owner, 2026-11-24: "is a car a
// device"): a truck's or a boat's device is a GPS tracker (Traccar's model); the node's name
// says what it is on.
export const NODE_KINDS: Record<
  NodeKind,
  {
    label: string;
    icon: IconName;
    group: "radio" | "wifi" | "tracker" | "drone" | "machine" | "self";
  }
> = {
  gateway: {
    label: "LoRa gateway",
    icon: "settings_input_antenna",
    group: "radio",
  },
  sensor: { label: "LoRa sensor", icon: "sensors", group: "radio" },
  wifi: { label: "Wi-Fi access point", icon: "router", group: "wifi" },
  truck: { label: "GPS tracker", icon: "local_shipping", group: "tracker" },
  drone: { label: "Drone telemetry", icon: "drone", group: "drone" },
  boat: { label: "GPS tracker", icon: "directions_boat", group: "drone" },
  printer: { label: "Network printer", icon: "print", group: "machine" },
  printer3d: { label: "3D printer", icon: "deployed_code", group: "machine" },
  cnc: {
    label: "CNC machine",
    icon: "precision_manufacturing",
    group: "machine",
  },
  phone: { label: "Phone", icon: "smartphone", group: "self" },
  computer: { label: "Computer", icon: "computer", group: "self" },
};

/** Smallest difference between two headings, -180..180 (the map's glide turns by it). */
export const turn = (from: number, to: number) =>
  ((to - from + 540) % 360) - 180;

/** "18 min left", "40 s left". */
const formatLeft = (s: number) =>
  s >= 60 ? `${Math.round(s / 60)} min left` : `${Math.round(s)} s left`;

const temp = ([actual, target]: [number, number]) =>
  target > 0
    ? `${Math.round(actual)} / ${target} °C`
    : `${Math.round(actual)} °C`;

/** One line for a list row: "Printing · benchy.gcode · 42% · 18 min left". */
export function statusLine(status: MachineStatus): string {
  if (status.type === "printer") {
    if (status.state !== "processing" || !status.pages)
      return status.state === "idle" ? "Idle" : "Stopped";
    return `Printing · page ${status.pages[0]} of ${status.pages[1]}`;
  }
  const word =
    status.type === "cnc"
      ? { Idle: "Idle", Run: "Running", Hold: "On hold" }[status.state]
      : {
          idle: "Idle",
          heating: "Heating",
          printing: "Printing",
          finished: "Finished",
        }[status.state];
  if (!status.job || status.state === "idle") return word;
  // Heating: the job is known, nothing printed yet.
  if (status.state === "heating") return `${word} · ${status.job}`;
  return [
    word,
    status.job,
    `${Math.round(status.progress)}%`,
    ...(status.secondsLeft !== null ? [formatLeft(status.secondsLeft)] : []),
  ].join(" · ");
}

/** The detail card's rows for a machine (label, value). */
export function statusRows(status: MachineStatus): [string, string][] {
  const rows: [string, string][] = [
    ["State", statusLine(status).split(" · ")[0]],
  ];
  if (status.job) rows.push(["Job", status.job]);
  if (status.type === "printer") {
    if (status.pages)
      rows.push(["Pages", `${status.pages[0]} of ${status.pages[1]}`]);
    rows.push(["Toner", `${Math.round(status.toner)}%`]);
    return rows;
  }
  if (status.job && status.state !== "heating")
    rows.push(["Progress", `${Math.round(status.progress)}%`]);
  if (status.secondsLeft !== null)
    rows.push(["Time left", formatLeft(status.secondsLeft)]);
  if (status.type === "printer3d") {
    rows.push(["Nozzle", temp(status.nozzle)]);
    rows.push(["Bed", temp(status.bed)]);
  } else {
    rows.push([
      "Spindle",
      status.spindle > 0 ? `${status.spindle} rpm` : "Off",
    ]);
  }
  return rows;
}

/** "12 km/h" (speeds come in m/s). */
export const formatSpeed = (mps: number) => `${Math.round(mps * 3.6)} km/h`;

/** "now", "8 s ago", "3 min ago". */
export function formatAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 2) return "now";
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
}
