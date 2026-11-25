/**
 * Unit test for contact accounts (`src/account/account.server.ts`): the real migrations on a REAL
 * local D1 (wrangler `getPlatformProxy`, in memory; `src/testing/d1.ts`), with the clock moved by
 * hand (every function takes `now`). Run from packages/db:
 *   node --test scripts/account-test.ts
 * Nothing here talks to Cloudflare's network or sends mail. The Turnstile and background
 * verification-mail cases moved to `packages/server/scripts/contact-test.ts` (2026-11-25).
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  MAX_ATTEMPTS,
  claimNotify,
  createToken,
  deleteAccount,
  deleteOwnAccount,
  getSession,
  maskEmail,
  peekLink,
  purgeExpired,
  sendAsSession,
  sixDigitCode,
  startContact,
  verifyCode,
  verifyLink,
  type Session,
} from "../src/account/account.server.ts";
import { createTestD1 } from "../src/testing/d1.ts";

const SECRET = "test-secret-not-real";

/** One real local D1 for this file (`src/testing/d1.ts`); every test starts from `freshDb()`. */
const testD1 = await createTestD1();
after(() => testD1.dispose());
const freshDb = () => testD1.reset();

const t0 = new Date("2026-11-25T10:00:00.000Z");
const at = (ms: number) => new Date(t0.getTime() + ms);
const MIN = 60_000;
const input = { name: "Visitor", email: "Visitor@Example.com", body: "Hello" };

async function started(db: D1Database, now = t0, data = input) {
  const r = await startContact(db, SECRET, data, now);
  assert.equal(r.kind, "started");
  if (r.kind !== "started") throw new Error();
  return r;
}

test("codes are six digits", () => {
  for (let i = 0; i < 200; i++) assert.match(sixDigitCode(), /^\d{6}$/);
});

test("maskEmail", () => {
  assert.equal(maskEmail("ada@example.com"), "a***@e***.com");
});

test("first message: unverified account, unconfirmed message, session, token", async () => {
  const db = await freshDb();
  const r = await started(db);
  assert.ok(r.token);
  assert.ok(r.messageId);
  const session = await getSession(db, r.sessionToken, t0);
  assert.equal(session?.verified, false);
  assert.equal(session?.email, "visitor@example.com");
  const msg = await db
    .prepare("SELECT * FROM message")
    .first<{ confirmed_at: string | null }>();
  assert.equal(msg?.confirmed_at, null);
});

test("the right code verifies the account, its message and this session", async () => {
  const db = await freshDb();
  const r = await started(db);
  const session = (await getSession(db, r.sessionToken, t0))!;
  const v = await verifyCode(db, SECRET, session, r.token!.code, at(MIN));
  assert.deepEqual(v.ok && { first: v.firstTime, newSession: v.sessionToken }, {
    first: true,
    newSession: null,
  });
  assert.equal((await getSession(db, r.sessionToken, at(MIN)))?.verified, true);
  const msg = await db
    .prepare("SELECT confirmed_at FROM message")
    .first<{ confirmed_at: string }>();
  assert.ok(msg?.confirmed_at);
  // Single use.
  const again = await verifyCode(db, SECRET, session, r.token!.code, at(MIN));
  assert.deepEqual(again, { ok: false, reason: "used" });
});

test("wrong codes count; the fifth locks the token", async () => {
  const db = await freshDb();
  const r = await started(db);
  const session = (await getSession(db, r.sessionToken, t0))!;
  const wrong = r.token!.code === "000000" ? "111111" : "000000";
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    assert.deepEqual(await verifyCode(db, SECRET, session, wrong, t0), {
      ok: false,
      reason: "invalid",
    });
  }
  assert.deepEqual(await verifyCode(db, SECRET, session, wrong, t0), {
    ok: false,
    reason: "locked",
  });
  assert.deepEqual(await verifyCode(db, SECRET, session, r.token!.code, t0), {
    ok: false,
    reason: "locked",
  });
});

test("a code expires after 30 minutes", async () => {
  const db = await freshDb();
  const r = await started(db);
  const session = (await getSession(db, r.sessionToken, t0))!;
  assert.deepEqual(
    await verifyCode(db, SECRET, session, r.token!.code, at(31 * MIN)),
    {
      ok: false,
      reason: "expired",
    },
  );
});

test("the link: GET peeks without verifying, POST verifies the OPENING browser only", async () => {
  const db = await freshDb();
  const r = await started(db);
  const peek = await peekLink(db, r.token!.linkToken, at(MIN));
  assert.deepEqual(peek, { ok: true, masked: "v***@e***.com" });
  assert.equal(
    (await getSession(db, r.sessionToken, at(MIN)))?.verified,
    false,
  );
  // Opened on another device (no session there): a new verified session for THAT device only.
  // The browser that asked is NOT upgraded (it may be a stranger who typed the address).
  const v = await verifyLink(db, r.token!.linkToken, null, at(MIN));
  assert.ok(v.ok && v.sessionToken);
  if (!v.ok || !v.sessionToken) return;
  assert.equal((await getSession(db, v.sessionToken, at(MIN)))?.verified, true);
  assert.equal(
    (await getSession(db, r.sessionToken, at(MIN)))?.verified,
    false,
  );
  assert.deepEqual(await verifyLink(db, "not-a-token", null, at(MIN)), {
    ok: false,
    reason: "invalid",
  });
});

test("a new email voids the older code (latest token only)", async () => {
  const db = await freshDb();
  const r = await started(db);
  const session = (await getSession(db, r.sessionToken, t0))!;
  const second = await createToken(
    db,
    SECRET,
    session.accountId,
    session.tokenHash,
    at(2 * MIN),
  );
  assert.ok(second);
  const old = await verifyCode(db, SECRET, session, r.token!.code, at(3 * MIN));
  assert.equal(old.ok, second!.code === r.token!.code);
  assert.equal(
    (await verifyCode(db, SECRET, session, second!.code, at(3 * MIN))).ok,
    true,
  );
});

test("send caps: 60 s gap, 3 per address per day", async () => {
  const db = await freshDb();
  const r = await started(db);
  const id = r.accountId;
  assert.equal(await createToken(db, SECRET, id, null, at(30_000)), null);
  assert.ok(await createToken(db, SECRET, id, null, at(2 * MIN)));
  assert.ok(await createToken(db, SECRET, id, null, at(4 * MIN)));
  assert.equal(await createToken(db, SECRET, id, null, at(6 * MIN)), null);
});

test("someone else typing a known address: same answer, message waits, no sign-in as them", async () => {
  const db = await freshDb();
  const owner = await started(db);
  const s = (await getSession(db, owner.sessionToken, t0))!;
  await verifyCode(db, SECRET, s, owner.token!.code, t0);
  const other = await started(db, at(5 * MIN), { ...input, name: "Impostor" });
  const os = (await getSession(db, other.sessionToken, at(5 * MIN)))!;
  assert.equal(os.verified, false);
  assert.equal(os.name, "Visitor"); // the account keeps its name
  const waiting = await db
    .prepare("SELECT COUNT(*) AS n FROM message WHERE confirmed_at IS NULL")
    .first<{ n: number }>();
  assert.equal(waiting?.n, 1);
});

test("an unverified account may have 3 messages waiting; extra ones are dropped silently", async () => {
  const db = await freshDb();
  for (let i = 0; i < 4; i++) await started(db, at(i * 2 * MIN));
  const n = await db
    .prepare("SELECT COUNT(*) AS n FROM message")
    .first<{ n: number }>();
  assert.equal(n?.n, 3);
});

test("sendAsSession: unverified up to 3 waiting; verified confirmed at once", async () => {
  const db = await freshDb();
  const r = await started(db);
  let s = (await getSession(db, r.sessionToken, t0))!;
  assert.equal((await sendAsSession(db, s, "two", t0)).kind, "saved");
  assert.equal((await sendAsSession(db, s, "three", t0)).kind, "saved");
  assert.deepEqual(await sendAsSession(db, s, "four", t0), {
    kind: "capped",
    verified: false,
  });
  await verifyCode(db, SECRET, s, r.token!.code, t0);
  s = (await getSession(db, r.sessionToken, t0)) as Session;
  const sent = await sendAsSession(db, s, "verified", at(MIN));
  assert.ok(sent.kind === "saved" && sent.confirmed);
});

test("owner notified once, then at most hourly", async () => {
  const db = await freshDb();
  const r = await started(db);
  assert.equal(await claimNotify(db, r.accountId, t0), false); // not verified yet
  const s = (await getSession(db, r.sessionToken, t0))!;
  await verifyCode(db, SECRET, s, r.token!.code, t0);
  assert.equal(await claimNotify(db, r.accountId, t0), true);
  assert.equal(await claimNotify(db, r.accountId, at(30 * MIN)), false);
  assert.equal(await claimNotify(db, r.accountId, at(61 * MIN)), true);
});

test("purge: unverified accounts and their waiting messages go after 7 days", async () => {
  const db = await freshDb();
  const r = await started(db);
  await purgeExpired(db, at(8 * 24 * 60 * MIN));
  const counts = await db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM contact_account) AS a, (SELECT COUNT(*) FROM message) AS m, (SELECT COUNT(*) FROM contact_session) AS s",
    )
    .first<{ a: number; m: number; s: number }>();
  assert.deepEqual({ ...counts }, { a: 0, m: 0, s: 0 });
  assert.equal(
    await getSession(db, r.sessionToken, at(8 * 24 * 60 * MIN)),
    null,
  );
});

test("deleteAccount keeps confirmed messages, unlinked", async () => {
  const db = await freshDb();
  const r = await started(db);
  const s = (await getSession(db, r.sessionToken, t0))!;
  await verifyCode(db, SECRET, s, r.token!.code, t0);
  await deleteAccount(db, r.accountId);
  const m = await db
    .prepare("SELECT account_id FROM message")
    .first<{ account_id: string | null }>();
  assert.equal(m?.account_id, null);
  assert.equal(await getSession(db, r.sessionToken, t0), null);
});

test("parallel wrong guesses cannot pass the 5-attempt limit", async () => {
  const db = await freshDb();
  const r = await started(db);
  const session = (await getSession(db, r.sessionToken, t0))!;
  const wrong = r.token!.code === "000000" ? "111111" : "000000";
  await Promise.all(
    Array.from({ length: 20 }, () =>
      verifyCode(db, SECRET, session, wrong, t0),
    ),
  );
  const row = await db
    .prepare("SELECT attempts FROM verify_token")
    .first<{ attempts: number }>();
  assert.equal(row?.attempts, MAX_ATTEMPTS);
  assert.deepEqual(await verifyCode(db, SECRET, session, r.token!.code, t0), {
    ok: false,
    reason: "locked",
  });
});

test("a stranger who typed a VERIFIED address is not upgraded when its owner confirms", async () => {
  const db = await freshDb();
  const owner = await started(db);
  const s = (await getSession(db, owner.sessionToken, t0))!;
  await verifyCode(db, SECRET, s, owner.token!.code, t0);
  const stranger = await started(db, at(5 * MIN), {
    ...input,
    name: "Stranger",
  });
  // The real owner opens the stranger's email link in their own browser and confirms.
  await verifyLink(db, stranger.token!.linkToken, s, at(6 * MIN));
  assert.equal(
    (await getSession(db, stranger.sessionToken, at(6 * MIN)))?.verified,
    false,
  );
});

// --- 2026-11-25 follow-ups (owner, "DECIDED" (1) to (3)) --------------------------------------

const count = async (db: D1Database, sql: string, ...args: unknown[]) =>
  (await db
    .prepare(sql)
    .bind(...args)
    .first<{ n: number }>())!.n;

test("self-delete (verified): account, every session, tokens, ALL its messages and replies go", async () => {
  const db = await freshDb();
  const r = await started(db);
  const session = (await getSession(db, r.sessionToken, t0))!;
  await verifyCode(db, SECRET, session, r.token!.code, at(MIN));
  const verified = (await getSession(db, r.sessionToken, at(MIN)))!;
  // A second browser of the same person, verified by a link.
  const other = await createToken(db, SECRET, r.accountId, null, at(2 * MIN));
  const v = await verifyLink(db, other!.linkToken, null, at(2 * MIN));
  assert.ok(v.ok && v.sessionToken);
  await sendAsSession(db, verified, "second, confirmed", at(3 * MIN));
  await db
    .prepare(
      "INSERT INTO message_reply (message_id, body, created_at, send_status) VALUES (?, 'reply', ?, 'sent')",
    )
    .bind(r.messageId, at(4 * MIN).toISOString())
    .run();
  // Someone else's account and message stay.
  const stranger = await started(db, t0, {
    name: "Other",
    email: "other@example.com",
    body: "not theirs",
  });

  assert.deepEqual(await deleteOwnAccount(db, verified), { kind: "deleted" });
  for (const [sql, arg] of [
    ["SELECT COUNT(*) AS n FROM contact_account WHERE id = ?", r.accountId],
    [
      "SELECT COUNT(*) AS n FROM contact_session WHERE account_id = ?",
      r.accountId,
    ],
    [
      "SELECT COUNT(*) AS n FROM verify_token WHERE account_id = ?",
      r.accountId,
    ],
    [
      "SELECT COUNT(*) AS n FROM message WHERE email = ?",
      "visitor@example.com",
    ],
    [
      "SELECT COUNT(*) AS n FROM message_reply WHERE message_id = ?",
      r.messageId,
    ],
  ] as const) {
    assert.equal(await count(db, sql, arg), 0, sql);
  }
  assert.equal(
    await getSession(db, v.ok ? v.sessionToken : "", at(5 * MIN)),
    null,
  );
  assert.equal(
    await count(
      db,
      "SELECT COUNT(*) AS n FROM message WHERE account_id = ?",
      stranger.accountId,
    ),
    1,
  );
  // Again with the same (now deleted) session: nothing left.
  assert.deepEqual(await deleteOwnAccount(db, verified), { kind: "gone" });
});

test("self-delete: an unverified browser cannot delete, whether the account is verified or not", async () => {
  const db = await freshDb();
  // A verified account, and a stranger who typed its address.
  const owner = await started(db);
  const s = (await getSession(db, owner.sessionToken, t0))!;
  await verifyCode(db, SECRET, s, owner.token!.code, at(MIN));
  const typed = await started(db, at(2 * MIN), { ...input, body: "stranger" });
  const strangerSession = (await getSession(
    db,
    typed.sessionToken,
    at(2 * MIN),
  ))!;
  assert.equal(strangerSession.verified, false);
  // A never-verified account, from its own (unverified) browser.
  const fresh = await started(db, t0, {
    name: "New",
    email: "new@example.com",
    body: "hi",
  });
  const freshSession = (await getSession(db, fresh.sessionToken, t0))!;
  // The same answer for both: no oracle on whether an address is verified.
  assert.deepEqual(await deleteOwnAccount(db, strangerSession), {
    kind: "verify-first",
  });
  assert.deepEqual(await deleteOwnAccount(db, freshSession), {
    kind: "verify-first",
  });
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM contact_account"), 2);
  assert.equal(
    await count(
      db,
      "SELECT COUNT(*) AS n FROM message WHERE account_id = ?",
      owner.accountId,
    ),
    2,
  );
});

test("self-delete: a session whose row is gone (signed out elsewhere) deletes nothing", async () => {
  const db = await freshDb();
  const r = await started(db);
  const session = (await getSession(db, r.sessionToken, t0))!;
  await verifyCode(db, SECRET, session, r.token!.code, at(MIN));
  const verified = (await getSession(db, r.sessionToken, at(MIN)))!;
  await db.prepare("DELETE FROM contact_session").run();
  assert.deepEqual(await deleteOwnAccount(db, verified), { kind: "gone" });
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM contact_account"), 1);
  assert.equal(await count(db, "SELECT COUNT(*) AS n FROM message"), 1);
});

const confirmedOf = async (db: D1Database, body: string) =>
  (
    await db
      .prepare("SELECT confirmed_at FROM message WHERE body = ?")
      .bind(body)
      .first<{ confirmed_at: string | null }>()
  )?.confirmed_at ?? null;

test("a code confirms only its own browser's messages, not a stranger's with the same address", async () => {
  const db = await freshDb();
  const owner = await started(db, t0, { ...input, body: "owner's first" });
  // A stranger types the same (still unverified) address in another browser.
  const stranger = await started(db, at(2 * MIN), {
    ...input,
    name: "Stranger",
    body: "stranger's",
  });
  const strangerSession = (await getSession(
    db,
    stranger.sessionToken,
    at(2 * MIN),
  ))!;
  // (One more each: the account may have 3 waiting in all, `UNCONFIRMED_PER_ACCOUNT`.)
  assert.equal(strangerSession.verified, false);
  // The owner gets a fresh code for their own browser ("Send the email again") and types it.
  const ownerSession = (await getSession(db, owner.sessionToken, at(4 * MIN)))!;
  await sendAsSession(db, ownerSession, "owner's second", at(4 * MIN));
  const fresh = await createToken(
    db,
    SECRET,
    owner.accountId,
    ownerSession.tokenHash,
    at(5 * MIN),
  );
  const v = await verifyCode(
    db,
    SECRET,
    ownerSession,
    fresh!.code,
    at(5 * MIN),
  );
  assert.equal(v.ok, true);
  // The owner's messages, sent before AND after the token, are confirmed...
  assert.ok(await confirmedOf(db, "owner's first"));
  assert.ok(await confirmedOf(db, "owner's second"));
  // ...the stranger's stay waiting, and its browser is not signed in as verified.
  assert.equal(await confirmedOf(db, "stranger's"), null);
  assert.equal(
    (await getSession(db, stranger.sessionToken, at(5 * MIN)))?.verified,
    false,
  );
  // ...and the 7-day purge takes them.
  await purgeExpired(db, at(8 * 24 * 60 * MIN));
  assert.equal(
    await count(
      db,
      "SELECT COUNT(*) AS n FROM message WHERE body LIKE 'stranger%'",
    ),
    0,
  );
  assert.equal(
    await count(
      db,
      "SELECT COUNT(*) AS n FROM message WHERE body LIKE 'owner%'",
    ),
    2,
  );
});

test("the link never upgrades the asking browser, so a stranger who typed the address gains nothing", async () => {
  const db = await freshDb();
  // A stranger types the person's address; the real person opens the emailed link elsewhere.
  const stranger = await started(db, t0, { ...input, body: "stranger's" });
  const v = await verifyLink(db, stranger.token!.linkToken, null, at(MIN));
  assert.ok(v.ok && v.sessionToken);
  // The account is verified, the opening device is; the stranger's browser and message are not.
  assert.equal(
    (await getSession(db, stranger.sessionToken, at(MIN)))?.verified,
    false,
  );
  assert.equal(await confirmedOf(db, "stranger's"), null);
  // The asker's own browser confirms its message by typing the code (only it can).
});

test("a stranger's link confirmed by the owner of an already VERIFIED address confirms nothing of the stranger's", async () => {
  const db = await freshDb();
  const owner = await started(db);
  const s = (await getSession(db, owner.sessionToken, t0))!;
  await verifyCode(db, SECRET, s, owner.token!.code, t0);
  const stranger = await started(db, at(5 * MIN), {
    ...input,
    body: "typed by a stranger",
  });
  await verifyLink(db, stranger.token!.linkToken, s, at(6 * MIN));
  assert.equal(await confirmedOf(db, "typed by a stranger"), null);
});

test("a waiting message with no session_hash (sent before 0005) is never confirmed by a code", async () => {
  const db = await freshDb();
  const r = await started(db);
  await db
    .prepare(
      "INSERT INTO message (name, email, body, created_at, account_id) VALUES ('V', 'visitor@example.com', 'legacy wait', ?, ?)",
    )
    .bind(at(MIN).toISOString(), r.accountId)
    .run();
  const s = (await getSession(db, r.sessionToken, at(2 * MIN)))!;
  assert.equal(
    (await verifyCode(db, SECRET, s, r.token!.code, at(2 * MIN))).ok,
    true,
  );
  assert.equal(await confirmedOf(db, "legacy wait"), null);
  assert.ok(await confirmedOf(db, "Hello"));
});

test("self-delete also removes the address's messages from before accounts (verified only)", async () => {
  const db = await freshDb();
  const old = (email: string, body: string) =>
    db
      .prepare(
        "INSERT INTO message (name, email, body, created_at, confirmed_at) VALUES ('Old', ?, ?, ?, ?)",
      )
      .bind(email, body, t0.toISOString(), t0.toISOString())
      .run();
  // As typed before accounts (case and spaces kept), and someone else's.
  await old(" Visitor@EXAMPLE.com ", "before accounts");
  await old("someone@example.com", "not theirs, before accounts");
  const oldId = (await db
    .prepare("SELECT id FROM message WHERE body = 'before accounts'")
    .first<{ id: number }>())!.id;
  await db
    .prepare(
      "INSERT INTO message_reply (message_id, body, created_at, send_status) VALUES (?, 'old reply', ?, 'sent')",
    )
    .bind(oldId, t0.toISOString())
    .run();
  const r = await started(db, at(MIN));
  const unverified = (await getSession(db, r.sessionToken, at(MIN)))!;
  // Unverified: refused, the old rows stay.
  assert.deepEqual(await deleteOwnAccount(db, unverified), {
    kind: "verify-first",
  });
  assert.equal(
    await count(
      db,
      "SELECT COUNT(*) AS n FROM message WHERE body = 'before accounts'",
    ),
    1,
  );
  await verifyCode(db, SECRET, unverified, r.token!.code, at(2 * MIN));
  const verified = (await getSession(db, r.sessionToken, at(2 * MIN)))!;
  assert.deepEqual(await deleteOwnAccount(db, verified), { kind: "deleted" });
  assert.equal(
    await count(
      db,
      "SELECT COUNT(*) AS n FROM message WHERE body = 'before accounts'",
    ),
    0,
  );
  assert.equal(
    await count(
      db,
      "SELECT COUNT(*) AS n FROM message_reply WHERE message_id = ?",
      oldId,
    ),
    0,
  );
  assert.equal(
    await count(
      db,
      "SELECT COUNT(*) AS n FROM message WHERE body = 'not theirs, before accounts'",
    ),
    1,
  );
});

test("a typed code upgrades only the typing browser, never a stranger who asked for the latest email", async () => {
  const db = await freshDb();
  const owner = await started(db, t0, { ...input, body: "owner's" });
  // More than 60 s later a stranger types the same address: the LATEST token is theirs.
  const stranger = await started(db, at(2 * MIN), {
    ...input,
    body: "stranger's",
  });
  assert.ok(stranger.token);
  const ownerSession = (await getSession(db, owner.sessionToken, at(3 * MIN)))!;
  // The owner reads the newest email and types its code in their own browser.
  const v = await verifyCode(
    db,
    SECRET,
    ownerSession,
    stranger.token!.code,
    at(3 * MIN),
  );
  assert.equal(v.ok, true);
  assert.equal(
    (await getSession(db, owner.sessionToken, at(3 * MIN)))?.verified,
    true,
  );
  assert.equal(
    (await getSession(db, stranger.sessionToken, at(3 * MIN)))?.verified,
    false,
  );
  assert.ok(await confirmedOf(db, "owner's"));
  assert.equal(await confirmedOf(db, "stranger's"), null);
});
