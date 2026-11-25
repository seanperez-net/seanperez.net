/**
 * The Maps style editor's groups: which layers of OpenFreeMap's `positron` and `dark` styles a
 * group colors and hides, and the overrides the visitor sets (2026-11-24, owner: "like how mapbox
 * and google have their map playground"). The groups follow those editors' feature groups
 * (background / land, water, parks, buildings, roads, rail, boundaries, labels).
 *
 * Layers are assigned by RULE (type, source-layer, id), not by id lists, because the two styles
 * name the same thing differently (positron `park`, dark `landuse_park`; positron `label_city`,
 * dark `place_city`). Checked against both styles' JSON (tiles.openfreemap.org/styles/positron and
 * /dark, fetched 2026-11-24: 55 and 47 layers; every layer lands in exactly one group or none).
 * - A group's COLOR goes on the layer's main paint property (background-color, fill-color,
 *   line-color, text-color), never on `*casing*` (the outline under a road) or `*subtle*` (faint
 *   low-zoom lines), so roads keep their edges. A railway's `*dashline*` (the dashes over the
 *   line) gets a shade of it (`dashColor`), so a recolored rail still looks like a rail.
 * - VISIBILITY (`layout.visibility`) applies to every layer of the group.
 * - A flat color replaces a zoom expression on a few layers (motorways); Reset reloads the style,
 *   which brings the originals back.
 *
 * MapLibre APIs (installed maplibre-gl 6.19.0 `maplibre-gl.d.ts`): `setPaintProperty`,
 * `setLayoutProperty` for live edits; `MapOptions.transformStyle` ("Subsequent calls to
 * Map.setStyle will use the same transform if the transformStyle option is not set") applies the
 * overrides to every style the map loads, so light / dark keep them.
 *
 * Imports only TYPES from maplibre-gl, so it is safe on the server.
 */
import type { MapOptions } from "maplibre-gl";

/** maplibre-gl does not re-export the style-spec types; derived as e-store's `local-style.ts` does. */
export type StyleSpecification = Exclude<
  MapOptions["style"],
  string | undefined
>;
export type LayerSpecification = StyleSpecification["layers"][number];

export type StyleGroupId =
  | "background"
  | "water"
  | "parks"
  | "buildings"
  | "roads"
  | "rail"
  | "boundaries"
  | "labels";

export type StyleGroup = { id: StyleGroupId; label: string };

/** In the panel's order. Plain data (labels are props of the panel). */
export const STYLE_GROUPS: readonly StyleGroup[] = [
  { id: "background", label: "Background" },
  { id: "water", label: "Water" },
  { id: "parks", label: "Parks & land" },
  { id: "buildings", label: "Buildings" },
  { id: "roads", label: "Roads" },
  { id: "rail", label: "Rail" },
  { id: "boundaries", label: "Boundaries" },
  { id: "labels", label: "Labels" },
];

/** One group's override: a `#rrggbb` color and / or hidden. */
export type StyleOverride = { color?: string; hidden?: boolean };
export type StyleOverrides = Partial<Record<StyleGroupId, StyleOverride>>;

type LayerLike = { id: string; type: string; "source-layer"?: string };

/** The group a layer belongs to, or null (our own route layers, shields, one-way arrows). */
export function layerGroup(layer: LayerLike): StyleGroupId | null {
  const { id, type } = layer;
  const sl = layer["source-layer"] ?? "";
  if (id.startsWith("maps-")) return null; // ours (route, stops)
  if (type === "background") return "background";
  if (type === "symbol") {
    // Shields and one-way arrows are icons, not names.
    if (id.includes("shield") || id.includes("oneway")) return null;
    return "labels";
  }
  if (sl === "water" || sl === "waterway") return "water";
  // Parks, wood, grass, ice and land use (residential too: "& land").
  if (sl === "park" || sl === "landcover" || sl === "landuse") return "parks";
  if (sl === "building") return "buildings";
  if (sl === "boundary") return "boundaries";
  if (sl === "transportation" && id.startsWith("railway")) return "rail";
  if (sl === "transportation" || sl === "aeroway") return "roads";
  return null;
}

/** The paint property a group's color sets on this layer, or null (casings, dashes). */
export function colorProperty(layer: LayerLike): string | null {
  if (/casing|dashline|subtle/.test(layer.id)) return null;
  switch (layer.type) {
    case "background":
      return "background-color";
    case "fill":
      return "fill-color";
    case "line":
      return "line-color";
    case "symbol":
      return "text-color";
    default:
      return null;
  }
}

/**
 * A railway's dashes (`*dashline*`, drawn over the rail line) for a rail color: the color mixed
 * 30% towards black when it is light, towards white when it is dark, so the dashes always read as
 * a faint stripe ON the line. Left alone, the base styles' own dashes (positron `#fafafa`, dark
 * `rgb(12,12,12)`) turned a recolored line into a loud light / black checkerboard (dark style
 * after "From theme": `outline` gray with near-black dashes; Chrome, 2026-11-24).
 */
export function dashColor(color: string): string {
  const ch = (i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  // Rec. 709 luma of the sRGB values: enough to pick a side.
  const luma = (0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2)) / 255;
  return mix(color, luma > 0.5 ? "#000000" : "#ffffff", 0.7);
}

/**
 * The paint a group's color sets on this layer: its main color property, or for a railway's
 * dashes `line-color` from `dashColor`. Null for casings and subtle lines (left as drawn).
 */
export function overridePaint(
  layer: LayerLike,
  color: string,
): { prop: string; value: string } | null {
  if (layer.type === "line" && /dashline/.test(layer.id))
    return { prop: "line-color", value: dashColor(color) };
  const prop = colorProperty(layer);
  return prop ? { prop, value: color } : null;
}

/** The style with the overrides written into its layers (a new object; `style` is not changed). */
export function applyOverrides(
  style: StyleSpecification,
  overrides: StyleOverrides,
): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const group = layerGroup(layer);
      const override = group ? overrides[group] : undefined;
      if (!override) return layer;
      const next = { ...layer } as LayerSpecification & {
        paint?: Record<string, unknown>;
        layout?: Record<string, unknown>;
      };
      const paint = override.color
        ? overridePaint(layer, override.color)
        : null;
      if (paint)
        next.paint = { ...(next.paint ?? {}), [paint.prop]: paint.value };
      if (override.hidden)
        next.layout = { ...(next.layout ?? {}), visibility: "none" };
      return next as LayerSpecification;
    }),
  };
}

/** Reads overrides from untrusted JSON (storage, an imported file): only known groups and fields. */
export function readOverrides(value: unknown): StyleOverrides {
  const out: StyleOverrides = {};
  if (!value || typeof value !== "object") return out;
  for (const { id } of STYLE_GROUPS) {
    const raw = (value as Record<string, unknown>)[id];
    if (!raw || typeof raw !== "object") continue;
    const { color, hidden } = raw as Record<string, unknown>;
    const entry: StyleOverride = {};
    if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color))
      entry.color = color.toLowerCase();
    if (hidden === true) entry.hidden = true;
    if (entry.color || entry.hidden) out[id] = entry;
  }
  return out;
}

/** `rgb(35 67 115)`, `rgb(35, 67, 115)` or `#rgb` / `#rrggbb` -> `#rrggbb` (the color input's format). */
export function toHex(css: string): string | null {
  const value = css.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const h =
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return `#${h.toLowerCase()}`;
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(value);
  if (!rgb) return null;
  return `#${[rgb[1], rgb[2], rgb[3]]
    .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** `a` mixed into `b` by `weight` (0..1) in sRGB, as CSS `color-mix(in srgb, a w%, b)`. */
function mix(a: string, b: string, weight: number): string {
  const ch = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(ch(a, i) * weight + ch(b, i) * (1 - weight))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * "From theme": each group's color from the site's Material 3 roles, after e-store's map palette
 * (`packages/maps/src/tokens.css`, `--maps-color-*`): land `surface-container-low`, water
 * `secondary-container`, park `tertiary-container` 55% over land, building
 * `surface-container-high`, road `surface-container-lowest` (e-store's major roads), rail and
 * boundary `outline`, label `on-surface`. Ours: the background is e-store's LAND (e-store paints
 * its background as water around a town; here the background is the land between tiles).
 * `read` returns a role's computed value (`--color-*` on `<html>`, light or dark as now).
 */
export function themeOverrides(read: (role: string) => string): StyleOverrides {
  const role = (name: string) => toHex(read(`--color-${name}`)) ?? "#808080";
  const land = role("surface-container-low");
  return {
    background: { color: land },
    water: { color: role("secondary-container") },
    parks: { color: mix(role("tertiary-container"), land, 0.55) },
    buildings: { color: role("surface-container-high") },
    roads: { color: role("surface-container-lowest") },
    rail: { color: role("outline") },
    boundaries: { color: role("outline") },
    labels: { color: role("on-surface") },
  };
}

/**
 * Each group's MAIN layer in positron and dark (ids checked in both styles' JSON, 2026-11-24):
 * the one whose color stands for the group. The first layer of a group was not always it: dark's
 * first label is `water_name` (`hsla(0,0%,0%,0.7)`, read as black) and its first "park" layer
 * the ice shelf (`rgb(12,12,12)`).
 */
const MAIN_LAYER: Record<StyleGroupId, RegExp> = {
  background: /^background$/,
  water: /^water$/,
  parks: /park$/,
  buildings: /^building$/,
  roads: /^highway_minor$/,
  rail: /^railway$/,
  boundaries: /^boundary/,
  labels: /^(label|place)_city$/,
};

/**
 * A group's color as the style draws it now (the swatch's value when the group has no override):
 * its main layer's flat color, else the first colored layer's, else gray (an expression has no
 * single color).
 */
export function groupColor(
  style: StyleSpecification | undefined,
  group: StyleGroupId,
): string {
  const layers = style?.layers ?? [];
  const main = layers.filter((layer) => MAIN_LAYER[group].test(layer.id));
  for (const layer of [...main, ...layers]) {
    if (layerGroup(layer) !== group) continue;
    const prop = colorProperty(layer);
    const value = prop
      ? (layer as { paint?: Record<string, unknown> }).paint?.[prop]
      : undefined;
    if (typeof value === "string")
      return toHex(value) ?? toHexLoose(value) ?? "#808080";
  }
  return "#808080";
}

/** `hsl()` / `hsla()` colors, as the OpenFreeMap styles write some, to `#rrggbb`. */
function toHexLoose(css: string): string | null {
  const m = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i.exec(
    css.trim(),
  );
  if (!m) return null;
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return `#${[f(0), f(8), f(4)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
