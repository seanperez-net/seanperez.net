/**
 * Unit test for the feed's posts (`src/feed/posts.server.ts`): `savePost` (insert, update,
 * publish, unpublish, slug taken), the public readers `listPublished` / `listPublishedFull` /
 * `getPublished` (published only, newest first) and `deletePost`, on a REAL local D1 with the
 * real migrations (`src/testing/d1.ts`, in memory). Added 2026-11-25 (backend inventory: "not
 * covered"). Run from packages/db:
 *   node --test scripts/posts-test.ts
 */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  deletePost,
  getById,
  getPublished,
  listAll,
  listPublished,
  listPublishedFull,
  savePost,
  slugify,
} from "../src/feed/posts.server.ts";
import { createTestD1 } from "../src/testing/d1.ts";

const testD1 = await createTestD1();
after(() => testD1.dispose());

async function saved(
  db: D1Database,
  input: { title: string; slug: string; body_md?: string; publish: boolean },
  id?: number,
): Promise<number> {
  const r = await savePost(db, { body_md: "", ...input }, id);
  assert.equal(typeof r, "number");
  return r as number;
}

/** Sets a post's `published_at` by hand, so the order does not depend on the clock. */
const setPublishedAt = (db: D1Database, id: number, iso: string) =>
  db
    .prepare("UPDATE post SET published_at = ? WHERE id = ?")
    .bind(iso, id)
    .run();

test("slugify", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("  Mon Résumé  "), "mon-resume");
  assert.equal(slugify("---"), "");
  assert.ok(slugify("a".repeat(200)).length <= 80);
});

test("a published post is listed and readable; a draft is neither", async () => {
  const db = await testD1.reset();
  const pub = await saved(db, {
    title: "Published",
    slug: "published",
    body_md: "Hello **there**.",
    publish: true,
  });
  const draft = await saved(db, {
    title: "Draft",
    slug: "draft",
    body_md: "Not yet.",
    publish: false,
  });

  const list = await listPublished(db);
  assert.deepEqual(
    list.map((p) => p.slug),
    ["published"],
  );
  // A summary: no body.
  assert.equal("body_md" in list[0], false);
  assert.equal(list[0].draft, 0);
  assert.ok(list[0].published_at);

  const post = await getPublished(db, "published");
  assert.equal(post?.id, pub);
  assert.equal(post?.title, "Published");
  assert.equal(post?.body_md, "Hello **there**.");
  assert.equal(await getPublished(db, "draft"), null);
  assert.equal(await getPublished(db, "unknown"), null);
  // A malformed slug is refused before any query.
  assert.equal(await getPublished(db, "Bad Slug!"), null);
  assert.equal(await getPublished(db, "../published"), null);

  // The admin sees both; a draft has no published_at.
  assert.equal((await listAll(db)).length, 2);
  const d = await getById(db, draft);
  assert.equal(d?.draft, 1);
  assert.equal(d?.published_at, null);

  // The Atom feed's reader: bodies included, published only.
  const full = await listPublishedFull(db);
  assert.deepEqual(
    full.map((p) => [p.slug, p.body_md]),
    [["published", "Hello **there**."]],
  );
});

test("listPublished / listPublishedFull: newest first, limit honoured", async () => {
  const db = await testD1.reset();
  const a = await saved(db, { title: "A", slug: "a", publish: true });
  const b = await saved(db, { title: "B", slug: "b", publish: true });
  const c = await saved(db, { title: "C", slug: "c", publish: true });
  await setPublishedAt(db, a, "2026-01-02T00:00:00.000Z");
  await setPublishedAt(db, b, "2026-01-03T00:00:00.000Z");
  await setPublishedAt(db, c, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(
    (await listPublished(db)).map((p) => p.slug),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    (await listPublishedFull(db, 2)).map((p) => p.slug),
    ["b", "a"],
  );
});

test("savePost: update, publish keeps the first published_at, unpublish clears it", async () => {
  const db = await testD1.reset();
  const id = await saved(db, { title: "One", slug: "one", publish: false });
  assert.equal(await getPublished(db, "one"), null);

  // Publish.
  await saved(db, { title: "One", slug: "one", publish: true }, id);
  const first = (await getPublished(db, "one"))?.published_at;
  assert.ok(first);

  // Edit while published: title, slug and body change, published_at is kept.
  await setPublishedAt(db, id, "2026-01-01T00:00:00.000Z");
  await saved(
    db,
    { title: "One (edited)", slug: "one-edited", body_md: "New.", publish: true },
    id,
  );
  assert.equal(await getPublished(db, "one"), null);
  const edited = await getPublished(db, "one-edited");
  assert.equal(edited?.title, "One (edited)");
  assert.equal(edited?.body_md, "New.");
  assert.equal(edited?.published_at, "2026-01-01T00:00:00.000Z");

  // Unpublish: a draft again, gone from the public readers, published_at cleared.
  await saved(db, { title: "One (edited)", slug: "one-edited", publish: false }, id);
  assert.equal(await getPublished(db, "one-edited"), null);
  assert.deepEqual(await listPublished(db), []);
  assert.equal((await getById(db, id))?.published_at, null);
});

test("savePost: a slug another post has is refused; its own slug is fine", async () => {
  const db = await testD1.reset();
  const a = await saved(db, { title: "A", slug: "same", publish: true });
  assert.equal(
    await savePost(db, { title: "B", slug: "same", body_md: "", publish: true }),
    "slug-taken",
  );
  const b = await saved(db, { title: "B", slug: "other", publish: true });
  assert.equal(
    await savePost(
      db,
      { title: "B", slug: "same", body_md: "", publish: true },
      b,
    ),
    "slug-taken",
  );
  // Saving A again under its own slug is not a clash.
  assert.equal(
    await savePost(db, { title: "A2", slug: "same", body_md: "", publish: true }, a),
    a,
  );
  assert.equal((await listAll(db)).length, 2);
});

test("deletePost removes the post from every reader", async () => {
  const db = await testD1.reset();
  const keep = await saved(db, { title: "Keep", slug: "keep", publish: true });
  const gone = await saved(db, { title: "Gone", slug: "gone", publish: true });
  await deletePost(db, gone);
  assert.equal(await getPublished(db, "gone"), null);
  assert.equal(await getById(db, gone), null);
  assert.deepEqual(
    (await listPublished(db)).map((p) => p.id),
    [keep],
  );
  // Deleting an id that does not exist is a no-op.
  await deletePost(db, 9999);
  assert.equal((await listAll(db)).length, 1);
});

test("the public readers return [] / null when the table is missing", async () => {
  const bare = await createTestD1({ migrate: false });
  try {
    const original = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(await listPublished(bare.db), []);
      assert.deepEqual(await listPublishedFull(bare.db), []);
      assert.equal(await getPublished(bare.db, "any"), null);
    } finally {
      console.error = original;
    }
  } finally {
    await bare.dispose();
  }
});
