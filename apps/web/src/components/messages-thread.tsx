import {
  $,
  component$,
  createContextId,
  useComputed$,
  useContext,
  useSignal,
  type QRL,
  type Signal,
} from "@qwik.dev/core";
import {
  Button,
  EmptyState,
  FullscreenButton,
  Icon,
  IconButton,
  Layout,
  Menu,
  layoutContextId,
  openCompanion,
  useSnackbar,
} from "@seanperez/ui";
import {
  ChatAvatar,
  ChatTypingIndicator,
  MessageComposer,
  MessageList,
} from "@seanperez/chat";
import { useMyApps } from "../apps/use-my-apps";
import { OWNER_ACCOUNT } from "../content/accounts";
import { MESSAGES_SEARCH_NOTICE, findThread } from "../content/conversations";
import { DEMO } from "../demo/demo";
import { usePresence } from "../presence/use-presence";
import {
  ownThreadTitle,
  useProfileOverride,
  withOwnAccount,
} from "../profile/use-profile";
import { CONTACT_COMPANION_ID } from "./contact-panel";
import { ConfirmDialog } from "./contacts-dialogs";
import { MESSAGES_DETAILS_COMPANION } from "./messages-details";
import { SendCheck } from "./send-check";
import { useDemoThread } from "./use-demo-thread";
import type { SiteUpdate } from "../messages/site-updates";

/** The composer's textarea id: the focus target when a conversation is opened. */
export const COMPOSER_ID = "messages-composer";

/** The detail heading (the conversation's name). */
const HEADING_ID = "messages-conversation-title";

/** A Shortcuts view's heading (Mentions, Starred): the focus target when one is opened. */
export const MESSAGES_VIEW_TITLE_ID = "messages-view-title";

/**
 * The conversations read this visit (`routes/messages/layout.tsx` provides it): their unread
 * count shows 0 once opened. Browser memory only: nothing is stored or sent.
 */
export const MessagesReadContext =
  createContextId<Signal<string[]>>("messages-read");

/**
 * One conversation, the Messages app's detail pane: a header (back in single-pane, avatar,
 * name, what it is, the thread's action), the transcript (`MessageList`, an ARIA log), the
 * typing line and the composer, all from `@seanperez/chat`.
 *
 * READ-ONLY DEMO (owner, 2026-11-24: visitors write nothing except the contact form). A send
 * never leaves the browser:
 * - Any thread but the assistant's: the message appears HERE ONLY, marked "Not sent"
 *   (`status: "failed"`), and a snackbar says the account is a demo, with a "Contact" action
 *   that opens the Contact companion (the real way to message the owner). The message shows,
 *   so the visitor sees the app work and the log announces it; "Not sent" says plainly that no
 *   one got it (the second agent's concern with a plain echo).
 * - The assistant's: the message is "Sent" (to this page) and a canned reply STREAMS in word by
 *   word (`streaming`, drawn outside the log), then lands in the log whole: the seam for a real
 *   assistant, with no AI call.
 * Gone on reload or on leaving the conversation (component state). The send is
 * `useDemoThread` (`use-demo-thread.ts`), shared with the floating Messages window.
 *
 * The header (Google Chat's conversation header, measured 2026-11-24, cut to the basics): Back
 * (single-pane), avatar, name, what it is ("Space · 3 members"), then icon buttons: Search in
 * this conversation (a demo notice: not built, PLAN.md; a filter would rewrite the ARIA log),
 * Conversation details (the `messages-details` companion; a device member links to the map),
 * Full screen (`FullscreenButton` on the primary pane's `<main>`, the target `Layout.PaneHeader
 * fullscreen` uses). Since 2026-11-25 the header IS `Layout.PaneHeader` (its `leading` avatar and
 * `subtitle`, owner); what does not fit a narrow pane goes into a More menu (see the JSX).
 * The owner's thread (2026-11-25; was the self thread while the site looked signed in as him) has
 * "Contact me" (opens the Contact me companion, the real way to reach him), unless the visitor
 * removed that app. Each message has Delete (local, confirmed, with Undo: `use-demo-thread.ts`). Google's pop-out,
 * Shared, Threads and Board are left out. A video call (Meet) button, when the header gets one,
 * goes FIRST in the icon-button row, before Search (Google Chat's order); today only the floating
 * window has it, as a demo notice (`messages-window-host.tsx`).
 */
export const MessagesThread = component$<{
  id: string;
  /** A read-only channel's posts from the server (Site updates: `useSiteUpdates`). */
  updates?: SiteUpdate[];
}>(({ id, updates }) => {
  const layout = useContext(layoutContextId);
  const { showSnackbar$ } = useSnackbar();
  const presence = usePresence();
  // The visitor's own edited name on their self thread and avatar (2026-11-24).
  const own = useProfileOverride();
  // Static content; the id was checked by the route's loader.
  const thread = findThread(id)!;
  // The messages and the demo send, shared with the floating Messages window.
  const {
    messages,
    streaming,
    send$,
    askDelete$,
    confirmDelete$,
    confirmOpen,
    needsCheck,
    checkForm,
    checking,
  } = useDemoThread(id, updates);
  const apps = useMyApps();

  const contact$ = $((_: Event, el: HTMLElement) =>
    openCompanion(layout, CONTACT_COMPANION_ID, el),
  );
  // The supporting pane is outside the full-screen `<main>`: leave full screen first, or the
  // panel would open where it cannot be seen (second agent, 2026-11-24).
  const details$ = $(async (_: Event, el: HTMLElement) => {
    if (document.fullscreenElement)
      await document.exitFullscreen().catch(() => {});
    openCompanion(layout, MESSAGES_DETAILS_COMPANION.id, el);
  });
  const search$ = $(() => showSnackbar$({ message: MESSAGES_SEARCH_NOTICE }));
  // DEMO: Contact me in Sean's thread, unless the visitor removed that app.
  const contactMe = useComputed$(
    () =>
      DEMO &&
      thread.person.id === OWNER_ACCOUNT.id &&
      !apps.removed.includes("contact"),
  );
  // The pane is narrower than 20rem: More holds Contact me and the details too.
  const tiny = useSignal(false);
  const measure$ = $((_: Event, el: HTMLElement) => {
    const pane = el.closest("section");
    if (pane) tiny.value = pane.clientWidth < 20 * 16;
  });
  // From the menu, focus goes back to the More button when the panel closes. The button is
  // looked up inside each handler (a plain function captured by a `$` is not serializable).
  const contactFromMenu$ = $(() =>
    openCompanion(
      layout,
      CONTACT_COMPANION_ID,
      document.querySelector<HTMLElement>(
        '[data-thread-more] [aria-haspopup="menu"]',
      ),
    ),
  );
  const detailsFromMenu$ = $(async () => {
    if (document.fullscreenElement)
      await document.exitFullscreen().catch(() => {});
    openCompanion(
      layout,
      MESSAGES_DETAILS_COMPANION.id,
      document.querySelector<HTMLElement>(
        '[data-thread-more] [aria-haspopup="menu"]',
      ),
    );
  });
  // Full screen from the menu: the primary pane, as `FullscreenButton` (Escape leaves it).
  const fullscreen$ = $(() => {
    const main = document.getElementById(layout.mainId);
    if (!document.fullscreenEnabled) {
      showSnackbar$({ message: "Full screen isn't available in this browser" });
      return;
    }
    if (document.fullscreenElement) void document.exitFullscreen();
    else void main?.requestFullscreen?.().catch(() => {});
  });

  return (
    <section
      aria-labelledby={HEADING_ID}
      // `@container/thread`: the header's actions follow the PANE's width, not the window's (at
      // 1000px with the drawer docked and the side panel open the pane is about 270px wide).
      class="@container/thread layout-pane-rulers h-full min-h-0 [--layout-pane-rulers-body:minmax(0,1fr)]"
    >
      {/* M3's app bar inside the pane (rule H5, 2026-11-25): Back (single-pane only, the part
          hides it in two-pane), the avatar, the name and what it is (`subtitle`), then the
          actions. Actions that do not fit the pane go into More (M3 app bars: an overflow menu),
          so the title keeps its readable minimum:
          - from 32rem: Contact me (labelled), Search, Conversation details, Full screen;
          - 20 to 32rem: Contact me (icon), Conversation details, More (Search, Full screen);
            the avatar from 24rem;
          - below 20rem: More holds them all. */}
      <Layout.PaneHeader
        title={ownThreadTitle(thread, own.fields)}
        titleId={HEADING_ID}
        subtitle={thread.subtitle}
        backHref="/messages/"
        backLabel="Back to messages"
        leading={
          // Placement only: no room for the avatar below 24rem.
          <span class="@max-sm/thread:hidden">
            <ChatAvatar
              person={withOwnAccount(thread.person, presence.shown, own.fields)}
            />
          </span>
        }
      >
        {/* DEMO: Contact me opens the Contact me companion, which only the layer has. */}
        {contactMe.value && (
          <>
            <div class="hidden @lg/thread:block">
              <Button
                look="tonal"
                label="Contact me"
                leadingIcon="waving_hand"
                onClick$={contact$}
              />
            </div>
            <div class="hidden @xs/thread:block @lg/thread:hidden">
              <IconButton
                look="tonal"
                icon="waving_hand"
                label="Contact me"
                onClick$={contact$}
              />
            </div>
          </>
        )}
        {/* DEMO: Search only says "not built yet"; off, no button. */}
        {DEMO && (
          <div class="hidden @lg/thread:block">
            <IconButton
              icon="search"
              label="Search in this conversation"
              onClick$={search$}
            />
          </div>
        )}
        <div class="hidden @xs/thread:block">
          <IconButton
            icon={MESSAGES_DETAILS_COMPANION.icon}
            label={MESSAGES_DETAILS_COMPANION.label}
            onClick$={details$}
          />
        </div>
        <div class="hidden @lg/thread:block">
          <FullscreenButton targetId={layout.mainId} />
        </div>
        {/* The overflow menu for what did not fit (none from 32rem). Which rows it holds is read
            from the pane's width when the pointer or focus reaches it, before it opens (a
            handler, never render: rule L19), so its rows are only what is not on show. */}
        <div
          class="@lg/thread:hidden"
          data-thread-more=""
          onPointerEnter$={measure$}
          onFocusIn$={measure$}
        >
          <Menu.Root>
            <Menu.Trigger look="plain" aria-label="More actions">
              <Icon name="more_vert" size="sm" />
            </Menu.Trigger>
            <Menu.Content align="end">
              {contactMe.value && tiny.value && (
                <Menu.Item onClick$={contactFromMenu$}>Contact me</Menu.Item>
              )}
              {DEMO && (
                <Menu.Item onClick$={search$}>
                  Search in this conversation
                </Menu.Item>
              )}
              {tiny.value && (
                <Menu.Item onClick$={detailsFromMenu$}>
                  {MESSAGES_DETAILS_COMPANION.label}
                </Menu.Item>
              )}
              <Menu.Item onClick$={fullscreen$}>Full screen</Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </div>
      </Layout.PaneHeader>

      {/* The detail's ONE body element: transcript, typing line, composer. */}
      <div class="flex min-h-0 flex-col gap-2">
        {/* A new log per conversation: this component is the `[id]` route's, keyed by it. A
            read-only channel with no posts (none published, or the database unreachable) says
            so instead of an empty log. */}
        {thread.readOnly && messages.value.length === 0 ? (
          <div class="grid flex-1 place-items-center">
            <EmptyState
              size="sm"
              icon="article"
              headline="No updates yet"
              live={false}
            />
          </div>
        ) : (
          <MessageList
            messages={messages.value}
            streaming={streaming.value}
            label={`Messages with ${ownThreadTitle(thread, own.fields)}`}
            onDelete$={askDelete$}
          />
        )}

        <ChatTypingIndicator
          name={streaming.value ? thread.person.name : null}
          kind="replying"
        />

        {/* Sean's thread with an unverified session: the security check (`send-check.tsx`). */}
        {needsCheck.value && (
          <SendCheck form={checkForm} pending={checking.value} />
        )}

        {/* Read-only (Site updates): a note in the composer's place, nothing to send. */}
        <MessageComposer
          id={COMPOSER_ID}
          onSend$={send$}
          readOnly={thread.readOnly}
          placeholder={
            thread.kind === "assistant"
              ? "Ask the assistant"
              : `Message ${ownThreadTitle(thread, own.fields)}`
          }
        />
      </div>
      <DeleteMessageDialog open={confirmOpen} onConfirm$={confirmDelete$} />
    </section>
  );
});

/** Asks before a message is deleted (it can be undone right after, from the snackbar). */
export const DeleteMessageDialog = component$<{
  open: Signal<boolean>;
  onConfirm$: QRL<() => void>;
}>(({ open, onConfirm$ }) => (
  <ConfirmDialog
    open={open}
    title="Delete this message?"
    description="It's deleted in this browser only."
    confirmLabel="Delete"
    onConfirm$={onConfirm$}
  />
));
