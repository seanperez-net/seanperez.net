/**
 * The render-side check for a link target that may come from data (a CMS, a host's config).
 * From e-store's `utils/safe-href.ts` (2026-11-23).
 *
 * Allowed: `http:`, `https:`, `mailto:`, `tel:`, and anything with no scheme at all (a path,
 * `#anchor`, `?query`, `./x`, `../x`, `//host`). Refused: every other scheme, notably
 * `javascript:`, `vbscript:` and `data:`.
 *
 * The scheme is read the way the WHATWG URL parser reads it: leading and trailing C0 controls and
 * spaces are stripped, and tab / LF / CR are removed ANYWHERE, so `java\tscript:` is seen as the
 * `javascript:` it would navigate to. A colon after the first `/`, `?` or `#` is not a scheme.
 */
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

/** The href as the browser would read it, or `undefined` when it must not become a link. */
export function safeHref(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  const normalized = href
    // eslint-disable-next-line no-control-regex
    .replace(/^[\u0000- ]+|[\u0000- ]+$/g, "")
    .replace(/[\t\n\r]/g, "");
  if (normalized === "") return undefined;
  const scheme = SCHEME.exec(normalized);
  if (scheme)
    return SAFE_SCHEMES.has(scheme[1].toLowerCase()) ? normalized : undefined;
  return normalized;
}
