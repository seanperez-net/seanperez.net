/**
 * The Workers Rate Limiting binding `LIMITER` (`wrangler.jsonc`, 60 per 60 s per key and
 * location), as a cheap gate in front of D1, Turnstile Siteverify and Resend. Approved plan:
 * `.claude/notes/rate-limiting-research-2026-11-25.md` (owner, 2026-11-25). Weights: `WEIGHT`.
 *
 * API (PROOFED 2026-11-25, developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/):
 * `env.LIMITER.limit({ key, delta? })` answers `{ success }`; `key` is any string, `delta` a
 * positive integer (default 1) that weights the call. It is per Cloudflare location and
 * approximate: the hard limits stay the D1 caps (`account.server.ts`, `messages.server.ts`).
 *
 * Keys: a route name (`contact`, `link`, `search`, `ingest`) or `<route>:<SHA-256 of the session
 * cookie>`. NEVER an IP address (the owner keeps no IP; Cloudflare advises against IP keys).
 *
 * Fails OPEN: no binding (an old `pnpm dev` started before the binding existed, or a test env)
 * or a throwing binding lets the request through with one `console.warn`, because the D1 caps
 * are the real limit. The key is never logged.
 */

import { sha256 } from "../account/account.server.ts";

/**
 * How much one call counts against the binding's 60 per 60 s (per key, per location), so ONE
 * binding gives each endpoint its own number. The rate-limiting note proposed 10 per 60 s with
 * `delta` for the heavier calls; 10 is too few for the two route-wide keys that legitimately run
 * often (the app bar search fires 200 ms after typing; a device reports every 5 s), so the base
 * is 60 and the form posts weigh more. All numbers are judgement, NOT PROOFED against traffic.
 */
export const WEIGHT = {
  /** Contact me send, route-wide: 10 a minute. */
  contact: 6,
  /** Sean-thread send, per session: 10 a minute. */
  send: 6,
  /** 6-digit code, per session: 5 a minute (the 5 tries per token stay in D1). */
  verify: 12,
  /** /verify/ Confirm, route-wide: 10 a minute. */
  link: 6,
  /** /api/search, route-wide: 60 a minute. */
  search: 1,
  /** /api/nodes/ingest, route-wide: 60 a minute (12 a minute per device at one report / 5 s). */
  ingest: 1,
} as const;

/** The 429 text: the same for every endpoint, says nothing about an address or account. */
export const TOO_MANY = "Too many tries. Try again in a minute.";

type LimitEnv = { LIMITER?: Pick<RateLimit, "limit"> };

let warned = false;
const warnOnce = (why: string) => {
  if (warned) return;
  warned = true;
  console.warn(`limit: ${why}; allowing (fail open)`);
};

/** True when the request may go on; false means answer 429 with `TOO_MANY`. */
export async function allow(
  env: LimitEnv,
  key: string,
  delta = 1,
): Promise<boolean> {
  const limiter = env.LIMITER;
  if (!limiter) {
    warnOnce("no LIMITER binding");
    return true;
  }
  try {
    const { success } = await limiter.limit(
      delta === 1 ? { key } : { key, delta },
    );
    return success;
  } catch (error) {
    // The error's name only: a message could quote the key.
    console.warn(
      "limit: LIMITER failed; allowing (fail open)",
      (error as Error).name,
    );
    return true;
  }
}

/** For tests: forget that the missing-binding warning was printed. */
export function resetLimitWarning() {
  warned = false;
}

/**
 * `<prefix>:<SHA-256 hex of the session cookie>`, or `<prefix>:none` without one. The same
 * hash D1 stores as `contact_session.token_hash`, computed without a D1 read, so the gate runs
 * before any database work. The raw cookie never becomes a key.
 */
export async function sessionKey(
  prefix: string,
  cookieValue: string | null,
): Promise<string> {
  return cookieValue
    ? `${prefix}:${await sha256(cookieValue)}`
    : `${prefix}:none`;
}
