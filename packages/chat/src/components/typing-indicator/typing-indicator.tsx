import { component$, type PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { chatLabels, fillLabel, type ChatLabels } from "../../labels";

/**
 * "Sean is typing…" (or "Assistant is replying…") under the transcript. e-store's typing line
 * (`chat-workspace.tsx`: an `aria-live="polite"` paragraph, always rendered so the live region
 * exists before its text does), plus three dots beside the words (new). The words are the
 * status; the dots are decorative and stop under reduced motion.
 */
export const typingIndicatorVariants = tv({
  slots: {
    root: "flex min-h-5 items-center gap-2 text-body-small text-on-surface-variant",
    dots: "inline-flex items-center gap-0.5",
    dot: "size-1.5 rounded-full bg-current animate-bounce motion-reduce:animate-none",
  },
});

export type ChatTypingIndicatorProps = Omit<PropsOf<"p">, "children"> & {
  /** Who is typing; nothing shows (and nothing is announced) without it. */
  name?: string | null;
  /** `typing` (a person) or `replying` (an assistant streaming its answer). */
  kind?: "typing" | "replying";
  labels?: Partial<ChatLabels>;
};

export const ChatTypingIndicator = component$<ChatTypingIndicatorProps>(
  ({ name, kind = "typing", labels, class: className, ...rest }) => {
    const L = chatLabels(labels);
    const s = typingIndicatorVariants();
    return (
      <p
        {...rest}
        role="status"
        aria-live="polite"
        data-chat-typing={name ? kind : undefined}
        class={[s.root(), className]}
      >
        {name && (
          <>
            <span aria-hidden="true" class={s.dots()}>
              <span class={s.dot()} />
              <span class={[s.dot(), "[animation-delay:150ms]"]} />
              <span class={[s.dot(), "[animation-delay:300ms]"]} />
            </span>
            {fillLabel(kind === "replying" ? L.isReplying : L.isTyping, {
              name,
            })}
          </>
        )}
      </p>
    );
  },
);
