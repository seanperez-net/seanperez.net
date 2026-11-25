import type { Cookie } from "@qwik.dev/router";
import {
  SESSION_MS,
  claimNotify,
  getSession,
  recordSend,
  type NewToken,
  type Session,
} from "./account.server";
import {
  FROM_NOREPLY,
  canMail,
  notifyOwner,
  ownerNotice,
  sendMail,
  verificationMail,
} from "../mail/mail.server";

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
  cookie.delete(cookieFor(url).name, { path: "/" });
}

/** The session of this request, or null. A database error (migration 0004 missing) = null. */
export async function sessionOf(
  env: Env,
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
export const accountsOpen = (env: Env) => !!env.AUTH_SECRET && canMail(env);

/** The verification email for `token`; its outcome is stored for /admin. */
export async function sendVerification(
  env: Env,
  origin: string,
  to: string,
  token: NewToken,
) {
  const link = `${origin}/verify/?t=${encodeURIComponent(token.linkToken)}`;
  const outcome = await sendMail(env, {
    to,
    from: FROM_NOREPLY,
    ...verificationMail(link, token.code),
    idempotencyKey: `verify-${token.linkHash.slice(0, 40)}`,
  });
  await recordSend(env.DB, token.linkHash, outcome);
  return outcome;
}

type Ctx = { waitUntil(promise: Promise<unknown>): void } | undefined;

/**
 * Tells the owner about a VERIFIED account's message, at most once an hour per account (owner,
 * 2026-11-25), AFTER the response (`waitUntil`, awaited inside the task: a dangling promise can
 * be dropped, e-store's `waitUntilBackgroundTask` note). Never for unverified messages.
 */
export function notifyOwnerLater(
  env: Env,
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
      const link = `${origin}/admin/messages/${row.id ?? ""}${row.id ? "/" : ""}`;
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
 * number for us). The capped paths skip the Resend call and would otherwise be faster.
 */
export const RESPONSE_FLOOR_MS = 600;

export async function floor(startedAt: number) {
  const wait = RESPONSE_FLOOR_MS - (Date.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
