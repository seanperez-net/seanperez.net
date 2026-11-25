/**
 * The Maps app's URL: the camera (`?at=`), the searched place (`?q=`) and the directions
 * (`?from=`, `?to=`, `?mode=`). Ported from e-store's `packages/maps/src/url/maps-url.ts`
 * (`AT_PATTERN`, `parseCameraParam`, `formatCameraParam`, `withMapsUrlView`), 2026-11-24.
 *
 * - `?at=<lat>,<lng>,<zoom>z`: latitude first, as people read it and as e-store writes it; 6
 *   decimals for a position (about 0.1 m), 2 for the zoom. A bad value is ignored (a URL is user
 *   input), never thrown.
 * - `?from=` / `?to=`: a stop as `<lat>,<lng>` (the same order). `?mode=` `bike` / `foot`; car is
 *   the default and is left out (e-store leaves out `drive`).
 * - Ours, not e-store's: plain regexes instead of valibot (apps/web has no valibot, and these are
 *   three small patterns); no `/place/`, `/search/`, `/dir/` routes: one route, `/maps/`, whose
 *   query says what it shows. e-store's foreign-link readers, `?base=`, `?layers=`, `?hl=`,
 *   `?via=` are not ported (no such features here).
 *
 * Qwik-free and DOM-free: the route reads it on the server, the map in the browser.
 */

/** `[longitude, latitude]`, as MapLibre and GeoJSON take it. */
export type LngLat = [number, number];

export type MapCamera = { center: LngLat; zoom: number };

export type TravelMode = "car" | "bike" | "foot";

export const TRAVEL_MODES: readonly TravelMode[] = ["car", "bike", "foot"];

const MIN_ZOOM = 0;
const MAX_ZOOM = 22;

/** e-store's `AT_PATTERN`: latitude, longitude, zoom with or without its `z`. */
const AT_PATTERN =
  /^(-?\d{1,2}(?:\.\d{1,8})?),(-?\d{1,3}(?:\.\d{1,8})?),(\d{1,2}(?:\.\d{1,3})?)z?$/;
/** A stop: latitude, longitude. */
const POINT_PATTERN = /^(-?\d{1,2}(?:\.\d{1,8})?),(-?\d{1,3}(?:\.\d{1,8})?)$/;

const isLat = (n: number) => Number.isFinite(n) && n >= -90 && n <= 90;
const isLng = (n: number) => Number.isFinite(n) && n >= -180 && n <= 180;

/** A valid `[lng, lat]`, or null. */
export function lngLat(lng: number, lat: number): LngLat | null {
  return isLng(lng) && isLat(lat) ? [lng, lat] : null;
}

/** `?at=` -> a camera, or null. */
export function parseCameraParam(
  value: string | null | undefined,
): MapCamera | null {
  if (!value || value.length > 64) return null;
  const m = AT_PATTERN.exec(value);
  if (!m) return null;
  const center = lngLat(Number(m[2]), Number(m[1]));
  const zoom = Number(m[3]);
  if (!center || zoom < MIN_ZOOM || zoom > MAX_ZOOM) return null;
  return { center, zoom };
}

/** Trims float noise (e-store's `fixed`). */
const fixed = (n: number, digits: number) =>
  Number(n.toFixed(digits)).toString();

/** A camera -> `<lat>,<lng>,<zoom>z`. */
export function formatCameraParam(camera: MapCamera): string {
  const [lng, lat] = camera.center;
  return `${fixed(lat, 6)},${fixed(lng, 6)},${fixed(camera.zoom, 2)}z`;
}

/** `?from=` / `?to=` -> a point, or null. */
export function parsePointParam(
  value: string | null | undefined,
): LngLat | null {
  if (!value || value.length > 40) return null;
  const m = POINT_PATTERN.exec(value);
  return m ? lngLat(Number(m[2]), Number(m[1])) : null;
}

/** A point -> `<lat>,<lng>`. */
export function formatPointParam([lng, lat]: LngLat): string {
  return `${fixed(lat, 6)},${fixed(lng, 6)}`;
}

/** `?mode=` -> a travel mode (car when absent or unknown). */
export function parseModeParam(value: string | null | undefined): TravelMode {
  return value === "bike" || value === "foot" ? value : "car";
}

/** `?q=`: trimmed, control characters dropped, capped (e-store's `TextParamSchema`, shortened). */
export function parseTextParam(value: string | null | undefined): string {
  return (
    (value ?? "")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 200)
  );
}

/** What the Maps URL can say, as the server and the map read it. */
export type MapsUrlState = {
  camera: MapCamera | null;
  query: string;
  from: LngLat | null;
  to: LngLat | null;
  mode: TravelMode;
  /** `?node=<id>`: select that node and open the Nodes panel (the Devices page links here). */
  node: string | null;
};

/** A node id as the fleet writes them (`truck-4`, `drone-a`); anything else is ignored. */
export function parseNodeParam(value: string | null | undefined): string | null {
  return value && /^[a-z0-9-]{1,40}$/.test(value) ? value : null;
}

export function parseMapsUrl(params: URLSearchParams): MapsUrlState {
  return {
    node: parseNodeParam(params.get("node")),
    camera: parseCameraParam(params.get("at")),
    query: parseTextParam(params.get("q")),
    from: parsePointParam(params.get("from")),
    to: parsePointParam(params.get("to")),
    mode: parseModeParam(params.get("mode")),
  };
}

/**
 * The same URL with the view written in (the `history.replaceState` target, e-store's
 * `withMapsUrlView`): only the keys given change; `null` / empty removes a key.
 */
export function withMapsUrl(
  href: string,
  view: Partial<{
    camera: MapCamera;
    query: string;
    from: LngLat | null;
    to: LngLat | null;
    mode: TravelMode;
  }>,
): string {
  const url = new URL(href);
  const params = url.searchParams;
  if (view.camera) params.set("at", formatCameraParam(view.camera));
  if ("query" in view) {
    if (view.query) params.set("q", view.query);
    else params.delete("q");
  }
  for (const key of ["from", "to"] as const) {
    if (!(key in view)) continue;
    const point = view[key];
    if (point) params.set(key, formatPointParam(point));
    else params.delete(key);
  }
  if (view.mode) {
    if (view.mode === "car") params.delete("mode");
    else params.set("mode", view.mode);
  }
  // `URLSearchParams` writes `,` as `%2C`; a comma is allowed in a query (RFC 3986 sub-delims),
  // so the link stays readable: `?at=48.8584,2.2945,13z`.
  return url.toString().replace(/%2C/gi, ",");
}
