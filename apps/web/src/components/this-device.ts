import { isHere, hereLabel, type Here } from "../here/here";
import { readPref, writePref } from "../local-store";
import type { MapNode, NodeSource } from "./map-nodes";
import type { LngLat } from "./map-url";

/**
 * THIS DEVICE (owner, 2026-11-25: "there should be no dummy device the only device that should be
 * there is this device ... the default device should be the one they first logged in on"): the
 * visitor's own browser, the ONLY device the site shows besides real devices that report to the
 * hub. Browser only; call after resume (tasks, handlers), never while rendering.
 *
 * - The RECORD is per-device state, so it lives in localStorage (`local-store.ts` `readPref` /
 *   `writePref`, key `spn.v1.devices.this`), like the map's camera (the seam's rule: account data
 *   goes through `changeLocalDoc`, per-device state stays in localStorage). Made on the first
 *   visit that needs it: an id, "This device", phone or computer, `firstSeenAt`, and `isDefault`.
 *   The FIRST record a browser makes is the default device and stays so (nothing clears it); a
 *   later account sync can then tell which device came first.
 * - APPROXIMATE location: `GET /api/here` (Cloudflare's `request.cf`, IP geolocation, never
 *   stored on the server). The last answer is kept in the record (the visitor's own browser), so
 *   the map opens there at once next time and offline.
 * - PRECISE location: only when the visitor presses "Use precise location" in Devices
 *   (`locatePrecise()`, `locate.ts`), never on load. Kept with its accuracy until they turn it off.
 *
 * Same-tab views hear changes through a `document` event (`THIS_DEVICE_EVENT`), other tabs
 * through the `storage` event.
 */

/** The node id on the map and in `?node=` (the same for every visitor: it is always THEIR device). */
export const THIS_DEVICE_NODE_ID = "this-device";

export const THIS_DEVICE_EVENT = "spn:this-device";

const KEY = "devices.this";

export type PreciseFix = {
  lngLat: LngLat;
  /** Metres (Geolocation `coords.accuracy`). */
  accuracy: number;
  /** When it was taken (ms since the epoch). */
  at: number;
};

export type ThisDevice = {
  id: string;
  name: string;
  kind: "phone" | "computer";
  firstSeenAt: number;
  /** The first device this browser recorded: the default, and it stays the default. */
  isDefault: boolean;
  precise: PreciseFix | null;
  /** The last `/api/here` answer (approximate), or null before the first one. */
  approx: Here | null;
};

const isPoint = (v: unknown): v is LngLat =>
  Array.isArray(v) &&
  v.length === 2 &&
  v.every((n) => typeof n === "number" && Number.isFinite(n)) &&
  Math.abs(v[0] as number) <= 180 &&
  Math.abs(v[1] as number) <= 90;

function parseFix(v: unknown): PreciseFix | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  return isPoint(f.lngLat) &&
    typeof f.accuracy === "number" &&
    f.accuracy >= 0 &&
    typeof f.at === "number"
    ? { lngLat: f.lngLat, accuracy: f.accuracy, at: f.at }
    : null;
}

/** Stored data is untrusted (another version of the site, or the visitor, may have written it). */
function parseDevice(raw: unknown): ThisDevice | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (
    typeof d.id !== "string" ||
    !d.id ||
    typeof d.name !== "string" ||
    (d.kind !== "phone" && d.kind !== "computer") ||
    typeof d.firstSeenAt !== "number" ||
    typeof d.isDefault !== "boolean"
  )
    return null;
  return {
    id: d.id,
    name: d.name,
    kind: d.kind,
    firstSeenAt: d.firstSeenAt,
    isDefault: d.isDefault,
    precise: parseFix(d.precise),
    approx: isHere(d.approx) ? d.approx : null,
  };
}

/**
 * Phone or computer: `navigator.userAgentData.mobile` where the browser has it (Chromium; MDN
 * "NavigatorUAData.mobile"), else "Mobi" in the user agent (MDN "Browser detection using the user
 * agent": the recommended mobile test). An iPad reports a desktop user agent: a computer here.
 */
export function detectKind(): ThisDevice["kind"] {
  const data = (navigator as { userAgentData?: { mobile?: boolean } })
    .userAgentData;
  if (typeof data?.mobile === "boolean")
    return data.mobile ? "phone" : "computer";
  return /Mobi/i.test(navigator.userAgent) ? "phone" : "computer";
}

/** This browser's device record, made (and marked default) the first time. */
export function loadThisDevice(): ThisDevice {
  const stored = readPref(KEY, parseDevice);
  if (stored) return stored;
  const device: ThisDevice = {
    id: crypto.randomUUID(),
    name: "This device",
    kind: detectKind(),
    firstSeenAt: Date.now(),
    // The first record is the default device (owner: "the one they first logged in on").
    isDefault: true,
    precise: null,
    approx: null,
  };
  writePref(KEY, device);
  return device;
}

function save(device: ThisDevice) {
  writePref(KEY, device);
  document.dispatchEvent(new CustomEvent(THIS_DEVICE_EVENT));
}

/** Precise location on (a fix) or off (`null`: back to approximate). */
export function setPrecise(fix: PreciseFix | null): ThisDevice {
  const device = { ...loadThisDevice(), precise: fix };
  save(device);
  return device;
}

/**
 * Asks `/api/here` (never cached: `no-store` both ways) and keeps the answer in the record.
 * Offline or failing: the record as it was.
 */
export async function refreshApprox(): Promise<ThisDevice> {
  try {
    const response = await fetch("/api/here", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const here: unknown = response.ok ? await response.json() : null;
    if (isHere(here)) {
      const device = { ...loadThisDevice(), approx: here };
      save(device);
      return device;
    }
  } catch {
    // Offline, or the dev server is restarting: keep the last answer.
  }
  return loadThisDevice();
}

/** Where to show this device: precise if on, else approximate, else null ("Location unknown"). */
export const devicePoint = (d: ThisDevice): LngLat | null =>
  d.precise?.lngLat ?? d.approx?.lngLat ?? null;

/** "Precise · within 12 m" / "Approximate (from your network) · near Austin, Texas, US". */
export function locationText(d: ThisDevice): string {
  if (d.precise) return `Precise · within ${Math.round(d.precise.accuracy)} m`;
  if (!d.approx?.lngLat) return "Location unknown";
  const place = hereLabel(d.approx);
  return place
    ? `Approximate (from your network) · near ${place}`
    : "Approximate (from your network)";
}

/** The record as a map node (no position: no node, the panels say "Location unknown"). */
export function thisDeviceNode(d: ThisDevice, now: number): MapNode | null {
  const lngLat = devicePoint(d);
  if (!lngLat) return null;
  return {
    id: THIS_DEVICE_NODE_ID,
    name: d.name,
    kind: d.kind,
    lngLat,
    heading: null,
    speed: 0,
    battery: null,
    online: true,
    ts: d.precise?.at ?? now,
    program: { label: locationText(d) },
  };
}

/**
 * `source`'s nodes with this device in front: its stored position at once, then `/api/here`'s
 * answer, and again whenever Devices changes it (this tab or another).
 */
export function withThisDevice(source: NodeSource): NodeSource {
  let own: MapNode | null = null;
  let real: MapNode[] = [];
  const all = () =>
    own ? [own, ...real.filter((n) => n.id !== own?.id)] : real;
  return {
    snapshot: all,
    trails: source.trails ? () => source.trails?.() ?? {} : undefined,
    subscribe(callback) {
      let alive = true;
      const update = (device: ThisDevice) => {
        if (!alive) return;
        own = thisDeviceNode(device, Date.now());
        callback(all());
      };
      const reload = () => update(loadThisDevice());
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key.endsWith(KEY)) reload();
      };
      document.addEventListener(THIS_DEVICE_EVENT, reload);
      window.addEventListener("storage", onStorage);
      reload();
      void refreshApprox().then(update);
      const stop = source.subscribe((nodes) => {
        real = nodes;
        if (alive) callback(all());
      });
      return () => {
        alive = false;
        stop();
        document.removeEventListener(THIS_DEVICE_EVENT, reload);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}
