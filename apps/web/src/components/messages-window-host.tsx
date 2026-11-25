import {
  $,
  component$,
  createContextId,
  noSerialize,
  useContext,
  useContextProvider,
  useSignal,
  useTask$,
  type NoSerialize,
  type QRL,
  type Signal,
} from "@qwik.dev/core";
import { useLocation, useNavigate } from "@qwik.dev/router";
import { useSnackbar } from "@seanperez/ui";
import { MessagesWindow } from "@seanperez/chat";
import { findAccount } from "../content/accounts";
import {
  MESSAGES_VIDEO_NOTICE,
  findThread,
  messagesHref,
} from "../content/conversations";
import { DEMO } from "../demo/demo";
import { WIP } from "../demo/wip";
import { usePresence } from "../presence/use-presence";
import {
  ownThreadTitle,
  useProfileOverride,
  withOwnAccount,
} from "../profile/use-profile";
import { COMPOSER_ID, DeleteMessageDialog } from "./messages-thread";
import { SendCheck } from "./send-check";
import { useDemoThread } from "./use-demo-thread";

/**
 * The floating Messages window, ONE for the site (2026-11-24, owner: Google Contacts' person page
 * opens a small chat window; "keep messages in ours": email and chat are one conversation, so
 * this is the Messages app's thread, not a separate chat). `routes/layout.tsx` provides the API
 * (`useMessagesWindowProvider`) and mounts `<MessagesWindowHost />`; any page calls
 * `useMessagesWindow().open$(accountId, el)`.
 *
 * `open$(accountId, opener?)`:
 * - `accountId` is an `Account.id` (`content/accounts.ts`); its `chatId` names the thread. A
 *   thread id is accepted too. Unknown, or an account with no conversation: nothing happens
 *   (resolves `false`).
 * - Below 600px it NAVIGATES to the thread's page (`/messages/<id>/`) instead: a floating window
 *   on a phone would cover the whole screen and duplicate that page (second agent, 2026-11-24).
 *   The width is read in the handler only (rule L19).
 * - On that thread's own page it focuses the page's composer instead of opening a second copy.
 * - `opener`: what focus returns to on close (pass the clicked button; Safari does not focus a
 *   clicked button, so `document.activeElement` is not enough there).
 * - Opening another account replaces the window (one at a time, as the second agent advised).
 */
export interface MessagesWindowApi {
  open$: QRL<(accountId: string, opener?: HTMLElement) => Promise<boolean>>;
  close$: QRL<() => void>;
}

interface MessagesWindowState {
  threadId: Signal<string | null>;
  opener: Signal<NoSerialize<HTMLElement>>;
}

const MessagesWindowApiContext = createContextId<MessagesWindowApi>(
  "messages-window-api",
);
const MessagesWindowStateContext = createContextId<MessagesWindowState>(
  "messages-window-state",
);

/** The thread an account's Messages conversation is (`Account.chatId`), or a thread id itself. */
const threadFor = (accountId: string) => {
  const chatId = findAccount(accountId)?.chatId ?? accountId;
  return findThread(chatId)?.id ?? null;
};

/** In the root layout, once. Returns the API (the same object `useMessagesWindow` gives). */
export const useMessagesWindowProvider = (): MessagesWindowApi => {
  const nav = useNavigate();
  const loc = useLocation();
  const threadId = useSignal<string | null>(null);
  const opener = useSignal<NoSerialize<HTMLElement>>();
  useContextProvider(MessagesWindowStateContext, { threadId, opener });

  const open$ = $(async (accountId: string, from?: HTMLElement) => {
    const id = threadFor(accountId);
    if (!id) return false;
    const href = messagesHref(id);
    if (loc.url.pathname === href) {
      document.getElementById(COMPOSER_ID)?.focus();
      return true;
    }
    if (!matchMedia("(min-width: 600px)").matches) {
      threadId.value = null;
      await nav(href);
      return true;
    }
    const active = document.activeElement;
    opener.value = noSerialize(
      from ?? (active instanceof HTMLElement ? active : undefined),
    );
    threadId.value = id;
    return true;
  });
  const close$ = $(() => {
    threadId.value = null;
  });
  const api: MessagesWindowApi = { open$, close$ };
  useContextProvider(MessagesWindowApiContext, api);

  // Arriving on the open thread's own page ("Open in Messages", the drawer): the page shows it;
  // the window goes.
  useTask$(({ track }) => {
    const path = track(() => loc.url.pathname);
    const id = threadId.value;
    if (id && path === messagesHref(id)) threadId.value = null;
  });

  return api;
};

/** The window's API, from any component under the root layout. */
export const useMessagesWindow = (): MessagesWindowApi =>
  useContext(MessagesWindowApiContext);

/** Renders the open conversation's window; nothing while none is open. Mount once, in the root layout. */
export const MessagesWindowHost = component$(() => {
  const state = useContext(MessagesWindowStateContext);
  // Read in JSX (rule Q12). Keyed by the thread: another conversation is a new window, with its
  // own ARIA log and local messages (as the `[id]` route keys `MessagesThread`).
  return (
    <>
      {state.threadId.value && (
        <ThreadWindow key={state.threadId.value} id={state.threadId.value} />
      )}
    </>
  );
});

const ThreadWindow = component$<{ id: string }>(({ id }) => {
  const state = useContext(MessagesWindowStateContext);
  const { showSnackbar$ } = useSnackbar();
  const presence = usePresence();
  const own = useProfileOverride();
  // The same messages and demo send as the Messages app's pane (`use-demo-thread.ts`).
  const {
    thread,
    messages,
    streaming,
    send$,
    askDelete$,
    confirmDelete$,
    confirmOpen,
    needsCheck,
    checkForm,
    checking,
  } = useDemoThread(id);

  return (
    <>
    <MessagesWindow
      person={withOwnAccount(thread.person, presence.shown, own.fields)}
      title={ownThreadTitle(thread, own.fields)}
      messages={messages.value}
      streaming={streaming.value}
      typingName={streaming.value ? thread.person.name : null}
      typingKind="replying"
      onSend$={send$}
      onDelete$={askDelete$}
      onClose$={$(() => {
        state.threadId.value = null;
      })}
      openFullHref={messagesHref(id)}
      // DEMO: the video call is a notice (`MESSAGES_VIDEO_NOTICE`); off, no button. WIP: and
      // only with the release switch on (`demo/wip.ts`): no button in production builds.
      onVideoCall$={
        DEMO && WIP
          ? $(() => showSnackbar$({ message: MESSAGES_VIDEO_NOTICE }))
          : undefined
      }
      opener={state.opener.value}
      composerPlaceholder={
        thread.kind === "assistant" ? "Ask the assistant" : `Message ${ownThreadTitle(thread, own.fields)}`
      }
    />
    {/* Sean's thread with an unverified session: the security check, at the bottom start,
      clear of the window (`send-check.tsx`). */}
    {needsCheck.value && (
      <SendCheck form={checkForm} pending={checking.value} floating />
    )}
    {/* Outside the window's popover: Escape in the dialog closes the dialog only. */}
    <DeleteMessageDialog open={confirmOpen} onConfirm$={confirmDelete$} />
    </>
  );
});
