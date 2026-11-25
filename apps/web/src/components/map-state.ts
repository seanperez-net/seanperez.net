import { createContextId, useContextProvider, useStore } from "@qwik.dev/core";
import type { Signal } from "@qwik.dev/core";
import type { MapNode } from "./map-nodes";
import type { MapPlace, MapRoute } from "./map-services";
import type { StyleGroupId, StyleOverrides } from "./map-style-groups";
import type { LngLat, MapCamera, TravelMode } from "./map-url";

/**
 * The Maps app's shared state: what the side panel (search, directions, style) and the map in the
 * primary pane both read. Provided by `routes/layout.tsx`, their one common ancestor, through
 * `useMapsProvider()` (one line there), with the layout's `activeCompanion` and
 * `supportExpanded` signals.
 *
 * ONE store, `deep: false` (Qwik rc.5 docs, "State": nested objects are tracked unless
 * `{ deep: false }`): every field is REPLACED, never mutated, so a route's thousands of points
 * are not wrapped in proxies. Plain JSON only: no MapLibre object (that lives in `MapView`).
 * Before 2026-11-24 this was one `Signal<string>` (the map style, `map-style.ts`).
 */

/** The map's own theme: `site` follows the site's light / dark; `light` / `dark` pin it. */
export type MapStyle = "site" | "light" | "dark";

/** A directions stop: a place from the search, or a point picked on the map. */
export type MapStop = { label: string; lngLat: LngLat };

export type MapsState = {
  /** The map's style choice (the Style panel). */
  style: MapStyle;
  /** The place chosen in the search (a marker), or null. */
  place: MapPlace | null;
  /** The search text as it should appear in `?q=`. */
  query: string;
  /**
   * The Search panel's box text and its last results, kept here so they survive a switch to
   * another companion and back (the panel unmounts; forms audit 2026-11-24, decision 2). Not
   * saved to storage. `query` above is the chosen place's name for the URL, not the typed text.
   */
  searchText: string;
  searchResults: MapPlace[];
  from: MapStop | null;
  to: MapStop | null;
  mode: TravelMode;
  route: MapRoute | null;
  routeStatus: "idle" | "loading" | "error";
  routeError: string;
  /** The next map click sets this stop (a "Choose on map" button), or null. */
  pick: "from" | "to" | null;
  /** The style editor's overrides, per group. */
  overrides: StyleOverrides;
  /** Each group's color in the base style now loaded (the color inputs' starting values). */
  baseColors: Partial<Record<StyleGroupId, string>>;
  /** The map's camera, as it last settled (the search's bias, the URL). */
  camera: MapCamera | null;
  /** A camera move the panel asks for; `seq` lets the same place be asked twice. */
  flyTo: {
    center: LngLat;
    zoom?: number;
    bbox?: [number, number, number, number];
    seq: number;
  } | null;
  /** Bumped by Reset: the map reloads its style without overrides. */
  resetSeq: number;
  /** Prefs and URL have been read into the store (the map's first task). */
  ready: boolean;
  /** The nodes' latest reports (the Nodes layer, `map-nodes.ts`), replaced each tick. */
  nodes: MapNode[];
  /** The node chosen in the list or on the map, or null. */
  selectedNode: string | null;
  /** The Nodes layer's show / hide switch (a pref). */
  nodesShown: boolean;
};

export const mapsContextId = createContextId<MapsState>(
  "net.seanperez.web.maps",
);

/**
 * The layout's `activeCompanion` signal (which side panel is open), so a Maps panel can switch to
 * another (the Search panel's "Directions" button). Owned by `routes/layout.tsx`.
 */
export const mapsCompanionContextId = createContextId<Signal<string | null>>(
  "net.seanperez.web.maps-companion",
);

/**
 * The layout's `supportExpanded` signal (whether the side panel is open), so a click on a node on
 * the map can open the Nodes panel. Owned by `routes/layout.tsx`.
 */
export const mapsSupportContextId = createContextId<Signal<boolean>>(
  "net.seanperez.web.maps-support",
);

/** `local-store.ts` names for the small prefs (style, overrides) and the last camera. */
export const MAPS_PREFS_KEY = "maps.prefs";
export const MAPS_CAMERA_KEY = "maps.camera";

/**
 * Creates and provides the Maps state. Call once, in `routes/layout.tsx`, with the layout's
 * `activeCompanion` and `supportExpanded` signals.
 */
export function useMapsProvider(
  activeCompanion: Signal<string | null>,
  supportExpanded: Signal<boolean>,
): MapsState {
  useContextProvider(mapsCompanionContextId, activeCompanion);
  useContextProvider(mapsSupportContextId, supportExpanded);
  const state = useStore<MapsState>(
    {
      style: "site",
      place: null,
      query: "",
      searchText: "",
      searchResults: [],
      from: null,
      to: null,
      mode: "car",
      route: null,
      routeStatus: "idle",
      routeError: "",
      pick: null,
      overrides: {},
      baseColors: {},
      camera: null,
      flyTo: null,
      resetSeq: 0,
      ready: false,
      nodes: [],
      selectedNode: null,
      nodesShown: true,
    },
    { deep: false },
  );
  useContextProvider(mapsContextId, state);
  return state;
}
