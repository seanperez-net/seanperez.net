/**
 * Unit test for `src/mail/mail.server.ts`: the Resend request it builds, with a fake `fetch`
 * (Resend's live API is never called), and the production fallbacks with no key. Run from
 * apps/web:
 *   node --test scripts/mail-test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FROM_NOREPLY,
  notifyOwner,
  sendMail,
  verificationMail,
} from "../src/mail/mail.server.ts";

const mail = {
  to: "visitor@example.com",
  from: FROM_NOREPLY,
  ...verificationMail("https://seanperez.net/verify/?t=abc", "123456"),
  idempotencyKey: "verify-abc",
};

test("sendMail posts Resend's documented request", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ id: "email-id-1" }), { status: 200 });
  }) as unknown as typeof fetch;
  const out = await sendMail(
    { RESEND_API_KEY: "re_test_fake", OWNER_NOTIFY_TO: "" },
    mail,
    fake,
  );
  assert.deepEqual(out, { status: "sent", id: "email-id-1" });
  assert.ok(seen);
  const { url, init } = seen as { url: string; init: RequestInit };
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init.method, "POST");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer re_test_fake");
  assert.equal(headers["Idempotency-Key"], "verify-abc");
  const body = JSON.parse(String(init.body));
  assert.deepEqual(body.to, ["visitor@example.com"]);
  assert.equal(body.from, "Sean Perez <noreply@seanperez.net>");
  assert.match(body.text, /123456/);
  assert.equal(body.reply_to, undefined);
});

test("a Resend error is a failed outcome with its status and name only", async () => {
  const fake = (async () =>
    new Response(
      JSON.stringify({
        statusCode: 422,
        name: "validation_error",
        message: "x",
      }),
      {
        status: 422,
      },
    )) as unknown as typeof fetch;
  const out = await sendMail(
    { RESEND_API_KEY: "re_test_fake", OWNER_NOTIFY_TO: "" },
    mail,
    fake,
  );
  assert.deepEqual(out, { status: "failed", error: "422 validation_error" });
});

test("no key outside dev: nothing is sent", async () => {
  const out = await sendMail(
    { RESEND_API_KEY: "", OWNER_NOTIFY_TO: "" },
    mail,
    (() => {
      throw new Error("must not fetch");
    }) as unknown as typeof fetch,
  );
  assert.deepEqual(out, { status: "failed", error: "not_configured" });
});

test("owner notice: send_email binding first, with reply-to", async () => {
  let sent: Record<string, unknown> | null = null;
  const EMAIL = {
    send: async (m: Record<string, unknown>) => {
      sent = m;
      return { messageId: "cf-1" };
    },
  } as unknown as SendEmail;
  const out = await notifyOwner(
    { RESEND_API_KEY: "", OWNER_NOTIFY_TO: "owner@example.com", EMAIL },
    {
      subject: "s",
      text: "t",
      html: "h",
      replyTo: "visitor@example.com",
      idempotencyKey: "n",
    },
  );
  assert.deepEqual(out, { status: "sent", id: "cf-1" });
  assert.equal((sent as unknown as { to: string }).to, "owner@example.com");
  assert.equal(
    (sent as unknown as { replyTo: string }).replyTo,
    "visitor@example.com",
  );
});

test("the verification email never carries a name or message text", () => {
  const m = verificationMail("https://x/verify/?t=t", "654321");
  assert.doesNotMatch(m.text, /Visitor/);
  assert.match(m.html, /654321/);
});
