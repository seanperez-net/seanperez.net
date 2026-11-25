/**
 * Unit test for contact accounts (`src/account/account.server.ts`): the real migrations on an
 * in-memory SQLite (`node:sqlite`, Node 24) behind a small D1-shaped shim, with the clock moved
 * by hand (every function takes `now`). Run from apps/web:
 *   node --test scripts/account-test.ts
 * Nothing here talks to Cloudflare or sends mail.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  MAX_ATTEMPTS,
  claimNotify,
  createToken,
  deleteAccount,
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

const SECRET = "test-secret-not-real";

/** The parts of D1's API the module uses, on node:sqlite. */
function fakeD1(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const file of ["0003_create_message.sql", "0004_contact_accounts.sql"]) {
    sqlite.exec(
      readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"),
    );
  }
  type Stmt = { sql: string; args: unknown[] };
  const exec = ({ sql, args }: Stmt) => {
    const s = sqlite.prepare(sql);
    if (/\bRETURNING\b/i.test(sql) || /^\s*SELECT/i.test(sql)) {
      const results = s.all(...(args as never[]));
      return { results, meta: { changes: results.length } };
    }
    const r = s.run(...(args as never[]));
    return { results: [], meta: { changes: Number(r.changes) } };
  };
  const statement = (sql: string, args: unknown[] = []) => ({
    sql,
    args,
    bind: (...next: unknown[]) => statement(sql, next),
    run: async () => exec({ sql, args }),
    all: async () => exec({ sql, args }),
    first: async () => (exec({ sql, args }).results[0] ?? null) as never,
  });
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (list: Stmt[]) => {
      sqlite.exec("BEGIN");
      try {
        const out = list.map(exec);
        sqlite.exec("COMMIT");
        return out;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
}

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
  const db = fakeD1();
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
  const db = fakeD1();
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
  const db = fakeD1();
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
  const db = fakeD1();
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

test("the link: GET peeks without verifying, POST verifies and signs in another browser", async () => {
  const db = fakeD1();
  const r = await started(db);
  const peek = await peekLink(db, r.token!.linkToken, at(MIN));
  assert.deepEqual(peek, { ok: true, masked: "v***@e***.com" });
  assert.equal(
    (await getSession(db, r.sessionToken, at(MIN)))?.verified,
    false,
  );
  // Opened on another device (no session there): a new verified session for it, and the
  // browser that sent the message is upgraded too.
  const v = await verifyLink(db, r.token!.linkToken, null, at(MIN));
  assert.ok(v.ok && v.sessionToken);
  if (!v.ok || !v.sessionToken) return;
  assert.equal((await getSession(db, v.sessionToken, at(MIN)))?.verified, true);
  assert.equal((await getSession(db, r.sessionToken, at(MIN)))?.verified, true);
  assert.deepEqual(await verifyLink(db, "not-a-token", null, at(MIN)), {
    ok: false,
    reason: "invalid",
  });
});

test("a new email voids the older code (latest token only)", async () => {
  const db = fakeD1();
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
  const db = fakeD1();
  const r = await started(db);
  const id = r.accountId;
  assert.equal(await createToken(db, SECRET, id, null, at(30_000)), null);
  assert.ok(await createToken(db, SECRET, id, null, at(2 * MIN)));
  assert.ok(await createToken(db, SECRET, id, null, at(4 * MIN)));
  assert.equal(await createToken(db, SECRET, id, null, at(6 * MIN)), null);
});

test("someone else typing a known address: same answer, message waits, no sign-in as them", async () => {
  const db = fakeD1();
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
  const db = fakeD1();
  for (let i = 0; i < 4; i++) await started(db, at(i * 2 * MIN));
  const n = await db
    .prepare("SELECT COUNT(*) AS n FROM message")
    .first<{ n: number }>();
  assert.equal(n?.n, 3);
});

test("sendAsSession: unverified up to 3 waiting; verified confirmed at once", async () => {
  const db = fakeD1();
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
  const db = fakeD1();
  const r = await started(db);
  assert.equal(await claimNotify(db, r.accountId, t0), false); // not verified yet
  const s = (await getSession(db, r.sessionToken, t0))!;
  await verifyCode(db, SECRET, s, r.token!.code, t0);
  assert.equal(await claimNotify(db, r.accountId, t0), true);
  assert.equal(await claimNotify(db, r.accountId, at(30 * MIN)), false);
  assert.equal(await claimNotify(db, r.accountId, at(61 * MIN)), true);
});

test("purge: unverified accounts and their waiting messages go after 7 days", async () => {
  const db = fakeD1();
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
  const db = fakeD1();
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
  const db = fakeD1();
  const r = await started(db);
  const session = (await getSession(db, r.sessionToken, t0))!;
  const wrong = r.token!.code === "000000" ? "111111" : "000000";
  await Promise.all(
    Array.from({ length: 20 }, () => verifyCode(db, SECRET, session, wrong, t0)),
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
  const db = fakeD1();
  const owner = await started(db);
  const s = (await getSession(db, owner.sessionToken, t0))!;
  await verifyCode(db, SECRET, s, owner.token!.code, t0);
  const stranger = await started(db, at(5 * MIN), { ...input, name: "Stranger" });
  // The real owner opens the stranger's email link in their own browser and confirms.
  await verifyLink(db, stranger.token!.linkToken, s, at(6 * MIN));
  assert.equal((await getSession(db, stranger.sessionToken, at(6 * MIN)))?.verified, false);
});
