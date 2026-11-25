import {
  $,
  component$,
  useId,
  useSignal,
  useVisibleTask$,
  type NoSerialize,
  type QRL,
} from "@qwik.dev/core";
import {
  IconButton,
  TitleBar,
  closeAnimated,
  openPopover,
  type IconName,
} from "@seanperez/ui";
import { tv } from "tailwind-variants/lite";
import { chatLabels, fillLabel, type ChatLabels } from "../../labels";
import type { ChatMessage, ChatPerson } from "../../types";
import { ChatAvatar } from "../conversation-item/conversation-item";
import { MessageComposer } from "../message-composer/message-composer";
import { MessageList } from "../message-list/message-list";
import { ChatTypingIndicator } from "../typing-indicator/typing-indicator";

/**
 * The floating Messages window (Gmail's / Google Chat's pop-up chat): docked at the window's
 * bottom end, a `TitleBar` (avatar, name, actions), the transcript and the composer. NON-MODAL:
 * the page behind stays usable. See `messages-window.md` for the proof and the second agent's
 * review.
 *
 * - A `<section popover="manual" role="dialog">` in the top layer (rule L18: non-modal overlays
 *   are popovers; no z-index over the scaffold). `manual`: no light dismiss, and another popover
 *   opening does not close it (MDN Popover API). Not a `<dialog>`: as a popover it would only
 *   add the `dialog` role, and its `close()` / `cancel` do nothing without `open` (HTML spec);
 *   e-store's compose window is a `<dialog popover="manual">`.
 * - Opened by `openPopover` on mount, closed by `closeAnimated` then `hidePopover()` (rule L26),
 *   then `onClose$` (the host unmounts it). Escape inside it closes it. Focus moves to the
 *   composer on open and back to the opener on close (WAI-ARIA APG dialog pattern).
 * - Minimize keeps the title bar only (Gmail); the body is `hidden` (nothing in it is a Tab stop)
 *   but stays mounted, so the draft is kept. The button is a disclosure: a stable name,
 *   `aria-expanded`, `aria-controls` the body (APG Disclosure).
 * - Mount it on the client only (the host renders it after a click): it renders nothing useful
 *   on the server, and a closed popover never becomes visible, so its task runs on
 *   `document-ready`.
 */
export const messagesWindowVariants = tv({
  slots: {
    root: [
      // Undo the UA popover box; fixed to the bottom END (logical: right in LTR, left in RTL).
      "fixed",
      "inset-auto",
      "bottom-0",
      "inset-e-6",
      "m-0",
      "border-0",
      "p-0",
      "overflow-hidden",
      "flex-col",
      "open:flex",
      "rounded-t-lg",
      "bg-surface",
      "text-on-surface",
      "shadow-3",
      // Gmail's chat window size, never past the viewport.
      "w-[min(22.5rem,calc(100vw-3rem))]",
      "h-[min(30rem,calc(100dvh-5rem))]",
      // Minimized: the title bar only, narrower (Gmail).
      "data-minimized:h-10",
      "data-minimized:w-[min(16rem,calc(100vw-3rem))]",
      // Under 600px the host opens the full Messages page instead; a window left open while the
      // viewport narrows spans it, edge to edge.
      "max-sm:inset-x-0",
      "max-sm:w-auto",
      "max-sm:data-minimized:w-auto",
      // Motion (`messages-window.md` "Motion"): enters the screen from its bottom edge, M3
      // bottom-sheet pair: 400ms Emphasized decelerate in, 200ms Emphasized accelerate out.
      // Enter: `@starting-style`. Exit: `data-closing` while still open (`closeAnimated`).
      // Only the vertical axis moves: nothing to mirror in RTL.
      "transition-[opacity,translate,height,width]",
      "duration-medium-4",
      "ease-emphasized-decelerate",
      "translate-y-0",
      "opacity-100",
      "starting:open:translate-y-6",
      "starting:open:opacity-0",
      "open:data-closing:translate-y-6",
      "open:data-closing:opacity-0",
      "open:data-closing:duration-short-4",
      "open:data-closing:ease-emphasized-accelerate",
      "motion-reduce:transition-none",
    ],
    body: "flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3",
  },
});

export interface MessagesWindowProps {
  /** Who the conversation is with (the title bar's avatar). */
  person: ChatPerson;
  /** The window's title (the person's or the space's name). */
  title: string;
  messages: ChatMessage[];
  /** A reply still arriving (`MessageList streaming`). */
  streaming?: ChatMessage | null;
  /** Who is typing or replying; none = nothing shows. */
  typingName?: string | null;
  typingKind?: "typing" | "replying";
  /** Each message's Delete action (`MessageList onDelete$`); the host confirms and deletes. */
  onDelete$?: QRL<(id: string) => void>;
  /** The host's send (`MessageComposer onSend$`). */
  onSend$: QRL<(text: string) => boolean | void | Promise<boolean | void>>;
  /** Called after the exit animation; the host unmounts the window. */
  onClose$: QRL<() => void>;
  /** The conversation's full page; shows the "Open in Messages" link. */
  openFullHref?: string;
  /** Shows the video call button; the host decides what a call is. */
  onVideoCall$?: QRL<(el: HTMLElement) => void>;
  /** What focus returns to on close; default the element focused when the window opened. */
  opener?: NoSerialize<HTMLElement>;
  composerPlaceholder?: string;
  minimizeIcon?: IconName;
  restoreIcon?: IconName;
  openFullIcon?: IconName;
  closeIcon?: IconName;
  videoCallIcon?: IconName;
  labels?: Partial<ChatLabels>;
}

export const MessagesWindow = component$<MessagesWindowProps>(
  ({
    person,
    title,
    messages,
    streaming,
    typingName,
    typingKind = "typing",
    onSend$,
    onDelete$,
    onClose$,
    openFullHref,
    onVideoCall$,
    opener,
    composerPlaceholder,
    minimizeIcon = "minimize",
    restoreIcon = "expand_less",
    openFullIcon = "open_in_full",
    closeIcon = "close",
    videoCallIcon = "videocam",
    labels,
  }) => {
    const L = chatLabels(labels);
    const s = messagesWindowVariants();
    const id = useId();
    const headingId = `${id}-title`;
    const bodyId = `${id}-body`;
    const composerId = `${id}-composer`;
    const rootRef = useSignal<HTMLElement>();
    const minimized = useSignal(false);
    // The element to return focus to (APG dialog: back to what opened it).
    const returnTo = useSignal<NoSerialize<HTMLElement>>(opener);

    /** Focus back on the opener, unless the visitor has moved on (never steal focus). */
    const restoreFocus = $((hadFocus: boolean) => {
      const active = document.activeElement;
      const lost = hadFocus || !active || active === document.body;
      const to = returnTo.value;
      if (lost && to?.isConnected) to.focus();
    });

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(
      ({ cleanup }) => {
        const el = rootRef.value;
        if (!el) return;
        if (!returnTo.value) {
          const active = document.activeElement;
          if (active instanceof HTMLElement && !el.contains(active))
            returnTo.value = active as NoSerialize<HTMLElement>;
        }
        if (openPopover(el))
          document.getElementById(composerId)?.focus({ preventScroll: true });
        cleanup(() => {
          // Unmounted by the host without our close (another conversation, a navigation).
          const hadFocus = el.contains(document.activeElement);
          if (el.matches(":popover-open")) el.hidePopover();
          restoreFocus(hadFocus);
        });
      },
      { strategy: "document-ready" },
    );

    const close$ = $(async () => {
      const el = rootRef.value;
      if (!el) return;
      const hadFocus = el.contains(document.activeElement);
      const hid = await closeAnimated(el, () => {
        if (el.matches(":popover-open")) el.hidePopover();
      });
      if (!hid) return;
      await restoreFocus(hadFocus);
      await onClose$();
    });

    return (
      <section
        ref={rootRef}
        popover="manual"
        role="dialog"
        aria-labelledby={headingId}
        data-messages-window=""
        data-minimized={minimized.value ? "" : undefined}
        class={s.root()}
        onKeyDown$={(e: KeyboardEvent) => {
          // An inner control that used Escape marks it handled. A menu (a message's actions,
          // 2026-11-25) does not: its popover closes on the browser's own Escape, so a key from
          // inside one is the menu's, not the window's.
          if (
            e.key === "Escape" &&
            !e.defaultPrevented &&
            !(e.target as Element | null)?.closest?.('[role="menu"]')
          )
            close$();
        }}
      >
        <TitleBar title={title} headingId={headingId} size="sm" tone="container">
          <ChatAvatar q:slot="leading" person={person} size="xs" />
          {onVideoCall$ && (
            <IconButton
              q:slot="trailing"
              size="xs"
              icon={videoCallIcon}
              label={L.videoCall}
              onClick$={(_: Event, el: HTMLElement) => onVideoCall$(el)}
            />
          )}
          <IconButton
            q:slot="trailing"
            size="xs"
            icon={minimized.value ? restoreIcon : minimizeIcon}
            label={L.windowMinimize}
            aria-expanded={minimized.value ? "false" : "true"}
            aria-controls={bodyId}
            onClick$={() => {
              minimized.value = !minimized.value;
            }}
          />
          {openFullHref && (
            <IconButton
              q:slot="trailing"
              size="xs"
              type="link"
              href={openFullHref}
              icon={openFullIcon}
              label={L.windowOpenFull}
            />
          )}
          <IconButton
            q:slot="trailing"
            size="xs"
            icon={closeIcon}
            label={L.windowClose}
            onClick$={close$}
          />
        </TitleBar>
        <div id={bodyId} class={s.body()} hidden={minimized.value}>
          <MessageList
            messages={messages}
            streaming={streaming}
            label={fillLabel(L.transcriptLabel, { name: title })}
            onDelete$={onDelete$}
            labels={labels}
          />
          <ChatTypingIndicator
            name={typingName}
            kind={typingKind}
            labels={labels}
          />
          <MessageComposer
            id={composerId}
            onSend$={onSend$}
            placeholder={composerPlaceholder}
            labels={labels}
          />
        </div>
      </section>
    );
  },
);
