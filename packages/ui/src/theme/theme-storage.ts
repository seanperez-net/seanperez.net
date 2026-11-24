/**
 * Where the theme is kept in the browser, and how it is put on the page. No colour maths here,
 * so `ThemeModeScript` and `ThemeToggle` can use it without loading the colour library.
 */
export type ColorMode = "light" | "dark" | "auto";

/** "light" or "dark". Unset means "auto": follow the system. */
export const THEME_STORAGE_KEY = "seanperez-color-mode";
/** The chosen source colour (hex). Unset means: the colours in the token files. */
export const THEME_COLOR_KEY = "seanperez-source-color";
/** The CSS generated from that colour, kept so the next visit paints it before any script. */
export const THEME_CSS_KEY = "seanperez-theme-css";
/** The id of the `<style>` that holds the generated colours. */
export const THEME_STYLE_ID = "theme-palette";

/** The source colour the token files were made for: where the sliders start. */
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
 * Puts the mode on `<html>` (the `dark` class) and saves it. While the colours change,
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
};

/** Puts generated colours on the page and saves them; `null` goes back to the token files. */
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
};
