/**
 * Security headers for every response a Worker generates (audit H1,
 * `.claude/notes/cache-sw-pwa-audit-2026-11-25.md`). Both apps wrap their `fetch` with
 * `withSecurityHeaders`; the SAME values are repeated in each app's `public/_headers` for static
 * assets, which are served BEFORE the Worker runs (asset-first routing) and never pass through it.
 * Cloudflare applies `_headers` to asset responses only, never to Worker responses
 * (developers.cloudflare.com/workers/static-assets/headers and .../routing/worker-script, read
 * 2026-11-25). Keep the two in step: `scripts/security-headers-test.ts` compares them.
 *
 * Sources read 2026-11-25: MDN (each header's reference page), OWASP Secure Headers Project,
 * Cloudflare Turnstile "Content Security Policy".
 *
 * - `Strict-Transport-Security: max-age=31536000; includeSubDomains`. NO `preload`: being on the
 *   browsers' preload list is a commitment that every subdomain serves HTTPS for good and takes
 *   months to undo (hstspreload.org); the owner decides. Browsers ignore it over plain HTTP
 *   (MDN), so `wrangler dev` / localhost are unaffected.
 * - `X-Content-Type-Options: nosniff`.
 * - `X-Frame-Options: DENY` + an ENFORCED `Content-Security-Policy: frame-ancestors 'none'` (the
 *   only enforced CSP directive): nothing on the site frames itself (the Messages floating window
 *   and fullscreen are the same document; the only iframe is Turnstile's, from
 *   challenges.cloudflare.com, framed BY us).
 * - `Referrer-Policy: strict-origin-when-cross-origin`. A route that already set one (`/verify`:
 *   `no-referrer`) keeps it: no header a route set is overwritten.
 * - `Permissions-Policy`: allows what the site uses (geolocation for Maps "here" and the precise
 *   location opt-in, fullscreen for the map and the Messages window), denies the powerful rest.
 *   Only directives Chromium knows (an unknown one logs a console error there). Safari and
 *   Firefox ignore the header (MDN browser compat data).
 * - `Content-Security-Policy-Report-Only` (audit M7): the policy the site WOULD enforce, logged as
 *   console warnings only, no report endpoint. Not enforced: Qwik's inline scripts and the theme
 *   script need a nonce from `entry.ssr.tsx` first, hence `'unsafe-inline'` here.
 */

/** Headers every response gets (Worker and static assets), app-specific values passed in. */
export interface SecurityHeaderValues {
  permissionsPolicy: string;
  cspReportOnly: string;
}

const BASE_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const DENIED_FEATURES = [
  "accelerometer",
  "autoplay",
  "browsing-topics",
  "camera",
  "display-capture",
  "gyroscope",
  "hid",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "serial",
  "usb",
];

const permissions = (allowSelf: string[]) =>
  [
    ...allowSelf.map((f) => `${f}=(self)`),
    ...DENIED_FEATURES.map((f) => `${f}=()`),
  ].join(", ");

const csp = (directives: Record<string, string>) =>
  Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join("; ");

/** Directives both apps share. */
const CSP_COMMON = {
  "default-src": "'self'",
  // Post images and chat link cards may point anywhere on https.
  "img-src": "'self' data: blob: https:",
  "font-src": "'self'",
  "manifest-src": "'self'",
  "object-src": "'none'",
  "base-uri": "'self'",
  "form-action": "'self'",
  "frame-ancestors": "'none'",
};

/**
 * apps/web: Turnstile (script + iframe, Cloudflare's Turnstile CSP page), OpenFreeMap styles,
 * tiles, glyphs and sprites, Photon search, FOSSGIS OSRM routing (`components/map-services.ts`,
 * `map-view.tsx`), MapLibre's worker (self-hosted, `setWorkerUrl`), the service worker.
 */
export const WEB_SECURITY_HEADERS: SecurityHeaderValues = {
  permissionsPolicy: permissions(["fullscreen", "geolocation"]),
  cspReportOnly: csp({
    ...CSP_COMMON,
    "script-src": "'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src": "'self' 'unsafe-inline'",
    "connect-src":
      "'self' https://tiles.openfreemap.org https://photon.komoot.io https://routing.openstreetmap.de",
    "frame-src": "https://challenges.cloudflare.com",
    "worker-src": "'self' blob:",
  }),
};

/** apps/admin: same-origin only (no map, no Turnstile); no geolocation. */
export const ADMIN_SECURITY_HEADERS: SecurityHeaderValues = {
  permissionsPolicy: permissions(["fullscreen"]).concat(", geolocation=()"),
  cspReportOnly: csp({
    ...CSP_COMMON,
    "script-src": "'self' 'unsafe-inline'",
    "style-src": "'self' 'unsafe-inline'",
    "connect-src": "'self'",
    "frame-src": "'none'",
    "worker-src": "'self'",
  }),
};

/** The full header list for one app, in the order `_headers` writes them. */
export const securityHeaderList = (
  values: SecurityHeaderValues,
): [string, string][] => [
  ...Object.entries(BASE_HEADERS),
  ["Permissions-Policy", values.permissionsPolicy],
  ["Content-Security-Policy-Report-Only", values.cspReportOnly],
];

/**
 * A copy of `response` with the security headers added (headers a route already set win).
 * `101 Switching Protocols` is returned as it is: rebuilding it would drop its `webSocket`.
 * HTML that set no `Cache-Control` gets `no-cache` (audit M5): stored only with a revalidation,
 * and NOT `private`, which the service worker refuses (offline would break).
 */
export function withSecurityHeaders(
  response: Response,
  values: SecurityHeaderValues,
): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of securityHeaderList(values)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (
    !headers.has("Cache-Control") &&
    (headers.get("Content-Type") ?? "").includes("text/html")
  ) {
    headers.set("Cache-Control", "no-cache");
  }
  // A missing `/build/` or `/assets/` file (the adapter's `env.ASSETS.fetch`) answers 404 with
  // the `_headers` rule for that path: `immutable` for a year. A browser would then keep the 404
  // even once the file exists; errors are never stored.
  if (
    response.status >= 400 &&
    /\bimmutable\b|max-age=[1-9]/.test(headers.get("Cache-Control") ?? "")
  ) {
    headers.set("Cache-Control", "no-store");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
