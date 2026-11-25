import type { LngLat } from "../components/map-url";

/**
 * Where Cloudflare places a request (`GET /api/here`, 2026-11-25). From `request.cf`'s
 * geographic fields (Cloudflare docs, Workers runtime APIs > Request > `IncomingRequestCfProperties`;
 * `@cloudflare/workers-types` `IncomingRequestCfPropertiesGeographicInformation`): `city`,
 * `region`, `country` (ISO 3166-1 alpha-2; `"T1"` = Tor), `timezone`, and `latitude` /
 * `longitude` as STRINGS. All may be missing. The docs give no accuracy: it is IP geolocation,
 * so it is shown as "approximate". Client-safe (types and a pure parse only).
 */
export type Here = {
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
  /** [lng, lat] rounded to 2 decimals (about 1 km); null when unknown. */
  lngLat: LngLat | null;
};

export const UNKNOWN_HERE: Here = {
  city: null,
  region: null,
  country: null,
  timezone: null,
  lngLat: null,
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim() && value.length <= 100
    ? value.trim()
    : null;

/** A coordinate string (or number) as a number in `[-limit, limit]`, else null. */
function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** 2 decimals (about 1.1 km of latitude): the source is city-level anyway. */
const round2 = (n: number) => Math.round(n * 100) / 100 || 0;

/**
 * `request.cf` (untrusted shape: an object, or nothing) as `Here`. Tor (`country: "T1"`) has no
 * place: everything null. Missing or unparsable latitude / longitude: `lngLat` null.
 */
export function parseHere(cf: unknown): Here {
  if (!cf || typeof cf !== "object") return UNKNOWN_HERE;
  const c = cf as Record<string, unknown>;
  const country = text(c.country);
  if (country === "T1") return UNKNOWN_HERE;
  const lat = coordinate(c.latitude, 90);
  const lng = coordinate(c.longitude, 180);
  return {
    city: text(c.city),
    region: text(c.region),
    country,
    timezone: text(c.timezone),
    lngLat: lat !== null && lng !== null ? [round2(lng), round2(lat)] : null,
  };
}

/** A `GET /api/here` answer checked (the response is data from the network). */
export function isHere(value: unknown): value is Here {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const ok = (x: unknown) => x === null || typeof x === "string";
  const point =
    v.lngLat === null ||
    (Array.isArray(v.lngLat) &&
      v.lngLat.length === 2 &&
      v.lngLat.every((n) => typeof n === "number" && Number.isFinite(n)));
  return ok(v.city) && ok(v.region) && ok(v.country) && ok(v.timezone) && point;
}

/** "Austin, Texas, US"; null when nothing is known. */
export function hereLabel(here: Here | null): string | null {
  if (!here) return null;
  const parts = [here.city, here.region, here.country].filter(
    (p): p is string => !!p,
  );
  return parts.length ? [...new Set(parts)].join(", ") : null;
}
