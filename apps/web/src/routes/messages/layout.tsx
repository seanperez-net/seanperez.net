import {
  $,
  Slot,
  component$,
  isBrowser,
  useComputed$,
  useContextProvider,
  useOnDocument,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import { routeLoader$, useLocation, useNavigate } from "@qwik.dev/router";
import { excerpt } from "@seanperez/data/feed/markdown.server";
import { listUpdates } from "@seanperez/data/feed/posts.server";
import {
  toChatMessage,
  useStoredMessages,
} from "../../components/use-demo-thread";
import { EmptyState, Layout, List } from "@seanperez/ui";
import { ChatConversationItem, sortConversations } from "@seanperez/chat";
import { AppActionFab, appActionFor } from "../../components/app-action";
import {
  COMPOSER_ID,
  MessagesReadContext,
} from "../../components/messages-thread";
import {
  MESSAGES_SHORTCUTS,
  isShortcut,
  messagesHref,
  shortcutThreads,
  toConversation,
  type MessagesShortcut,
} from "../../content/conversations";
import {
  SITE_UPDATES_ID,
  markSiteUpdatesSeen,
  readSiteUpdatesSeen,
  toSiteUpdateMessages,
  unreadSiteUpdates,
  type SiteUpdate,
} from "../../messages/site-updates";
import { usePresence } from "../../presence/use-presence";
import {
  ownThreadTitle,
  useProfileOverride,
  withOwnAccount,
} from "../../profile/use-profile";

/** The detail route's slug (a conversation id or a shortcut), or null on `/messages/`. */
const detailSlug = (pathname: string) =>
  /^\/messages\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null;

/** The open conversation's id (null on Home and on a Mentions / Starred list). */
const threadId = (pathname: string) => {
  const slug = detailSlug(pathname);
  return slug && !isShortcut(slug) ? slug : null;
};

/** Which list the list pane shows: Mentions / Starred on their routes, Home otherwise. */
const listOf = (pathname: string): "" | MessagesShortcut => {
  const slug = detailSlug(pathname);
  return slug && isShortcut(slug) ? slug : "";
};

/** A conversation's row link in the list pane (`ChatConversationItem` `data-chat-conversation`). */
const rowLink = (id: string) => {
  const v = CSS.escape(id);
  return document.querySelector<HTMLElement>(
    `[data-chat-conversation="${v}"] a, a[data-chat-conversation="${v}"]`,
  );
};

/**
 * The Site updates channel's posts (2026-11-25, `messages/site-updates.ts`): the newest 20
 * published posts from D1, the same source as Home, newest first. Read on EVERY request (the
 * default `no-cache` JSON; the service worker is network-first and falls back to its copy only
 * offline). `serializationStrategy: "always"`: the list's rows are recomputed in the browser
 * (stored messages, the unread count), and the default `never` would fetch the JSON again on
 * every resume (rule Q7). `search: []`: no query string changes it. The thread route reads it
 * too (`[id]/index.tsx`).
 */
export const useSiteUpdates = routeLoader$(
  async ({ platform }): Promise<SiteUpdate[]> =>
    (await listUpdates(platform.env.DB, 20)).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      summary: excerpt(p.body_head),
      publishedAt: p.published_at,
    })),
  { serializationStrategy: "always", search: [] },
);

/** The least time between two refreshes on `visibilitychange` (owner, 2026-11-25: 60 s). */
const REFRESH_EVERY_MS = 60_000;

/** The list pane's heading id (its section and its list are named by it). */
const LIST_TITLE_ID = "messages-title";

/**
 * The Messages app (owner, 2026-11-24): M3's LIST-DETAIL canonical layout, the same structure
 * as the Contacts app (`routes/contacts/layout.tsx`, read it for the reasons): `Layout.Pane
 * bleed` holding `Layout.ListDetail` (two panes from a 43rem container width, which pane shows in
 * single-pane mode from the URL, never the window width in render, rule L19).
 *
 * Google Chat's NAV (Shortcuts, Direct messages, Spaces, Apps) is the scaffold's DRAWER since
 * 2026-11-24 (owner: "the shortcuts etc are in the drawer why are you not using our drawer for
 * this"; `routes/layout.tsx` `drawerItems`, `MESSAGES_DRAWER_GROUPS`): docked beside the rail
 * from 600px, the modal drawer below. This pane is then Google Chat's middle column, the chosen
 * shortcut's LIST (Home: every conversation; Mentions; Starred), and the conversation beside it.
 *
 * Routes: `/messages/` Home, `/messages/mentions/` and `/messages/starred/` the filtered lists
 * (single-pane: the list; two-pane: the list and "Select a conversation"), `/messages/<id>/` a
 * conversation (beside Home's list in two-pane). One URL per view.
 *
 * "New chat" is the app's FAB (`components/app-action.tsx`): in the rail from 600px, at this
 * pane's lower end corner on the list view below 600px (the tonal button it replaces is gone).
 */
export default component$(() => {
  const loc = useLocation();
  const presence = usePresence();
  const own = useProfileOverride();
  const read = useSignal<string[]>([]);
  const stored = useStoredMessages();
  const updates = useSiteUpdates();
  // This device's last-seen post time (`undefined` until read in the browser: the server render
  // shows no unread count for the channel rather than a guess).
  const seen = useSignal<string | null | undefined>(undefined);
  useContextProvider(MessagesReadContext, read);

  const view = useComputed$(() =>
    threadId(loc.url.pathname) ? "detail" : "list",
  );
  const list = useComputed$(() => listOf(loc.url.pathname));
  const shortcut = useComputed$(
    () => MESSAGES_SHORTCUTS.find((s) => s.slug === list.value)!,
  );
  const selected = useComputed$(() => threadId(loc.url.pathname) ?? "");
  const rows = useComputed$(() =>
    sortConversations(
      shortcutThreads(list.value).map((base) => {
        // The Site updates channel: the server's posts (minus the ones deleted here), no visitor
        // messages (read-only); unread = posts newer than this device's last-seen time.
        if (base.id === SITE_UPDATES_ID) {
          const hidden = stored.value.hidden[base.id] ?? [];
          const thread = {
            ...base,
            messages: toSiteUpdateMessages(updates.value).filter(
              (m) => !hidden.includes(m.id),
            ),
          };
          // Not "read this visit" as the other threads: a post that arrives later (the refresh on
          // `visibilitychange` below) is unread again; while the channel is open it is 0.
          const unread =
            seen.value === undefined || selected.value === SITE_UPDATES_ID
              ? 0
              : unreadSiteUpdates(updates.value, seen.value, hidden);
          const row = toConversation(thread, unread);
          // The preview names the post ("Sean Perez: <title>"), not the message's "New post".
          const last = thread.messages[thread.messages.length - 1];
          const title = last?.embeds?.[0]?.title;
          const conversation =
            row.lastMessage && title
              ? {
                  ...row,
                  lastMessage: {
                    ...row.lastMessage,
                    body: `${last.author.name}: ${title}`,
                  },
                }
              : row;
          return {
            thread,
            conversation,
            lastMessageAt: conversation.lastMessageAt,
          };
        }
        // The visitor's own messages (kept in their browser) count for the preview and order;
        // a message they deleted does not (2026-11-25, `messages-local.ts` `hidden`).
        const mine = stored.value.threads[base.id] ?? [];
        const hidden = stored.value.hidden[base.id] ?? [];
        const site = base.messages.filter((m) => !hidden.includes(m.id));
        const thread =
          mine.length || hidden.length
            ? {
                ...base,
                messages: [
                  ...site,
                  ...mine.map((m) => toChatMessage(m, base.person)),
                ],
                // Unread counts the site's messages still there (a deleted welcome is not new).
                unread: Math.min(base.unread, site.length),
              }
            : base;
        const conversation = toConversation(
          thread,
          read.value.includes(thread.id) ? 0 : thread.unread,
        );
        return {
          thread,
          conversation,
          lastMessageAt: conversation.lastMessageAt,
        };
      }),
    ),
  );
  const action = useComputed$(() => appActionFor(loc.url.pathname));

  // The channel's last-seen time, in the browser only (localStorage): read it, and save the
  // newest post shown when the channel is open. On the document's `qinit` (a server-rendered
  // page) and on each browser-side navigation (a `useTask$` that ran on the server does not run
  // again on resume, so it alone would never save on a page load: RULE 2 review).
  const syncSeen$ = $(() => {
    seen.value =
      threadId(loc.url.pathname) === SITE_UPDATES_ID
        ? markSiteUpdatesSeen(updates.value)
        : readSiteUpdatesSeen();
  });
  useOnDocument("qinit", syncSeen$);
  useTask$(({ track }) => {
    track(() => loc.url.pathname);
    if (isBrowser) return syncSeen$();
  });

  // Kept current when the page comes BACK (owner, 2026-11-25): an installed PWA returning from
  // the background re-runs this route's loaders, so Site updates shows posts made meanwhile with
  // no manual reload. `nav()` with no URL is the router's documented refresh (next.qwik.dev/docs/
  // routing "<Link reload>": every matching routeLoader$ runs again on the server); rc.5's
  // `beginNavigation` defaults `forceReload` to `path === undefined` and, for the same URL, keeps
  // no loader request (only `cacheControl: 'immutable'` ones). `scroll: false`: the router does
  // not restore scroll on a same-path forceReload anyway (`commitNavigation`); said for the reader.
  // The route's components stay mounted (same modules, the thread keyed by the same id), so a
  // composer draft and focus are untouched: the router moves no focus, and the focus task below
  // returns on an unchanged path. At most once a minute (`lastLoad`: `performance.now()` of the
  // last load, 0 = this page's own load) and only online (offline the service worker would answer
  // with its copy: nothing new).
  const nav = useNavigate();
  const lastLoad = useSignal(() => (isBrowser ? performance.now() : 0));
  useOnDocument(
    "visibilitychange",
    $(async () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      const now = performance.now();
      if (now - lastLoad.value < REFRESH_EVERY_MS) return;
      lastLoad.value = now;
      await nav(undefined, { forceReload: true, scroll: false });
      // Open on the channel: what just arrived is now seen.
      await syncSeen$();
    }),
  );

  // Opening a conversation marks it read (this visit), on the server render too.
  useTask$(({ track }) => {
    const id = threadId(track(() => loc.url.pathname));
    if (id && !read.value.includes(id)) read.value = [...read.value, id];
  });

  // Focus (as Contacts, APG: move focus to the new content on a view change). Opening a
  // conversation focuses its COMPOSER (write at once); leaving it for a list, the row that was
  // open. Choosing a list in the drawer keeps focus in the drawer (navigation, not new content
  // to read first). Client navigations only: a page load keeps the browser's own focus.
  const lastPath = useSignal("");
  useTask$(({ track }) => {
    const path = track(() => loc.url.pathname);
    const from = lastPath.value;
    lastPath.value = path;
    if (!isBrowser || !from || from === path) return;
    const opened = threadId(path);
    const left = threadId(from);
    if (!opened && !left) return;
    const target = () =>
      opened ? document.getElementById(COMPOSER_ID) : rowLink(left!);
    // The new view renders after this task: retry for up to about a second (a first, cold
    // navigation from the drawer still loads the thread's code; 10 frames missed it, 2026-11-24).
    let tries = 60;
    const focus = () => {
      const el = target();
      if (el && el.offsetParent !== null) el.focus();
      else if (--tries > 0) requestAnimationFrame(focus);
    };
    requestAnimationFrame(focus);
  });

  return (
    <Layout.Pane role="primary" bleed aria-label="Messages">
      {/* The pane's ONE root: M3 list-detail as two panes (`Layout.ListDetail`, 2026-11-24, as
          Contacts; it was one pane split by a border). "New chat" below 600px is the part's
          compact FAB, on the list view only (over a conversation it would cover Send; e-store
          mail hides its FAB while composing). */}
      <Layout.ListDetail
        view={view.value}
        fab={action.value ? <AppActionFab action={action.value} /> : undefined}
      >
        {/* The list pane: the chosen shortcut's conversations. */}
        <Layout.ListPane aria-labelledby={LIST_TITLE_ID}>
          <Layout.PaneHeader
            title={shortcut.value.label}
            titleId={LIST_TITLE_ID}
          />
          {/* The list pane's body. */}
          <div class="flex min-w-0 flex-col gap-2">
            {rows.value.length === 0 ? (
              // Empty: the library's EmptyState (e-store's, ported 2026-11-24).
              <EmptyState
                size="sm"
                icon={shortcut.value.icon}
                headline={shortcut.value.empty}
              />
            ) : (
              // One Tab stop, arrows between rows, Enter opens (list.md `rovingFocus`).
              <List.Root
                rovingFocus
                padding="none"
                aria-labelledby={LIST_TITLE_ID}
              >
                {rows.value.map(({ thread, conversation }) => (
                  <ChatConversationItem
                    key={thread.id}
                    // The self thread's avatar is the visitor's own (live) presence.
                    conversation={{
                      ...conversation,
                      person: withOwnAccount(
                        conversation.person,
                        presence.shown,
                        own.fields,
                      ),
                    }}
                    title={ownThreadTitle(thread, own.fields)}
                    href={messagesHref(thread.id)}
                    selected={selected.value === thread.id}
                  />
                ))}
              </List.Root>
            )}
          </div>
        </Layout.ListPane>

        {/* The detail pane: the child route. The conversation scrolls its own transcript with the
            composer pinned under it, so the pane is `bleed`. */}
        <Layout.DetailPane bleed>
          <Slot />
        </Layout.DetailPane>
      </Layout.ListDetail>
    </Layout.Pane>
  );
});
