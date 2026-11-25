import { component$, type PropsOf, type QRL } from "@qwik.dev/core";
import { Icon, Menu, type IconName } from "@seanperez/ui";
import { tv } from "tailwind-variants/lite";
import { chatLabels, fillLabel, type ChatLabels } from "../../labels";
import type { ChatMessage, ChatMessageStatus } from "../../types";
import { CHAT_LOCALE, CHAT_TIME_ZONE, formatMessageTime } from "../../utils";
import { ChatAvatar } from "../conversation-item/conversation-item";
import {
  ChatMessageEmbeds,
  renderChatBody,
} from "../message-embeds/message-embeds";

/**
 * One message as a bubble: incoming at the start, outgoing at the end (logical, so it flips in
 * RTL). NEW, not in e-store: its `MessageList` draws flat rows. M3 has no chat or bubble
 * component. The anatomy follows Google Chat's web DMs (measured in Chrome 2026-11-24, see the
 * `.md`): a group of one author's messages opens with a HEADER line (incoming: a 32dp avatar in
 * the start column and "Name · time"; outgoing: the time at the end), the bubbles under it
 * without times; corners 20dp (`lg-increased`), the author's side 4dp (`xs`) where a bubble joins
 * the one above. Colours stay M3 role pairs (outgoing `primary-container` /
 * `on-primary-container`, incoming `surface-container-high` / `on-surface`): Google's own
 * values come from its baseline scheme, ours from the theme's seed.
 *
 * `groupStart`: the first of a run by one author (`startsGroup`): the header, more space above.
 * `showStatus`: the status line (the host sets it on the viewer's LAST message); a `failed`
 * message always shows it ("Not sent" must stay on every message that was not sent).
 * `onDelete$` (2026-11-25): the message's ACTIONS menu, e-store's pattern (`@estore/chat`
 * `message-list.tsx`: a `more_vert` `Menu.Trigger look="plain" size="xs"`, shown on hover or
 * focus, `Menu.Item` with an icon), cut to Delete. Beside the bubble, on its inner side. Always
 * shown on a coarse pointer (no hover there). The host confirms and deletes.
 */
export const messageBubbleVariants = tv({
  // No class here is overridden by a variant (`tailwind-variants/lite` does not merge
  // conflicting utilities): alignment lives in the `mine` variants only.
  slots: {
    // Incoming: a 32dp avatar column, then the bubbles. Outgoing: one column at the end.
    root: "group/message grid min-w-0 gap-x-2",
    avatar: "row-span-3 pt-0.5",
    header:
      "flex items-baseline gap-2 px-1 pb-1 text-label-small text-on-surface-variant",
    name: "text-label-large text-on-surface",
    // The bubble and its actions on one line (the bubble keeps its 85% cap of the column).
    line: "flex w-full min-w-0 items-center gap-1",
    bubble: [
      "max-w-[min(40rem,85%)] rounded-lg-increased px-4 py-2",
      "text-body-large wrap-break-word whitespace-pre-wrap",
    ],
    // e-store's: hidden until the message is hovered or holds focus (or its menu is open);
    // always there on a touch screen.
    actions: [
      "flex shrink-0 opacity-0 transition-opacity motion-reduce:transition-none",
      "group-hover/message:opacity-100 focus-within:opacity-100",
      "has-[[aria-expanded=true]]:opacity-100 pointer-coarse:opacity-100",
    ],
    // The link cards: the bubbles' column and width, on the author's side.
    embeds: "w-full max-w-[min(28rem,85%)]",
    meta: "flex items-center gap-1 px-1 pt-0.5 text-label-small text-on-surface-variant",
    caret: [
      "ms-0.5 inline-block h-[1em] w-0.5 translate-y-0.5 bg-current align-baseline",
      "animate-pulse motion-reduce:animate-none",
    ],
  },
  variants: {
    mine: {
      true: {
        root: "grid-cols-[minmax(0,1fr)] justify-items-end",
        header: "justify-end",
        embeds: "justify-self-end",
        // Reversed: the bubble at the end, its actions on its inner (start) side.
        line: "flex-row-reverse",
        bubble: "bg-primary-container text-on-primary-container",
        meta: "justify-end",
      },
      false: {
        // The second column is the bubbles; the avatar (or nothing) holds the first.
        root: "grid-cols-[2rem_minmax(0,1fr)] [&>*:not([data-chat-avatar])]:col-start-2",
        bubble: "bg-surface-container-high text-on-surface",
        embeds: "justify-self-start",
      },
    },
    groupStart: { true: { root: "pt-4" }, false: { root: "pt-0.5" } },
  },
  compoundVariants: [
    // The corner on the author's side joins the bubble to the one above it.
    {
      mine: true,
      groupStart: false,
      class: { bubble: "rounded-se-xs" },
    },
    {
      mine: false,
      groupStart: false,
      class: { bubble: "rounded-ss-xs" },
    },
  ],
  defaultVariants: { mine: false, groupStart: true },
});

/** The status line's icon and its words (the icon is decorative; the words are spoken). */
const STATUS: Record<
  ChatMessageStatus,
  { icon: IconName; label: keyof ChatLabels }
> = {
  sending: { icon: "schedule", label: "statusSending" },
  sent: { icon: "check", label: "statusSent" },
  delivered: { icon: "done_all", label: "statusDelivered" },
  read: { icon: "done_all", label: "statusRead" },
  failed: { icon: "error", label: "statusFailed" },
};

export type ChatMessageBubbleProps = Omit<PropsOf<"li">, "children" | "ref"> & {
  message: ChatMessage;
  /** The first of a run by one author: the header line, no joined corner. Default `true`. */
  groupStart?: boolean;
  /** Show the status line (the viewer's last message). `failed` shows it anyway. Default `true`. */
  showStatus?: boolean;
  /** `li` in a `MessageList`'s `<ol>`; `div` for the streaming bubble outside it. */
  as?: "li" | "div";
  /** Shows the message's actions menu with Delete; called with the message's id. */
  onDelete$?: QRL<(id: string) => void>;
  moreIcon?: IconName;
  deleteIcon?: IconName;
  labels?: Partial<ChatLabels>;
  locale?: string;
  timeZone?: string;
};

export const ChatMessageBubble = component$<ChatMessageBubbleProps>(
  ({
    message: m,
    groupStart = true,
    showStatus = true,
    as = "li",
    onDelete$,
    moreIcon = "more_vert",
    deleteIcon = "delete",
    labels,
    locale = CHAT_LOCALE,
    timeZone = CHAT_TIME_ZONE,
    class: className,
    ...rest
  }) => {
    const L = chatLabels(labels);
    const s = messageBubbleVariants({ mine: m.mine, groupStart });
    const status =
      m.mine && m.status && (showStatus || m.status === "failed")
        ? STATUS[m.status]
        : null;
    const time = (
      <time dateTime={m.createdAt}>
        {formatMessageTime(m.createdAt, locale, timeZone)}
      </time>
    );
    // One element either way; typed as the `li` (its attributes are a subset of a div's).
    const Tag = as as "li";
    return (
      <Tag
        {...rest}
        data-chat-message={m.id}
        data-mine={m.mine ? "" : undefined}
        data-status={m.status}
        data-streaming={m.streaming ? "" : undefined}
        aria-busy={m.streaming ? "true" : undefined}
        class={[s.root(), className]}
      >
        {!m.mine && groupStart && (
          <div data-chat-avatar="" class={s.avatar()}>
            <ChatAvatar person={m.author} size="appbar" />
          </div>
        )}
        {/* The group's header: who and when. Hidden from assistive tech: the body below says
            who (sr-only) and the time is read from the meta of each message instead. */}
        {groupStart && (
          <p aria-hidden="true" class={s.header()}>
            {!m.mine && <span class={s.name()}>{m.author.name}</span>}
            {time}
          </p>
        )}
        <div class={s.line()}>
        <p class={s.bubble()}>
          {/* The sender in words: side and colour say nothing to a screen reader, and a
              grouped bubble shows no name. Then the time, which the header shows only once. */}
          <span class="sr-only">
            {m.mine ? L.you : m.author.name},{" "}
            {formatMessageTime(m.createdAt, locale, timeZone)}:{" "}
          </span>
          {/* Links and chips (2026-11-24, `message-embeds`); a streaming reply stays plain
              text until it lands whole. */}
          {m.streaming ? m.body : renderChatBody(m, labels)}
          {m.streaming && <span aria-hidden="true" class={s.caret()} />}
        </p>
        {onDelete$ && !m.streaming && (
          <div data-chat-actions="" class={s.actions()}>
            <Menu.Root>
              <Menu.Trigger
                look="plain"
                size="xs"
                aria-label={fillLabel(L.messageActions, {
                  name: m.mine ? L.you : m.author.name,
                })}
              >
                <Icon name={moreIcon} size="sm" />
              </Menu.Trigger>
              {/* Opens away from the bubble: toward the column's middle (seen in Chrome 2026-11-25:
                  e-store's `end` covered an incoming bubble's text). */}
              <Menu.Content align={m.mine ? "end" : "start"}>
                <Menu.Item
                  data-chat-delete={m.id}
                  onClick$={() => onDelete$(m.id)}
                >
                  <Icon name={deleteIcon} size="sm" />
                  <span class="ms-3">{L.deleteMessage}</span>
                </Menu.Item>
              </Menu.Content>
            </Menu.Root>
          </div>
        )}
        </div>
        {/* Link cards UNDER the bubble, outside its `<p>` (block content) and its sr-only
            prefix; each card is one link, none nested in the bubble's. */}
        {!m.streaming && !!m.embeds?.length && (
          <div class={s.embeds()}>
            <ChatMessageEmbeds embeds={m.embeds} labels={labels} />
          </div>
        )}
        {status && (
          <p class={s.meta()}>
            <Icon name={status.icon} size="xs" />
            <span>{L[status.label]}</span>
          </p>
        )}
      </Tag>
    );
  },
);
