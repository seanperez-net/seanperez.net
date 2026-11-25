import {
  THEME_COLOR_ROLE,
  THEME_CSS_KEY,
  THEME_STORAGE_KEY,
  THEME_STYLE_ID,
} from "../../theme/theme-storage";

/**
 * Inline script for the document `<head>`. Before first paint it puts the `dark` class on
 * `<html>` (the saved choice, otherwise the system setting) and, when the visitor has picked a
 * source color, the saved colors for it. So the page never flashes the wrong theme, and the
 * color library is not needed to show a saved theme.
 *
 * It also sets every `<meta name="theme-color">` (put them BEFORE this script) to the colour of
 * the scaffold's surface (`THEME_COLOR_ROLE`) for that mode, as `syncThemeColorMeta` does later.
 * Not from the computed style: Qwik puts the stylesheet `<link>` at the END of `<head>`, so it
 * has not loaded yet here. With saved colors, the value comes out of the saved CSS (its
 * `:root{...}` or `:root.dark{...}` block), as material-web's catalog does with its saved theme
 * string; otherwise from the server's meta whose `media` names that mode (the page's own
 * default for it), which matters when the visitor forced the mode the system is not in.
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
  )};s.textContent=c;d.head.appendChild(s)}var k=d.documentElement.classList.contains("dark"),t=d.querySelectorAll('meta[name="theme-color"]'),v,x,i;if(c){x=new RegExp(${JSON.stringify(
    THEME_COLOR_ROLE + ":([^;}]+)",
  )}).exec(c.split(":root.dark")[k?1:0]||"");v=x&&x[1]}else for(i=0;i<t.length;i++)if((t[i].media||"").indexOf(k?"dark":"light")>=0)v=t[i].content;if(v)for(i=0;i<t.length;i++)t[i].content=v}catch(e){}`;
  return <script nonce={nonce} dangerouslySetInnerHTML={script} />;
};
