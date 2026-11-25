/**
 * The Messages app's SITE UPDATES channel (owner, 2026-11-25: "more like how discord has an updates
 * that gets sent to everyone ... they can see ... but not reply ... that actually has to be in the
 * database or in the feed on seanperez site ... so when it refreshes its getting the lastest
 * data"). Read-only, like a Discord announcement channel, with no reactions.
 *
 * - The messages are the site's PUBLISHED POSTS (D1 `post`, the same source as Home), read on the
 *   server by `useSiteUpdates` (`routes/messages/layout.tsx`, `listUpdates` in @seanperez/db).
 *   Nothing about them is stored in the visitor's `messages.local` except a local Delete (hide).
 * - Fresh on every load: a page load and a client navigation both reach the server (the loader's
 *   JSON is `no-cache`; the service worker is network-first for pages and loader JSON and serves
 *   its copy only when the network fails: offline).
 * - Posting happens only in the admin app's Posts (apps/admin), never here.
 * - Unread: posts newer than this device's last-seen time (`siteUpdatesSeen`, per-device state in
 *   localStorage through `readPref` / `writePref`, as the seam allows). The time saved is the
 *   newest post's `published_at` that was shown, never the device clock (a wrong clock would hide
 *   or invent unread posts). No saved time (a first visit) = only the newest post is unread.
 * - Kept current while open: the layout re-runs the route's loaders when the page becomes visible
 *   again (`routes/messages/layout.tsx`, `refreshOnVisible$`), at most once a minute, online only.
 *
 * Client-safe: no server imports.
 */
import type { ChatMessage } from "@seanperez/chat";
import { OWNER_ACCOUNT, toChatPerson } from "../content/accounts";
import { readPref, writePref } from "../local-store";

/** The channel's thread id (`content/conversations.ts`). */
export const SITE_UPDATES_ID = "site-updates";

/** What the composer's place says in the channel (`MessageComposer readOnly`). */
export const SITE_UPDATES_NOTE =
  "Only Sean posts here. Updates come from the site's feed.";

/** The site's name on each post's card. */
const SITE_NAME = "seanperez.net";

/** One published post as the loader sends it. */
export interface SiteUpdate {
  id: number;
  slug: string;
  title: string;
  /** Plain text, the first words of the post (`excerpt`). */
  summary: string;
  publishedAt: string;
}

/** A post's message id (stable, so a local Delete keeps hiding it). */
export const siteUpdateMessageId = (id: number) => `post-${id}`;

/**
 * The posts as the channel's messages, OLDEST FIRST (newest at the bottom, as a channel), each
 * from Sean (the admin account): a short line and the post's card (title, summary, a same-tab
 * link to `/feed/<slug>/`). The title is on the card only, not repeated in the line.
 */
export function toSiteUpdateMessages(
  updates: readonly SiteUpdate[],
): ChatMessage[] {
  const sean = toChatPerson(OWNER_ACCOUNT);
  return [...updates]
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .map((u) => ({
      id: siteUpdateMessageId(u.id),
      author: sean,
      body: "New post",
      createdAt: u.publishedAt,
      mine: false,
      embeds: [
        {
          kind: "link",
          internal: true,
          url: `/feed/${encodeURIComponent(u.slug)}/`,
          title: u.title,
          description: u.summary || null,
          siteName: SITE_NAME,
        },
      ],
    }));
}

/** The localStorage pref (`spn.v1.siteUpdatesSeen`): the newest post time this device has seen. */
const SEEN = "siteUpdatesSeen";

const isIso = (raw: unknown): raw is string =>
  typeof raw === "string" && !Number.isNaN(Date.parse(raw));

/** The last-seen post time on this device, or null (never opened, or no storage). Browser only. */
export const readSiteUpdatesSeen = (): string | null =>
  readPref(SEEN, (raw) => (isIso(raw) ? raw : null));

/**
 * Marks the channel seen up to its newest post (never moves back). Returns the time now saved,
 * or the previous one when nothing newer was shown. Browser only.
 */
export function markSiteUpdatesSeen(
  updates: readonly SiteUpdate[],
): string | null {
  const previous = readSiteUpdatesSeen();
  const newest = updates.reduce<string | null>(
    (max, u) => (!max || u.publishedAt > max ? u.publishedAt : max),
    null,
  );
  if (!newest || (previous && previous >= newest)) return previous;
  writePref(SEEN, newest);
  return newest;
}

/**
 * The channel's unread count: posts newer than `seen` and not hidden by the visitor. With no
 * saved time (`null`: this device never opened the channel) only the NEWEST post counts, 1 or 0
 * when the visitor hid it (owner, 2026-11-25: a first visit is "1 unread", not the 20 listed).
 */
export function unreadSiteUpdates(
  updates: readonly SiteUpdate[],
  seen: string | null,
  hidden: readonly string[] = [],
): number {
  const shown = (u: SiteUpdate) => !hidden.includes(siteUpdateMessageId(u.id));
  if (!seen) {
    const newest = updates.reduce<SiteUpdate | null>(
      (max, u) => (!max || u.publishedAt > max.publishedAt ? u : max),
      null,
    );
    return newest && shown(newest) ? 1 : 0;
  }
  return updates.filter((u) => u.publishedAt > seen && shown(u)).length;
}
