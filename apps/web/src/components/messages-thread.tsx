import {
  $,
  component$,
  createContextId,
  useContext,
  type QRL,
  type Signal,
} from "@qwik.dev/core";
import {
  Button,
  FullscreenButton,
  IconButton,
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
import {
  MESSAGES_SEARCH_NOTICE,
  findThread,
} from "../content/conversations";
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
import { useDemoThread } from "./use-demo-thread";

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
 * fullscreen` uses; our header is not a PaneHeader because it needs Back, avatar and subtitle).
 * The owner's thread (2026-11-25; was the self thread while the site looked signed in as him) has
 * "Contact me" (opens the Contact me companion, the real way to reach him), unless the visitor
 * removed that app. Each message has Delete (local, confirmed, with Undo: `use-demo-thread.ts`). Google's pop-out,
 * Shared, Threads and Board are left out. A video call (Meet) button, when the header gets one,
 * goes FIRST in the icon-button row, before Search (Google Chat's order); today only the floating
 * window has it, as a demo notice (`messages-window-host.tsx`).
 */
export const MessagesThread = component$<{ id: string }>(({ id }) => {
  const layout = useContext(layoutContextId);
  const { showSnackbar$ } = useSnackbar();
  const presence = usePresence();
  // The visitor's own edited name on their self thread and avatar (2026-11-24).
  const own = useProfileOverride();
  // Static content; the id was checked by the route's loader.
  const thread = findThread(id)!;
  // The messages and the demo send, shared with the floating Messages window.
  const { messages, streaming, send$, askDelete$, confirmDelete$, confirmOpen } =
    useDemoThread(id);
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

  return (
    <section
      aria-labelledby={HEADING_ID}
      class="layout-pane-rulers h-full min-h-0 [--layout-pane-rulers-body:minmax(0,1fr)]"
    >
      {/* The detail's ONE body element: header, transcript, typing line, composer. */}
      <div class="flex min-h-0 flex-col gap-2">
        <header class="flex items-center gap-3">
          {/* Single-pane only (M3): back to the list, a link so it works from a deep link.
              `data-pane-header-back`: `Layout.ListDetail` hides it in two-pane (layout.md). */}
          <div data-pane-header-back="">
            <IconButton
              type="link"
              href="/messages/"
              icon="arrow_back"
              label="Back to messages"
              flipIconInRtl
            />
          </div>
          <ChatAvatar
            person={withOwnAccount(thread.person, presence.shown, own.fields)}
          />
          <div class="min-w-0 flex-1">
            <h2
              id={HEADING_ID}
              class="truncate text-title-large text-on-surface"
            >
              {ownThreadTitle(thread, own.fields)}
            </h2>
            <p class="truncate text-body-medium text-on-surface-variant">
              {thread.subtitle}
            </p>
          </div>
          {/* DEMO: Contact me opens the Contact me companion, which only the layer has. */}
          {DEMO &&
            thread.person.id === OWNER_ACCOUNT.id &&
            !apps.removed.includes("contact") && (
              <>
                {/* Placement only: the labelled button from 600px; below, an icon button, so the
                    conversation's name keeps its room at 390px (seen in Chrome 2026-11-25). */}
                <div class="max-sm:hidden">
                  <Button
                    look="tonal"
                    label="Contact me"
                    leadingIcon="waving_hand"
                    onClick$={contact$}
                  />
                </div>
                <div class="sm:hidden">
                  <IconButton
                    look="tonal"
                    icon="waving_hand"
                    label="Contact me"
                    onClick$={contact$}
                  />
                </div>
              </>
            )}
          {/* Placement only: the actions keep their size when the title is cut short. */}
          <div class="flex shrink-0 items-center">
            {/* DEMO: Search only says "not built yet"; off, no button. */}
            {DEMO && (
              <IconButton
                icon="search"
                label="Search in this conversation"
                onClick$={search$}
              />
            )}
            <IconButton
              icon={MESSAGES_DETAILS_COMPANION.icon}
              label={MESSAGES_DETAILS_COMPANION.label}
              onClick$={details$}
            />
            <FullscreenButton targetId={layout.mainId} />
          </div>
        </header>

        {/* A new log per conversation: this component is the `[id]` route's, keyed by it. */}
        <MessageList
          messages={messages.value}
          streaming={streaming.value}
          label={`Messages with ${ownThreadTitle(thread, own.fields)}`}
          onDelete$={askDelete$}
        />

        <ChatTypingIndicator
          name={streaming.value ? thread.person.name : null}
          kind="replying"
        />

        <MessageComposer
          id={COMPOSER_ID}
          onSend$={send$}
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
