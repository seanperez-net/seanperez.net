/**
 * The feed's posts in D1 (binding `DB`, table `post`, `migrations/0001_create_post.sql`).
 * Public readers see only published rows (`draft = 0` and a `published_at`); /admin sees all.
 */

import { MAX_SLUG, SLUG_PATTERN } from "./limits";

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

const PUBLISHED = "draft = 0 AND published_at IS NOT NULL";
const SUMMARY = "id, slug, title, draft, published_at, updated_at";


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
    const { results } = await db
      .prepare(
        `SELECT ${SUMMARY} FROM post WHERE ${PUBLISHED} ORDER BY published_at DESC`,
      )
      .all<PostSummary>();
    return results;
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
    const { results } = await db
      .prepare(
        `SELECT * FROM post WHERE ${PUBLISHED} ORDER BY published_at DESC LIMIT ?`,
      )
      .bind(limit)
      .all<Post>();
    return results;
  } catch (error) {
    console.error("feed: list failed", error);
    return [];
  }
}

export async function getPublished(
  db: D1Database,
  slug: string,
): Promise<Post | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  try {
    return await db
      .prepare(`SELECT * FROM post WHERE slug = ? AND ${PUBLISHED}`)
      .bind(slug)
      .first<Post>();
  } catch (error) {
    console.error("feed: read failed", error);
    return null;
  }
}

// --- /admin only (behind `requireAdmin`) ---------------------------------------------------

export async function listAll(db: D1Database): Promise<PostSummary[]> {
  const { results } = await db
    .prepare(`SELECT ${SUMMARY} FROM post ORDER BY updated_at DESC`)
    .all<PostSummary>();
  return results;
}

export async function getById(
  db: D1Database,
  id: number,
): Promise<Post | null> {
  return db.prepare("SELECT * FROM post WHERE id = ?").bind(id).first<Post>();
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
  const now = new Date().toISOString();
  const taken = await db
    .prepare("SELECT id FROM post WHERE slug = ? AND id IS NOT ?")
    .bind(input.slug, id ?? null)
    .first<{ id: number }>();
  if (taken) return "slug-taken";
  const draft = input.publish ? 0 : 1;
  if (id === undefined) {
    const row = await db
      .prepare(
        `INSERT INTO post (slug, title, body_md, draft, published_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(
        input.slug,
        input.title,
        input.body_md,
        draft,
        input.publish ? now : null,
        now,
      )
      .first<{ id: number }>();
    return row!.id;
  }
  await db
    .prepare(
      `UPDATE post SET slug = ?, title = ?, body_md = ?, draft = ?,
         published_at = CASE WHEN ? = 1 THEN NULL ELSE COALESCE(published_at, ?) END,
         updated_at = ?
       WHERE id = ?`,
    )
    .bind(input.slug, input.title, input.body_md, draft, draft, now, now, id)
    .run();
  return id;
}

export async function deletePost(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM post WHERE id = ?").bind(id).run();
}
