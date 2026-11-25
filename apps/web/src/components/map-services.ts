/**
 * The Maps app's place search and directions: free, keyless public services called from the
 * visitor's browser. Behind e-store's provider shapes (`packages/maps/src/engine/types.ts`
 * `PlaceSearchProvider.suggest`, `RouteProvider.route`; its `RouteStep` = `{ text, distanceM }`),
 * but e-store only has MOCK providers (`services/mock.ts`), so the real ones are new here.
 *
 * Providers and their terms (read 2026-11-24):
 * - Place search and reverse lookup: Photon by komoot, https://photon.komoot.io/ , OpenStreetMap
 *   data. "You can use the API for your project, but please be fair - extensive usage will be
 *   throttled." No key, CORS open. Built for search-as-you-type, which Nominatim's policy forbids
 *   ("you must not implement such a service on the client side using the API",
 *   https://operations.osmfoundation.org/policies/nominatim/), so Nominatim is not used.
 * - Directions: FOSSGIS's public OSRM servers, https://routing.openstreetmap.de/about.html :
 *   car, bike and foot, worldwide. "One request per second max." "No scraping, no heavy usage."
 *   "Use a valid user agent and, if applicable, a correct referrer." Attribution with a link to
 *   fix the map. Not router.project-osrm.org: its demo runs car only in practice and is
 *   "restricted to reasonable, non-commercial use-cases".
 * Both are PUBLIC DEMO SERVICES with no guarantee: the panel says so. The browser sends its own
 * User-Agent and the page's Referer (origin only by the default referrer policy); nothing
 * personal is sent, only the query text, a point or two, and the map's center as a search bias.
 *
 * Courtesy, so a visitor never comes near the limits: search runs 400 ms after typing stops,
 * from 3 characters, at most 5 results, answers cached per query for the page's life, the
 * previous request aborted; a route is fetched only when both stops are set, once per
 * from / to / mode, cached; a map click asks for one reverse lookup.
 */
import type { LngLat, TravelMode } from "./map-url";

/** A 429 (too many requests): the service asks us to slow down; said so, not retried. */
export const BUSY = "The service is busy. Try again in a moment.";

export const PHOTON_URL = "https://photon.komoot.io";
export const ROUTER_URL = "https://routing.openstreetmap.de";

/** A search result (e-store's `PlaceSuggestion` plus where it is). */
export type MapPlace = {
  id: string;
  name: string;
  /** City, region, country: the second line. */
  detail: string;
  lngLat: LngLat;
  /** `[west, south, east, north]` when the place is an area. */
  bbox?: [number, number, number, number];
  /** "City, Country" (or "Region, Country", or the country): what a Location field stores. */
  area: string;
};

/** One step of a route (e-store's `RouteStep`). */
export type MapRouteStep = { text: string; distanceM: number };

export type MapRoute = {
  mode: TravelMode;
  distanceM: number;
  durationS: number;
  steps: MapRouteStep[];
  /** The line, `[lng, lat]` points. */
  coordinates: LngLat[];
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    /** Photon's layer: house, street, locality, district, city, county, state, country, other. */
    type?: string;
    osm_type?: string;
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    country?: string;
    extent?: [number, number, number, number];
  };
};

/** Photon's `extent` is `[minLon, maxLat, maxLon, minLat]`; MapLibre wants west, south, east, north. */
const toBbox = (
  e: [number, number, number, number] | undefined,
): MapPlace["bbox"] =>
  e
    ? [
        Math.min(e[0], e[2]),
        Math.min(e[1], e[3]),
        Math.max(e[0], e[2]),
        Math.max(e[1], e[3]),
      ]
    : undefined;

const toPlace = (f: PhotonFeature): MapPlace => {
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const name =
    p.name || street || p.city || p.state || p.country || "Unnamed place";
  const detail = [
    street !== name ? street : "",
    p.city ?? p.district,
    p.state,
    p.country,
  ]
    .filter((part, i, all) => part && part !== name && all.indexOf(part) === i)
    .join(", ");
  // A town-sized result names itself; anything smaller names the town it is in.
  const town =
    p.city ??
    (p.type && TOWN_LAYERS.has(p.type) ? p.name : undefined) ??
    p.county;
  const area = [
    town ?? p.state ?? (p.type === "state" ? p.name : undefined),
    p.country,
  ]
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(", ");
  return {
    id: `${p.osm_type ?? "X"}${p.osm_id ?? `${f.geometry.coordinates.join(",")}`}`,
    name,
    detail,
    lngLat: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
    bbox: toBbox(p.extent),
    area: area || name,
  };
};

/** Photon layers that ARE a town (Havana comes back as a `district` with `lang=en`). */
const TOWN_LAYERS = new Set(["city", "locality", "district"]);

/** Options a caller may add to a Photon request. */
export type PhotonOptions = {
  /** Photon's `lang` (`default`, `en`, `de`, `fr`): names in that language ("Havana", not "La Habana"). */
  lang?: string;
};

const searchCache = new Map<string, MapPlace[]>();

/** Places for `query`, nearest to `near` first (Photon's `lat` / `lon` bias). */
export async function searchPlaces(
  query: string,
  near: LngLat | null,
  signal?: AbortSignal,
  options: PhotonOptions = {},
): Promise<MapPlace[]> {
  const q = query.trim();
  // Round the bias so small pans hit the cache (and the service sees no precise position).
  const bias = near ? `${near[1].toFixed(1)},${near[0].toFixed(1)}` : "";
  const key = `${q.toLowerCase()}|${bias}|${options.lang ?? ""}`;
  const cached = searchCache.get(key);
  if (cached) return cached;
  const url = new URL("/api/", PHOTON_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "5");
  if (options.lang) url.searchParams.set("lang", options.lang);
  if (near) {
    url.searchParams.set("lat", near[1].toFixed(1));
    url.searchParams.set("lon", near[0].toFixed(1));
  }
  const response = await fetch(url, { signal });
  if (response.status === 429) throw new Error(BUSY);
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  const data = (await response.json()) as { features?: PhotonFeature[] };
  const places = (data.features ?? []).map(toPlace);
  searchCache.set(key, places);
  return places;
}

/** The place at a point (Photon `/reverse`), or null. */
export async function reversePlace(
  point: LngLat,
  signal?: AbortSignal,
  options: PhotonOptions = {},
): Promise<MapPlace | null> {
  const url = new URL("/reverse", PHOTON_URL);
  url.searchParams.set("lat", point[1].toFixed(6));
  url.searchParams.set("lon", point[0].toFixed(6));
  url.searchParams.set("limit", "1");
  if (options.lang) url.searchParams.set("lang", options.lang);
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const data = (await response.json()) as { features?: PhotonFeature[] };
  const feature = data.features?.[0];
  // The clicked point, not the feature's: the route starts where the visitor clicked.
  return feature ? { ...toPlace(feature), lngLat: point } : null;
}

/** FOSSGIS's servers, one per mode (the path's profile segment is ignored by them). */
const PROFILE_PATH: Record<TravelMode, string> = {
  car: "routed-car/route/v1/driving",
  bike: "routed-bike/route/v1/driving",
  foot: "routed-foot/route/v1/driving",
};

type OsrmStep = {
  name?: string;
  ref?: string;
  distance: number;
  maneuver: {
    type: string;
    modifier?: string;
    exit?: number;
    bearing_after?: number;
  };
};
type OsrmResponse = {
  code: string;
  message?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs: { steps: OsrmStep[] }[];
  }[];
};

/** A bearing in degrees -> "north", "northeast", ... */
const compass = (bearing = 0) =>
  [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ][Math.round((((bearing % 360) + 360) % 360) / 45) % 8];

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/**
 * OSRM gives each step a maneuver (`type`, `modifier`) and a street name, not a sentence
 * (osrm-backend docs, "StepManeuver"). The wording is ours, short and in English, after the
 * maneuver types the API lists: depart, turn, new name, merge, on / off ramp, fork, end of road,
 * continue, roundabout / rotary, arrive.
 */
export function stepText(step: OsrmStep): string {
  const { type, modifier, exit } = step.maneuver;
  const road = step.name || step.ref || "";
  const onto = road ? ` onto ${road}` : "";
  const dir = modifier ?? "";
  switch (type) {
    case "depart": {
      // A depart's modifier is relative to nothing the visitor sees; its compass bearing is.
      const heading = compass(step.maneuver.bearing_after);
      return road ? `Head ${heading} on ${road}` : `Head ${heading}`;
    }
    case "arrive":
      return "Arrive at your destination";
    case "roundabout":
    case "rotary":
    case "roundabout turn":
      return exit
        ? `At the roundabout, take the ${ordinal(exit)} exit${onto}`
        : `Enter the roundabout${onto}`;
    case "exit roundabout":
    case "exit rotary":
      return `Exit the roundabout${onto}`;
    case "merge":
      return `Merge${dir ? ` ${dir}` : ""}${onto}`;
    case "on ramp":
      return `Take the ramp${dir ? ` on the ${dir.replace("slight ", "")}` : ""}${onto}`;
    case "off ramp":
      return `Take the exit${dir ? ` on the ${dir.replace("slight ", "")}` : ""}${onto}`;
    case "fork":
      return `Keep ${dir.replace("slight ", "") || "straight"} at the fork${onto}`;
    case "end of road":
      return `Turn ${dir || "at the end of the road"}${onto}`;
    case "continue":
    case "new name":
      return dir && dir !== "straight"
        ? `Continue ${dir}${onto}`
        : `Continue${onto}`;
    default:
      if (dir === "uturn") return `Make a U-turn${onto}`;
      if (dir === "straight") return `Go straight${onto}`;
      return `Turn ${dir || "ahead"}${onto}`;
  }
}

const routeCache = new Map<string, MapRoute>();

/** A route from `from` to `to` for `mode`, with steps and the line. */
export function fetchRoute(
  from: LngLat,
  to: LngLat,
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<MapRoute> {
  return fetchRouteThrough([from, to], mode, signal);
}

/**
 * A route through every stop in order (OSRM takes up to many `;`-separated coordinates in ONE
 * request: a loop A;B;C;A is one call, not three). Used by the dummy nodes' road programs
 * (`map-nodes-programs.ts`), which fetch once per vehicle and cache it.
 */
export async function fetchRouteThrough(
  stops: LngLat[],
  mode: TravelMode,
  signal?: AbortSignal,
  /**
   * `steps: false` leaves out the turn-by-turn text (the nodes need only the line);
   * `radius`: metres a stop may snap to a road (OSRM `radiuses`, so a stop in a field fails
   * instead of snapping far away); `straight`: OSRM `continue_straight=true`, no U-turns at the
   * stops. OSRM API v5.24 (project-osrm.org/docs/v5.24.0/api, read 2026-11-24).
   */
  options: { steps?: boolean; radius?: number; straight?: boolean } = {},
): Promise<MapRoute> {
  const { steps = true, radius, straight } = options;
  const pair = stops
    .map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join(";");
  const key = `${mode}|${pair}|${steps}|${radius ?? ""}|${straight ?? ""}`;
  const cached = routeCache.get(key);
  if (cached) return cached;
  const url = new URL(`/${PROFILE_PATH[mode]}/${pair}`, ROUTER_URL);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", String(steps));
  if (radius)
    url.searchParams.set("radiuses", stops.map(() => radius).join(";"));
  if (straight) url.searchParams.set("continue_straight", "true");
  const response = await fetch(url, { signal });
  if (response.status === 429) throw new Error(BUSY);
  const data = (await response.json().catch(() => null)) as OsrmResponse | null;
  const best = data?.routes?.[0];
  if (!response.ok || !data || data.code !== "Ok" || !best) {
    throw new Error(
      data?.code === "NoRoute"
        ? "No route between these places."
        : `Directions failed (${data?.message ?? response.status})`,
    );
  }
  const route: MapRoute = {
    mode,
    distanceM: best.distance,
    durationS: best.duration,
    steps: best.legs.flatMap((leg) =>
      leg.steps.map((s) => ({ text: stepText(s), distanceM: s.distance })),
    ),
    coordinates: best.geometry.coordinates.map(
      ([lng, lat]) => [lng, lat] as LngLat,
    ),
  };
  routeCache.set(key, route);
  return route;
}

/** e-store's `formatDistance` (`model/places.ts`): metres under 1 km, else km to 0.1. */
export function formatDistance(metres: number, locale = "en"): string {
  if (metres < 1000) {
    const m = Math.max(10, Math.round(metres / 10) * 10);
    return `${new Intl.NumberFormat(locale).format(m)} m`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metres / 1000)} km`;
}

/** e-store's `formatDuration`: "1 hr 5 min" / "12 min". */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
}

/** A point as text, latitude first (for a stop picked on the map with no name). */
export const pointLabel = ([lng, lat]: LngLat) =>
  `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
