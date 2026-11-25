/**
 * The D1 schema (`seanperez-net`, binding `DB`) in Drizzle ORM 0.45.4 (`drizzle-orm/sqlite-core`),
 * and the ONE source of the database: `migrations/0000_init.sql` is drizzle-kit's SQL for this file
 * (squashed before launch, 2026-11-25: the hand-written 0001-0007 history is gone;
 * `.claude/notes/prelaunch-cleanup-2026-11-25.md`). `scripts/schema-test.ts` checks that the
 * migrations build exactly what drizzle-kit makes from this file (columns, defaults, keys, indexes,
 * foreign keys, CHECKs).
 *
 * Change it ONLY together with a migration: edit here, then `pnpm --filter @seanperez/db db:generate
 * --name <what>` (never a hand-written migration; rules in `.claude/rules/db.md`).
 *
 * - JS keys ARE the SQL column names (snake_case): a `select()` row is the row type the apps
 *   already use (`Post`, `Message`, ...). Leave `casing` unset everywhere.
 * - UNIQUE is a table constraint (`unique().on()`); drizzle-kit 0.31.11 writes it as a
 *   `CREATE UNIQUE INDEX <name>`.
 * - Every database DEFAULT is declared here: `insert().values()` sends NULL for an unset column
 *   without one.
 * - Times are ISO 8601 UTC text (`new Date().toISOString()`), which sorts as text.
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  unique,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

export const SEND_STATUSES = ["pending", "sent", "failed", "logged"] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

/** The feed's posts. Public pages show `draft = 0` rows with a `published_at`. */
export const post = sqliteTable(
  "post",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    slug: text().notNull(),
    title: text().notNull(),
    body_md: text().notNull().default(""),
    draft: integer().$type<0 | 1>().notNull().default(1),
    published_at: text(),
    updated_at: text().notNull(),
    // The folded title and folded plain body (`search/fold.ts` `postSearchColumns`), always
    // written by `savePost`; the site search matches them. A row inserted by raw SQL without them
    // gets '' (not found by the search).
    search_title: text().notNull().default(""),
    search_text: text().notNull().default(""),
  },
  (t) => [
    unique("post_slug_unique").on(t.slug),
    check("post_draft_check", sql`draft IN (0, 1)`),
    index("post_published").on(t.draft, t.published_at),
  ],
);

/** The owner's profile, ONE row (id = 1). NULL / empty = "use the default". */
export const profile = sqliteTable(
  "profile",
  {
    id: integer().primaryKey(),
    name: text(),
    headline: text(),
    location: text(),
    bio: text(),
    /** JSON array of { label, href }, checked again on every read. */
    links: text(),
    updated_at: text().notNull(),
    /**
     * JSON document of the profile's sections (Work, Education, Skills, ... and custom ones;
     * `profile/profile-sections.ts`, checked again on every read). NULL = none. 2026-11-25. Last: an
     * `ALTER TABLE ... ADD` appends it (`migrations/0002_profile_sections.sql`).
     */
    sections: text(),
  },
  () => [check("profile_id_check", sql`id = 1`)],
);

/** The inbox. Contact form rows and mail to sean@. */
export const message = sqliteTable(
  "message",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    email: text().notNull(),
    body: text().notNull(),
    created_at: text().notNull(),
    read_at: text(),
    account_id: text().references((): AnySQLiteColumn => contactAccount.id, {
      onDelete: "set null",
    }),
    confirmed_at: text(),
    session_hash: text(),
    source: text({ enum: ["form", "email"] })
      .notNull()
      .default("form"),
    subject: text(),
    message_id: text(),
    auth: text(),
  },
  (t) => [
    check("message_source_check", sql`source IN ('form', 'email')`),
    index("message_created").on(t.created_at),
    index("message_account").on(t.account_id, t.confirmed_at),
    index("message_session").on(t.session_hash),
    index("message_source").on(t.source, t.created_at),
  ],
);

/** Contact accounts (one per normalized address). */
export const contactAccount = sqliteTable(
  "contact_account",
  {
    id: text().primaryKey(),
    email: text().notNull(),
    name: text().notNull(),
    created_at: text().notNull(),
    verified_at: text(),
    notified_at: text(),
    last_seen_at: text(),
  },
  (t) => [unique("contact_account_email_unique").on(t.email)],
);

/** Browser sessions (the cookie's SHA-256). */
export const contactSession = sqliteTable(
  "contact_session",
  {
    token_hash: text().primaryKey(),
    account_id: text()
      .notNull()
      .references(() => contactAccount.id, { onDelete: "cascade" }),
    created_at: text().notNull(),
    verified_at: text(),
    expires_at: text().notNull(),
  },
  (t) => [index("contact_session_account").on(t.account_id)],
);

/** Verification emails (link + 6-digit code). */
export const verifyToken = sqliteTable(
  "verify_token",
  {
    link_hash: text().primaryKey(),
    account_id: text()
      .notNull()
      .references(() => contactAccount.id, { onDelete: "cascade" }),
    session_hash: text(),
    code_hash: text().notNull(),
    created_at: text().notNull(),
    expires_at: text().notNull(),
    used_at: text(),
    attempts: integer().notNull().default(0),
    send_status: text({ enum: SEND_STATUSES }).notNull().default("pending"),
    send_id: text(),
    send_error: text(),
  },
  (t) => [
    check(
      "verify_token_send_status_check",
      sql`send_status IN ('pending', 'sent', 'failed', 'logged')`,
    ),
    index("verify_token_account").on(t.account_id, t.created_at),
    index("verify_token_created").on(t.created_at),
  ],
);

/** The owner's email replies from the admin. */
export const messageReply = sqliteTable(
  "message_reply",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    message_id: integer()
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    body: text().notNull(),
    created_at: text().notNull(),
    send_status: text({ enum: SEND_STATUSES }).notNull(),
    send_id: text(),
    send_error: text(),
  },
  (t) => [
    check(
      "message_reply_send_status_check",
      sql`send_status IN ('pending', 'sent', 'failed', 'logged')`,
    ),
    index("message_reply_message").on(t.message_id),
  ],
);
