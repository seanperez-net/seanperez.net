import { $, component$, sync$, useSignal, type QRL } from "@qwik.dev/core";
import { IconButton, TextField, type IconName } from "@seanperez/ui";
import { tv } from "tailwind-variants/lite";
import { chatLabels, type ChatLabels } from "../../labels";

/** Lines the field grows to before it scrolls. */
const MAX_ROWS = 5;

export const messageComposerVariants = tv({
  slots: {
    // The send button sits on the field's 56dp line, not centred on field + supporting text.
    root: "flex items-start gap-2",
    field: "min-w-0 flex-1",
    // Read-only (2026-11-25): the note in the composer's place, readable at full contrast (a
    // disabled field's supporting text is on-surface 38%, too faint for the only explanation).
    note: [
      "rounded-md bg-surface-container px-4 py-4 text-body-medium text-on-surface-variant",
      "focus-ring",
    ],
  },
});

export interface MessageComposerProps {
  /**
   * Called with the text on Enter or the send button. The HOST decides what sending means (a
   * server action, a local echo, an assistant's stream): this is the seam for every backend.
   * Return `false` to keep the text in the field (not sent); anything else clears it.
   */
  onSend$: QRL<(text: string) => boolean | void | Promise<boolean | void>>;
  /** The textarea's id (a host focuses it after a user action, never on page load). */
  id?: string;
  /** The field's form name; default `message`. */
  name?: string;
  placeholder?: string;
  /** The line under the field; default the key hint. */
  hint?: string;
  disabled?: boolean;
  /**
   * A read-only conversation (2026-11-25, the Site updates channel, like a Discord announcement
   * channel): this NOTE replaces the field and the send button (say who posts and where from).
   * Nothing can be written or sent; `onSend$` is never called. The note takes `id`, with
   * `tabindex="-1"`, so a host that focuses the composer on opening a conversation lands on it.
   */
  readOnly?: string;
  sendIcon?: IconName;
  labels?: Partial<ChatLabels>;
}

/**
 * The composer: a multi-line field and a send icon button. From e-store's `MessageComposer`
 * (`message-composer.tsx`): Enter sends, Shift+Enter adds a line; the key is caught by a
 * `sync$` on the FORM (a lazy `$()` runs too late to stop the newline, Qwik rc.5 "sync$()
 * Synchronous Events") that calls `requestSubmit()`, so a key and a click take one path; the
 * submit reads the textarea, not the signal (a fast Enter can beat the last input handler).
 * The send button is `md` (56dp), the field's height (M3: a button beside a field). Left out:
 * mentions, threads, the store port, the typing hint to a server.
 *
 * Changed after the second agent's review (2026-11-24): an IME composition's Enter (Safari
 * reports `isComposing` false with `keyCode` 229) never sends; `enterkeyhint="send"`;
 * `autocomplete="off"` on the form (a message is not form history). The field grows with its
 * line breaks up to five rows (`rows` from the text; no library change).
 */
export const MessageComposer = component$<MessageComposerProps>(
  ({
    onSend$,
    id,
    name = "message",
    placeholder,
    hint,
    disabled = false,
    readOnly,
    sendIcon = "send",
    labels,
  }) => {
    const L = chatLabels(labels);
    const body = useSignal("");
    const busy = useSignal(false);
    const s = messageComposerVariants();

    const submit$ = $(async (_: Event, form: HTMLFormElement) => {
      const field = form.querySelector<HTMLTextAreaElement>(
        `textarea[name="${name}"]`,
      );
      const text = field?.value ?? "";
      if (busy.value || !text.trim()) return;
      busy.value = true;
      try {
        const kept = (await onSend$(text)) === false;
        if (!kept) {
          body.value = "";
          if (field) field.value = "";
        }
      } finally {
        busy.value = false;
      }
    });

    if (readOnly)
      return (
        <p
          id={id}
          tabIndex={-1}
          data-chat-composer="readonly"
          class={s.note()}
        >
          {readOnly}
        </p>
      );

    return (
      <form
        data-chat-composer=""
        aria-label={L.composerLabel}
        autocomplete="off"
        class={s.root()}
        preventdefault:submit
        onSubmit$={submit$}
        onKeyDown$={sync$((e: KeyboardEvent) => {
          const t = e.target as HTMLTextAreaElement;
          if (t.tagName !== "TEXTAREA" || e.key !== "Enter" || e.shiftKey)
            return;
          // An IME is committing text (Safari: `isComposing` false, `keyCode` 229).
          if (e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          t.form?.requestSubmit();
        })}
      >
        <TextField
          class={s.field()}
          type="textarea"
          id={id}
          name={name}
          rows={Math.min(MAX_ROWS, body.value.split("\n").length)}
          resize="none"
          aria-label={L.composerLabel}
          placeholder={placeholder ?? L.composerPlaceholder}
          supportingText={hint ?? L.composerHint}
          enterKeyHint="send"
          disabled={disabled}
          bind:value={body}
        />
        <IconButton
          type="submit"
          look="filled"
          size="md"
          icon={sendIcon}
          label={L.send}
          disabled={disabled || busy.value || !body.value.trim()}
        />
      </form>
    );
  },
);
