/**
 * Unit test for the contact orchestration (`src/account/contact.server.ts`): Turnstile Siteverify
 * outcomes and actions, and the verification email sent in the background (`waitUntil`) with
 * its outcome recorded in D1. Moved out of `@seanperez/db`'s `account-test.ts` on 2026-11-25
 * (packages/data split). The D1 is a REAL local one (`@seanperez/db/testing/d1`). Run from
 * packages/server:
 *   node --test scripts/contact-test.ts
 * Nothing here talks to Cloudflare's network or sends mail (fake `fetch`).
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startContact } from "@seanperez/db/account/account.server";
import { createTestD1 } from "@seanperez/db/testing/d1";
import {
  checkTurnstile,
  sendVerificationLater,
} from "../src/account/contact.server.ts";
import { TURNSTILE_ACTIONS } from "../src/account/turnstile-actions.ts";
import type { DataEnv } from "../src/env.ts";

const SECRET = "test-secret-not-real";
const t0 = new Date("2026-11-25T10:00:00.000Z");
const input = { name: "Visitor", email: "Visitor@Example.com", body: "Hello" };

const testD1 = await createTestD1();
after(() => testD1.dispose());
const freshDb = () => testD1.reset();

async function started(db: D1Database, now = t0, data = input) {
  const r = await startContact(db, SECRET, data, now);
  assert.equal(r.kind, "started");
  if (r.kind !== "started") throw new Error();
  return r;
}

const envFor = (db: D1Database) =>
  ({
    DB: db,
    RESEND_API_KEY: "re_test_fake",
    OWNER_NOTIFY_TO: "",
  }) as unknown as DataEnv;

test("verification email in the background: handed to waitUntil, recorded in D1 when done", async () => {
  const db = await freshDb();
  const r = await started(db);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const fake = (async () => {
    await gate;
    return new Response(JSON.stringify({ id: "email-id-9" }), { status: 200 });
  }) as unknown as typeof fetch;
  const handed: Promise<unknown>[] = [];
  const task = sendVerificationLater(
    envFor(db),
    { waitUntil: (p) => handed.push(p) },
    "https://seanperez.net",
    "visitor@example.com",
    r.token!,
    fake,
  );
  // Returned at once, the mail still in flight: the caller's answer does not wait for it.
  assert.equal(handed.length, 1);
  const status = () =>
    db
      .prepare(
        "SELECT send_status, send_id FROM verify_token WHERE link_hash = ?",
      )
      .bind(r.token!.linkHash)
      .first<{ send_status: string; send_id: string | null }>();
  assert.equal((await status())?.send_status, "pending");
  release();
  await task;
  assert.deepEqual(
    { ...(await status()) },
    { send_status: "sent", send_id: "email-id-9" },
  );
});

test("verification email in the background: a refusal is recorded as failed, never thrown", async () => {
  const db = await freshDb();
  const r = await started(db);
  const fake = (async () =>
    new Response(JSON.stringify({ name: "validation_error" }), {
      status: 422,
    })) as unknown as typeof fetch;
  await sendVerificationLater(
    envFor(db),
    undefined,
    "https://x",
    "visitor@example.com",
    r.token!,
    fake,
  );
  const row = await db
    .prepare(
      "SELECT send_status, send_error FROM verify_token WHERE link_hash = ?",
    )
    .bind(r.token!.linkHash)
    .first<{ send_status: string; send_error: string }>();
  assert.deepEqual(
    { ...row },
    { send_status: "failed", send_error: "422 validation_error" },
  );
});

test("checkTurnstile: no secret = not open; no token; Siteverify outcomes", async () => {
  const env = {
    TURNSTILE_SECRET_KEY: "s",
    TURNSTILE_HOSTNAMES: "seanperez.net",
  };
  const answer = (body: object, status = 200) =>
    (async (_url: string, init: RequestInit) => {
      const sent = new URLSearchParams(init.body as URLSearchParams);
      assert.equal(sent.get("secret"), "s");
      assert.equal(sent.get("response"), "tok");
      assert.equal(sent.get("remoteip"), "203.0.113.9");
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
  assert.deepEqual(
    await checkTurnstile(
      { TURNSTILE_SECRET_KEY: "", TURNSTILE_HOSTNAMES: "" },
      "tok",
      "",
      "contact",
    ),
    { ok: false, status: 503, message: "The contact form is not open yet." },
  );
  assert.equal((await checkTurnstile(env, "", "", "contact")).ok, false);
  const ok = answer({
    success: true,
    hostname: "seanperez.net",
    action: "contact",
  });
  assert.deepEqual(
    await checkTurnstile(env, "tok", "203.0.113.9", "contact", ok),
    { ok: true },
  );
  for (const bad of [
    { success: false, hostname: "seanperez.net", action: "contact" },
    { success: true, hostname: "evil.example", action: "contact" },
    { success: true, hostname: "seanperez.net", action: "other" },
    // The test secret's shape is accepted only where example.com is listed.
    { success: true, hostname: "example.com" },
  ]) {
    const r = await checkTurnstile(
      env,
      "tok",
      "203.0.113.9",
      "contact",
      answer(bad),
    );
    assert.equal(r.ok === false && r.status, 403, JSON.stringify(bad));
  }
  const down = await checkTurnstile(
    env,
    "tok",
    "203.0.113.9",
    "contact",
    answer({}, 500),
  );
  assert.equal(down.ok === false && down.status, 502);
});

// --- 2026-11-25 security review gaps (session-scoped confirm, Turnstile actions, self-delete) ----

test("checkTurnstile: each form's action; a token solved for another form is refused", async () => {
  const env = {
    TURNSTILE_SECRET_KEY: "s",
    TURNSTILE_HOSTNAMES: "seanperez.net",
  };
  const solvedFor = (action: string) =>
    (async () =>
      new Response(
        JSON.stringify({ success: true, hostname: "seanperez.net", action }),
        {
          status: 200,
        },
      )) as unknown as typeof fetch;
  const actions = Object.values(TURNSTILE_ACTIONS);
  assert.deepEqual(actions, ["contact", "message", "resend"]);
  for (const expected of actions) {
    for (const solved of actions) {
      const r = await checkTurnstile(
        env,
        "tok",
        "",
        expected,
        solvedFor(solved),
      );
      if (solved === expected) assert.deepEqual(r, { ok: true });
      else
        assert.equal(
          r.ok === false && r.status,
          403,
          `${solved} -> ${expected}`,
        );
    }
  }
});
