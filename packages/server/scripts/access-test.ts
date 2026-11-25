/**
 * Unit test for the /admin Access check (`src/feed/access.server.ts`): tokens signed with a key
 * made here, checked against a local JWKS holding only its public half. Run from packages/server:
 *   node --test scripts/access-test.ts
 * Nothing here talks to Cloudflare.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
} from "jose";
import { verifyAccessToken } from "../src/feed/access.server.ts";

const TEAM = "https://example-team.cloudflareaccess.com";
const AUD = "test-aud-tag";
const EMAIL = "owner@example.com";
const config = { teamDomain: TEAM, audience: AUD, allowedEmail: EMAIL };

const good = await generateKeyPair("RS256");
const forger = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(good.publicKey)), kid: "k1", alg: "RS256" };
const keys = createLocalJWKSet({ keys: [jwk] });

async function sign(
  claims: JWTPayload,
  {
    key = good.privateKey,
    issuer = TEAM,
    audience = AUD,
    expires = "5m",
  }: {
    key?: CryptoKey;
    issuer?: string;
    audience?: string;
    expires?: string;
  } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(issuer)
    .setAudience([audience])
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key);
}

test("a valid token for the owner passes", async () => {
  const token = await sign({ email: EMAIL, sub: "u1" });
  assert.deepEqual(await verifyAccessToken(token, config, keys), { ok: true });
});

test("the email is compared without case and the team domain is normalised", async () => {
  const token = await sign({ email: "Owner@Example.com" });
  const loose = { ...config, teamDomain: "example-team.cloudflareaccess.com/" };
  assert.equal((await verifyAccessToken(token, loose, keys)).ok, true);
});

test("a missing token is refused", async () => {
  assert.equal((await verifyAccessToken(null, config, keys)).ok, false);
  assert.equal((await verifyAccessToken("", config, keys)).ok, false);
});

test("any missing setting fails closed", async () => {
  const token = await sign({ email: EMAIL });
  for (const key of ["teamDomain", "audience", "allowedEmail"] as const) {
    const result = await verifyAccessToken(
      token,
      { ...config, [key]: "" },
      keys,
    );
    assert.deepEqual(result, { ok: false, reason: "not configured" });
  }
  assert.equal((await verifyAccessToken(token, {}, keys)).ok, false);
});

test("a token signed by another key (forged) is refused", async () => {
  const token = await sign({ email: EMAIL }, { key: forger.privateKey });
  const result = await verifyAccessToken(token, config, keys);
  assert.deepEqual(result, {
    ok: false,
    reason: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  });
});

test("another Access app (audience) or account (issuer) is refused", async () => {
  const otherApp = await sign({ email: EMAIL }, { audience: "other-aud" });
  const otherTeam = await sign(
    { email: EMAIL },
    { issuer: "https://other.cloudflareaccess.com" },
  );
  assert.equal((await verifyAccessToken(otherApp, config, keys)).ok, false);
  assert.equal((await verifyAccessToken(otherTeam, config, keys)).ok, false);
});

test("an expired token is refused", async () => {
  const token = await sign({ email: EMAIL }, { expires: "-1m" });
  assert.deepEqual(await verifyAccessToken(token, config, keys), {
    ok: false,
    reason: "ERR_JWT_EXPIRED",
  });
});

test("another email, or none, is refused", async () => {
  const other = await sign({ email: "someone@example.com" });
  const none = await sign({ sub: "u1" });
  assert.equal((await verifyAccessToken(other, config, keys)).ok, false);
  assert.equal((await verifyAccessToken(none, config, keys)).ok, false);
});

test("an unsigned token (alg none) and garbage are refused", async () => {
  const header = Buffer.from('{"alg":"none"}').toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ email: EMAIL, iss: TEAM, aud: AUD }),
  ).toString("base64url");
  assert.equal(
    (await verifyAccessToken(`${header}.${body}.`, config, keys)).ok,
    false,
  );
  assert.equal((await verifyAccessToken("not.a.jwt", config, keys)).ok, false);
});
