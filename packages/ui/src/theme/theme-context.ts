import {
  $,
  createContextId,
  isServer,
  useContextProvider,
  useOnDocument,
  useTask$,
} from "@qwik.dev/core";
import type { Signal } from "@qwik.dev/core";
import { useBoundSignal } from "../utils/use-bound-signal";
import { paletteCss } from "./palette";
import { applyColorMode, applyPaletteCss, loadTheme } from "./theme-storage";
import type { ColorMode } from "./theme-storage";

/**
 * Theme context: the source color and the color mode, shared by `ThemeChanger`,
 * `ThemeToggle` and anything else that reads or sets the theme. `Layout.Root` provides it (so
 * does `ThemeRoot`, for a page without the layout).
 */
export type ThemeContextValue = {
  /** Source color, hex. Empty: the colors in the token files. */
  sourceColor: Signal<string>;
  /** light, dark, or auto (follow the system). */
  colorMode: Signal<ColorMode>;
};

export const themeContextId = createContextId<ThemeContextValue>(
  "net.seanperez.ui.theme",
);

export type ThemeProps = {
  /** The source color to start from (hex). Plain data: a CMS can store it. */
  sourceColor?: string;
  /** The color mode to start from. Defaults to "auto". */
  colorMode?: ColorMode;
  /** The app's own signal for the source color. */
  "bind:color"?: Signal<string>;
  /** The app's own signal for the color mode. */
  "bind:mode"?: Signal<ColorMode>;
};

/**
 * Provides the theme context and keeps the page in step with it. The visitor's saved choice
 * (if any) replaces the starting props once the page has loaded; after that every change to
 * either signal is applied to the page and saved.
 */
export const useThemeProvider = (props: ThemeProps): ThemeContextValue => {
  const sourceColor = useBoundSignal(
    props["bind:color"],
    props.sourceColor ?? "",
  );
  const colorMode = useBoundSignal<ColorMode>(
    props["bind:mode"],
    props.colorMode ?? "auto",
  );
  const theme = { sourceColor, colorMode };
  useContextProvider(themeContextId, theme);

  // `ThemeModeScript` has already painted the saved theme; this brings the signals in line.
  useOnDocument(
    "DOMContentLoaded",
    $(() => {
      const saved = loadTheme();
      if (saved.color) sourceColor.value = saved.color;
      if (saved.mode !== "auto") colorMode.value = saved.mode;
    }),
  );

  // The color library is only loaded here, the first time a color is actually applied.
  useTask$(({ track }) => {
    const color = track(sourceColor);
    const mode = track(colorMode);
    if (isServer) return;
    applyColorMode(mode);
    applyPaletteCss(color, color ? paletteCss(color) : null);
  });

  return theme;
};
