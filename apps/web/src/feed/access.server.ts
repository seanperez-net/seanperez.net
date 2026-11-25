import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { RequestEventCommon } from "@qwik.dev/router";

/**
 * The /admin gate: Cloudflare Access in front, and this check in the Worker.
 *
 * Cut down from e-store's `packages/auth/src/cloudflare-access.ts` (PROOFED 2026-11-24 against
 * developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/
 * authorization-cookie/validating-json/ and the installed jose 6.2.18; second agent reviewed).
 * What differs from e-store, and why:
 * - Access is the ONLY gate here (e-store has Better Auth behind it), so missing settings FAIL
 *   CLOSED: e-store lets everything through when `ACCESS_TEAM_DOMAIN` is unset.
 * - `ctx.access` is not an option: a Worker with static assets runs behind Cloudflare's assets
 *   router, which does not pass `ctx.access` on (workers/configuration/cloudflare-access/,
 *   "ctx.access limitations").
 * - The token's email must also equal `ACCESS_ALLOWED_EMAIL`, in case the Access policy is ever
 *   widened by mistake. All three settings are Worker SECRETS (the repo is public and the email
 *   must not be published), read with `env.get`.
 * - No failure-reason taxonomy, no identity fields beyond the email.
 */

/** Set by Access on every request it lets through (the cookie is browser-only). */
export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

/** The algorithms Access signs with; pinned so an odd key in the JWKS cannot widen them. */
const ALGORITHMS = ["RS256", "ES256"];

export interface AccessConfig {
  /** `https://<team-name>.cloudflareaccess.com` */
  teamDomain?: string;
  /** The Access application's AUD tag. */
  audience?: string;
  /** The one address allowed in. */
  allowedEmail?: string;
}

export type AccessResult = { ok: true } | { ok: false; reason: string };

/**
 * One JWKS per team domain, at module scope: jose matches keys on `kid` and refetches on a
 * miss, which covers Access's key rotation.
 */
const jwksByTeam = new Map<string, JWTVerifyGetKey>();

function teamKeys(teamDomain: string): JWTVerifyGetKey {
  let keys = jwksByTeam.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksByTeam.set(teamDomain, keys);
  }
  return keys;
}

/** `iss` must match exactly: no trailing slash, `https://` added when left out (e-store's). */
function normalizeTeamDomain(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Verify an Access token. Never throws. `keys` is for the unit test (`scripts/access-test.ts`),
 * which signs tokens with a local key; the Worker always uses the team's published keys.
 */
export async function verifyAccessToken(
  token: string | null | undefined,
  config: AccessConfig,
  keys?: JWTVerifyGetKey,
): Promise<AccessResult> {
  const teamDomain = normalizeTeamDomain(config.teamDomain ?? "");
  const audience = config.audience?.trim();
  const allowedEmail = config.allowedEmail?.trim().toLowerCase();
  if (!teamDomain || !audience || !allowedEmail) {
    return { ok: false, reason: "not configured" };
  }
  if (!token) return { ok: false, reason: "no token" };
  try {
    const { payload } = await jwtVerify(token, keys ?? teamKeys(teamDomain), {
      issuer: teamDomain,
      audience,
      algorithms: ALGORITHMS,
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    if (email.toLowerCase() !== allowedEmail) {
      return { ok: false, reason: "email not allowed" };
    }
    return { ok: true };
  } catch (error) {
    // jose's error codes (ERR_JWT_EXPIRED, ERR_JWS_SIGNATURE_VERIFICATION_FAILED, ...), or a
    // failed fetch of the keys: either way the request is refused.
    const code = (error as { code?: unknown }).code;
    return {
      ok: false,
      reason: typeof code === "string" ? code : "unverifiable",
    };
  }
}

/**
 * Refuse the request unless it carries a valid Access token for the owner. Called by
 * `onRequest` in `routes/admin/layout.tsx`, which Qwik Router runs before every /admin page,
 * loader JSON request and action POST (router `user-response.mjs`, `resolveRequestHandlers`).
 * It does NOT run for `server$` calls (they are resolved before route middleware, on any
 * route): admin code uses only `routeAction$` / `routeLoader$`, never `server$` or
 * `globalAction$`.
 */
export async function requireAdmin(ev: RequestEventCommon): Promise<void> {
  // DEV BYPASS: `pnpm dev` only. `import.meta.env.DEV` is false in every build, so the Worker
  // (`pnpm build`, `pnpm serve`, production) always checks. Access cannot front localhost.
  if (import.meta.env.DEV) return;
  const result = await verifyAccessToken(
    ev.request.headers.get(ACCESS_JWT_HEADER),
    {
      teamDomain: ev.env.get("ACCESS_TEAM_DOMAIN"),
      audience: ev.env.get("ACCESS_POLICY_AUD"),
      allowedEmail: ev.env.get("ACCESS_ALLOWED_EMAIL"),
    },
  );
  if (!result.ok) {
    // The reason only, never the address.
    console.warn(`admin: refused (${result.reason})`);
    throw ev.send(403, "Forbidden");
  }
}
