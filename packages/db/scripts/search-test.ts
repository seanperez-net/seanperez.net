/**
 * The one fold and word rule (`src/search/fold.ts`) and the posts' folded search columns
 * (`savePost`, `searchPublished` in `src/feed/posts.server.ts`) on a REAL local D1
 * (`src/testing/d1.ts`). 2026-11-25, owner on accents: "Both now". Run from packages/db:
 *   node --test scripts/search-test.ts
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { savePost, searchPublished } from "../src/feed/posts.server.ts";
import {
  MAX_SEARCH_WORDS,
  fold,
  matchesWords,
  plainText,
  postSearchColumns,
  searchWords,
} from "../src/search/fold.ts";
import { createTestD1 } from "../src/testing/d1.ts";

const has = (text: string, query: string) =>
  matchesWords(fold(text), searchWords(query));

test("fold drops accents and case, keeps CJK", () => {
  assert.equal(fold("García"), "garcia");
  assert.equal(fold("Müller"), "muller");
  assert.equal(fold("Résumé"), "resume");
  assert.equal(fold("ZOË Ñandú Élan"), "zoe nandu elan");
  // Compatibility forms become plain letters (NFKD).
  assert.equal(fold("ﬁle Ａ"), "file a");
  // No decomposition: unchanged apart from case.
  assert.equal(fold("Øre Łódź Straße"), "øre łodz straße");
  assert.equal(fold("東京の天気"), "東京の天気");
});

test("every word must be contained, any order, accents either way", () => {
  assert.ok(has("José García", "garcia"));
  assert.ok(has("José García", "GARCÍA jose"));
  assert.ok(has("Hans Müller", "muller"));
  assert.ok(has("My Résumé", "resume"));
  assert.ok(has("my resume", "résumé"));
  assert.ok(has("Sean A. Perez", "sean perez"));
  assert.ok(!has("Sean A. Perez", "sean smith"));
  // CJK: substrings match, no word splitting needed.
  assert.ok(has("東京の天気 今日は晴れです", "東京"));
  assert.ok(has("東京の天気 今日は晴れです", "晴れ 天気"));
  assert.ok(!has("東京の天気", "大阪"));
  // Partial words match (a prefix or the middle).
  assert.ok(has("Cloudflare Workers", "clou"));
  // No words: no match.
  assert.ok(!has("anything", "   "));
});

test("searchWords: folded, distinct, capped", () => {
  assert.deepEqual(searchWords("  Résumé  resume RESUME  "), ["resume"]);
  assert.equal(searchWords("a b c d e f g h").length, MAX_SEARCH_WORDS);
});

test("plainText drops link targets, images and code", () => {
  assert.equal(
    plainText(
      "# Hi [Cloudflare](https://x.dev) ![logo](a.png)\n```js\nx\n```\nsnake_case",
    ),
    "Hi Cloudflare snake_case",
  );
  assert.deepEqual(
    postSearchColumns("Mon Résumé", "**Élan** [link](https://e.com)"),
    {
      search_title: "mon resume",
      search_text: "elan link",
    },
  );
});

const testD1 = await createTestD1();
after(() => testD1.dispose());

const words = (q: string) => searchWords(q);

test("posts: saved with folded columns, found by folded words", async () => {
  const db = await testD1.reset();
  const id = await savePost(db, {
    title: "Mon Résumé",
    slug: "mon-resume",
    body_md:
      "Travail chez **García & Müller** à 東京. See [the site](https://example.com).",
    publish: true,
  });
  assert.equal(typeof id, "number");
  const row = await db
    .prepare("SELECT search_title, search_text FROM post WHERE id = ?")
    .bind(id)
    .first<{ search_title: string; search_text: string }>();
  assert.equal(row?.search_title, "mon resume");
  assert.ok(row?.search_text.includes("garcia & muller"));

  for (const q of [
    "resume",
    "RÉSUMÉ",
    "garcia",
    "muller resume",
    "東京",
    "chez",
  ])
    assert.equal((await searchPublished(db, words(q), 50)).length, 1, q);
  assert.equal((await searchPublished(db, words("smith"), 50)).length, 0);
  // Link targets are not searched any more.
  assert.equal((await searchPublished(db, words("https"), 50)).length, 0);
  // `%` and `_` are plain characters for instr().
  assert.equal((await searchPublished(db, words("%"), 50)).length, 0);

  // An update re-folds.
  await savePost(
    db,
    { title: "Élan", slug: "mon-resume", body_md: "", publish: true },
    id as number,
  );
  assert.equal((await searchPublished(db, words("elan"), 50)).length, 1);
  assert.equal((await searchPublished(db, words("resume"), 50)).length, 0);
});

test("posts: drafts are not found; title matches sort first", async () => {
  const db = await testD1.reset();
  await savePost(db, {
    title: "Draft café",
    slug: "draft",
    body_md: "",
    publish: false,
  });
  await savePost(db, {
    title: "Body only",
    slug: "b",
    body_md: "un café",
    publish: true,
  });
  await savePost(db, {
    title: "Café notes",
    slug: "t",
    body_md: "",
    publish: true,
  });
  const hits = await searchPublished(db, words("cafe"), 50);
  assert.deepEqual(
    hits.map((h) => h.slug),
    ["t", "b"],
  );
});
