import { component$, type PropsOf, type QRL } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { ChatLabels } from "../../labels";
import type { ChatMessage } from "../../types";
import { CHAT_LOCALE, CHAT_TIME_ZONE, dayKey, startsGroup } from "../../utils";
import { ChatDaySeparator } from "../day-separator/day-separator";
import { ChatMessageBubble } from "../message-bubble/message-bubble";

/**
 * The transcript: a scroller that starts at the newest message, around an ARIA LOG of the
 * messages. Name and scroller from e-store's `MessageList` and its workspace
 * (`chat-workspace.tsx`: a `flex-col-reverse` box, so the scroll starts at the end without
 * script, the DOM order oldest first). The log is NEW: e-store's list is a plain `<ol>`.
 *
 * - `role="log"` (WAI-ARIA 1.2: "a type of live region where new information is added in
 *   meaningful order and old information may disappear"; implicit `aria-live="polite"`,
 *   `aria-relevant` "additions text"), on a WRAPPER `<div>`, so the `<ol>` keeps its list
 *   semantics. `aria-live="polite"` is also set outright for older screen readers.
 * - What is in a live region when it first renders is not announced, so the history stays
 *   quiet on load. A NEW region per conversation: the host keys it (or renders it in the
 *   conversation's own route), otherwise swapping conversations reads every message.
 * - `streaming`: a reply still arriving is drawn AFTER the log and hidden from assistive tech
 *   (`aria-hidden`), so the log does not speak it token by token; the host shows
 *   `ChatTypingIndicator kind="replying"` meanwhile, and on the last token adds the finished
 *   message to `messages`: one new `<li>`, announced once.
 */
export const messageListVariants = tv({
  slots: {
    // `overflow-y: auto` clips sideways too (CSS computes `overflow-x` to `auto`), which cut the
    // avatars' presence ring (2px outline + 2px offset, `appbar` size) at the pane's edge (owner,
    // 2026-11-25). 4px of inline padding, given back by a negative margin: the messages stay where
    // they were, the ring has room. Same for the message menu's focus ring at the end.
    scroller: [
      "flex min-h-0 flex-1 flex-col-reverse overflow-y-auto",
      "-mx-1 px-1",
    ],
    list: "flex flex-col pb-2",
  },
});

export type MessageListProps = Omit<PropsOf<"div">, "children"> & {
  messages: ChatMessage[];
  /** The log's name ("Messages with Sean Perez"). */
  label: string;
  /** A reply still arriving (see above); `null` / absent = none. */
  streaming?: ChatMessage | null;
  labels?: Partial<ChatLabels>;
  /** Each message gets an actions menu with Delete (`ChatMessageBubble onDelete$`). */
  onDelete$?: QRL<(id: string) => void>;
  /** Day headings' level; default 3. */
  dayHeadingLevel?: 2 | 3 | 4 | 5 | 6;
  locale?: string;
  timeZone?: string;
};

export const MessageList = component$<MessageListProps>(
  ({
    messages,
    label,
    streaming,
    labels,
    onDelete$,
    dayHeadingLevel = 3,
    locale = CHAT_LOCALE,
    timeZone = CHAT_TIME_ZONE,
    class: className,
    ...rest
  }) => {
    const s = messageListVariants();
    const last = messages[messages.length - 1];
    // The viewer's last message carries the status line (Google Chat shows one receipt, not
    // one per message); a failed one keeps "Not sent" wherever it is (the bubble decides).
    let lastMine = -1;
    messages.forEach((m, i) => {
      if (m.mine) lastMine = i;
    });
    return (
      <div {...rest} data-chat-transcript="" class={[s.scroller(), className]}>
        {/* column-reverse: this one child sits at the scroller's end. */}
        <div>
          <div role="log" aria-live="polite" aria-label={label}>
            <ol class={s.list()}>
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const newDay =
                  !prev ||
                  dayKey(prev.createdAt, timeZone) !==
                    dayKey(m.createdAt, timeZone);
                return [
                  newDay && (
                    <ChatDaySeparator
                      key={`day-${dayKey(m.createdAt, timeZone)}`}
                      date={m.createdAt}
                      headingLevel={dayHeadingLevel}
                      locale={locale}
                      timeZone={timeZone}
                    />
                  ),
                  <ChatMessageBubble
                    key={m.id}
                    message={m}
                    groupStart={newDay || startsGroup(prev, m)}
                    showStatus={i === lastMine}
                    onDelete$={onDelete$}
                    labels={labels}
                    locale={locale}
                    timeZone={timeZone}
                  />,
                ];
              })}
            </ol>
          </div>
          {streaming && (
            <ChatMessageBubble
              as="div"
              aria-hidden="true"
              message={{ ...streaming, streaming: true }}
              groupStart={!last || startsGroup(last, streaming)}
              labels={labels}
              locale={locale}
              timeZone={timeZone}
            />
          )}
        </div>
      </div>
    );
  },
);
