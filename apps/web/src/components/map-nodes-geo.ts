import type { LngLat } from "./map-url";

/**
 * Small geometry for the dummy nodes' programs (`map-nodes-programs.ts`). Spherical Earth
 * (R = 6,371,008.8 m, the IUGG mean radius); good to well under 1% at the few-km scale the
 * nodes move on. Formulas: the haversine distance, the initial bearing, and spherical linear
 * interpolation along the great circle (Ed Williams, "Aviation Formulary",
 * edwilliams.org/avform147.htm, "Intermediate points on a great circle"). NOT PROOFED against
 * a library; the panel shows positions to 5 decimals only.
 */

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Metres between two points (haversine). */
export function distance(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from true north (0-360). */
export function bearing(a: LngLat, b: LngLat): number {
  const [l1, p1, l2, p2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const y = Math.sin(l2 - l1) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) -
    Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** The point a fraction `f` (0-1) of the way from a to b along the great circle. */
export function greatCircle(a: LngLat, b: LngLat, f: number): LngLat {
  const d = distance(a, b) / R;
  if (d < 1e-9) return a;
  const [l1, p1, l2, p2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
  const z = A * Math.sin(p1) + B * Math.sin(p2);
  return [deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.hypot(x, y)))];
}

/** A point `metres` from `p` on `bearingDeg` (for placing waypoints around an anchor). */
export function offset(p: LngLat, metres: number, bearingDeg: number): LngLat {
  const d = metres / R;
  const t = rad(bearingDeg);
  const p1 = rad(p[1]);
  const l1 = rad(p[0]);
  const p2 = Math.asin(
    Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t),
  );
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(t) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * Math.sin(p2),
    );
  return [deg(l2), deg(p2)];
}

/** A polyline with the distance to each vertex, for driving along it. */
export type Polyline = { points: LngLat[]; at: number[]; length: number };

export function polyline(points: LngLat[]): Polyline {
  const at = [0];
  for (let i = 1; i < points.length; i++)
    at.push(at[i - 1] + distance(points[i - 1], points[i]));
  return { points, at, length: at[at.length - 1] ?? 0 };
}

/** Position and heading `d` metres along a polyline (straight between vertices). */
export function along(
  line: Polyline,
  d: number,
): { p: LngLat; heading: number } {
  const { points, at } = line;
  if (points.length < 2) return { p: points[0] ?? [0, 0], heading: 0 };
  // Binary search for the segment holding d.
  let lo = 1;
  let hi = at.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (at[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const a = points[lo - 1];
  const b = points[lo];
  const span = at[lo] - at[lo - 1] || 1;
  const f = Math.min(1, Math.max(0, (d - at[lo - 1]) / span));
  return {
    p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f],
    heading: bearing(a, b),
  };
}

/** Smallest difference between two headings, -180..180. */
export const turn = (from: number, to: number) =>
  ((to - from + 540) % 360) - 180;

/** Ray casting: is `p` inside a polygon given as rings (outer first, then holes)? */
export function inPolygon(p: LngLat, rings: LngLat[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (
        yi > p[1] !== yj > p[1] &&
        p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
      )
        inside = !inside;
    }
  }
  return inside;
}
