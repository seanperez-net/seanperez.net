import type { Cookie } from "@qwik.dev/router";
import type { DataEnv } from "../env.ts";
import { adminUrl } from "../hosts.ts";
import {
  SESSION_MS,
  claimNotify,
  getSession,
  recordSend,
  type NewToken,
  type Session,
} from "./account.server.ts";
import {
  FROM_NOREPLY,
  canMail,
  notifyOwner,
  ownerNotice,
  sendMail,
  verificationMail,
} from "../mail/mail.server.ts";

/**
 * The request side of contact accounts: the session cookie, "is it set up here", sending the
 * verification email, the owner's notification, the response floor. The data side is
 * `account.server.ts`; the mail side `mail/mail.server.ts`.
 */

/**
 * The session cookie (accounts plan A.2; Qwik rc.5 `CookieOptions`, read in the installed
 * `request-handler/index.d.ts`): `__Host-spn_session; HttpOnly; Secure; SameSite=Lax; Path=/`.
 * `__Host-` needs `Secure` and `Path=/` and forbids `Domain` (MDN Set-Cookie "Cookie prefixes",
 * NOT re-read 2026-11-25). Over plain http (`pnpm dev` at http://[::1]:5173) WebKit refuses a
 * `Secure` cookie, so there the name is `spn_session` without `Secure`: production is https.
 */
const cookieFor = (url: URL) =>
  url.protocol === "https:"
    ? { name: "__Host-spn_session", secure: true }
    : { name: "spn_session", secure: false };

export function readSessionCookie(cookie: Cookie, url: URL): string | null {
  return cookie.get(cookieFor(url).name)?.value ?? null;
}

export function setSessionCookie(
  cookie: Cookie,
  url: URL,
  token: string,
  verified: boolean,
) {
  const { name, secure } = cookieFor(url);
  cookie.set(name, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    // A verified browser: 30 days. Unverified: 7 days, as long as the account lasts.
    maxAge: [verified ? SESSION_MS / 86_400_000 : 7, "days"],
  });
}

export function clearSessionCookie(cookie: Cookie, url: URL) {
  // Not `cookie.delete` (second agent, RULE 2, 2026-11-25): Qwik rc.5's `delete` is
  // `set(name, "deleted", { ...options, maxAge: 0 })` and its type allows only domain / sameSite /
  // path (installed `user-response.mjs` :394), and a browser ignores a `__Host-` cookie set
  // without `Secure`. So the same `set` by hand, with the attributes the cookie was made with.
  const { name, secure } = cookieFor(url);
  cookie.set(name, "deleted", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** The session of this request, or null. A database error (migration 0004 missing) = null. */
export async function sessionOf(
  env: DataEnv,
  cookie: Cookie,
  url: URL,
): Promise<Session | null> {
  const token = readSessionCookie(cookie, url);
  if (!token) return null;
  try {
    return await getSession(env.DB, token);
  } catch (error) {
    console.error("account: session read failed", error);
    return null;
  }
}

/**
 * Accounts are on when the code HMAC key is set and mail can go out (Resend, or the dev
 * console). Otherwise the contact form works as before accounts (plan 6, "fails closed"): the
 * message is stored, no account, no email, and nothing is said about one.
 */
export const accountsOpen = (env: DataEnv) => !!env.AUTH_SECRET && canMail(env);

/** The verification email for `token`; its outcome is stored for /admin. */
export async function sendVerification(
  env: DataEnv,
  origin: string,
  to: string,
  token: NewToken,
  fetcher?: typeof fetch,
) {
  const link = `${origin}/verify/?t=${encodeURIComponent(token.linkToken)}`;
  const outcome = await sendMail(
    env,
    {
      to,
      from: FROM_NOREPLY,
      ...verificationMail(link, token.code),
      idempotencyKey: `verify-${token.linkHash.slice(0, 40)}`,
    },
    fetcher,
  );
  await recordSend(env.DB, token.linkHash, outcome);
  return outcome;
}

/**
 * The verification email AFTER the response (owner, 2026-11-25, "DECIDED" (1); second agent's
 * finding on the 600 ms floor): every path of a send returns after the same D1 work, so the
 * response time no longer tells whether an email went out now (a new address, a known one, a
 * capped one). The outcome is still stored on the token (`recordSend`: `pending` until then,
 * `sent` / `failed` / `logged` after), which /admin shows; the visitor is not told at once that a
 * send failed ("Send the email again" is always there). Awaited inside the task, which is handed
 * to `waitUntil` (Workers: the isolate stays until it settles). Under `pnpm dev` the platform is
 * wrangler's `getPlatformProxy()`, whose `ctx.waitUntil` does nothing (wrangler 4.165.0
 * `ExecutionContext`, read 2026-11-25): the promise still runs to its end in the Node process,
 * so the dev console sender and `/api/dev-mail` get the mail a moment after the response.
 */
export function sendVerificationLater(
  env: DataEnv,
  ctx: Ctx,
  origin: string,
  to: string,
  token: NewToken,
  fetcher?: typeof fetch,
): Promise<void> {
  const task = (async () => {
    try {
      await sendVerification(env, origin, to, token, fetcher);
    } catch (error) {
      // A D1 error after the send leaves the token `pending`, which /admin shows as such.
      console.error("account: verification send failed", (error as Error).name);
    }
  })();
  ctx?.waitUntil(task);
  return task;
}

export type Ctx = { waitUntil(promise: Promise<unknown>): void } | undefined;

/**
 * Tells the owner about a VERIFIED account's message, at most once an hour per account (owner,
 * 2026-11-25), AFTER the response (`waitUntil`, awaited inside the task: a dangling promise can
 * be dropped, e-store's `waitUntilBackgroundTask` note). Never for unverified messages.
 */
export function notifyOwnerLater(
  env: DataEnv,
  ctx: Ctx,
  origin: string,
  accountId: string,
  messageId: number | null,
) {
  const task = (async () => {
    try {
      if (!(await claimNotify(env.DB, accountId))) return;
      const row = await env.DB.prepare(
        `SELECT a.name, a.email, m.id, m.body FROM contact_account a
         LEFT JOIN message m ON m.account_id = a.id AND m.confirmed_at IS NOT NULL
         WHERE a.id = ? AND (? IS NULL OR m.id = ?)
         ORDER BY m.created_at DESC LIMIT 1`,
      )
        .bind(accountId, messageId, messageId)
        .first<{
          name: string;
          email: string;
          id: number | null;
          body: string | null;
        }>();
      if (!row) return;
      // The admin app's inbox (`hosts.ts`; `/admin` left the site 2026-11-25).
      const link = adminUrl(
        `/messages/${row.id ?? ""}${row.id ? "/" : ""}`,
        new URL(origin),
      );
      await notifyOwner(env, {
        ...ownerNotice(row.name, row.body ?? "", link),
        replyTo: row.email,
        // One notice per account per hour (`claimNotify`); the key matches that slot.
        idempotencyKey: `notify-${accountId}-${new Date().toISOString().slice(0, 13)}`,
      });
    } catch (error) {
      console.error("account: owner notice failed", (error as Error).name);
    }
  })();
  // Production always has `ctx`; without one the task still runs to its end.
  ctx?.waitUntil(task);
}

/**
 * Every answer that might differ by whether an address is known takes at least this long
 * (plan 5.3; e-store's `AUTH_MAIL_RESPONSE_FLOOR_MS = 600` as a pattern, NOT PROOFED as the right
 * number for us). Since 2026-11-25 no path awaits the email (`sendVerificationLater`), so the
 * floor only evens out D1 timing; kept as the owner decided.
 */
export const RESPONSE_FLOOR_MS = 600;

export async function floor(startedAt: number) {
  const wait = RESPONSE_FLOOR_MS - (Date.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

// --- Turnstile (Siteverify) -------------------------------------------------------------------

export const SITEVERIFY =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileCheck =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 502 | 503; message: string };

/**
 * Turnstile Siteverify (developers.cloudflare.com/turnstile/get-started/server-side-validation/):
 * POST the secret, the token and the visitor's IP; fail closed. Moved here from
 * `contact-panel.tsx` on 2026-11-25 so Contact me and an UNVERIFIED session's send in Sean's
 * thread (owner, "DECIDED" (2)) run the same check. No secret: 503 "not open yet", as Contact me.
 * Since 2026-11-25 each form has its OWN action (`turnstile-actions.ts`: `contact`, `message`,
 * `resend`) and the caller passes the one it expects, so a token solved for one form is refused
 * by the others (Cloudflare "Best practices": validate the action and hostname).
 *
 * A real token carries the widget's `action`. Cloudflare's TEST secret answers
 * `hostname: "example.com"` and no action (Turnstile "Testing"); that is accepted only where
 * `TURNSTILE_HOSTNAMES` lists example.com, which is `.dev.vars` alone.
 */
export async function checkTurnstile(
  env: Pick<DataEnv, "TURNSTILE_SECRET_KEY" | "TURNSTILE_HOSTNAMES">,
  token: string | undefined,
  remoteIp: string,
  action: string,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileCheck> {
  if (!env.TURNSTILE_SECRET_KEY) {
    return {
      ok: false,
      status: 503,
      message: "The contact form is not open yet.",
    };
  }
  if (!token) {
    return {
      ok: false,
      status: 400,
      message: "Please complete the security check, then send again.",
    };
  }
  let outcome: {
    success?: boolean;
    hostname?: string;
    action?: string;
    "error-codes"?: string[];
  };
  try {
    const res = await fetcher(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: remoteIp,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    outcome = await res.json();
  } catch (error) {
    console.error("contact: siteverify failed", (error as Error).message);
    return {
      ok: false,
      status: 502,
      message: "The security check could not be confirmed. Please try again.",
    };
  }
  const hostnames = (env.TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const actionOk =
    outcome.action === action ||
    (outcome.action === undefined && outcome.hostname === "example.com");
  if (
    !outcome.success ||
    !outcome.hostname ||
    !hostnames.includes(outcome.hostname) ||
    !actionOk
  ) {
    console.warn("contact: turnstile refused", outcome["error-codes"]);
    return {
      ok: false,
      status: 403,
      message: "The security check failed. Please try again.",
    };
  }
  return { ok: true };
}
