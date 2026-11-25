// Time and grouping helpers. From e-store's `@estore/chat` `utils.ts` (`formatMessageTime`,
// `startsGroup`, its `zoned` fallback), changed: every date is printed in a FIXED `timeZone`
// and locale (default UTC, "en-US", as the site's `feed/format.ts`), never relative to "now",
// so the server's HTML and the browser's later renders agree (the Worker renders in UTC; the
// second agent's review, 2026-11-24). `dayKey` / `formatDay` are new (the day separator).

import type { ChatConversation, ChatMessage } from "./types";

export const CHAT_LOCALE = "en-US";
export const CHAT_TIME_ZONE = "UTC";

/** `Intl.DateTimeFormat` in `timeZone`, falling back to the runtime's zone for an unknown one. */
function zoned(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string,
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone });
  } catch {
    return new Intl.DateTimeFormat(locale, options);
  }
}

const valid = (iso: string) => !Number.isNaN(new Date(iso).getTime());

/** The calendar day of `iso` in `timeZone`, as `YYYY-MM-DD` (groups messages by day). */
export function dayKey(iso: string, timeZone = CHAT_TIME_ZONE): string {
  if (!valid(iso)) return "";
  return zoned(
    "en-CA",
    { year: "numeric", month: "2-digit", day: "2-digit" },
    timeZone,
  ).format(new Date(iso));
}

/** A day separator's text: "Monday, November 23, 2026". */
export function formatDay(
  iso: string,
  locale = CHAT_LOCALE,
  timeZone = CHAT_TIME_ZONE,
): string {
  if (!valid(iso)) return "";
  return zoned(
    locale,
    { weekday: "long", year: "numeric", month: "long", day: "numeric" },
    timeZone,
  ).format(new Date(iso));
}

/** A message's time: "3:05 PM" (the day is the separator above it). */
export function formatMessageTime(
  iso: string,
  locale = CHAT_LOCALE,
  timeZone = CHAT_TIME_ZONE,
): string {
  if (!valid(iso)) return "";
  return zoned(locale, { hour: "numeric", minute: "2-digit" }, timeZone).format(
    new Date(iso),
  );
}

/** The list row's time: "Nov 23" (absolute, see the file comment). */
export function formatListTime(
  iso: string,
  locale = CHAT_LOCALE,
  timeZone = CHAT_TIME_ZONE,
): string {
  if (!valid(iso)) return "";
  return zoned(locale, { month: "short", day: "numeric" }, timeZone).format(
    new Date(iso),
  );
}

/** Messages by one author within five minutes read as one group (e-store's `startsGroup`). */
export function startsGroup(
  prev: Pick<ChatMessage, "author" | "createdAt"> | undefined,
  m: Pick<ChatMessage, "author" | "createdAt">,
): boolean {
  if (!prev || prev.author.id !== m.author.id) return true;
  return Date.parse(m.createdAt) - Date.parse(prev.createdAt) > 5 * 60 * 1000;
}

/** Newest first, as a conversation list sorts. */
export function sortConversations<
  T extends Pick<ChatConversation, "lastMessageAt">,
>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) =>
    b.lastMessageAt.localeCompare(a.lastMessageAt),
  );
}
