/**
 * RECENT INTERACTIONS with a contact (2026-11-25, owner: "the default behavior of contacts that has
 * contact details and recent interactions the histor last edited added to contacts"). Google
 * Contacts' person page shows a "Recent interactions" card in its second column (observed signed
 * in, 2026-11-25, layout only): one row per recent email or meeting with that person, the app's
 * icon, the subject and the date. Google's People API does not expose these (they come from Gmail
 * and Calendar, not the Person resource; notes `.claude/notes/contacts-google-parity-2026-11-25.md`).
 *
 * Here the only interactions are MESSAGES: the conversations in the Messages app that the contact's
 * ACCOUNT is a member of (`content/conversations.ts` `THREADS`; in a space only the messages that
 * contact or the visitor wrote), each with its latest message as
 * the visitor sees it: the site's messages minus the ones they deleted (`hidden`), plus their own
 * stored ones (`messages.local`). One row per conversation, newest first. A contact with no account
 * (the visitor's own contacts) has none: the site has no mail or calendar of the visitor's.
 *
 * Plain TS, no Qwik: the page passes the stored messages in (`useStoredMessages`).
 */
import { DEFAULT_CHAT_LABELS, chatPlainText } from "@seanperez/chat";
import type { IconName } from "@seanperez/ui";
import { THREADS, messagesHref } from "../content/conversations";
import type { StoredMessages } from "../components/use-demo-thread";

/** Rows the card shows at most (Google shows a handful). */
export const MAX_INTERACTIONS = 5;

export interface Interaction {
  threadId: string;
  /** The conversation's name ("Site updates", the person's name for a direct one). */
  title: string;
  /** What the latest message says, tokens as names, one line. */
  preview: string;
  /** The latest message's ISO time. */
  at: string;
  /** Who wrote it: the visitor (`true`) or someone in the conversation. */
  mine: boolean;
  icon: IconName;
  href: string;
}

/** The latest messages of every conversation `accountId` is in, newest first. */
export function recentInteractions(
  accountId: string | undefined,
  stored: StoredMessages,
  max = MAX_INTERACTIONS,
): Interaction[] {
  if (!accountId) return [];
  const rows: Interaction[] = [];
  for (const t of THREADS) {
    if (!t.members.some((m) => m.id === accountId)) continue;
    const hidden = stored.hidden[t.id] ?? [];
    const site = t.messages
      // In a space, only what THIS contact or the visitor wrote is an interaction with them.
      .filter(
        (m) =>
          !hidden.includes(m.id) &&
          (t.kind !== "space" || m.mine || m.author.id === accountId),
      )
      .map((m) => ({
        body: chatPlainText(m, DEFAULT_CHAT_LABELS),
        at: m.createdAt,
        mine: m.mine,
      }));
    const own = (stored.threads[t.id] ?? []).map((m) => ({
      body: m.body,
      at: m.createdAt,
      mine: m.mine,
    }));
    const last = [...site, ...own]
      .sort((a, b) => a.at.localeCompare(b.at))
      .at(-1);
    if (!last) continue;
    rows.push({
      threadId: t.id,
      title: t.kind === "space" ? t.title : t.person.name,
      preview: last.body.replace(/\s+/g, " ").trim(),
      at: last.at,
      mine: last.mine,
      icon: t.kind === "space" ? "groups" : "chat",
      href: messagesHref(t.id),
    });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, max);
}
