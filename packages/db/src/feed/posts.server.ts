/**
 * The feed's posts in D1 (binding `DB`, table `post`, `migrations/0000_init.sql`), through
 * Drizzle (`../schema.ts`, `../client.ts`; port 2026-11-25). Public readers see only published
 * rows (`draft = 0` and a `published_at`); the admin app sees all.
 */

import {
  and,
  desc,
  eq,
  isNotNull,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { getDb } from "../client.ts";
import { post } from "../schema.ts";
import { postSearchColumns } from "../search/fold.ts";
import { MAX_SLUG, SLUG_PATTERN } from "./limits.ts";

export interface Post {
  id: number;
  slug: string;
  title: string;
  body_md: string;
  draft: 0 | 1;
  published_at: string | null;
  updated_at: string;
}

/** A row in a list: no body. */
export type PostSummary = Omit<Post, "body_md">;

const PUBLISHED = and(eq(post.draft, 0), isNotNull(post.published_at));
const SUMMARY = {
  id: post.id,
  slug: post.slug,
  title: post.title,
  draft: post.draft,
  published_at: post.published_at,
  updated_at: post.updated_at,
};
/** A whole post as the app sees it: never the search columns (they stay in D1). */
const FULL = { ...SUMMARY, body_md: post.body_md };

/** A slug from a title: "Hello, World!" -> "hello-world". */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/, "");
}

/**
 * The public pages read through these. A database error (such as the table not created yet,
 * when the code is deployed before the migration) is logged and shown as no posts / not found,
 * rather than a 500 on a public page.
 */
export async function listPublished(db: D1Database): Promise<PostSummary[]> {
  try {
    return await getDb(db)
      .select(SUMMARY)
      .from(post)
      .where(PUBLISHED)
      .orderBy(desc(post.published_at));
  } catch (error) {
    console.error("feed: list failed", error);
    return [];
  }
}

/** The newest published posts with their bodies, for the Atom feed. */
export async function listPublishedFull(
  db: D1Database,
  limit = 20,
): Promise<Post[]> {
  try {
    return await getDb(db)
      .select(FULL)
      .from(post)
      .where(PUBLISHED)
      .orderBy(desc(post.published_at))
      .limit(limit);
  } catch (error) {
    console.error("feed: list failed", error);
    return [];
  }
}

/** A published post as the Messages app's Site updates channel shows it (apps/web, 2026-11-25). */
export interface PostUpdate {
  id: number;
  slug: string;
  title: string;
  /** The start of the body (`UPDATE_HEAD` characters): the caller makes the summary from it. */
  body_head: string;
  published_at: string;
}

/** Characters of the body read for a summary (enough for `excerpt`'s 160 after markdown). */
const UPDATE_HEAD = 600;

/**
 * The newest `limit` published posts, newest first, with only the start of each body: the
 * Site updates channel (a summary per post, never the whole body). Errors as `listPublished`.
 */
export async function listUpdates(
  db: D1Database,
  limit = 20,
): Promise<PostUpdate[]> {
  try {
    return await getDb(db)
      .select({
        id: post.id,
        slug: post.slug,
        title: post.title,
        body_head: sql<string>`substr(${post.body_md}, 1, ${UPDATE_HEAD})`,
        // Never NULL here: `PUBLISHED` requires it.
        published_at: sql<string>`${post.published_at}`,
      })
      .from(post)
      .where(PUBLISHED)
      .orderBy(desc(post.published_at))
      .limit(limit);
  } catch (error) {
    console.error("feed: updates failed", error);
    return [];
  }
}

export async function getPublished(
  db: D1Database,
  slug: string,
): Promise<Post | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  try {
    return (
      (await getDb(db)
        .select(FULL)
        .from(post)
        .where(and(eq(post.slug, slug), PUBLISHED))
        .get()) ?? null
    );
  } catch (error) {
    console.error("feed: read failed", error);
    return null;
  }
}

/** A post that matched a search: what a result row shows. */
export type PostMatch = Pick<Post, "slug" | "title" | "body_md">;

/** `word` (folded) is in the folded column. */
const contains = (folded: SQLWrapper, word: string): SQL =>
  sql`instr(${folded}, ${word}) > 0`;

/**
 * The site search over PUBLISHED posts (2026-11-25): EVERY word in the title or the body, title
 * matches first, then newest. `words` must come from `searchWords` (`../search/fold.ts`): folded,
 * at most 6 (6 bound parameters each: under D1's 100). Matched on the stored folded text, so
 * "resume" finds "Résumé" (SQLite's LIKE and lower() fold ASCII only). Errors as `listPublished`.
 */
export async function searchPublished(
  db: D1Database,
  words: string[],
  limit: number,
): Promise<PostMatch[]> {
  if (!words.length) return [];
  const inTitle = (w: string) => contains(post.search_title, w);
  const inBody = (w: string) => contains(post.search_text, w);
  try {
    return await getDb(db)
      .select({ slug: post.slug, title: post.title, body_md: post.body_md })
      .from(post)
      .where(and(PUBLISHED, ...words.map((w) => or(inTitle(w), inBody(w)))))
      .orderBy(
        desc(sql`(${sql.join(words.map(inTitle), sql` AND `)})`),
        desc(post.published_at),
      )
      .limit(limit);
  } catch (error) {
    // No table / column yet (code deployed before the migration) is "no posts".
    console.error("search: posts failed", error);
    return [];
  }
}

// --- /admin only (behind `requireAdmin`) ---------------------------------------------------

export async function listAll(db: D1Database): Promise<PostSummary[]> {
  return getDb(db).select(SUMMARY).from(post).orderBy(desc(post.updated_at));
}

export async function getById(
  db: D1Database,
  id: number,
): Promise<Post | null> {
  return (
    (await getDb(db).select(FULL).from(post).where(eq(post.id, id)).get()) ??
    null
  );
}

export interface PostInput {
  title: string;
  slug: string;
  body_md: string;
  /** Publish (or keep published) when true; a draft when false. */
  publish: boolean;
}

/**
 * Insert (no `id`) or update a post; returns its id, or `"slug-taken"`. A post keeps its first
 * `published_at` when it is updated or published again; unpublishing clears it.
 */
export async function savePost(
  db: D1Database,
  input: PostInput,
  id?: number,
): Promise<number | "slug-taken"> {
  const d = getDb(db);
  const now = new Date().toISOString();
  const taken = await d
    .select({ id: post.id })
    .from(post)
    .where(and(eq(post.slug, input.slug), sql`${post.id} IS NOT ${id ?? null}`))
    .get();
  if (taken) return "slug-taken";
  const draft = input.publish ? 0 : 1;
  if (id === undefined) {
    const row = await d
      .insert(post)
      .values({
        slug: input.slug,
        title: input.title,
        body_md: input.body_md,
        draft,
        published_at: input.publish ? now : null,
        updated_at: now,
        ...postSearchColumns(input.title, input.body_md),
      })
      .returning({ id: post.id })
      .get();
    return row.id;
  }
  await d
    .update(post)
    .set({
      slug: input.slug,
      title: input.title,
      body_md: input.body_md,
      draft,
      published_at: sql`CASE WHEN ${draft} = 1 THEN NULL ELSE COALESCE(${post.published_at}, ${now}) END`,
      updated_at: now,
      ...postSearchColumns(input.title, input.body_md),
    })
    .where(eq(post.id, id));
  return id;
}

export async function deletePost(db: D1Database, id: number): Promise<void> {
  await getDb(db).delete(post).where(eq(post.id, id));
}
