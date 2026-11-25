/**
 * The feed's posts in D1 (binding `DB`, table `post`, `migrations/0001_create_post.sql`), through
 * Drizzle (`../schema.ts`, `../client.ts`; port 2026-11-25). Public readers see only published
 * rows (`draft = 0` and a `published_at`); the admin app sees all.
 */

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../client.ts";
import { post } from "../schema.ts";
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
      .select()
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
        .select()
        .from(post)
        .where(and(eq(post.slug, slug), PUBLISHED))
        .get()) ?? null
    );
  } catch (error) {
    console.error("feed: read failed", error);
    return null;
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
    (await getDb(db).select().from(post).where(eq(post.id, id)).get()) ?? null
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
    })
    .where(eq(post.id, id));
  return id;
}

export async function deletePost(db: D1Database, id: number): Promise<void> {
  await getDb(db).delete(post).where(eq(post.id, id));
}
