/**
 * The D1 schema (`seanperez-net`, binding `DB`) in Drizzle ORM 0.45.4 (`drizzle-orm/sqlite-core`).
 * It describes EXACTLY what `migrations/0001`-`0006` create (2026-11-25 port; plan
 * `.claude/notes/drizzle-port-plan-2026-11-25.md`). Those six files stay as they are: the baseline
 * snapshot `migrations/meta/0006_snapshot.json` was generated from this file, and
 * `scripts/schema-test.ts` checks that drizzle-kit's SQL for this file builds the same tables as the
 * six migrations (columns, defaults, keys, indexes, foreign keys, CHECKs).
 *
 * Change it ONLY together with a migration: edit here, then `pnpm --filter @seanperez/db db:generate
 * --name <what>` (never a hand-written migration; rules in `.claude/rules/db.md`).
 *
 * - JS keys ARE the SQL column names (snake_case): a `select()` row is the row type the apps
 *   already use (`Post`, `Message`, ...). Leave `casing` unset everywhere.
 * - Column order = the order SQLite has after 0001-0006 (ALTER-added `message` columns last).
 * - UNIQUE is a table constraint (`unique().on()`): drizzle-kit renders it inside CREATE TABLE,
 *   like the migrations' inline UNIQUE (a column `.unique()` would be a separate index).
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

/** 0001: the feed's posts. Public pages show `draft = 0` rows with a `published_at`. */
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
  },
  (t) => [
    unique("post_slug_unique").on(t.slug),
    check("post_draft_check", sql`draft IN (0, 1)`),
    index("post_published").on(t.draft, t.published_at),
  ],
);

/** 0002: the owner's profile, ONE row (id = 1). NULL / empty = "use the default". */
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
  },
  () => [check("profile_id_check", sql`id = 1`)],
);

/** 0003 (+ 0004, 0005, 0006): the inbox. Contact form rows and mail to sean@. */
export const message = sqliteTable(
  "message",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    email: text().notNull(),
    body: text().notNull(),
    created_at: text().notNull(),
    read_at: text(),
    // 0004
    account_id: text().references((): AnySQLiteColumn => contactAccount.id, {
      onDelete: "set null",
    }),
    confirmed_at: text(),
    // 0005
    session_hash: text(),
    // 0006
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

/** 0004: contact accounts (one per normalized address). */
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

/** 0004: browser sessions (the cookie's SHA-256). */
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

/** 0004: verification emails (link + 6-digit code). */
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

/** 0004: the owner's email replies from the admin. */
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
