import { component$ } from "@qwik.dev/core";
import type { PropsOf, QRL } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 standard icon button.
 * Specs: https://m3.material.io/components/icon-buttons/specs
 *
 * 40px round container, 24px icon in on-surface-variant, with the same state layer as Button.
 */
export const iconButtonVariants = tv({
  base: [
    // Layout
    "relative",
    "inline-flex",
    "size-10",
    "shrink-0",
    "items-center",
    "justify-center",
    "rounded-full",
    "text-on-surface-variant",
    "cursor-pointer",
    // State layer
    "before:absolute",
    "before:inset-0",
    "before:rounded-[inherit]",
    "before:bg-on-surface-variant",
    "before:opacity-0",
    "before:transition-opacity",
    "before:pointer-events-none",
    "before:content-['']",
    "hover:before:opacity-(--opacity-hover)",
    "focus-visible:before:opacity-(--opacity-focus)",
    "active:before:opacity-(--opacity-pressed)",
    // Focus ring
    "focus-visible:outline-2",
    "focus-visible:outline-offset-2",
    "focus-visible:outline-secondary",
    // Disabled
    "disabled:pointer-events-none",
    "disabled:text-on-surface/38",
  ],
});

export type IconButtonProps = Omit<
  PropsOf<"button">,
  "children" | "onClick$"
> & {
  /** Named, and passed on by name: a handler is never left to the `...rest` spread. */
  onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
  icon: IconName;
  /** What the button does: its name for screen readers and its hover title. */
  label: string;
};

/** A Material 3 standard icon button. */
export const IconButton = component$<IconButtonProps>(
  ({ icon, label, type = "button", class: className, onClick$, ...rest }) => {
    return (
      <button
        {...rest}
        type={type}
        aria-label={label}
        title={label}
        class={[iconButtonVariants(), className]}
        onClick$={onClick$}
      >
        <Icon name={icon} />
      </button>
    );
  },
);
