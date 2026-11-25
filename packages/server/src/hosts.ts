/**
 * The two apps' origins (2026-11-25: `/admin` moved to its own app, `apps/admin`, on
 * `admin.seanperez.net`; owner decision, memory `admin-decisions-2026-11-25`). A link from one
 * app to the other (the owner's "new message" notice, the 301 from the site's old `/admin/*`, the
 * admin's "Resend verification" link to the site's `/verify/`) is built here, never from the
 * request's own origin. Client-safe: plain strings.
 *
 * Locally (`pnpm dev` 5173, `pnpm dev:admin` 5180) a request from a loopback host gets the other
 * dev server, so the links work on one machine. Vite listens on `[::1]` (QWIK-DEFAULTS finding 14).
 */
export const SITE_ORIGIN = "https://seanperez.net";
export const ADMIN_ORIGIN = "https://admin.seanperez.net";
export const SITE_DEV_ORIGIN = "http://[::1]:5173";
export const ADMIN_DEV_ORIGIN = "http://[::1]:5180";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Whether `url` is one of this machine's dev servers. */
export const isLocal = (url: URL) => LOOPBACK.has(url.hostname);

/** A path on the admin app, seen from a request to either app. */
export const adminUrl = (path: string, from: URL) =>
  new URL(path, isLocal(from) ? ADMIN_DEV_ORIGIN : ADMIN_ORIGIN).href;

/** The site's origin, seen from a request to either app (no trailing slash). */
export const siteOrigin = (from: URL) =>
  isLocal(from) ? SITE_DEV_ORIGIN : SITE_ORIGIN;
