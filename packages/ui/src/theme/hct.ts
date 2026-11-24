import {
  Hct,
  argbFromHex,
  hexFromArgb,
} from "@material/material-color-utilities";

/**
 * HCT (hue, chroma, tone): Material's colour space, from Google's Material Color Utilities.
 * Hue 0 to 360, chroma 0 to about 150, tone 0 (black) to 100 (white).
 * https://material.io/blog/science-of-color-design
 */
export type HctColor = { hue: number; chroma: number; tone: number };

export function hctFromHex(hex: string): HctColor {
  const hct = Hct.fromInt(argbFromHex(hex));
  return { hue: hct.hue, chroma: hct.chroma, tone: hct.tone };
}

/** The nearest sRGB colour to an HCT value, as hex. */
export function hexFromHct(hue: number, chroma: number, tone: number): string {
  return hexFromArgb(Hct.from(hue, chroma, tone).toInt());
}

/** A CSS gradient showing one HCT axis from end to end: the strip under a slider. */
export function hctGradient(
  axis: "hue" | "chroma" | "tone",
  hue = 0,
  stops = 24,
): string {
  const parts: string[] = [];
  for (let index = 0; index <= stops; index++) {
    const at = index / stops;
    const hex =
      axis === "hue"
        ? hexFromHct(360 * at, 100, 50)
        : axis === "chroma"
          ? hexFromHct(hue, 150 * at, 50)
          : hexFromHct(0, 0, 100 * at);
    parts.push(`${hex} ${Math.round(at * 100)}%`);
  }
  return `linear-gradient(to right, ${parts.join(", ")})`;
}
