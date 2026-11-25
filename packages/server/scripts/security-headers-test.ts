/**
 * Unit test for `src/http/security-headers.ts` (audit H1 / M5, 2026-11-25), and the check that
 * both apps' `public/_headers` `/*` rule carries exactly the same headers (static assets are
 * served before the Worker, so they get theirs from `_headers`). Run from packages/server:
 *   node --test scripts/security-headers-test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ADMIN_SECURITY_HEADERS,
  WEB_SECURITY_HEADERS,
  securityHeaderList,
  withSecurityHeaders,
  type SecurityHeaderValues,
} from "../src/http/security-headers.ts";

test("adds every header to an HTML page, and no-cache when it set none", () => {
  const res = withSecurityHeaders(
    new Response("<p>hi</p>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
    WEB_SECURITY_HEADERS,
  );
  for (const [name, value] of securityHeaderList(WEB_SECURITY_HEADERS)) {
    assert.equal(res.headers.get(name), value, name);
  }
  assert.equal(res.headers.get("Cache-Control"), "no-cache");
  assert.match(
    res.headers.get("Strict-Transport-Security") ?? "",
    /^max-age=31536000; includeSubDomains$/,
  );
  assert.equal(
    res.headers.get("Content-Security-Policy"),
    "frame-ancestors 'none'",
  );
});

test("keeps headers a route set (/verify's no-referrer, admin's no-store)", () => {
  const res = withSecurityHeaders(
    new Response("x", {
      headers: {
        "Content-Type": "text/html",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "private, no-store",
      },
    }),
    ADMIN_SECURITY_HEADERS,
  );
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  assert.equal(res.headers.get("X-Frame-Options"), "DENY");
});

test("non-HTML gets the headers but no Cache-Control; status and body are kept", async () => {
  const res = withSecurityHeaders(
    new Response('{"a":1}', {
      status: 404,
      statusText: "Not Found",
      headers: { "Content-Type": "application/json" },
    }),
    WEB_SECURITY_HEADERS,
  );
  assert.equal(res.status, 404);
  assert.equal(res.statusText, "Not Found");
  assert.equal(res.headers.get("Cache-Control"), null);
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(await res.text(), '{"a":1}');
});

test("a 404 for a missing hashed asset is never cached (the _headers rule says immutable)", () => {
  const res = withSecurityHeaders(
    new Response("Not Found", {
      status: 404,
      headers: {
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    }),
    WEB_SECURITY_HEADERS,
  );
  assert.equal(res.headers.get("Cache-Control"), "no-store");
});

test("a 101 upgrade passes through untouched", () => {
  // Node's Response refuses status 101, so a stand-in with the fields the wrapper reads.
  const upgrade = { status: 101, headers: new Headers() } as Response;
  assert.equal(withSecurityHeaders(upgrade, WEB_SECURITY_HEADERS), upgrade);
});

test("web allows geolocation and fullscreen for itself; admin denies geolocation", () => {
  assert.match(WEB_SECURITY_HEADERS.permissionsPolicy, /geolocation=\(self\)/);
  assert.match(WEB_SECURITY_HEADERS.permissionsPolicy, /fullscreen=\(self\)/);
  assert.match(ADMIN_SECURITY_HEADERS.permissionsPolicy, /geolocation=\(\)/);
  assert.match(ADMIN_SECURITY_HEADERS.permissionsPolicy, /fullscreen=\(self\)/);
  assert.match(WEB_SECURITY_HEADERS.permissionsPolicy, /camera=\(\)/);
});

/** The headers of the `/*` rule in a `_headers` file. */
function starRule(path: string): [string, string][] {
  const lines = readFileSync(path, "utf8").split("\n");
  const start = lines.indexOf("/*");
  assert.ok(start >= 0, `${path} has a /* rule`);
  const out: [string, string][] = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(line)) break;
    const i = line.indexOf(":");
    out.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return out;
}

for (const [app, values] of [
  ["web", WEB_SECURITY_HEADERS],
  ["admin", ADMIN_SECURITY_HEADERS],
] as [string, SecurityHeaderValues][]) {
  test(`apps/${app}/public/_headers /* = the Worker's headers`, () => {
    const file = new URL(
      `../../../apps/${app}/public/_headers`,
      import.meta.url,
    ).pathname;
    assert.deepEqual(starRule(file), securityHeaderList(values));
    // A header in two matching rules is joined with a comma (Cloudflare _headers docs).
    const names = new Set(securityHeaderList(values).map(([n]) => n));
    const text = readFileSync(file, "utf8");
    for (const rule of text.split(/\n(?=\/)/).slice(1)) {
      if (rule.startsWith("/*\n")) continue;
      for (const name of names) {
        assert.ok(!rule.includes(`  ${name}:`), `${name} repeated in ${rule}`);
      }
    }
  });
}
