import {
  Slot,
  component$,
  isBrowser,
  useComputed$,
  useContextProvider,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import { useLocation } from "@qwik.dev/router";
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
