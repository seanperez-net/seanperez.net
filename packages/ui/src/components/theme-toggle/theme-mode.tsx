import {
  THEME_CSS_KEY,
  THEME_STORAGE_KEY,
  THEME_STYLE_ID,
} from "../../theme/theme-storage";

/**
 * Inline script for the document `<head>`. Before first paint it puts the `dark` class on
 * `<html>` (the saved choice, otherwise the system setting) and, when the visitor has picked a
 * source colour, the saved colours for it. So the page never flashes the wrong theme, and the
 * colour library is not needed to show a saved theme.
 *
 * Under a nonce-based Content-Security-Policy, pass the request's `nonce`.
 */
export const ThemeModeScript = ({ nonce }: { nonce?: string } = {}) => {
  const script = `try{var d=document,m=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});d.documentElement.classList.toggle("dark",m?m==="dark":matchMedia("(prefers-color-scheme: dark)").matches);var c=localStorage.getItem(${JSON.stringify(
    THEME_CSS_KEY,
  )});if(c){var s=d.createElement("style");s.id=${JSON.stringify(
    THEME_STYLE_ID,
  )};s.textContent=c;d.head.appendChild(s)}}catch(e){}`;
  return <script nonce={nonce} dangerouslySetInnerHTML={script} />;
};
