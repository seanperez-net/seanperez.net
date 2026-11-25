/**
 * Contact accounts and email verification (server only; D1 `DB`, migration 0004). The plan is
 * `.claude/notes/contact-verify-email-plan-2026-11-25.md` (owner's answers 2026-11-25: memory
 * `contact-creates-account`, "DECIDED"). Hand-rolled on Web Crypto, no package (memory
 * `keep-it-basic`; Better Auth was reverted on 2026-11-22).
 *
 * - The first message from an address makes an UNVERIFIED account and a session (the browser
 *   is "logged in" at once), and one verify token: a 32-byte link token AND a 6-digit code, in one
 *   email (`mail.server.ts`, sent by the caller). Link or code = verified.
 * - The account unlocks nothing but "send in Sean's thread without the form". Zero access.
 * - Caps (all `INSERT ... SELECT ... WHERE (count) < cap`, one statement each, as `saveMessage`):
 *   see the constants below.
 *
 * Crypto (plan section 5.1; accounts plan A.2):
 * - link and session tokens: 32 bytes from `crypto.getRandomValues`, base64url; stored as SHA-256;
 * - code: 6 digits by rejection sampling, stored as HMAC-SHA-256(AUTH_SECRET, link_hash|code): a
 *   plain hash of 6 digits is brute-forced from a database copy in milliseconds;
 * - compares are constant-time (`crypto.subtle.timingSafeEqual` in workerd; a XOR loop under
 *   `pnpm dev`, whose SSR runs in Node, which lacks it).
 *
 * Drizzle (port 2026-11-25, `../schema.ts`, `../client.ts`) for every statement EXCEPT the cap
 * inserts (`createToken`, `startContact`'s batch, `sendAsSession`), which stay raw D1: one
 * `INSERT ... SELECT ... WHERE (count) < cap` each (`.claude/rules/db.md`). Every function takes
 * `now`, so the tests (`scripts/account-test.ts`, on a real local D1) can move the clock.
 */

import {
  and,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../client.ts";
import {
  contactAccount,
  contactSession,
  message,
  messageReply,
  verifyToken,
} from "../schema.ts";

/** Wrong codes allowed per token. */
export const MAX_ATTEMPTS = 5;
/** A link / code works this long (owner, 2026-11-25: 30 minutes). */
export const TOKEN_MS = 30 * 60_000;
/** Unverified accounts (and unconfirmed messages) are deleted after this (owner: 7 days). */
export const UNVERIFIED_MS = 7 * 24 * 3600_000;
/** A verified browser stays signed in this long; an unverified one as long as its account. */
export const SESSION_MS = 30 * 24 * 3600_000;
/** Messages kept per UTC day, whoever sends them (the existing contact form cap). */
export const MESSAGES_PER_DAY = 20;
/** Messages an UNVERIFIED account may have waiting (owner, 2026-11-25: 3). */
export const UNCONFIRMED_PER_ACCOUNT = 3;
/** Messages per verified account per UTC day. */
export const VERIFIED_PER_DAY = 10;
/** Verification emails: one per address per minute, 3 per address per day, 40 per day in all. */
export const SEND_GAP_MS = 60_000;
export const SENDS_PER_ADDRESS_DAY = 3;
export const SENDS_PER_DAY = 40;
/** The owner hears about a verified account at most once an hour (owner, 2026-11-25). */
export const NOTIFY_GAP_MS = 3600_000;

const enc = new TextEncoder();

const iso = (d: Date) => d.toISOString();
const ago = (now: Date, ms: number) =>
  new Date(now.getTime() - ms).toISOString();
const later = (now: Date, ms: number) =>
  new Date(now.getTime() + ms).toISOString();
/** Midnight UTC of `now`, as the ISO text the `created_at` columns hold. */
const startOfDay = (now: Date) =>
  `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32 random bytes, base64url (43 characters): a link or session token. */
export function randomToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** Six digits, uniform: bytes of 250 and up are thrown away (no modulo bias). */
export function sixDigitCode(): string {
  let code = "";
  while (code.length < 6) {
    for (const b of crypto.getRandomValues(new Uint8Array(12))) {
      if (b < 250 && code.length < 6) code += String(b % 10);
    }
  }
  return code;
}

export async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}

/** Constant-time compare of two hex digests of the same length. */
function sameDigest(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const x = enc.encode(a);
  const y = enc.encode(b);
  // Workers-only (developers.cloudflare.com/workers/runtime-apis/web-crypto, "timingSafeEqual").
  const subtle = crypto.subtle as unknown as {
    timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean;
  };
  if (typeof subtle.timingSafeEqual === "function")
    return subtle.timingSafeEqual(x, y);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Trimmed and lower-cased: one account per address, whatever the case typed. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** "s***@g***.com": shown on /verify/ to whoever holds the link, never anywhere else. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${user.slice(0, 1)}***@${host.slice(0, 1)}***${tld}`;
}


// --- sessions ---------------------------------------------------------------------------------

export interface Session {
  tokenHash: string;
  accountId: string;
  name: string;
  email: string;
  /** THIS browser proved the address (link or code). */
  verified: boolean;
}

/** The session for a cookie value, or null (unknown, expired). */
export async function getSession(
  db: D1Database,
  token: string | null | undefined,
  now = new Date(),
): Promise<Session | null> {
  if (!token || token.length > 100) return null;
  const tokenHash = await sha256(token);
  const row = await getDb(db)
    .select({
      token_hash: contactSession.token_hash,
      account_id: contactSession.account_id,
      verified_at: contactSession.verified_at,
      name: contactAccount.name,
      email: contactAccount.email,
    })
    .from(contactSession)
    .innerJoin(contactAccount, eq(contactAccount.id, contactSession.account_id))
    .where(
      and(
        eq(contactSession.token_hash, tokenHash),
        gt(contactSession.expires_at, iso(now)),
      ),
    )
    .get();
  if (!row) return null;
  return {
    tokenHash: row.token_hash,
    accountId: row.account_id,
    name: row.name,
    email: row.email,
    verified: !!row.verified_at,
  };
}

/** `last_seen_at` at day precision, written at most once a day (`/api/me`). */
export async function touchAccount(
  db: D1Database,
  accountId: string,
  now = new Date(),
) {
  const day = iso(now).slice(0, 10);
  await getDb(db)
    .update(contactAccount)
    .set({ last_seen_at: day })
    .where(
      and(
        eq(contactAccount.id, accountId),
        or(
          isNull(contactAccount.last_seen_at),
          lt(contactAccount.last_seen_at, day),
        ),
      ),
    );
}

export async function signOut(db: D1Database, tokenHash: string) {
  await getDb(db)
    .delete(contactSession)
    .where(eq(contactSession.token_hash, tokenHash));
}

// --- purge ------------------------------------------------------------------------------------

/**
 * Deletes what the 7-day rule says (owner, 2026-11-25): unverified accounts older than 7 days
 * with their sessions and tokens, every unconfirmed message older than 7 days (also one sent in a
 * verified person's name from a browser that never confirmed), expired sessions, tokens older
 * than 7 days (the daily caps only look at today's). Run on every contact send and on
 * /admin/accounts/, so no cron is needed. Foreign keys cascade in D1, but the rows are deleted
 * explicitly so nothing depends on it. One batch (one transaction, one D1 query).
 */
export async function purgeExpired(db: D1Database, now = new Date()) {
  const d = getDb(db);
  const cutoff = ago(now, UNVERIFIED_MS);
  const stale = () =>
    d
      .select({ id: contactAccount.id })
      .from(contactAccount)
      .where(
        and(
          isNull(contactAccount.verified_at),
          lt(contactAccount.created_at, cutoff),
        ),
      );
  await d.batch([
    d
      .delete(message)
      .where(
        and(
          isNull(message.confirmed_at),
          isNotNull(message.account_id),
          or(
            lt(message.created_at, cutoff),
            inArray(message.account_id, stale()),
          ),
        ),
      ),
    d
      .delete(contactSession)
      .where(
        or(
          lte(contactSession.expires_at, iso(now)),
          inArray(contactSession.account_id, stale()),
        ),
      ),
    d
      .delete(verifyToken)
      .where(
        or(
          lt(verifyToken.created_at, cutoff),
          inArray(verifyToken.account_id, stale()),
        ),
      ),
    d
      .delete(contactAccount)
      .where(
        and(
          isNull(contactAccount.verified_at),
          lt(contactAccount.created_at, cutoff),
        ),
      ),
  ]);
}

// --- tokens -----------------------------------------------------------------------------------

export interface NewToken {
  /** For the email only: never stored. */
  linkToken: string;
  code: string;
  linkHash: string;
}

/**
 * A verify token for `accountId`, unless a send cap says no (then null; the caller sends no
 * email and answers the same text, plan 5.3). `sessionHash`: the browser that asked, upgraded
 * when the token is used anywhere.
 *
 * RAW D1 on purpose: a cap insert (`.claude/rules/db.md`), ONE statement so the counts and the
 * insert cannot interleave with another request's.
 */
export async function createToken(
  db: D1Database,
  secret: string,
  accountId: string,
  sessionHash: string | null,
  now = new Date(),
): Promise<NewToken | null> {
  const linkToken = randomToken();
  const code = sixDigitCode();
  const linkHash = await sha256(linkToken);
  const codeHash = await hmac(secret, `${linkHash}|${code}`);
  const day = startOfDay(now);
  const result = await db
    .prepare(
      `INSERT INTO verify_token (link_hash, account_id, session_hash, code_hash, created_at, expires_at)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM verify_token WHERE created_at >= ?) < ?
         AND (SELECT COUNT(*) FROM verify_token WHERE account_id = ? AND created_at >= ?) < ?
         AND NOT EXISTS (SELECT 1 FROM verify_token WHERE account_id = ? AND created_at > ?)`,
    )
    .bind(
      linkHash,
      accountId,
      sessionHash,
      codeHash,
      iso(now),
      later(now, TOKEN_MS),
      day,
      SENDS_PER_DAY,
      accountId,
      day,
      SENDS_PER_ADDRESS_DAY,
      accountId,
      ago(now, SEND_GAP_MS),
    )
    .run();
  return result.meta.changes > 0 ? { linkToken, code, linkHash } : null;
}

/** What happened to a token's email (shown in /admin; no address, no token). */
export async function recordSend(
  db: D1Database,
  linkHash: string,
  outcome: {
    status: "sent" | "failed" | "logged";
    id?: string;
    error?: string;
  },
) {
  await getDb(db)
    .update(verifyToken)
    .set({
      send_status: outcome.status,
      send_id: outcome.id ?? null,
      send_error: outcome.error?.slice(0, 120) ?? null,
    })
    .where(eq(verifyToken.link_hash, linkHash));
}

// --- the first message ------------------------------------------------------------------------

export type StartResult =
  /** The day's site-wide cap is reached: the one error that may differ (it is not per address). */
  | { kind: "full" }
  | {
      kind: "started";
      /** The new session's cookie value. */
      sessionToken: string;
      accountId: string;
      /** The token to email, or null when a send cap held it back (same answer either way). */
      token: NewToken | null;
      messageId: number | null;
    };

/**
 * A message from someone with no session for this address (Contact me, plan 1.1 and 1.3): the
 * account (new: unverified; existing: kept as it is, the typed name stays on the message only),
 * the message UNCONFIRMED (unless this account already has 3 waiting: then it is dropped
 * silently, so the answer cannot tell whether the address is known), a new unverified session,
 * and a token. Everything is a bound parameter.
 *
 * The batch stays RAW D1 on purpose: its middle statement is a cap insert, and Drizzle's D1
 * batch cannot hold a raw `sql` statement with parameters (`.claude/rules/db.md`).
 */
export async function startContact(
  db: D1Database,
  secret: string,
  input: { name: string; email: string; body: string },
  now = new Date(),
): Promise<StartResult> {
  await purgeExpired(db, now);
  const email = normalizeEmail(input.email);
  const day = startOfDay(now);
  if ((await messagesSince(db, day)) >= MESSAGES_PER_DAY)
    return { kind: "full" };

  const sessionToken = randomToken();
  const sessionHash = await sha256(sessionToken);
  const accountOf = "(SELECT id FROM contact_account WHERE email = ?)";
  const [, inserted] = await db.batch([
    db
      .prepare(
        "INSERT INTO contact_account (id, email, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING",
      )
      .bind(crypto.randomUUID(), email, input.name, iso(now)),
    db
      .prepare(
        `INSERT INTO message (name, email, body, created_at, account_id, confirmed_at, session_hash)
         SELECT ?, ?, ?, ?, ${accountOf}, NULL, ?
         WHERE (SELECT COUNT(*) FROM message WHERE created_at >= ?) < ?
           AND (SELECT COUNT(*) FROM message WHERE account_id = ${accountOf} AND confirmed_at IS NULL) < ?
         RETURNING id`,
      )
      .bind(
        input.name,
        email,
        input.body,
        iso(now),
        email,
        sessionHash,
        day,
        MESSAGES_PER_DAY,
        email,
        UNCONFIRMED_PER_ACCOUNT,
      ),
    db
      .prepare(
        `INSERT INTO contact_session (token_hash, account_id, created_at, expires_at)
         VALUES (?, ${accountOf}, ?, ?)`,
      )
      .bind(sessionHash, email, iso(now), later(now, UNVERIFIED_MS)),
  ]);
  const account = await getDb(db)
    .select({ id: contactAccount.id })
    .from(contactAccount)
    .where(eq(contactAccount.email, email))
    .get();
  if (!account) throw new Error("account missing after insert");
  const messageId =
    (inserted.results?.[0] as { id?: number } | undefined)?.id ?? null;
  const token = await createToken(db, secret, account.id, sessionHash, now);
  return {
    kind: "started",
    sessionToken,
    accountId: account.id,
    token,
    messageId,
  };
}

/** Messages stored since `day` (the site-wide daily cap). */
async function messagesSince(db: D1Database, day: string): Promise<number> {
  const row = await getDb(db)
    .select({ n: count() })
    .from(message)
    .where(gte(message.created_at, day))
    .get();
  return row?.n ?? 0;
}

// --- later messages (a session) ---------------------------------------------------------------

export type SessionSendResult =
  | { kind: "saved"; messageId: number; confirmed: boolean }
  /** Site-wide daily cap. */
  | { kind: "full" }
  /** This account's own cap: 3 waiting (unverified) or 10 today (verified). */
  | { kind: "capped"; verified: boolean };

/**
 * A message from a browser with a session (Sean's thread, plan 1.3). Verified: confirmed at
 * once, 10 a day. Unverified: waits for the link / code, at most 3 waiting.
 *
 * The insert stays RAW D1 on purpose (a cap insert, `.claude/rules/db.md`).
 */
export async function sendAsSession(
  db: D1Database,
  session: Session,
  body: string,
  now = new Date(),
): Promise<SessionSendResult> {
  await purgeExpired(db, now);
  const day = startOfDay(now);
  // Verified: 10 today. Unverified: 3 waiting in all.
  const accountCap = session.verified
    ? "(SELECT COUNT(*) FROM message WHERE account_id = ? AND created_at >= ?) < ?"
    : "(SELECT COUNT(*) FROM message WHERE account_id = ? AND confirmed_at IS NULL) < ?";
  const capValues = session.verified
    ? [session.accountId, day, VERIFIED_PER_DAY]
    : [session.accountId, UNCONFIRMED_PER_ACCOUNT];
  const row = await db
    .prepare(
      `INSERT INTO message (name, email, body, created_at, account_id, confirmed_at, session_hash)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM message WHERE created_at >= ?) < ?
         AND ${accountCap}
       RETURNING id`,
    )
    .bind(
      session.name,
      session.email,
      body,
      iso(now),
      session.accountId,
      session.verified ? iso(now) : null,
      session.tokenHash,
      day,
      MESSAGES_PER_DAY,
      ...capValues,
    )
    .first<{ id: number }>();
  if (row)
    return { kind: "saved", messageId: row.id, confirmed: session.verified };
  return (await messagesSince(db, day)) >= MESSAGES_PER_DAY
    ? { kind: "full" }
    : { kind: "capped", verified: session.verified };
}

// --- verifying --------------------------------------------------------------------------------

export type VerifyResult =
  | {
      ok: true;
      accountId: string;
      /** A new verified session for THIS browser, when it had none for the account. */
      sessionToken: string | null;
      /** The account was unverified until now (the owner hears about it once). */
      firstTime: boolean;
    }
  | { ok: false; reason: "invalid" | "expired" | "used" | "locked" };

interface TokenRow {
  link_hash: string;
  account_id: string;
  session_hash: string | null;
  code_hash: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  attempts: number;
}

/**
 * Marks the token used and verifies: the account (if it was not), THIS browser (its session if it has
 * one for the account, else a new verified one), and the waiting messages of exactly the sessions
 * it upgrades (this browser's only). The token is claimed first (single use), then the rest is one batch.
 *
 * Messages are confirmed by SESSION (migration 0005, `message.session_hash`; security review gap
 * 2026-11-25): before, every waiting message of the account was confirmed, including one a
 * stranger had sent from another browser by typing the same address. Now another session's
 * waiting messages stay unconfirmed and go with the 7-day purge; a row with no `session_hash`
 * (sent between 0004 and 0005) matches no session and is never confirmed by a code or link. No
 * time bound any more: a message sent from the session before a "Send the email again" token is
 * the same browser's and is confirmed with it.
 */
async function complete(
  db: D1Database,
  token: TokenRow,
  current: Session | null,
  now: Date,
): Promise<VerifyResult> {
  const d = getDb(db);
  const before = await d
    .select({ verified_at: contactAccount.verified_at })
    .from(contactAccount)
    .where(eq(contactAccount.id, token.account_id))
    .get();
  if (!before) return { ok: false, reason: "invalid" };
  // Single use, claimed first: only the first of two racing requests changes the row.
  const used = await d
    .update(verifyToken)
    .set({ used_at: iso(now) })
    .where(
      and(
        eq(verifyToken.link_hash, token.link_hash),
        isNull(verifyToken.used_at),
      ),
    );
  if (used.meta.changes === 0) return { ok: false, reason: "used" };
  const currentHash =
    current && current.accountId === token.account_id
      ? current.tokenHash
      : null;
  const sessionToken = currentHash ? null : randomToken();
  // ONLY the browser that proves the token is verified, link or code (owner: "use your
  // recommendations", 2026-11-25; second agent's HIGH): the browser that ASKED for the email may be
  // a stranger who typed the same address, so it is never upgraded. Someone who opens the link on
  // another device confirms that device; the browser they wrote from types the code instead.
  const updates = [
    d
      .update(contactAccount)
      .set({ verified_at: iso(now) })
      .where(
        and(
          eq(contactAccount.id, token.account_id),
          isNull(contactAccount.verified_at),
        ),
      ),
    d
      .update(message)
      .set({ confirmed_at: iso(now) })
      .where(
        and(
          eq(message.account_id, token.account_id),
          isNull(message.confirmed_at),
          isNotNull(message.session_hash),
          eq(message.session_hash, currentHash ?? ""),
        ),
      ),
    d
      .update(contactSession)
      .set({ verified_at: iso(now), expires_at: later(now, SESSION_MS) })
      .where(
        and(
          eq(contactSession.account_id, token.account_id),
          eq(contactSession.token_hash, currentHash ?? ""),
        ),
      ),
  ] as const;
  if (sessionToken) {
    await d.batch([
      ...updates,
      d.insert(contactSession).values({
        token_hash: await sha256(sessionToken),
        account_id: token.account_id,
        created_at: iso(now),
        verified_at: iso(now),
        expires_at: later(now, SESSION_MS),
      }),
    ]);
  } else {
    await d.batch(updates);
  }
  return {
    ok: true,
    accountId: token.account_id,
    sessionToken,
    firstTime: !before.verified_at,
  };
}

function tokenState(
  token: TokenRow | null | undefined,
  now: Date,
): VerifyResult | null {
  if (!token) return { ok: false, reason: "invalid" };
  if (token.used_at) return { ok: false, reason: "used" };
  if (token.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  if (token.expires_at <= iso(now)) return { ok: false, reason: "expired" };
  return null;
}

/** The token row for a link hash, or undefined. */
const tokenByHash = (db: D1Database, linkHash: string) =>
  getDb(db)
    .select()
    .from(verifyToken)
    .where(eq(verifyToken.link_hash, linkHash))
    .get();

/** What /verify/'s GET shows for a link (never verifies: mail scanners follow GET links). */
export async function peekLink(
  db: D1Database,
  linkToken: string,
  now = new Date(),
): Promise<
  | { ok: true; masked: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "locked" }
> {
  if (!linkToken || linkToken.length > 100)
    return { ok: false, reason: "invalid" };
  const row = await getDb(db)
    .select({ ...getTableColumns(verifyToken), email: contactAccount.email })
    .from(verifyToken)
    .innerJoin(contactAccount, eq(contactAccount.id, verifyToken.account_id))
    .where(eq(verifyToken.link_hash, await sha256(linkToken)))
    .get();
  const state = tokenState(row, now);
  if (state && !state.ok) return state;
  return { ok: true, masked: maskEmail(row!.email) };
}

/** /verify/'s Confirm button (a POST). */
export async function verifyLink(
  db: D1Database,
  linkToken: string,
  current: Session | null,
  now = new Date(),
): Promise<VerifyResult> {
  if (!linkToken || linkToken.length > 100)
    return { ok: false, reason: "invalid" };
  const row = await tokenByHash(db, await sha256(linkToken));
  const state = tokenState(row, now);
  if (state) return state;
  return complete(db, row!, current, now);
}

/**
 * A code typed in THIS browser (Contact me, or /verify/ with a session): checked against the
 * account's LATEST token only, so a new email voids the older codes. A wrong code counts an
 * attempt; the fifth locks the token ("Send again" makes a new one).
 */
export async function verifyCode(
  db: D1Database,
  secret: string,
  session: Session,
  code: string,
  now = new Date(),
): Promise<VerifyResult> {
  const d = getDb(db);
  const row = await d
    .select()
    .from(verifyToken)
    .where(eq(verifyToken.account_id, session.accountId))
    .orderBy(desc(verifyToken.created_at), sql`rowid DESC`)
    .limit(1)
    .get();
  const state = tokenState(row, now);
  if (state) return state;
  // Claim the attempt FIRST, in one statement (second agent, RULE 2, 2026-11-25): read, compare
  // and count as separate steps let parallel guesses all see "attempts < 5". No row back = the
  // token is used, locked or expired by now.
  const claimed = await d
    .update(verifyToken)
    .set({ attempts: sql`${verifyToken.attempts} + 1` })
    .where(
      and(
        eq(verifyToken.link_hash, row!.link_hash),
        isNull(verifyToken.used_at),
        lt(verifyToken.attempts, MAX_ATTEMPTS),
        gt(verifyToken.expires_at, iso(now)),
      ),
    )
    .returning({ attempts: verifyToken.attempts })
    .get();
  if (!claimed) {
    const again = await tokenByHash(db, row!.link_hash);
    return tokenState(again, now) ?? { ok: false, reason: "locked" };
  }
  const given = await hmac(secret, `${row!.link_hash}|${code.trim()}`);
  if (!/^\d{6}$/.test(code.trim()) || !sameDigest(given, row!.code_hash)) {
    return claimed.attempts >= MAX_ATTEMPTS
      ? { ok: false, reason: "locked" }
      : { ok: false, reason: "invalid" };
  }
  return complete(db, row!, session, now);
}

/**
 * Whether to notify the owner about this account now (at most hourly), claiming the slot in the
 * same statement so two requests cannot both send.
 */
export async function claimNotify(
  db: D1Database,
  accountId: string,
  now = new Date(),
) {
  const result = await getDb(db)
    .update(contactAccount)
    .set({ notified_at: iso(now) })
    .where(
      and(
        eq(contactAccount.id, accountId),
        isNotNull(contactAccount.verified_at),
        or(
          isNull(contactAccount.notified_at),
          lte(contactAccount.notified_at, ago(now, NOTIFY_GAP_MS)),
        ),
      ),
    );
  return result.meta.changes > 0;
}

/**
 * What the owner's notice about `accountId` shows: the account's name and address and its newest
 * CONFIRMED message (`messageId`, when given, must be that message), or null. Moved here from
 * `notifyOwnerLater` (`@seanperez/server/account/contact.server`) on 2026-11-25: SQL lives in db.
 */
export async function notifyTarget(
  db: D1Database,
  accountId: string,
  messageId: number | null,
): Promise<{
  name: string;
  email: string;
  id: number | null;
  body: string | null;
} | null> {
  return (
    (await getDb(db)
      .select({
        name: contactAccount.name,
        email: contactAccount.email,
        id: message.id,
        body: message.body,
      })
      .from(contactAccount)
      .leftJoin(
        message,
        and(
          eq(message.account_id, contactAccount.id),
          isNotNull(message.confirmed_at),
        ),
      )
      .where(
        and(
          eq(contactAccount.id, accountId),
          messageId === null ? undefined : eq(message.id, messageId),
        ),
      )
      .orderBy(desc(message.created_at))
      .limit(1)
      .get()) ?? null
  );
}

// --- /admin only (behind `requireAdmin`) ------------------------------------------------------

export interface AccountSummary {
  id: string;
  name: string;
  email: string;
  created_at: string;
  verified_at: string | null;
  last_seen_at: string | null;
  messages: number;
}

export async function listAccounts(db: D1Database): Promise<AccountSummary[]> {
  const d = getDb(db);
  return d
    .select({
      id: contactAccount.id,
      name: contactAccount.name,
      email: contactAccount.email,
      created_at: contactAccount.created_at,
      verified_at: contactAccount.verified_at,
      last_seen_at: contactAccount.last_seen_at,
      messages: d.$count(message, eq(message.account_id, contactAccount.id)),
    })
    .from(contactAccount)
    .orderBy(desc(contactAccount.created_at))
    .limit(500);
}

export interface AccountDetail {
  id: string;
  name: string;
  email: string;
  created_at: string;
  verified_at: string | null;
  /** The latest verification email. */
  lastSend: {
    created_at: string;
    send_status: string;
    send_id: string | null;
    send_error: string | null;
  } | null;
}

export async function getAccount(
  db: D1Database,
  id: string,
): Promise<AccountDetail | null> {
  const d = getDb(db);
  const account = await d
    .select({
      id: contactAccount.id,
      name: contactAccount.name,
      email: contactAccount.email,
      created_at: contactAccount.created_at,
      verified_at: contactAccount.verified_at,
    })
    .from(contactAccount)
    .where(eq(contactAccount.id, id))
    .get();
  if (!account) return null;
  const lastSend = await d
    .select({
      created_at: verifyToken.created_at,
      send_status: verifyToken.send_status,
      send_id: verifyToken.send_id,
      send_error: verifyToken.send_error,
    })
    .from(verifyToken)
    .where(eq(verifyToken.account_id, id))
    .orderBy(desc(verifyToken.created_at), sql`rowid DESC`)
    .limit(1)
    .get();
  return { ...account, lastSend: lastSend ?? null };
}

/**
 * Deletes an account: its sessions, tokens and UNCONFIRMED messages go; its confirmed messages
 * stay in the inbox, unlinked (they were sent to the owner, as before accounts). One batch.
 */
export async function deleteAccount(db: D1Database, id: string) {
  const d = getDb(db);
  await d.batch([
    d
      .delete(message)
      .where(and(eq(message.account_id, id), isNull(message.confirmed_at))),
    d
      .update(message)
      .set({ account_id: null, session_hash: null })
      .where(eq(message.account_id, id)),
    d.delete(contactSession).where(eq(contactSession.account_id, id)),
    d.delete(verifyToken).where(eq(verifyToken.account_id, id)),
    d.delete(contactAccount).where(eq(contactAccount.id, id)),
  ]);
}

// --- the visitor's own account (/profile/ "Delete my account") --------------------------------

export type DeleteOwnResult =
  | { kind: "deleted" }
  /** This browser has not confirmed the address: it may not delete (see below). */
  | { kind: "verify-first" }
  /** The account is already gone (deleted in another tab, purged), or the session is. */
  | { kind: "gone" };

/**
 * The visitor deletes their own account (owner, 2026-11-25, "DECIDED" (3)): the account row, ALL
 * its sessions (every browser signed in to it), its verify tokens, ALL its messages (confirmed
 * too, unlike the owner's `deleteAccount`, which keeps what was delivered) and the owner's
 * replies to them. Identified ONLY by the session (the cookie), never by anything the browser
 * sends.
 *
 * Also the messages with the SAME address and NO account (security review gap, 2026-11-25): rows
 * from before accounts existed (migration 0003, or accounts not set up), and rows the owner's
 * `deleteAccount` unlinked. Matched on the address as stored (`lower(trim(email))`, since those
 * rows kept the address as typed) against the account's normalized address. Safe only because
 * the session is VERIFIED: this browser proved it reads that mailbox. Another account's
 * messages are never touched (`account_id IS NULL`).
 *
 * Only a VERIFIED session (this browser confirmed the address by link or code) may delete.
 * `startContact` gives an unverified session to anyone who types an address, so an unverified
 * session proves nothing: allowing it would let a stranger delete a real person's account (or,
 * before they confirm, their waiting messages), and a refusal that differed by account would tell
 * whether an address is verified (second agent, RULE 2, 2026-11-25). An unverified visitor
 * confirms first, or signs out and the 7-day purge removes the rest. The condition is repeated in
 * every statement of the batch (one transaction): all or nothing.
 */
export async function deleteOwnAccount(
  db: D1Database,
  session: Session,
): Promise<DeleteOwnResult> {
  if (!session.verified) return { kind: "verify-first" };
  const d = getDb(db);
  const id = session.accountId;
  const email = normalizeEmail(session.email);
  // This browser's VERIFIED session for the account still exists (built per statement).
  const allowed = () =>
    exists(
      d
        .select({ one: sql`1` })
        .from(contactSession)
        .where(
          and(
            eq(contactSession.token_hash, session.tokenHash),
            eq(contactSession.account_id, id),
            isNotNull(contactSession.verified_at),
          ),
        ),
    );
  // Rows from before accounts: no account, same address as typed (`lower(trim(email))`).
  const preAccount = () =>
    and(
      isNull(message.account_id),
      sql`lower(trim(${message.email})) = ${email}`,
    );
  const messageIds = (where: SQL | undefined) =>
    d.select({ id: message.id }).from(message).where(where);
  const [, , , , , removed] = await d.batch([
    // The messages from before accounts (no account, same address) and the replies to them.
    d
      .delete(messageReply)
      .where(
        and(
          inArray(messageReply.message_id, messageIds(preAccount())),
          allowed(),
        ),
      ),
    d.delete(message).where(and(preAccount(), allowed())),
    d
      .delete(messageReply)
      .where(
        and(
          inArray(messageReply.message_id, messageIds(eq(message.account_id, id))),
          allowed(),
        ),
      ),
    d.delete(message).where(and(eq(message.account_id, id), allowed())),
    d.delete(verifyToken).where(and(eq(verifyToken.account_id, id), allowed())),
    // The account row before its sessions (`allowed` reads this browser's session); D1
    // enforces foreign keys, so the sessions go with it (ON DELETE CASCADE)...
    d.delete(contactAccount).where(and(eq(contactAccount.id, id), allowed())),
    // ...and explicitly, once the account is gone (nothing here depends on the cascade).
    d
      .delete(contactSession)
      .where(
        and(
          eq(contactSession.account_id, id),
          notExists(
            d
              .select({ one: sql`1` })
              .from(contactAccount)
              .where(eq(contactAccount.id, id)),
          ),
        ),
      ),
  ]);
  return removed.meta.changes > 0 ? { kind: "deleted" } : { kind: "gone" };
}
