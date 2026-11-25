/**
 * Contact form messages in D1 (binding `DB`, table `message`, `migrations/0000_init.sql`),
 * through Drizzle (port 2026-11-25). The contact action writes through `saveMessage`; everything
 * else is the admin app's (behind `requireAdmin`). Every value is a bound parameter, never SQL text.
 */
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "../client.ts";
import { message, messageReply, type SendStatus } from "../schema.ts";

export interface Message {
  id: number;
  name: string;
  email: string;
  body: string;
  created_at: string;
  read_at: string | null;
  /** The sender's contact account; null when there is none (an unlinked mail, a deleted account). */
  account_id: string | null;
  /** NULL: sent before the address was verified ("Unverified" in /admin). */
  confirmed_at: string | null;
  /** The contact form, or a mail to sean@ (`mail/inbound.server.ts`). */
  source: MessageSource;
  /** Email rows: the subject, the Message-ID and the mx.cloudflare.net auth summary. */
  subject: string | null;
  message_id: string | null;
  auth: string | null;
}

export type MessageSource = "form" | "email";

/** A row in the inbox: the start of the body, not all of it. */
export type MessageSummary = Omit<Message, "body" | "email" | "message_id"> & {
  preview: string;
};

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
const startOfDay = (now: Date) =>
  `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;

/**
 * Store one message, unless today's cap is reached. ONE statement, so the count and the insert
 * cannot interleave with another request's: `INSERT ... SELECT ... WHERE (count) < cap` inserts
 * no row when the day is full, and `meta.changes` (D1Result, developers.cloudflare.com/d1/
 * worker-api/return-object/) says which happened.
 *
 * RAW D1 on purpose (Drizzle port 2026-11-25, `.claude/rules/db.md` "cap inserts"): Drizzle's
 * `insert().select(sql)` would need every column positionally, which hides the cap.
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
    .bind(
      input.name,
      input.email,
      input.body,
      now.toISOString(),
      startOfDay(now),
      MESSAGES_PER_DAY,
    )
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
  source: MessageSource | "all" = "all",
): Promise<MessageSummary[]> {
  return getDb(db)
    .select({
      id: message.id,
      name: message.name,
      preview: sql<string>`substr(${message.body}, 1, ${PREVIEW})`,
      created_at: message.created_at,
      read_at: message.read_at,
      account_id: message.account_id,
      confirmed_at: message.confirmed_at,
      source: message.source,
      subject: message.subject,
      auth: message.auth,
    })
    .from(message)
    .where(
      and(
        filter === "verified"
          ? isNotNull(message.confirmed_at)
          : filter === "unverified"
            ? isNull(message.confirmed_at)
            : undefined,
        source === "all" ? undefined : eq(message.source, source),
      ),
    )
    .orderBy(desc(message.created_at), desc(message.id))
    .limit(LIST_LIMIT);
}

export async function unreadCount(db: D1Database): Promise<number> {
  const row = await getDb(db)
    .select({ n: count() })
    .from(message)
    .where(isNull(message.read_at))
    .get();
  return row?.n ?? 0;
}

export async function getMessage(
  db: D1Database,
  id: number,
): Promise<Message | null> {
  return (
    (await getDb(db).select().from(message).where(eq(message.id, id)).get()) ??
    null
  );
}

/** Marks it read the first time only (opening it again keeps the first time). */
export async function markRead(db: D1Database, id: number): Promise<void> {
  await getDb(db)
    .update(message)
    .set({ read_at: new Date().toISOString() })
    .where(and(eq(message.id, id), isNull(message.read_at)));
}

export async function deleteMessage(db: D1Database, id: number): Promise<void> {
  await getDb(db).delete(message).where(eq(message.id, id));
}

// --- owner replies (table `message_reply`) ----------------------------------

export interface MessageReply {
  id: number;
  body: string;
  created_at: string;
  send_status: SendStatus;
  send_error: string | null;
}

export async function listReplies(
  db: D1Database,
  messageId: number,
): Promise<MessageReply[]> {
  return getDb(db)
    .select({
      id: messageReply.id,
      body: messageReply.body,
      created_at: messageReply.created_at,
      send_status: messageReply.send_status,
      send_error: messageReply.send_error,
    })
    .from(messageReply)
    .where(eq(messageReply.message_id, messageId))
    .orderBy(asc(messageReply.id));
}

/** Stores the reply before it is sent (its id is the send's idempotency key). */
export async function addReply(
  db: D1Database,
  messageId: number,
  body: string,
): Promise<number> {
  const row = await getDb(db)
    .insert(messageReply)
    .values({
      message_id: messageId,
      body,
      created_at: new Date().toISOString(),
      send_status: "pending",
    })
    .returning({ id: messageReply.id })
    .get();
  if (!row) throw new Error("reply not stored");
  return row.id;
}

export async function recordReplySend(
  db: D1Database,
  id: number,
  outcome: {
    status: "sent" | "failed" | "logged";
    id?: string;
    error?: string;
  },
) {
  await getDb(db)
    .update(messageReply)
    .set({
      send_status: outcome.status,
      send_id: outcome.id ?? null,
      send_error: outcome.error?.slice(0, 120) ?? null,
    })
    .where(eq(messageReply.id, id));
}
