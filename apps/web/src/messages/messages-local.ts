/**
 * The visitor's SENT MESSAGES, kept in their browser (2026-11-25). Owner: "local changes should
 * get saved locally and then from the service worker dispatched as a sync but we are cutting that
 * part out of this website". One document on the shared seam (`local-store.ts`,
 * `local-first-shared-seam`), so the Messages page, the floating Messages window and the visitor's
 * other tabs show the same conversation, and it survives a reload. Found in Chrome: a message sent
 * in the window was missing from the thread's page (each kept its own component state).
 *
 * Only what the visitor wrote and the assistant's canned replies are stored; the site's own
 * messages come from `content/conversations.ts`. Text only, checked on read (zod, `.strict()`):
 * a damaged doc reads as empty and is never rewritten on read. The newest `MAX_PER_THREAD` per
 * thread are kept.
 *
 * DELETE (2026-11-25, owner: the owner's welcome message "can be deleted"): the visitor may delete
 * any message in THEIR copy. A stored message the server never had is simply dropped; a site
 * message (or a stored one already synced, admin only) is HIDDEN by id (`hidden`), because the
 * site's data never changes (as Contacts' `hiddenSite`). Undo puts either back (`restoreMessage`).
 * `hiddenAt` / `hiddenSyncedAt` are the hidden list's outbox stamps for admin's sync.
 */
import { z } from "zod";

export const MESSAGES_DOC = "messages.local";

/** Messages kept per thread (oldest dropped first). */
export const MAX_PER_THREAD = 200;
/** A message's longest body (the composer has no limit of its own). */
export const MAX_BODY = 4000;

/** A stored message: the author is `mine` (the visitor) or the thread's other person. */
export interface StoredMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  /** Outgoing only: "sent" (the assistant, notes to self) or "failed" ("Not sent": no backend). */
  status?: "sent" | "failed";
  /** The server confirmed it (admin app only; never set on the site). */
  synced?: true;
}

export interface MessagesLocalDoc {
  v: 1;
  /** By thread id (`content/conversations.ts`). */
  threads: Record<string, StoredMessage[]>;
  /** Deleted messages the visitor cannot drop (the site's, or synced ones), by thread id. */
  hidden?: Record<string, string[]>;
  /** When `hidden` last changed (its outbox stamp). */
  hiddenAt?: number;
  /** The `hiddenAt` the server confirmed (admin only). */
  hiddenSyncedAt?: number;
  updatedAt: number;
}

/** Hidden ids kept per thread (a thread's site messages are far fewer). */
export const MAX_HIDDEN_PER_THREAD = 500;

const messageSchema = z
  .object({
    id: z.string().min(1).max(80),
    body: z.string().max(MAX_BODY),
    createdAt: z.string().max(40),
    mine: z.boolean(),
    status: z.enum(["sent", "failed"]).optional(),
    synced: z.literal(true).optional(),
  })
  .strict();

const time = z.number().int().nonnegative();
const docSchema = z
  .object({
    v: z.literal(1),
    threads: z.record(
      z.string().max(80),
      z.array(messageSchema).max(MAX_PER_THREAD),
    ),
    hidden: z
      .record(
        z.string().max(80),
        z.array(z.string().min(1).max(80)).max(MAX_HIDDEN_PER_THREAD),
      )
      .optional(),
    hiddenAt: time.optional(),
    hiddenSyncedAt: time.optional(),
    updatedAt: time,
  })
  .strict();

export const emptyMessagesDoc = (): MessagesLocalDoc => ({
  v: 1,
  threads: {},
  updatedAt: 0,
});

/** The stored doc, or the empty one when missing or not valid. */
export function parseMessagesDoc(raw: unknown): MessagesLocalDoc {
  const parsed = docSchema.safeParse(raw);
  return parsed.success
    ? (parsed.data as MessagesLocalDoc)
    : emptyMessagesDoc();
}

/** `doc` with `message` added to `threadId` (a new object; the oldest beyond the cap dropped). */
export function addMessage(
  doc: MessagesLocalDoc,
  threadId: string,
  message: StoredMessage,
  now: number,
): MessagesLocalDoc {
  const list = [...(doc.threads[threadId] ?? []), message].slice(
    -MAX_PER_THREAD,
  );
  return {
    ...doc,
    threads: { ...doc.threads, [threadId]: list },
    updatedAt: now,
  };
}

/** The ids of `threadId`'s deleted messages that are hidden (site or synced ones). */
export const hiddenIn = (doc: MessagesLocalDoc, threadId: string): string[] =>
  doc.hidden?.[threadId] ?? [];

/** What a delete took away, for Undo (`restoreMessage`). */
export type RemovedMessage =
  | { kind: "stored"; message: StoredMessage }
  | { kind: "hidden"; id: string };

/**
 * `doc` without message `id` in `threadId`: an unsynced stored message is dropped; any other (a
 * site message, a synced one) is hidden. Returns the new doc and what to give back on Undo, or
 * the same doc and `null` when it was already gone.
 */
export function deleteMessage(
  doc: MessagesLocalDoc,
  threadId: string,
  id: string,
  now: number,
): { doc: MessagesLocalDoc; removed: RemovedMessage | null } {
  const list = doc.threads[threadId] ?? [];
  const stored = list.find((m) => m.id === id);
  const hidden = hiddenIn(doc, threadId);
  if (!stored && hidden.includes(id)) return { doc, removed: null };
  let next: MessagesLocalDoc = { ...doc, updatedAt: now };
  if (stored)
    next = {
      ...next,
      threads: { ...doc.threads, [threadId]: list.filter((m) => m.id !== id) },
    };
  // The server has it (the site's message, or one admin already sent): hide it.
  if (!stored || stored.synced)
    next = {
      ...next,
      hidden: {
        ...doc.hidden,
        [threadId]: [...hidden, id].slice(-MAX_HIDDEN_PER_THREAD),
      },
      hiddenAt: now,
    };
  return {
    doc: next,
    removed: stored
      ? { kind: "stored", message: stored }
      : { kind: "hidden", id },
  };
}

/** Undo of `deleteMessage`: the stored message back in its place (by time), or un-hidden. */
export function restoreMessage(
  doc: MessagesLocalDoc,
  threadId: string,
  removed: RemovedMessage,
  now: number,
): MessagesLocalDoc {
  const id = removed.kind === "stored" ? removed.message.id : removed.id;
  let next: MessagesLocalDoc = { ...doc, updatedAt: now };
  const hidden = hiddenIn(doc, threadId);
  if (hidden.includes(id))
    next = {
      ...next,
      hidden: { ...doc.hidden, [threadId]: hidden.filter((h) => h !== id) },
      hiddenAt: now,
    };
  if (removed.kind === "stored") {
    const list = doc.threads[threadId] ?? [];
    if (!list.some((m) => m.id === id))
      next = {
        ...next,
        threads: {
          ...doc.threads,
          [threadId]: [...list, removed.message]
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .slice(-MAX_PER_THREAD),
        },
      };
  }
  return next;
}

/** What the admin app would send. */
export interface PendingMessages {
  /** The visitor's messages the server has not confirmed. */
  messages: { threadId: string; message: StoredMessage }[];
  /** The whole hidden list, when it changed since the last confirmed sync; else `null`. */
  hidden: { list: Record<string, string[]>; at: number } | null;
}

export function pendingMessages(doc: MessagesLocalDoc): PendingMessages {
  return {
    messages: Object.entries(doc.threads).flatMap(([threadId, list]) =>
      list
        .filter((m) => m.mine && !m.synced)
        .map((message) => ({ threadId, message })),
    ),
    hidden:
      (doc.hiddenAt ?? 0) > (doc.hiddenSyncedAt ?? 0)
        ? { list: doc.hidden ?? {}, at: doc.hiddenAt! }
        : null,
  };
}

/** After the server confirmed `sent`: those messages marked `synced`, the hidden list too. */
export function markMessagesSynced(
  doc: MessagesLocalDoc,
  sent: PendingMessages,
): MessagesLocalDoc {
  const ids = new Set(sent.messages.map((s) => s.message.id));
  const threads: MessagesLocalDoc["threads"] = {};
  for (const [id, list] of Object.entries(doc.threads))
    threads[id] = list.map((m) =>
      ids.has(m.id) ? { ...m, synced: true as const } : m,
    );
  // Only if the list did not change while it was being sent.
  const hiddenSynced =
    sent.hidden && sent.hidden.at === doc.hiddenAt
      ? { hiddenSyncedAt: sent.hidden.at }
      : {};
  return { ...doc, threads, ...hiddenSynced };
}
