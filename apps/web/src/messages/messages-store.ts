/**
 * Saving one message to the visitor's `messages.local` (the shared seam), from anywhere in this
 * tab: the Messages pane, the floating window, and Contact me (2026-11-25: a message sent to Sean
 * through Contact me also shows in his thread, owner: "the message thing should send me a message
 * also"). The seam's BroadcastChannel only reaches OTHER tabs, so this tab's views listen for
 * `MESSAGES_SAME_TAB_EVENT`.
 */
import { changeLocalDoc, readLocalDoc } from "../local-store";
import {
  MESSAGES_DOC,
  addMessage,
  parseMessagesDoc,
  type StoredMessage,
} from "./messages-local";

/** This tab's own saves (the seam's channel only reaches OTHER tabs): the page and the window. */
export const MESSAGES_SAME_TAB_EVENT = "spn:messages-local";

export const loadMessagesDoc = async () =>
  parseMessagesDoc(await readLocalDoc(MESSAGES_DOC));

export async function storeMessage(threadId: string, message: StoredMessage) {
  await changeLocalDoc(MESSAGES_DOC, loadMessagesDoc, (doc, now) => ({
    doc: addMessage(doc, threadId, message, now),
  }));
  document.dispatchEvent(new CustomEvent(MESSAGES_SAME_TAB_EVENT));
}
