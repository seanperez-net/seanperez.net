/**
 * Unit test for `src/limits/limit.server.ts` with a fake `LIMITER` binding (the real one is
 * Cloudflare's; locally miniflare's). Run from apps/web:
 *   node --test scripts/limit-test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WEIGHT,
  allow,
  resetLimitWarning,
  sessionKey,
} from "../src/limits/limit.server.ts";
import { sha256 } from "../src/account/account.server.ts";

/** Counts per key like the binding's `simple` limiter in one window: refuse once at `limit`. */
function fakeLimiter(limit = 60) {
  const counts = new Map<string, number>();
  const calls: { key: string; delta?: number }[] = [];
  return {
    calls,
    async limit({ key, delta }: { key: string; delta?: number }) {
      calls.push(delta === undefined ? { key } : { key, delta });
      const now = counts.get(key) ?? 0;
      if (now >= limit) return { success: false };
      counts.set(key, now + (delta ?? 1));
      return { success: true };
    },
  };
}

/** Captures console.warn while `fn` runs. */
async function warnings(fn: () => Promise<void>) {
  const seen: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) =>
    void seen.push(args.map(String).join(" "));
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return seen;
}

test("allows until the limit, then refuses; keys count separately", async () => {
  const LIMITER = fakeLimiter(3);
  const env = { LIMITER };
  assert.equal(await allow(env, "a"), true);
  assert.equal(await allow(env, "a"), true);
  assert.equal(await allow(env, "a"), true);
  assert.equal(await allow(env, "a"), false);
  assert.equal(await allow(env, "b"), true);
  // delta 1 is sent as the binding's default (no `delta` field).
  assert.deepEqual(LIMITER.calls[0], { key: "a" });
});

test("weights: contact 10 a minute, verify 5 a minute, search 60 a minute (binding 60 / 60 s)", async () => {
  const runs = async (key: string, delta: number) => {
    const env = { LIMITER: fakeLimiter(60) };
    let n = 0;
    while (await allow(env, key, delta)) n++;
    return n;
  };
  assert.equal(await runs("contact", WEIGHT.contact), 10);
  assert.equal(await runs("send:x", WEIGHT.send), 10);
  assert.equal(await runs("verify:x", WEIGHT.verify), 5);
  assert.equal(await runs("link", WEIGHT.link), 10);
  assert.equal(await runs("search", WEIGHT.search), 60);
  assert.equal(await runs("ingest", WEIGHT.ingest), 60);
});

test("a weighted call passes `delta` to the binding", async () => {
  const LIMITER = fakeLimiter();
  await allow({ LIMITER }, "verify:x", 12);
  assert.deepEqual(LIMITER.calls[0], { key: "verify:x", delta: 12 });
});

test("no binding: fails open, warns once, never logs the key", async () => {
  resetLimitWarning();
  const seen = await warnings(async () => {
    assert.equal(await allow({}, "send:secret-session-hash"), true);
    assert.equal(await allow({}, "send:secret-session-hash"), true);
  });
  assert.equal(seen.length, 1);
  assert.doesNotMatch(seen[0], /secret-session-hash/);
});

test("a throwing binding: fails open, logs the error name only", async () => {
  const LIMITER = {
    async limit(): Promise<{ success: boolean }> {
      throw new TypeError("boom for key verify:secret-hash");
    },
  };
  const seen = await warnings(async () => {
    assert.equal(await allow({ LIMITER }, "verify:secret-hash"), true);
  });
  assert.equal(seen.length, 1);
  assert.doesNotMatch(seen[0], /secret-hash/);
  assert.match(seen[0], /TypeError/);
});

test("sessionKey: the SHA-256 of the cookie (the D1 token_hash), never the cookie; none without one", async () => {
  const cookie = "raw-cookie-value";
  const key = await sessionKey("send", cookie);
  assert.equal(key, `send:${await sha256(cookie)}`);
  assert.doesNotMatch(key, /raw-cookie-value/);
  assert.equal(await sessionKey("verify", null), "verify:none");
});
