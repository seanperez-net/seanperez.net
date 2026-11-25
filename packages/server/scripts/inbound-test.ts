/**
 * Unit test for the inbound mail handler (`src/mail/inbound.server.ts`): a fake
 * `ForwardableEmailMessage` with raw MIME fixtures, the real migrations on a REAL local D1
 * (`@seanperez/db/testing/d1`, since 2026-11-25), the real postal-mime. Run from packages/server:
 *   node --test scripts/inbound-test.ts
 * Nothing here talks to Cloudflare or sends mail.
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createTestD1 } from "@seanperez/db/testing/d1";
import {
  EMAILS_PER_DAY,
  MAX_RAW_BYTES,
  authSummary,
  handleInbound,
  saveInbound,
  type InboundMessage,
} from "../src/mail/inbound.server.ts";

/** One real local D1 for this file (`@seanperez/db/testing/d1`); every test starts from `freshDb()`. */
const testD1 = await createTestD1();
after(() => testD1.dispose());
const freshDb = () => testD1.reset();

const CF_PASS =
  "mx.cloudflare.net; dkim=pass header.d=example.org header.s=s1; dmarc=pass header.from=example.org policy.dmarc=reject; spf=pass smtp.mailfrom=visitor@example.org";
const CF_FAIL =
  "mx.cloudflare.net; dkim=none; dmarc=fail header.from=example.org policy.dmarc=none; spf=softfail smtp.mailfrom=visitor@example.org";

function mime(
  opts: {
    auth?: string[];
    subject?: string;
    body?: string;
    extra?: string;
  } = {},
) {
  const auth = (opts.auth ?? [CF_PASS])
    .map((a) => `Authentication-Results: ${a}\r\n`)
    .join("");
  return (
    auth +
    "From: Ada Visitor <visitor@example.org>\r\n" +
    "To: sean@seanperez.net\r\n" +
    `Subject: ${opts.subject ?? "Hello Sean"}\r\n` +
    "Message-ID: <abc123@example.org>\r\n" +
    "Date: Wed, 25 Nov 2026 10:00:00 +0000\r\n" +
    (opts.extra ??
      "Content-Type: text/plain; charset=utf-8\r\n\r\n" +
        (opts.body ?? "Hi, a question about your site.\r\n"))
  );
}

/** A `ForwardableEmailMessage` stand-in; `events` records forward vs raw read order. */
function fakeMessage(
  raw: string,
  opts: { to?: string; rawSize?: number; forwardThrows?: boolean } = {},
) {
  const events: string[] = [];
  const forwards: string[] = [];
  const bytes = new TextEncoder().encode(raw);
  const message: InboundMessage = {
    from: "visitor@example.org",
    to: opts.to ?? "sean@seanperez.net",
    rawSize: opts.rawSize ?? bytes.byteLength,
    headers: new Headers({
      subject: "Hello Sean",
      "message-id": "<abc123@example.org>",
    }),
    raw: new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          events.push("raw");
          controller.enqueue(bytes);
          controller.close();
        },
      },
      { highWaterMark: 0 },
    ), // pulled only when read
    canBeForwarded: true,
    forward: (async (rcpt: string) => {
      events.push("forward");
      if (opts.forwardThrows) throw new Error("E_FORWARD");
      forwards.push(rcpt);
      return { messageId: "fwd-1" };
    }) as unknown as InboundMessage["forward"],
  };
  return { message, events, forwards };
}

const env = (db: D1Database) => ({
  DB: db,
  OWNER_NOTIFY_TO: "owner@example.com",
});
type Row = Record<string, unknown>;
const rows = async (db: D1Database) =>
  (await db.prepare("SELECT * FROM message ORDER BY id").all<Row>()).results;

test("forwards to OWNER_NOTIFY_TO FIRST, then reads and stores the mail as source 'email'", async () => {
  const db = await freshDb();
  const { message, events, forwards } = fakeMessage(mime());
  const out = await handleInbound(message, env(db));
  assert.deepEqual(out, { forwarded: true, stored: "saved" });
  assert.deepEqual(forwards, ["owner@example.com"]);
  assert.equal(events[0], "forward");
  assert.ok(events.includes("raw"));
  const [row] = await rows(db);
  assert.equal(row.source, "email");
  assert.equal(row.name, "Ada Visitor");
  assert.equal(row.email, "visitor@example.org");
  assert.equal(row.subject, "Hello Sean");
  assert.equal(row.message_id, "<abc123@example.org>");
  assert.equal(row.auth, "dkim=pass spf=pass dmarc=pass");
  assert.match(String(row.body), /a question about your site/);
  // Delivered mail is never "waiting" (no 7-day purge); not linked (no account).
  assert.equal(row.confirmed_at, row.created_at);
  assert.equal(row.account_id, null);
});

test("existing form rows default to source 'form'", async () => {
  const db = await freshDb();
  await db
    .prepare(
      "INSERT INTO message (name, email, body, created_at) VALUES ('a', 'b', 'c', 'd')",
    )
    .run();
  assert.equal((await rows(db))[0].source, "form");
});

test("only the FIRST Authentication-Results counts, and only from mx.cloudflare.net", async () => {
  // Cloudflare's says dmarc=fail; a sender-supplied one below claims pass: flagged.
  const db = await freshDb();
  const { message } = fakeMessage(mime({ auth: [CF_FAIL, CF_PASS] }));
  await handleInbound(message, env(db));
  assert.equal((await rows(db))[0].auth, "dkim=none spf=softfail dmarc=fail");
  // A first header from another server: no trusted result at all.
  assert.equal(
    authSummary([
      {
        key: "authentication-results",
        originalKey: "Authentication-Results",
        value: "evil.example; dmarc=pass",
      },
    ]),
    null,
  );
  assert.equal(
    authSummary([
      {
        key: "authentication-results",
        originalKey: "Authentication-Results",
        value: "mx.cloudflare.net.evil.example; dmarc=pass",
      },
    ]),
    null,
  );
  assert.equal(authSummary([]), null);
});

test("no attachment bytes are stored; the text part is", async () => {
  const db = await freshDb();
  const multipart =
    'Content-Type: multipart/mixed; boundary="b1"\r\n\r\n' +
    "--b1\r\nContent-Type: text/plain\r\n\r\nSee the file.\r\n" +
    '--b1\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="x.bin"\r\nContent-Transfer-Encoding: base64\r\n\r\nU0VDUkVUQVRUQUNITUVOVA==\r\n' +
    "--b1--\r\n";
  const { message } = fakeMessage(mime({ extra: multipart }));
  await handleInbound(message, env(db));
  const [row] = await rows(db);
  assert.match(String(row.body), /See the file\./);
  const all = JSON.stringify(row);
  assert.doesNotMatch(all, /SECRETATTACHMENT|U0VDUkVUQVRUQUNITUVOVA/);
  assert.doesNotMatch(all, /x\.bin/);
});

test("an HTML-only mail is stored as text", async () => {
  const db = await freshDb();
  const html =
    "Content-Type: text/html; charset=utf-8\r\n\r\n<p>Hello <b>Sean</b></p><script>alert(1)</script><p>Bye</p>\r\n";
  const { message } = fakeMessage(mime({ extra: html }));
  await handleInbound(message, env(db));
  const body = String((await rows(db))[0].body);
  assert.match(body, /Hello\s+Sean/);
  assert.doesNotMatch(body, /<|alert/);
});

test("mail to another address (catch-all) or over the size cap: forwarded only, nothing read or stored", async () => {
  for (const opts of [
    { to: "info@seanperez.net" },
    { rawSize: MAX_RAW_BYTES + 1 },
  ]) {
    const db = await freshDb();
    const { message, events, forwards } = fakeMessage(mime(), opts);
    const out = await handleInbound(message, env(db));
    assert.deepEqual(out, { forwarded: true, stored: "skipped" });
    assert.equal(forwards.length, 1);
    assert.deepEqual(events, ["forward"]);
    assert.equal((await rows(db)).length, 0);
  }
});

test("a failed forward is logged, and the mail is still stored", async () => {
  const db = await freshDb();
  const { message } = fakeMessage(mime(), { forwardThrows: true });
  const original = console.error;
  console.error = () => {};
  try {
    const out = await handleInbound(message, env(db));
    assert.deepEqual(out, { forwarded: false, stored: "saved" });
  } finally {
    console.error = original;
  }
  assert.equal((await rows(db)).length, 1);
});

test("raw unreadable after forward (NOT PROOFED case): a row from the headers, flagged", async () => {
  const db = await freshDb();
  const { message } = fakeMessage("");
  // The envelope still says a size; the stream gives nothing.
  const out = await handleInbound({ ...message, rawSize: 100 }, env(db));
  assert.deepEqual(out, { forwarded: true, stored: "headers-only" });
  const [row] = await rows(db);
  assert.equal(row.subject, "Hello Sean");
  assert.equal(row.auth, null);
  assert.equal(row.body, "");
});

test("linked to the contact account with the sender's address, only when DMARC passed", async () => {
  const db = await freshDb();
  await db
    .prepare(
      "INSERT INTO contact_account (id, email, name, created_at) VALUES ('acc-1', 'visitor@example.org', 'Ada', '2026-11-25T00:00:00.000Z')",
    )
    .run();
  await handleInbound(fakeMessage(mime()).message, env(db));
  await handleInbound(fakeMessage(mime({ auth: [CF_FAIL] })).message, env(db));
  const [passed, failed] = await rows(db);
  assert.equal(passed.account_id, "acc-1");
  assert.equal(failed.account_id, null);
  // Linking never verifies the account.
  const acc = (await db
    .prepare("SELECT verified_at FROM contact_account")
    .first<Row>())!;
  assert.equal(acc.verified_at, null);
});

test("the daily cap of email rows: forwarded, not stored", async () => {
  const db = await freshDb();
  const now = new Date("2026-11-25T12:00:00.000Z");
  const row = {
    name: "x",
    email: "x@example.org",
    body: "b",
    subject: null,
    messageId: null,
    auth: null,
  };
  for (let i = 0; i < EMAILS_PER_DAY; i++)
    assert.equal((await saveInbound(db, row, now)).saved, true);
  assert.equal((await saveInbound(db, row, now)).saved, false);
  // Form rows do not count toward it, and the next UTC day starts again.
  assert.equal(
    (await saveInbound(db, row, new Date("2026-11-26T00:00:01.000Z"))).saved,
    true,
  );
  assert.equal((await rows(db)).length, EMAILS_PER_DAY + 1);
});

test("no OWNER_NOTIFY_TO: not forwarded (logged), still stored", async () => {
  const db = await freshDb();
  const original = console.error;
  console.error = () => {};
  try {
    const out = await handleInbound(fakeMessage(mime()).message, { DB: db });
    assert.deepEqual(out, { forwarded: false, stored: "saved" });
  } finally {
    console.error = original;
  }
  assert.equal((await rows(db)).length, 1);
});
