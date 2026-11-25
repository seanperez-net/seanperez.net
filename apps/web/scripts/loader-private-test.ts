/**
 * Audit M1 (`.claude/notes/cache-sw-pwa-audit-2026-11-25.md`, 2026-11-25): the service worker
 * keeps EVERY loader's JSON for offline (`storable(..., allowPrivate)` in
 * `src/routes/service-worker.ts`), although Qwik marks all of it `private`: today every loader on
 * the site is public. The only thing that keeps a per-person loader out of the SW cache (and out
 * of the next user's offline copy on a shared device) is `no-store`. RULE: a `routeLoader$` whose
 * data depends on WHO asks (the session cookie, any cookie, a token in the URL, `Authorization`,
 * request headers, the visitor's IP or `request.cf`) sets `cacheControl: { noStore: true }` (the
 * loader option) or calls `cacheControl({ noStore: true })`.
 *
 * This test reads every `routeLoader$(...)` in `src/` and fails when one touches those inputs
 * without `noStore`. A heuristic by design (it reads the loader's own text, not helpers it calls):
 * a helper that reads the cookie must be called with the request event's `cookie`, which the
 * loader then names. Run from apps/web: `node --test scripts/loader-private-test.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SRC = new URL("../src/", import.meta.url).pathname;

/** What makes a loader per-person (in the loader's own text). */
const PER_PERSON =
  /\bcookie\b|session|Authorization|\.headers\b|request\.cf|getClientConn|clientConn|\btoken\b|searchParams\.get\(\s*["']t["']\s*\)/i;
const NO_STORE = /noStore\s*:\s*true|["']no-store["']/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && name !== "service-worker.ts"
      ? [path]
      : [];
  });
}

/** Every `routeLoader$( ... )` call's full text (arguments included), by bracket count. */
export function loaderCalls(code: string): string[] {
  const out: string[] = [];
  let at = code.indexOf("routeLoader$(");
  while (at >= 0) {
    const open = at + "routeLoader$".length;
    let depth = 0;
    let end = open;
    for (; end < code.length; end++) {
      if (code[end] === "(") depth++;
      else if (code[end] === ")" && --depth === 0) break;
    }
    out.push(code.slice(at, end + 1));
    at = code.indexOf("routeLoader$(", end);
  }
  return out;
}

export const offends = (loader: string) =>
  PER_PERSON.test(loader) && !NO_STORE.test(loader);

test("the check itself: flags a cookie loader without noStore, passes one with it", () => {
  const bad = `routeLoader$(async ({ cookie, platform }) => read(platform.env, cookie))`;
  const good = `routeLoader$(async ({ cookie, platform }) => read(platform.env, cookie), { cacheControl: { noStore: true } })`;
  const pub = `routeLoader$(({ platform }) => listPosts(platform.env.DB))`;
  assert.equal(offends(loaderCalls(bad)[0]), true);
  assert.equal(offends(loaderCalls(good)[0]), false);
  assert.equal(offends(loaderCalls(pub)[0]), false);
});

test("every per-person routeLoader$ in src/ sets no-store", () => {
  const found: string[] = [];
  let count = 0;
  for (const file of sources(SRC)) {
    const code = readFileSync(file, "utf8");
    for (const loader of loaderCalls(code)) {
      count++;
      if (offends(loader))
        found.push(`${file.slice(SRC.length)}: ${loader.slice(0, 80)}`);
    }
  }
  assert.ok(count > 0, "found the site's loaders");
  assert.deepEqual(found, [], "per-person loaders without noStore");
});
