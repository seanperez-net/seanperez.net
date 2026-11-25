import {
  $,
  useComputed$,
  useContext,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";
import { layoutContextId, openCompanion, useSnackbar } from "@seanperez/ui";
import type { ChatMessage } from "@seanperez/chat";
import { useMyApps } from "../apps/use-my-apps";
import {
  ASSISTANT_REPLY,
  ME,
  MESSAGES_DEMO_NOTICE,
  findThread,
} from "../content/conversations";
import { DEMO } from "../demo/demo";
import { changeLocalDoc, onLocalDocChange, readLocalDoc } from "../local-store";
import {
  MESSAGES_DOC,
  addMessage,
  deleteMessage,
  parseMessagesDoc,
  restoreMessage,
  type RemovedMessage,
  type StoredMessage,
} from "../messages/messages-local";
import { CONTACT_COMPANION_ID } from "./contact-panel";

/** This tab's own saves (the seam's channel only reaches OTHER tabs): the page and the window. */
const SAME_TAB_EVENT = "spn:messages-local";

const loadDoc = async () => parseMessagesDoc(await readLocalDoc(MESSAGES_DOC));

/** Stores one message for `threadId` and tells this tab's other views. Browser only. */
async function storeMessage(threadId: string, message: StoredMessage) {
  await changeLocalDoc(MESSAGES_DOC, loadDoc, (doc, now) => ({
    doc: addMessage(doc, threadId, message, now),
  }));
  document.dispatchEvent(new CustomEvent(SAME_TAB_EVENT));
}

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
      const doc = await loadDoc();
      stored.value = { threads: doc.threads, hidden: doc.hidden ?? {} };
    };
    const again = () => void read();
    document.addEventListener(SAME_TAB_EVENT, again);
    const stop = onLocalDocChange(MESSAGES_DOC, again);
    cleanup(() => {
      document.removeEventListener(SAME_TAB_EVENT, again);
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

  const send$ = $(async (text: string) => {
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
    await changeLocalDoc(MESSAGES_DOC, loadDoc, (doc, now) => ({
      doc: restoreMessage(doc, id, removed, now),
    }));
    gone.value = gone.value.filter((g) => g !== messageId);
    document.dispatchEvent(new CustomEvent(SAME_TAB_EVENT));
  });
  const confirmDelete$ = $(async () => {
    const messageId = deleting.value;
    deleting.value = null;
    if (!messageId) return;
    gone.value = [...gone.value, messageId];
    const change = await changeLocalDoc(MESSAGES_DOC, loadDoc, (doc, now) => {
      const { doc: next, removed } = deleteMessage(doc, id, messageId, now);
      return { doc: next, result: removed };
    });
    document.dispatchEvent(new CustomEvent(SAME_TAB_EVENT));
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
    messages,
    streaming,
    send$,
    askDelete$,
    confirmDelete$,
    confirmOpen,
  };
}
