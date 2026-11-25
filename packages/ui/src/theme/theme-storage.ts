/**
 * Where the theme is kept in the browser, and how it is put on the page. No color maths here,
 * so `ThemeModeScript` and `ThemeToggle` can use it without loading the color library.
 */
export type ColorMode = "light" | "dark" | "auto";

/** "light" or "dark". Unset means "auto": follow the system. */
export const THEME_STORAGE_KEY = "seanperez-color-mode";
/** The chosen source color (hex). Unset means: the colors in the token files. */
export const THEME_COLOR_KEY = "seanperez-source-color";
/** The CSS generated from that color, kept so the next visit paints it before any script. */
export const THEME_CSS_KEY = "seanperez-theme-css";
/** The id of the `<style>` that holds the generated colors. */
export const THEME_STYLE_ID = "theme-palette";

/**
 * The color role `<meta name="theme-color">` follows: the scaffold's own surface (the app bar,
 * rail and page background are all `surface-container`), so the browser's toolbar reads as part
 * of the page. Same role as material-web's catalog (see `syncThemeColorMeta`).
 */
export const THEME_COLOR_ROLE = "--color-surface-container";

/** The source color the token files were made for: where the sliders start. */
export const DEFAULT_SOURCE_COLOR = "#415f91";

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the theme still applies for this page.
  }
};

export const loadTheme = (): { mode: ColorMode; color: string } => {
  const mode = read(THEME_STORAGE_KEY);
  return {
    mode: mode === "light" || mode === "dark" ? mode : "auto",
    color: read(THEME_COLOR_KEY) ?? "",
  };
};

/**
 * Puts the mode on `<html>` (the `dark` class) and saves it. While the colors change,
 * `theme-transitioning` is on `<html>` for 200ms so they fade (the rule is in `global.css`).
 */
export const applyColorMode = (mode: ColorMode) => {
  const root = document.documentElement;
  const dark =
    mode === "dark" ||
    (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  if (root.classList.contains("dark") !== dark) {
    root.classList.add("theme-transitioning");
    root.classList.toggle("dark", dark);
    setTimeout(() => root.classList.remove("theme-transitioning"), 200);
  }
  write(THEME_STORAGE_KEY, mode === "auto" ? null : mode);
  syncThemeColorMeta();
};

/** Puts generated colors on the page and saves them; `null` goes back to the token files. */
export const applyPaletteCss = (color: string, css: string | null) => {
  let style = document.getElementById(THEME_STYLE_ID);
  if (css === null) {
    style?.remove();
  } else {
    if (!style) {
      style = document.createElement("style");
      style.id = THEME_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }
  write(THEME_COLOR_KEY, css === null ? null : color);
  write(THEME_CSS_KEY, css);
  syncThemeColorMeta();
};

/** `rgb(r g b)` (the token files) or `#rrggbb` (generated colors) as `#rrggbb`. */
const toHex = (value: string): string => {
  const rgb = /^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(value);
  return rgb
    ? `#${rgb
        .slice(1, 4)
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("")}`
    : value;
};

/**
 * Sets every `<meta name="theme-color">` to the page's current `THEME_COLOR_ROLE`, so the
 * browser's toolbar (and an installed app's title bar) follows light / dark and the visitor's
 * source color. ALL of them: the page's two metas carry `media="(prefers-color-scheme: ...)"`,
 * which the browser matches against the SYSTEM setting, not our `dark` class, so a page forced
 * dark on a light system would otherwise keep the light one.
 *
 * Ported from material-web's catalog, `catalog/src/utils/apply-theme-string.ts`
 * `applyThemeString()` ("Set the color of the URL bar", reads `--md-sys-color-surface-container`
 * and sets the meta), github.com/material-components/material-web (Apache-2.0), read 2026-11-24.
 * Material Color Utilities' own `applyTheme` does NOT touch the meta. Difference: the catalog
 * regex-reads its theme string; here the value is read from the computed style, because our
 * colors come from the token files OR the generated `<style>`, and the `dark` class picks the
 * block. Runs after the stylesheet has loaded (a click, the theme task); before first paint
 * `ThemeModeScript` does the same from the saved CSS. PROOFED 2026-11-24 in Chrome.
 */
export const syncThemeColorMeta = () => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(THEME_COLOR_ROLE)
    .trim();
  if (!value) return; // Stylesheet not applied yet: keep the server's values.
  const hex = toHex(value);
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", hex));
};
