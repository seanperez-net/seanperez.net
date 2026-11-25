import {
  argbFromHex,
  hexFromArgb,
  themeFromSourceColor,
} from "@material/material-color-utilities";

/**
 * The Material 3 color roles for one source color, as CSS. Same method as e-store's theme
 * package: Google's `themeFromSourceColor`, with the surface roles taken from the neutral
 * palette at the tones the current M3 spec gives them.
 * https://m3.material.io/styles/color/static/baseline
 */
const SURFACE_TONES = {
  light: {
    surface: 98,
    surfaceDim: 87,
    surfaceBright: 98,
    surfaceContainerLowest: 100,
    surfaceContainerLow: 96,
    surfaceContainer: 94,
    surfaceContainerHigh: 92,
    surfaceContainerHighest: 90,
  },
  dark: {
    surface: 6,
    surfaceDim: 6,
    surfaceBright: 24,
    surfaceContainerLowest: 4,
    surfaceContainerLow: 10,
    surfaceContainer: 12,
    surfaceContainerHigh: 17,
    surfaceContainerHighest: 22,
  },
} as const;

/** The roles the generator sets. Roles it leaves out keep the value in the token files. */
const SCHEME_ROLES = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "onBackground",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "outline",
  "outlineVariant",
  "inverseSurface",
  "inverseOnSurface",
  "inversePrimary",
] as const;

const toVarName = (role: string) =>
  `--color-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

/**
 * `:root{...}:root.dark{...}`: every generated role as a `--color-*` variable, light then
 * dark. Put in a `<style>` it overrides the token files, and the `dark` class still flips it.
 */
export function paletteCss(sourceHex: string): string {
  const theme = themeFromSourceColor(argbFromHex(sourceHex));
  const neutral = theme.palettes.neutral;
  const block = (mode: "light" | "dark") => {
    const scheme = theme.schemes[mode].toJSON() as unknown as Record<
      string,
      number
    >;
    const vars = SCHEME_ROLES.map(
      (role) => `${toVarName(role)}:${hexFromArgb(scheme[role])}`,
    );
    for (const [role, tone] of Object.entries(SURFACE_TONES[mode])) {
      vars.push(`${toVarName(role)}:${hexFromArgb(neutral.tone(tone))}`);
    }
    vars.push(
      `${toVarName("background")}:${hexFromArgb(neutral.tone(SURFACE_TONES[mode].surface))}`,
      `${toVarName("surfaceTint")}:${hexFromArgb(scheme.primary)}`,
    );
    return vars.join(";");
  };
  return `:root{${block("light")}}:root.dark{${block("dark")}}`;
}
