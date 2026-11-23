export type ColorMode = "light" | "dark";

/** Where the chosen colour mode is kept in the browser. Unset means: follow the system. */
export const THEME_STORAGE_KEY = "seanperez-color-mode";

/**
 * Inline script for the document `<head>`: puts the `dark` class on `<html>` before first
 * paint (the saved choice, otherwise the system setting), so the page never flashes the wrong
 * theme. The colour tokens and the `dark:` variant switch on that class.
 *
 * Under a nonce-based Content-Security-Policy, pass the request's `nonce`.
 */
export const ThemeModeScript = ({ nonce }: { nonce?: string } = {}) => {
  const script = `try{var m=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});document.documentElement.classList.toggle("dark",m?m==="dark":matchMedia("(prefers-color-scheme: dark)").matches)}catch(e){}`;
  return <script nonce={nonce} dangerouslySetInnerHTML={script} />;
};
