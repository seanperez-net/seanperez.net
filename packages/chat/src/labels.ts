// Every word the chat shows (e-store's `@estore/chat` `labels.ts` pattern: one defaults object,
// a host overrides any of them through a component's `labels` prop). Only the words these
// components use; e-store's thread, mention, space, invite and call labels are left out.

export const DEFAULT_CHAT_LABELS = {
  conversations: "Conversations",
  conversationLabel: "Conversation",
  /** The transcript's name: "Messages with {name}". */
  transcriptLabel: "Messages with {name}",
  you: "You",
  composerLabel: "Write a message",
  composerPlaceholder: "Message",
  composerHint: "Enter sends, Shift+Enter adds a line",
  send: "Send",
  /** The unread count's spoken text. */
  unread: "{count} unread",
  isTyping: "{name} is typing…",
  isReplying: "{name} is replying…",
  statusSending: "Sending",
  statusSent: "Sent",
  statusDelivered: "Delivered",
  statusRead: "Read",
  statusFailed: "Not sent",
  /** A message's actions menu (its trigger's name): "Message actions: Sean Perez". */
  messageActions: "Message actions: {name}",
  deleteMessage: "Delete",
  /** A `<@id>` / `<#id>` token the message does not resolve. */
  unknownRef: "Unknown",
  /** Read after an off-site link in a message (its `open_in_new` mark), and in a link card's name. */
  externalLink: "external link, opens in a new tab",
  /** The floating Messages window's title bar (`MessagesWindow`, 2026-11-24). */
  windowMinimize: "Minimize",
  windowOpenFull: "Open in Messages",
  windowClose: "Close",
  videoCall: "Start a video call",
};

export type ChatLabels = { [K in keyof typeof DEFAULT_CHAT_LABELS]: string };

/** Fills `{name}` placeholders in a label (e-store's `fillLabel`). */
export function fillLabel(
  label: string,
  values: Record<string, string | number>,
): string {
  return label.replace(/\{(\w+)\}/g, (all, k: string) =>
    k in values ? String(values[k]) : all,
  );
}

/** The defaults with a host's overrides on top. */
export const chatLabels = (labels?: Partial<ChatLabels>): ChatLabels => ({
  ...DEFAULT_CHAT_LABELS,
  ...labels,
});
