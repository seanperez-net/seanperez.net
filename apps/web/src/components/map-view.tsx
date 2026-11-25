import {
  component$,
  noSerialize,
  useContext,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";
import type { NoSerialize } from "@qwik.dev/core";
import { isBrowser } from "@qwik.dev/core/build";
import {
  Map as MapLibreMap,
  ScaleControl,
  prewarm,
  setWorkerUrl,
} from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?inline";
import mapControlsCss from "./map-view.css?inline";
import { MapControls } from "./map-controls";
import {
  fetchRoute,
  pointLabel,
  reversePlace,
  searchPlaces,
} from "./map-services";
import { readPref, writePref } from "../local-store";
import { createLiveNodeSource } from "./map-nodes-live";
import { NODE_KINDS } from "./map-nodes";
import type { MapNode } from "./map-nodes";
import { turn } from "./map-nodes-geo";
import {
  MAPS_CAMERA_KEY,
  MAPS_PREFS_KEY,
  mapsCompanionContextId,
  mapsContextId,
  mapsSupportContextId,
} from "./map-state";
import type { MapsState, MapStyle } from "./map-state";
import {
  STYLE_GROUPS,
  applyOverrides,
  overridePaint,
  groupColor,
  layerGroup,
  readOverrides,
} from "./map-style-groups";
import type {
  LayerSpecification,
  StyleSpecification,
} from "./map-style-groups";
import { parseCameraParam, withMapsUrl } from "./map-url";
import type { LngLat, MapCamera, MapsUrlState } from "./map-url";

/**
 * The Maps app's map: MapLibre GL JS 6 over OpenFreeMap's vector tiles, driven by the shared
 * Maps state (`map-state.ts`) that the side panel writes. Cut down from e-store's
 * `packages/maps` (`engine/maplibre.ts`, `components/map-view.tsx`, `maps-explorer.tsx`).
 *
 * PROOFED 2026-11-23 (the base map): installed maplibre-gl 6.19.0 (`setWorkerUrl`, `trackResize`,
 * `attributionControl`, `reduceMotion` follows the device), openfreemap.org (terms), Qwik rc.5
 * (`useVisibleTask$`); a fresh agent reviewed it. PROOFED 2026-11-24 (the playground): the same
 * d.ts for `prewarm`, `transformStyle`, `setPaintProperty`, `setLayoutProperty`, `GeoJSONSource.
 * setData`, `fitBounds`, `flyTo`, `GeolocateControl`, `ScaleControl`, `customAttribution`; Qwik
 * rc.5 docs "State" (`noSerialize` for a library instance made in `useVisibleTask$`, `useStore`
 * `deep: false`); a second fresh agent reviewed the plan (see the report in PLAN.md).
 *
 * - Startup (owner-approved 2026-11-24, e-store's order): the route reads `?at=` & co. on the
 *   server and passes them in; the first task reads `local-store.ts` (style choice, style overrides, last
 *   camera) BEFORE `new Map`; the URL wins over storage. `setWorkerUrl` then
 *   `prewarm()` (MapLibre: create the worker pool before the first map).
 * - Camera to URL: on `moveend` the camera goes into the state; a task writes `?at=` (and `?q=`,
 *   `?from=`, `?to=`, `?mode=`) 400 ms later with `history.replaceState(history.state, ...)`, so a
 *   pan is never a history entry and Back leaves `/maps/` (e-store's `maps-explorer.tsx`). The
 *   router is not told; nothing re-renders.
 * - Style overrides: live with `setPaintProperty` / `setLayoutProperty`; every style the map loads
 *   (light / dark, Reset) goes through `transformStyle`, which writes the overrides in and adds our
 *   own route and stop layers, so nothing is lost on a style swap.
 * - Tiles and style: OpenFreeMap's `positron` (light) and `dark`. Free, keyless, attribution
 *   required (openfreemap.org, read 2026-11-23). Search and routing credits are added to MapLibre's
 *   attribution control (`customAttribution`), with links to the services.
 * - Size: MapLibre follows its container (`trackResize`); the MapLibre stylesheet is adopted once,
 *   with the map's chunk (`adoptMapLibreCss`).
 * - Nodes (2026-11-24, new, not in e-store; a fresh agent reviewed it): `map-nodes.ts`. One
 *   GeoJSON source of points (the selected one marked by a property) and one of trails, each
 *   `setData` once per source tick; the arrow image comes back through
 *   `setMissingStyleImageResolver` after every style swap. Read against maplibre-gl 6.19.0's d.ts
 *   and shipped code (`flyTo` is instant under prefers-reduced-motion unless `essential`).
 * - Static imports only (repo rule): MapLibre is used only inside visible tasks, so the optimizer
 *   puts it in their chunks; the server render strips the task bodies.
 */

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

/**
 * Where the map opens with nothing in the URL or storage: Cuba (owner, 2026-11-24: "open maps on
 * cuba"), the whole island fitted to the map (`bounds`, so a phone gets a lower zoom than a
 * desktop). The dummy nodes live in Havana. `DEFAULT_CAMERA` is only the store's first value
 * until the map reports its fitted camera.
 */
const CUBA_BOUNDS: [LngLat, LngLat] = [
  [-85.0, 19.8],
  [-74.1, 23.3],
];
const DEFAULT_CAMERA: MapCamera = { center: [-79.55, 21.55], zoom: 5.5 };

const CREDITS = [
  '<a href="https://photon.komoot.io/" target="_blank" rel="noopener">Search: Photon by komoot</a>',
  '<a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">Routing: FOSSGIS OSRM</a>',
];

/** Which style the map's choice and the page's theme want now. */
const styleUrl = (choice: MapStyle) => {
  if (choice === "light") return STYLE_LIGHT;
  if (choice === "dark") return STYLE_DARK;
  return document.documentElement.classList.contains("dark")
    ? STYLE_DARK
    : STYLE_LIGHT;
};

/** Documents that already carry MapLibre's stylesheet (once each, never removed). */
const styledDocuments = new WeakSet<Document>();

/**
 * MapLibre's stylesheet (71 KB), then our controls' (`map-view.css`: M3 roles, inset inside the
 * pane), given to the document once, before the first map. Ours comes second so its rules win
 * MapLibre's at equal specificity.
 */
function adoptMapLibreCss(doc: Document) {
  if (styledDocuments.has(doc)) return;
  styledDocuments.add(doc);
  const sheets = [maplibreCss, mapControlsCss].map((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
  });
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, ...sheets];
}

/** What `GeoJSONSource.setData` takes (maplibre-gl's own type; no `@types/geojson` here). */
type GeoJsonData = Extract<
  Parameters<GeoJSONSource["setData"]>[0],
  { type: "FeatureCollection" }
>;
type PaintName = Parameters<MapLibreMap["setPaintProperty"]>[1];

const SOURCE_ROUTE = "maps-route";
const SOURCE_STOPS = "maps-stops";
const SOURCE_NODES = "maps-nodes";
const SOURCE_TRAILS = "maps-node-trails";
const LAYER_NODES = "maps-nodes";
/** Every Nodes layer, for the show / hide switch. */
const NODE_LAYERS = [
  "maps-node-trails",
  LAYER_NODES,
  "maps-node-arrows",
  "maps-node-labels",
];
/** The heading arrow, drawn on a canvas on first use (`setMissingStyleImageResolver`). */
const NODE_ARROW = "maps-node-arrow";
/** Positions kept per moving node for its trail. */
const TRAIL_LENGTH = 30;
/**
 * Motion is drawn across the time between two reports, measured (the live hub ticks every 3 s,
 * the in-browser dummy every second), within these bounds.
 */
const NODE_GLIDE_MIN_MS = 500;
const NODE_GLIDE_MAX_MS = 5000;
/**
 * At most this often a frame redraws the nodes (20 fps). Each `setData` re-tiles the source in
 * MapLibre's workers (measured 2026-11-24: ~330 worker messages a second at 30 fps), so the glide
 * is kept cheap: 20 fps, only from zoom 12 (below, a tick's move is under a pixel), and nothing
 * drawn once a glide is done until the next report.
 */
const NODE_FRAME_MS = 50;
const NODE_GLIDE_ZOOM = 12;
/**
 * Redraws the nodes now (a new selection), set by the nodes task while the map lives. Module
 * scope, browser only: there is one map on the page, and a closure cannot cross into another
 * task's QRL.
 */
let redrawNodes: (() => void) | null = null;
/** A node that moved further than this in one tick (back from an outage) jumps, not glides. */
const NODE_JUMP_M = 400;

/** A Material 3 role's computed value (`rgb(...)` or hex), which MapLibre parses. */
const role = (name: string) =>
  getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${name}`)
    .trim() || "#6750a4";

const routeData = (state: MapsState): GeoJsonData => ({
  type: "FeatureCollection",
  features: state.route
    ? [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: state.route.coordinates,
          },
        },
      ]
    : [],
});

const stopsData = (state: MapsState): GeoJsonData => {
  const points: { kind: string; lngLat: [number, number] }[] = [];
  if (state.place) points.push({ kind: "place", lngLat: state.place.lngLat });
  if (state.from) points.push({ kind: "from", lngLat: state.from.lngLat });
  if (state.to) points.push({ kind: "to", lngLat: state.to.lngLat });
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      properties: { kind: p.kind },
      geometry: { type: "Point", coordinates: p.lngLat },
    })),
  };
};

/**
 * The nodes as points; `selected` marks the chosen one (no extra layer, no filter). `nodes` are
 * the reports, or their positions between two ticks while they glide.
 */
const nodesData = (nodes: MapNode[], selected: string | null): GeoJsonData => ({
  type: "FeatureCollection",
  features: nodes.map((n) => ({
    type: "Feature",
    properties: {
      id: n.id,
      // With its altitude while it flies ("Drone A · 80 m").
      // With its progress while a machine runs a job ("Ender 3 Pro · 42%").
      label: n.altitude
        ? `${n.name} · ${n.altitude} m`
        : n.status?.job && n.status.type !== "printer"
          ? `${n.name} · ${Math.round(n.status.progress)}%`
          : n.name,
      group: NODE_KINDS[n.kind].group,
      online: n.online,
      selected: n.id === selected,
      // Only moving nodes carry a heading: the arrow layer is filtered on it.
      ...(n.heading !== null && n.online ? { heading: n.heading } : {}),
    },
    geometry: { type: "Point", coordinates: n.lngLat },
  })),
});

/** Each moving node's last positions as a line. */
const trailsData = (trails: Map<string, LngLat[]>): GeoJsonData => ({
  type: "FeatureCollection",
  features: [...trails]
    .filter(([, points]) => points.length > 1)
    .map(([id, points]) => ({
      type: "Feature",
      properties: { id },
      geometry: { type: "LineString", coordinates: points },
    })),
});

/**
 * The heading arrow: a white triangle pointing up (north) on a canvas, as an SDF image so the
 * layer can tint it (`icon-color`). No request.
 */
function arrowImage(): ImageData {
  const size = 24 * devicePixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(1, 1);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.12);
  ctx.lineTo(size * 0.8, size * 0.84);
  ctx.lineTo(size * 0.5, size * 0.66);
  ctx.lineTo(size * 0.2, size * 0.84);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

/** The font of the base style's first text layer (labels need a font the style's glyphs have). */
function styleFont(style: StyleSpecification): string[] | undefined {
  for (const layer of style.layers) {
    if (layer.type !== "symbol") continue;
    const font = layer.layout?.["text-font"];
    if (Array.isArray(font) && font.every((f) => typeof f === "string"))
      return font as string[];
  }
  return undefined;
}

/**
 * The Nodes layers (new, not in e-store; its places layer is the model for the click and cursor
 * handling): the trails, a circle per node colored by kind, the heading arrow on moving nodes,
 * and the names from zoom 13. Offline nodes are grey; the selected one is larger with an
 * `on-surface` ring.
 */
function nodeLayers(state: MapsState, font?: string[]): LayerSpecification[] {
  const visibility = state.nodesShown ? "visible" : "none";
  const ring = role("surface-container-lowest");
  const kindColor = [
    "match",
    ["get", "group"],
    "tracker",
    role("primary"),
    "drone",
    role("tertiary"),
    "radio",
    role("secondary"),
    // Printers and CNC (2026-11-24): the primary family's darkest (light) / lightest (dark)
    // tone, apart from the trackers' `primary` and Wi-Fi's neutral fallback.
    "machine",
    role("on-primary-container"),
    role("on-surface-variant"),
  ];
  const layers: LayerSpecification[] = [
    {
      id: "maps-node-trails",
      type: "line",
      source: SOURCE_TRAILS,
      layout: { "line-join": "round", "line-cap": "round", visibility },
      paint: {
        "line-color": role("primary"),
        "line-width": 3,
        "line-opacity": 0.45,
      },
    },
    {
      id: LAYER_NODES,
      type: "circle",
      source: SOURCE_NODES,
      layout: { visibility },
      paint: {
        "circle-radius": ["case", ["get", "selected"], 13, 10],
        "circle-color": [
          "case",
          ["get", "online"],
          kindColor,
          role("outline"),
        ] as never,
        "circle-stroke-width": ["case", ["get", "selected"], 4, 2],
        "circle-stroke-color": [
          "case",
          ["get", "selected"],
          role("on-surface"),
          ring,
        ],
      },
    },
    {
      id: "maps-node-arrows",
      type: "symbol",
      source: SOURCE_NODES,
      filter: ["has", "heading"],
      layout: {
        "icon-image": NODE_ARROW,
        "icon-size": ["case", ["get", "selected"], 0.6, 0.5],
        "icon-rotate": ["get", "heading"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        visibility,
      },
      paint: { "icon-color": ring },
    },
  ];
  if (font) {
    layers.push({
      id: "maps-node-labels",
      type: "symbol",
      source: SOURCE_NODES,
      minzoom: 13,
      layout: {
        "text-field": ["get", "label"],
        "text-font": font,
        "text-size": 12,
        "text-offset": [0, 1.4],
        "text-anchor": "top",
        "text-optional": true,
        visibility,
      },
      paint: {
        "text-color": role("on-surface"),
        "text-halo-color": ring,
        "text-halo-width": 1.5,
      },
    });
  }
  return layers;
}

/**
 * Our own layers, on top of the base style: the route (a casing, then the line) and the stops
 * (search result, start, destination). Colored from the M3 roles at load time (as e-store's
 * route `--maps-color-route` = primary, its casing surface-container-lowest, selected tertiary).
 */
function ownLayers(
  state: MapsState,
  font?: string[],
): {
  sources: StyleSpecification["sources"];
  layers: LayerSpecification[];
} {
  const casing = role("surface-container-lowest");
  return {
    sources: {
      [SOURCE_ROUTE]: { type: "geojson", data: routeData(state) },
      [SOURCE_STOPS]: { type: "geojson", data: stopsData(state) },
      [SOURCE_NODES]: {
        type: "geojson",
        data: nodesData(state.nodes, state.selectedNode),
      },
      // Trails come back with the next tick after a style swap.
      [SOURCE_TRAILS]: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    layers: [
      {
        id: "maps-route-casing",
        type: "line",
        source: SOURCE_ROUTE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": casing, "line-width": 9 },
      },
      {
        id: "maps-route",
        type: "line",
        source: SOURCE_ROUTE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": role("primary"), "line-width": 5 },
      },
      ...nodeLayers(state, font),
      {
        id: "maps-stops",
        type: "circle",
        source: SOURCE_STOPS,
        paint: {
          "circle-radius": ["match", ["get", "kind"], "from", 6, 8],
          "circle-color": [
            "match",
            ["get", "kind"],
            "place",
            role("tertiary"),
            "from",
            casing,
            role("primary"),
          ],
          "circle-stroke-width": 3,
          "circle-stroke-color": [
            "match",
            ["get", "kind"],
            "from",
            role("primary"),
            casing,
          ],
        },
      },
    ],
  };
}

/** Pushes the state's route and stops into the live sources (once the style has them). */
function syncData(map: MapLibreMap, state: MapsState) {
  map.getSource<GeoJSONSource>(SOURCE_ROUTE)?.setData(routeData(state));
  map.getSource<GeoJSONSource>(SOURCE_STOPS)?.setData(stopsData(state));
  map
    .getSource<GeoJSONSource>(SOURCE_NODES)
    ?.setData(nodesData(state.nodes, state.selectedNode));
}

/** Writes the state's overrides onto the live style (colors and visibility, per group). */
function syncOverrides(map: MapLibreMap, state: MapsState) {
  if (!map.isStyleLoaded()) return;
  for (const layer of map.getStyle().layers) {
    const group = layerGroup(layer);
    if (!group) continue;
    const override = state.overrides[group];
    const paint = override?.color ? overridePaint(layer, override.color) : null;
    if (paint)
      map.setPaintProperty(layer.id, paint.prop as PaintName, paint.value);
    map.setLayoutProperty(
      layer.id,
      "visibility",
      override?.hidden ? "none" : "visible",
    );
  }
}

/** Reads the small prefs from storage (untrusted: only known values). */
function readPrefs(): Partial<
  Pick<MapsState, "style" | "overrides" | "nodesShown">
> & {
  camera?: MapCamera;
} {
  const raw =
    readPref(MAPS_PREFS_KEY, (value) =>
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : null,
    ) ?? {};
  const style = ["site", "light", "dark"].includes(raw.style as string)
    ? (raw.style as MapStyle)
    : undefined;
  const camera =
    readPref(MAPS_CAMERA_KEY, (value) =>
      typeof value === "string" ? parseCameraParam(value) : null,
    ) ?? undefined;
  const nodesShown =
    typeof raw.nodesShown === "boolean" ? raw.nodesShown : undefined;
  return {
    style,
    overrides: readOverrides(raw.overrides),
    nodesShown,
    camera,
  };
}

export type MapViewProps = {
  /** What the URL said when the page was requested (the route reads it on the server). */
  initial: MapsUrlState;
  /** The map canvas's accessible name. */
  label?: string;
};

export const MapView = component$<MapViewProps>(
  ({ initial, label = "Map" }) => {
    const mount = useSignal<HTMLElement>();
    const wrapper = useSignal<HTMLElement>();
    const state = useContext(mapsContextId);
    const companion = useContext(mapsCompanionContextId);
    const support = useContext(mapsSupportContextId);
    // The MapLibre map, browser only (Qwik docs: a library instance made in a visible task is
    // `noSerialize`d; it would be `undefined` after a resume, and is never serialized).
    const mapRef = useSignal<NoSerialize<MapLibreMap>>();

    // The map needs the element and WebGL: browser only, once the element is on screen.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ cleanup }) => {
      const container = mount.value;
      if (!container) return;

      // Storage first, then the URL over it (the URL wins).
      const prefs = readPrefs();
      if (prefs.style) state.style = prefs.style;
      if (prefs.overrides) state.overrides = prefs.overrides;
      if (prefs.nodesShown !== undefined) state.nodesShown = prefs.nodesShown;
      if (initial.from)
        state.from = { label: pointLabel(initial.from), lngLat: initial.from };
      if (initial.to)
        state.to = { label: pointLabel(initial.to), lngLat: initial.to };
      state.mode = initial.mode;
      // `?node=<id>` (the Devices page): that node selected, the Nodes panel open.
      if (initial.node) {
        state.selectedNode = initial.node;
        companion.value = "nodes";
        support.value = true;
      }
      const saved = initial.camera ?? prefs.camera;
      const camera = saved ?? DEFAULT_CAMERA;
      state.camera = camera;
      state.ready = true;

      // Global in MapLibre: the worker's URL, then the worker pool, before the first map.
      setWorkerUrl(maplibreWorkerUrl);
      prewarm();
      adoptMapLibreCss(container.ownerDocument);

      let currentChoice = state.style;
      let current = styleUrl(currentChoice);
      const map = new MapLibreMap({
        container,
        style: current,
        center: camera.center,
        zoom: camera.zoom,
        // No `?at=` and no saved camera: fit Cuba (overrides center / zoom, MapLibre's docs).
        ...(saved
          ? {}
          : { bounds: CUBA_BOUNDS, fitBoundsOptions: { padding: 24 } }),
        // Every style the map loads: the overrides written in, our layers added (MapLibre reuses
        // this transform for later `setStyle` calls).
        transformStyle: (_previous, next) => {
          state.baseColors = Object.fromEntries(
            STYLE_GROUPS.map((g) => [g.id, groupColor(next, g.id)]),
          );
          const styled = applyOverrides(next, state.overrides);
          const own = ownLayers(state, styleFont(next));
          return {
            ...styled,
            sources: { ...styled.sources, ...own.sources },
            layers: [...styled.layers, ...own.layers],
          };
        },
        attributionControl: { customAttribution: CREDITS },
        locale: { "Map.Title": label },
      });
      // Zoom, north, my location and full screen are OUR controls (`map-controls.tsx`, the
      // library's Toolbar, 2026-11-24), not MapLibre's Navigation / Geolocate / Fullscreen
      // controls. Attribution (a licence requirement) and the scale stay MapLibre's.
      // The scale sits in the bottom-end column, above the credits (MapLibre puts a later
      // bottom control first): at the bottom start the credits' compact box, as wide as the
      // map, ran over it (2026-11-24). e-store keeps its scale in the credits strip too.
      map.addControl(new ScaleControl({}), "bottom-right");

      // Data changed while the style was loading: push it once the style is in.
      map.on("style.load", () => syncData(map, state));
      const keepCamera = () => {
        const c = map.getCenter();
        state.camera = { center: [c.lng, c.lat], zoom: map.getZoom() };
      };
      map.on("moveend", keepCamera);
      // The Cuba fit happens in the constructor (no `moveend`): record the fitted view.
      if (!saved) keepCamera();
      // The heading arrow, made on first use and again after each style swap drops it.
      map.setMissingStyleImageResolver((id) => {
        if (id === NODE_ARROW && !map.hasImage(id))
          map.addImage(id, arrowImage(), {
            sdf: true,
            pixelRatio: devicePixelRatio,
          });
      });
      // A node under the pointer: the pointer cursor (the crosshair wins while picking a stop).
      map.on("mouseenter", LAYER_NODES, () => {
        if (!state.pick) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER_NODES, () => {
        map.getCanvas().style.cursor = state.pick ? "crosshair" : "";
      });
      // ONE click handler. "Choose on map" first: the next click sets that stop (one reverse
      // lookup, then off). Otherwise a click on a node selects it and opens the Nodes panel.
      map.on("click", async (event) => {
        const which = state.pick;
        if (!which) {
          const hit = map.getLayer(LAYER_NODES)
            ? map.queryRenderedFeatures(event.point, { layers: [LAYER_NODES] })
            : [];
          const id = hit[0]?.properties.id;
          if (typeof id !== "string") return;
          state.selectedNode = id;
          companion.value = "nodes";
          support.value = true;
          return;
        }
        state.pick = null;
        const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
        state[which] = { label: pointLabel(point), lngLat: point };
        const found = await reversePlace(point).catch(() => null);
        if (found && state[which]?.lngLat === point) {
          state[which] = { label: found.name, lngLat: point };
        }
      });

      // Light / dark: the library's theme toggles the `dark` class on <html>; the Style panel's
      // choice is rendered as `data-map-style` on the container. One observer for both.
      const observer = new MutationObserver(() => {
        currentChoice =
          (container.dataset.mapStyle as MapStyle | undefined) ?? "site";
        const next = styleUrl(currentChoice);
        if (next === current) return;
        current = next;
        map.setStyle(next);
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      observer.observe(container, {
        attributes: true,
        attributeFilter: ["data-map-style"],
      });

      mapRef.value = noSerialize(map);

      // `?q=`: search it once and show the first result (fly there only without `?at=`).
      if (initial.query) {
        state.query = initial.query;
        void searchPlaces(initial.query, camera.center)
          .then((places) => {
            const first = places[0];
            if (!first || state.place) return;
            state.place = first;
            if (!initial.camera) {
              state.flyTo = {
                center: first.lngLat,
                zoom: 14,
                bbox: first.bbox,
                seq: Date.now(),
              };
            }
          })
          .catch(() => undefined);
      }

      cleanup(() => {
        observer.disconnect();
        mapRef.value = undefined;
        // Frees the WebGL context and the worker's tiles for this map.
        map.remove();
      });
    });

    // Route, stops: into the map's sources whenever they change.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      const map = track(() => mapRef.value);
      track(() => [state.route, state.place, state.from, state.to]);
      if (map && map.isStyleLoaded()) syncData(map, state);
    });

    // The Nodes layer: one source (the live hub, `map-nodes-live.ts`, which falls back to the
    // in-browser dummy), its reports into the
    // store once a tick (the panel), the trails once a tick, and the points drawn GLIDING from
    // where they are to the new report across one tick (a requestAnimationFrame loop, at most
    // ~30 fps; the browser pauses it in a hidden tab). Under prefers-reduced-motion there is no
    // loop: the points jump once a tick. MapLibre keeps one worker update in flight and drops the
    // waiting ones, so frames never pile up (reviewed in maplibre-gl 6.19's `setData`).
    // Started with the map, stopped with it: leaving /maps/ unmounts this component; the cleanup
    // cancels the frame, unsubscribes (which stops the dummy's timer and its route requests).
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track, cleanup }) => {
      const map = track(() => mapRef.value);
      if (!map) return;
      const source = createLiveNodeSource();
      const trails = new Map<string, LngLat[]>();
      /** The hub's trails are taken once, so a new visitor sees where vehicles have been. */
      let trailsSeeded = false;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)");
      /** Where each node was drawn last, and the report it is gliding to. */
      let from = new Map<string, MapNode>();
      let to: MapNode[] = [];
      let tickAt = performance.now();
      let glideMs = 1000;
      let frame = 0;
      let drawnAt = 0;
      /** This tick's final positions are on the map; no more frames until the next tick. */
      let settled = false;

      const draw = (nodes: MapNode[]) => {
        if (!state.nodesShown) return;
        map
          .getSource<GeoJSONSource>(SOURCE_NODES)
          ?.setData(nodesData(nodes, state.selectedNode));
      };
      /** The nodes a fraction `f` of the way from where they were drawn to their reports. */
      const between = (f: number): MapNode[] =>
        to.map((n) => {
          const a = from.get(n.id);
          if (!a || !n.online) return n;
          const [x0, y0] = a.lngLat;
          const [x1, y1] = n.lngLat;
          if (Math.hypot((x1 - x0) * 68_000, (y1 - y0) * 111_000) > NODE_JUMP_M)
            return n;
          const heading =
            a.heading !== null && n.heading !== null
              ? (a.heading + turn(a.heading, n.heading) * f + 360) % 360
              : n.heading;
          const altitude =
            a.altitude !== undefined && n.altitude !== undefined
              ? Math.round(a.altitude + (n.altitude - a.altitude) * f)
              : n.altitude;
          return {
            ...n,
            lngLat: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f],
            heading,
            altitude,
          };
        });
      const loop = (now: number) => {
        frame = requestAnimationFrame(loop);
        if (settled || now - drawnAt < NODE_FRAME_MS) return;
        drawnAt = now;
        const f =
          map.getZoom() < NODE_GLIDE_ZOOM
            ? 1
            : Math.min(1, (now - tickAt) / glideMs);
        settled = f === 1;
        draw(between(f));
      };

      redrawNodes = () => {
        if (frame) settled = false;
        else draw(to);
      };
      // `?node=<id>`: fly to it once, on its first report (not over a `?at=` view).
      let flewToNode = !initial.node || !!initial.camera;
      const unsubscribe = source.subscribe((nodes: MapNode[]) => {
        if (!flewToNode) {
          flewToNode = true;
          const node = nodes.find((n) => n.id === initial.node);
          if (node)
            state.flyTo = { center: node.lngLat, zoom: 15, seq: Date.now() };
        }
        if (!trailsSeeded) {
          const known = source.trails?.() ?? {};
          if (Object.keys(known).length) {
            trailsSeeded = true;
            for (const [id, points] of Object.entries(known))
              if (!trails.has(id)) trails.set(id, points.slice(-TRAIL_LENGTH));
          }
        }
        for (const n of nodes) {
          const group = NODE_KINDS[n.kind].group;
          if (group !== "tracker" && group !== "drone") continue;
          const points = trails.get(n.id) ?? [];
          const last = points[points.length - 1];
          if (last?.[0] !== n.lngLat[0] || last[1] !== n.lngLat[1]) {
            points.push(n.lngLat);
            if (points.length > TRAIL_LENGTH) points.shift();
          }
          trails.set(n.id, points);
        }
        state.nodes = nodes;
        map
          .getSource<GeoJSONSource>(SOURCE_TRAILS)
          ?.setData(trailsData(trails));
        // Glide from where each node is drawn NOW (mid-glide included) to its new report.
        const now = performance.now();
        const drawn = to.length
          ? between(Math.min(1, (now - tickAt) / glideMs))
          : nodes;
        from = new Map(drawn.map((n) => [n.id, n]));
        to = nodes;
        glideMs = Math.min(
          NODE_GLIDE_MAX_MS,
          Math.max(NODE_GLIDE_MIN_MS, now - tickAt),
        );
        tickAt = now;
        settled = false;
        if (reduce.matches) {
          cancelAnimationFrame(frame);
          frame = 0;
          draw(nodes);
        } else if (!frame) {
          frame = requestAnimationFrame(loop);
        }
      });
      cleanup(() => {
        cancelAnimationFrame(frame);
        redrawNodes = null;
        unsubscribe();
        state.nodes = [];
      });
    });

    // The selected node, drawn at once (the next frame, or now under reduced motion).
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      track(() => mapRef.value);
      track(() => state.selectedNode);
      redrawNodes?.();
    });

    // The Nodes layer's show / hide switch.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      const map = track(() => mapRef.value);
      const shown = track(() => state.nodesShown);
      if (!map || !map.isStyleLoaded()) return;
      for (const id of NODE_LAYERS) {
        if (map.getLayer(id))
          map.setLayoutProperty(id, "visibility", shown ? "visible" : "none");
      }
    });

    // Style overrides, live.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      const map = track(() => mapRef.value);
      track(() => state.overrides);
      if (map) syncOverrides(map, state);
    });

    // Reset: reload the style without overrides (the originals come back).
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      const map = track(() => mapRef.value);
      const seq = track(() => state.resetSeq);
      if (map && seq > 0) map.setStyle(styleUrl(state.style), { diff: false });
    });

    // Camera moves the panel asks for (a search result, a new route).
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      const map = track(() => mapRef.value);
      const target = track(() => state.flyTo);
      if (!map || !target) return;
      if (target.bbox) {
        map.fitBounds(target.bbox, { padding: 64, maxZoom: target.zoom ?? 16 });
      } else {
        map.flyTo({
          center: target.center,
          zoom: target.zoom ?? map.getZoom(),
        });
      }
    });

    // "Choose on map": a crosshair while a pick is pending.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      const map = track(() => mapRef.value);
      const pick = track(() => state.pick);
      if (map) map.getCanvas().style.cursor = pick ? "crosshair" : "";
    });

    // Directions: fetched when both stops and the mode are set, 300 ms after the last change, the
    // previous request aborted (FOSSGIS: at most one request per second).
    useTask$(({ track, cleanup }) => {
      const from = track(() => state.from?.lngLat);
      const to = track(() => state.to?.lngLat);
      const mode = track(() => state.mode);
      if (!isBrowser) return;
      if (!from || !to) {
        state.route = null;
        state.routeStatus = "idle";
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(async () => {
        state.routeStatus = "loading";
        try {
          const route = await fetchRoute(from, to, mode, controller.signal);
          state.route = route;
          state.routeStatus = "idle";
          state.routeError = "";
          const lngs = route.coordinates.map((p) => p[0]);
          const lats = route.coordinates.map((p) => p[1]);
          state.flyTo = {
            center: to,
            bbox: [
              Math.min(...lngs),
              Math.min(...lats),
              Math.max(...lngs),
              Math.max(...lats),
            ],
            seq: Date.now(),
          };
        } catch (error) {
          if (controller.signal.aborted) return;
          state.route = null;
          state.routeStatus = "error";
          state.routeError =
            error instanceof Error ? error.message : "Directions failed.";
        }
      }, 300);
      cleanup(() => {
        clearTimeout(timer);
        controller.abort();
      });
    });

    // The view into the address bar and the prefs into storage, 400 ms after the last change.
    useTask$(({ track, cleanup }) => {
      const ready = track(() => state.ready);
      const camera = track(() => state.camera);
      const query = track(() => state.query);
      const from = track(() => state.from?.lngLat ?? null);
      const to = track(() => state.to?.lngLat ?? null);
      const mode = track(() => state.mode);
      const style = track(() => state.style);
      const overrides = track(() => state.overrides);
      const nodesShown = track(() => state.nodesShown);
      if (!isBrowser || !ready) return;
      const timer = setTimeout(() => {
        if (!location.pathname.startsWith("/maps")) return;
        const next = withMapsUrl(location.href, {
          ...(camera ? { camera } : {}),
          query,
          from,
          to,
          mode,
        });
        if (next !== location.href)
          history.replaceState(history.state, "", next);
        // Storage full or blocked: skipped, the URL still holds the view.
        writePref(MAPS_PREFS_KEY, { style, overrides, nodesShown });
        if (camera)
          writePref(
            MAPS_CAMERA_KEY,
            new URL(next).searchParams.get("at") ?? "",
          );
      }, 400);
      cleanup(() => clearTimeout(timer));
    });

    // The map and its controls in one wrapper: it is what goes full screen, and the controls'
    // inset and placement are scoped to it (`map-view.css`).
    return (
      <div ref={wrapper} class="relative size-full" data-map-view="">
        {/* First in the DOM, so the tab order is controls, map, then MapLibre's credits (its
            control container is inside the map's element). */}
        <MapControls map={mapRef} fullscreenTarget={wrapper} />
        <div ref={mount} class="size-full" data-map-style={state.style} />
      </div>
    );
  },
);
