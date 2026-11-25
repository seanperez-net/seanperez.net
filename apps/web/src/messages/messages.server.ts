/**
 * Contact form messages in D1 (binding `DB`, table `message`, `migrations/0003_create_message.sql`).
 * The contact action writes through `saveMessage`; everything else is /admin only (behind
 * `requireAdmin`). Every value goes in as a bound parameter (`?`), never into the SQL text.
 */

export interface Message {
  id: number;
  name: string;
  email: string;
  body: string;
  created_at: string;
  read_at: string | null;
  /** The sender's contact account (migration 0004); null for older rows or a deleted account. */
  account_id: string | null;
  /** NULL: sent before the address was verified ("Unverified" in /admin). */
  confirmed_at: string | null;
}

/** A row in the inbox: the start of the body, not all of it. */
export type MessageSummary = Omit<Message, "body" | "email"> & { preview: string };

/** The inbox filter (`/admin/messages/?show=`). */
export type MessageFilter = "all" | "verified" | "unverified";

/**
 * At most this many messages are kept per UTC day (owner, 2026-11-24: simple abuse limits, no
 * IP storage). Turnstile stops most bots; this caps what a person (or a solved challenge) can
 * pile into the table in a day. Trade-off (second agent's review, accepted for a demo): whoever
 * passes Turnstile 20 times in a day blocks other senders until midnight UTC.
 */
export const MESSAGES_PER_DAY = 20;

/** Midnight UTC of `now`, as the same ISO text `created_at` holds. */
const startOfDay = (now: Date) => `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;

/**
 * Store one message, unless today's cap is reached. ONE statement, so the count and the insert
 * cannot interleave with another request's: `INSERT ... SELECT ... WHERE (count) < cap` inserts
 * no row when the day is full, and `meta.changes` (D1Result, developers.cloudflare.com/d1/
 * worker-api/return-object/) says which happened.
 */
export async function saveMessage(
  db: D1Database,
  input: { name: string; email: string; body: string },
): Promise<"saved" | "full"> {
  const now = new Date();
  const result = await db
    .prepare(
      `INSERT INTO message (name, email, body, created_at)
       SELECT ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM message WHERE created_at >= ?) < ?`,
    )
    .bind(input.name, input.email, input.body, now.toISOString(), startOfDay(now), MESSAGES_PER_DAY)
    .run();
  return result.meta.changes > 0 ? "saved" : "full";
}

// --- /admin only (behind `requireAdmin`) ---------------------------------------------------

/** Characters of the body shown in the inbox row (the row clamps it to one line). */
const PREVIEW = 160;
/** The inbox shows the newest this many. */
const LIST_LIMIT = 200;

export async function listMessages(
  db: D1Database,
  filter: MessageFilter = "all",
): Promise<MessageSummary[]> {
  const where =
    filter === "verified"
      ? "WHERE confirmed_at IS NOT NULL"
      : filter === "unverified"
        ? "WHERE confirmed_at IS NULL"
        : "";
  const { results } = await db
    .prepare(
      `SELECT id, name, substr(body, 1, ?) AS preview, created_at, read_at, account_id, confirmed_at
       FROM message ${where} ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .bind(PREVIEW, LIST_LIMIT)
    .all<MessageSummary>();
  return results;
}

export async function unreadCount(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM message WHERE read_at IS NULL")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getMessage(db: D1Database, id: number): Promise<Message | null> {
  return db.prepare("SELECT * FROM message WHERE id = ?").bind(id).first<Message>();
}

/** Marks it read the first time only (opening it again keeps the first time). */
export async function markRead(db: D1Database, id: number): Promise<void> {
  await db
    .prepare("UPDATE message SET read_at = ? WHERE id = ? AND read_at IS NULL")
    .bind(new Date().toISOString(), id)
    .run();
}

export async function deleteMessage(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM message WHERE id = ?").bind(id).run();
}

// --- owner replies (migration 0004, table `message_reply`) ----------------------------------

export interface MessageReply {
  id: number;
  body: string;
  created_at: string;
  send_status: "pending" | "sent" | "failed" | "logged";
  send_error: string | null;
}

export async function listReplies(db: D1Database, messageId: number): Promise<MessageReply[]> {
  const { results } = await db
    .prepare(
      "SELECT id, body, created_at, send_status, send_error FROM message_reply WHERE message_id = ? ORDER BY id",
    )
    .bind(messageId)
    .all<MessageReply>();
  return results;
}

/** Stores the reply before it is sent (its id is the send's idempotency key). */
export async function addReply(db: D1Database, messageId: number, body: string): Promise<number> {
  const row = await db
    .prepare(
      "INSERT INTO message_reply (message_id, body, created_at, send_status) VALUES (?, ?, ?, 'pending') RETURNING id",
    )
    .bind(messageId, body, new Date().toISOString())
    .first<{ id: number }>();
  if (!row) throw new Error("reply not stored");
  return row.id;
}

export async function recordReplySend(
  db: D1Database,
  id: number,
  outcome: { status: "sent" | "failed" | "logged"; id?: string; error?: string },
) {
  await db
    .prepare("UPDATE message_reply SET send_status = ?, send_id = ?, send_error = ? WHERE id = ?")
    .bind(outcome.status, outcome.id ?? null, outcome.error?.slice(0, 120) ?? null, id)
    .run();
}
