import {
  $,
  isBrowser,
  useComputed$,
  useContext,
  useOnDocument,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";
import {
  layoutContextId,
  openCompanion,
  useSnackbar,
  waitForTurnstileToken,
} from "@seanperez/ui";
import type { ChatMessage } from "@seanperez/chat";
import { useMyApps } from "../apps/use-my-apps";
import {
  ASSISTANT_REPLY,
  ME,
  MESSAGES_DEMO_NOTICE,
  findThread,
} from "../content/conversations";
import { DEMO } from "../demo/demo";
import { changeLocalDoc, onLocalDocChange } from "../local-store";
import {
  MESSAGES_DOC,
  deleteMessage,
  restoreMessage,
  type RemovedMessage,
  type StoredMessage,
} from "../messages/messages-local";
import {
  MESSAGES_SAME_TAB_EVENT,
  loadMessagesDoc,
  storeMessage,
} from "../messages/messages-store";
import { OWNER_ACCOUNT } from "../content/accounts";
import { CONTACT_COMPANION_ID, draftContactMessage } from "./contact-panel";
import { useSendToSean } from "./contact-actions";
import { ME_CHANGED_EVENT, fetchMe, type Me } from "../account/me";

/** The security check's form appears a render after `me` turns unverified: wait this long. */
const CHECK_FORM_WAIT_MS = 3000;

/** Milliseconds between the canned reply's words (the streaming demo). */
const WORD_MS = 60;

/** The snackbar after a delete; Undo puts the message back. */
export const MESSAGE_DELETED_NOTICE = "Message deleted from this browser";

/**
 * One conversation's messages, its LOCAL send and its local delete, shared by the Messages app's
 * detail pane (`messages-thread.tsx`) and the floating Messages window
 * (`messages-window-host.tsx`), so both behave the same. Nothing is ever posted (the site writes
 * nothing but the contact form). A send:
 * - Notes to self (the visitor's "(you)" thread, 2026-11-25): kept, "Sent"; nothing to send.
 * - The assistant's: "Sent" (to this page) and a canned reply STREAMS in word by word
 *   (`streaming`, drawn outside the log), then lands in the log whole: the seam for a real
 *   assistant, with no AI call.
 * - Anyone else's (the owner's thread, a space): kept, marked "Not sent" (`status: "failed"`),
 *   and a snackbar says so, with a "Contact me" action that opens the Contact me companion, the
 *   real way to message the owner (none when the visitor removed that app).
 * Delete (2026-11-25, owner: his welcome message "can be deleted"): any message, after a confirm
 * (`askDelete$`, the host draws `ConfirmDialog`), with Undo in the snackbar (`messages-local.ts`
 * `deleteMessage` / `restoreMessage`).
 * Kept in the visitor's browser (`messages.local` on the shared seam, 2026-11-25): the pane, the
 * window and other tabs show the same messages, after a reload too.
 *
 * `id` must be a known thread id (the caller checked it).
 */
/** A stored message as `MessageList` draws it (the author from `mine`). */
export const toChatMessage = (
  m: StoredMessage,
  other: ChatMessage["author"],
): ChatMessage => ({
  id: m.id,
  author: m.mine ? ME : other,
  body: m.body,
  createdAt: m.createdAt,
  mine: m.mine,
  ...(m.status ? { status: m.status } : {}),
});

/** The visitor's stored messages and deletions, by thread. */
export interface StoredMessages {
  threads: Record<string, StoredMessage[]>;
  hidden: Record<string, string[]>;
}

/**
 * The visitor's stored messages by thread (`messages.local`), read in the browser once the view
 * exists, and again when this tab's other view or another tab saves. Empty on the server and
 * until read. Used by the thread views and the conversation list (its previews and order).
 */
export function useStoredMessages() {
  const stored = useSignal<StoredMessages>({ threads: {}, hidden: {} });
  // Browser only, after the view exists (it may be client-rendered, the window, so `qinit` has
  // passed): no `useTask$` / `useOn` equivalent.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const read = async () => {
      const doc = await loadMessagesDoc();
      stored.value = { threads: doc.threads, hidden: doc.hidden ?? {} };
    };
    const again = () => void read();
    document.addEventListener(MESSAGES_SAME_TAB_EVENT, again);
    const stop = onLocalDocChange(MESSAGES_DOC, again);
    cleanup(() => {
      document.removeEventListener(MESSAGES_SAME_TAB_EVENT, again);
      stop();
    });
    void read();
  });
  return stored;
}

export function useDemoThread(id: string) {
  const layout = useContext(layoutContextId);
  const apps = useMyApps();
  const { showSnackbar$ } = useSnackbar();
  // Sean's thread with a contact account posts here (`contact-actions.ts`, root layout).
  const sendToSean = useSendToSean();
  const thread = findThread(id)!;
  const local = useSignal<ChatMessage[]>([]);
  const streaming = useSignal<ChatMessage | null>(null);
  // Deleted in this view (also when the browser could not store the deletion).
  const gone = useSignal<string[]>([]);
  // The stored messages (`useStoredMessages`): this thread's, as chat messages.
  const stored = useStoredMessages();
  const messages = useComputed$(() => {
    const hidden = stored.value.hidden[id] ?? [];
    return [...thread.messages, ...local.value].filter(
      (m) => !hidden.includes(m.id) && !gone.value.includes(m.id),
    );
  });
  useTask$(({ track }) => {
    const list = track(() => stored.value.threads[id]);
    if (list) local.value = list.map((m) => toChatMessage(m, thread.person));
  });

  // Sean's thread: this browser's contact session (`/api/me`), so an UNVERIFIED one can show the
  // security check (`SendCheck`) before the visitor sends (owner, 2026-11-25, "DECIDED" (2)).
  // Read on resume, on a browser render, and when Contact me signs in, verifies or signs out.
  const sean = DEMO && id === OWNER_ACCOUNT.chatId;
  const me = useSignal<Me | null>(null);
  const readMe = $(async () => {
    if (sean) me.value = await fetchMe();
  });
  useOnDocument("qinit", readMe);
  useOnDocument(ME_CHANGED_EVENT, readMe);
  useTask$(() => {
    if (isBrowser) return readMe();
  });
  /** Draw `SendCheck`: Sean's thread with an unverified session. */
  const needsCheck = useComputed$(() => sean && me.value?.verified === false);
  /** `SendCheck`'s form (the widget writes its token there). */
  const checkForm = useSignal<HTMLFormElement>();
  /** A send is spending the check's token (`SendCheck` resets the widget after). */
  const checking = useSignal(false);

  const send$ = $(async (text: string) => {
    // Sean's thread (2026-11-25, owner: "when trying to send a message to me and not logged in
    // ... it should pop that contact me window and ... auto focus the name"): there is no sign-in
    // yet, so a message to him goes THROUGH Contact me: the text moves into its Message field,
    // Contact me opens with Name focused, and Send there delivers it (and adds it to this thread,
    // `contact-panel.tsx`). Later, with an account from Contact me (PLAN.md), it sends directly.
    // With a contact account in this browser (2026-11-25, plan 1.3; `/api/me`), the message goes
    // straight to him: no form. Verified: delivered; unverified: delivered marked "Unverified",
    // at most 3 waiting. No session: Contact me as above.
    if (DEMO && id === OWNER_ACCOUNT.chatId) {
      const current = await fetchMe();
      me.value = current;
      if (current) {
        const mine: ChatMessage = {
          id: `local-${Date.now()}`,
          author: ME,
          body: text,
          createdAt: new Date().toISOString(),
          mine: true,
          status: "sending",
        };
        local.value = [...local.value, mine];
        // Unverified: the security check's token goes with it (the server checks it). The
        // check's form is drawn once `me` is known; wait for it, then for its token.
        let token = "";
        if (!current.verified) {
          const until = Date.now() + CHECK_FORM_WAIT_MS;
          while (!checkForm.value && Date.now() < until)
            await new Promise((r) => setTimeout(r, 50));
          if (checkForm.value) token = await waitForTurnstileToken(checkForm.value);
        }
        checking.value = true;
        let value;
        try {
          ({ value } = await sendToSean.submit({
            message: text,
            ...(token ? { "cf-turnstile-response": token } : {}),
          }));
        } finally {
          checking.value = false;
        }
        const sent = !value.failed;
        if (!sent && value.noSession && !apps.removed.includes("contact")) {
          // The session ended meanwhile: Contact me after all.
          local.value = local.value.filter((m) => m.id !== mine.id);
          draftContactMessage(text);
          openCompanion(layout, CONTACT_COMPANION_ID);
          return;
        }
        const status = sent ? "sent" : "failed";
        local.value = local.value.map((m) =>
          m.id === mine.id ? { ...m, status } : m,
        );
        await storeMessage(id, {
          id: mine.id,
          body: text,
          createdAt: mine.createdAt,
          mine: true,
          status,
        });
        if (!sent && value.message) await showSnackbar$({ message: value.message });
        else if (sent && !current.verified) {
          await showSnackbar$({
            message: "Sent. Confirm your email so Sean knows it's you.",
          });
        }
        return;
      }
    }
    if (
      DEMO &&
      id === OWNER_ACCOUNT.chatId &&
      !apps.removed.includes("contact")
    ) {
      draftContactMessage(text);
      openCompanion(layout, CONTACT_COMPANION_ID);
      return;
    }
    const assistant = thread.kind === "assistant";
    const self = thread.kind === "self";
    const mine: ChatMessage = {
      id: `local-${Date.now()}`,
      author: ME,
      body: text,
      createdAt: new Date().toISOString(),
      mine: true,
      // A note to self has no one to reach: kept is all it needs. DEMO: off, nothing else can
      // send (no backend, no assistant): "Not sent", with no snackbar and no canned reply.
      status: self || (DEMO && assistant) ? "sent" : "failed",
    };
    local.value = [...local.value, mine];
    await storeMessage(id, {
      id: mine.id,
      body: text,
      createdAt: mine.createdAt,
      mine: true,
      status: mine.status as StoredMessage["status"],
    });
    if (!DEMO || self) return;
    if (!assistant) {
      const contact = !apps.removed.includes("contact");
      await showSnackbar$({
        message: MESSAGES_DEMO_NOTICE,
        ...(contact
          ? {
              action: "Contact me",
              onAction$: $(() => openCompanion(layout, CONTACT_COMPANION_ID)),
            }
          : {}),
      });
      return;
    }
    // The assistant seam: a reply arriving in pieces, then the whole message.
    const words = ASSISTANT_REPLY.split(" ");
    const reply: ChatMessage = {
      id: `local-${Date.now()}-reply`,
      author: thread.person,
      body: "",
      createdAt: new Date().toISOString(),
      mine: false,
    };
    let n = 0;
    const next = () => {
      n++;
      if (n <= words.length) {
        streaming.value = { ...reply, body: words.slice(0, n).join(" ") };
        setTimeout(next, WORD_MS);
      } else {
        streaming.value = null;
        local.value = [...local.value, { ...reply, body: ASSISTANT_REPLY }];
        void storeMessage(id, {
          id: reply.id,
          body: ASSISTANT_REPLY,
          createdAt: reply.createdAt,
          mine: false,
        });
      }
    };
    setTimeout(next, 400);
  });

  // Delete: the host's confirm dialog opens on `askDelete$` and runs `confirmDelete$`.
  const deleting = useSignal<string | null>(null);
  const confirmOpen = useSignal(false);
  const askDelete$ = $((messageId: string) => {
    deleting.value = messageId;
    confirmOpen.value = true;
  });
  const undo$ = $(async (removed: RemovedMessage) => {
    const messageId =
      removed.kind === "stored" ? removed.message.id : removed.id;
    await changeLocalDoc(MESSAGES_DOC, loadMessagesDoc, (doc, now) => ({
      doc: restoreMessage(doc, id, removed, now),
    }));
    gone.value = gone.value.filter((g) => g !== messageId);
    document.dispatchEvent(new CustomEvent(MESSAGES_SAME_TAB_EVENT));
  });
  const confirmDelete$ = $(async () => {
    const messageId = deleting.value;
    deleting.value = null;
    if (!messageId) return;
    gone.value = [...gone.value, messageId];
    const change = await changeLocalDoc(MESSAGES_DOC, loadMessagesDoc, (doc, now) => {
      const { doc: next, removed } = deleteMessage(doc, id, messageId, now);
      return { doc: next, result: removed };
    });
    document.dispatchEvent(new CustomEvent(MESSAGES_SAME_TAB_EVENT));
    const removed = change.result;
    await showSnackbar$({
      message: MESSAGE_DELETED_NOTICE,
      ...(removed
        ? { action: "Undo", onAction$: $(() => undo$(removed)) }
        : {}),
    });
  });

  return {
    thread,
    needsCheck,
    checkForm,
    checking,
    messages,
    streaming,
    send$,
    askDelete$,
    confirmDelete$,
    confirmOpen,
  };
}
