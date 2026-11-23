import { Slot, component$ } from "@qwik.dev/core";
import type { PropsOf, QRL } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 common buttons.
 * Specs: https://m3.material.io/components/buttons/specs
 *
 * 40px high, fully rounded, label-large. The state layer is the `before` pseudo-element: the
 * content colour over the container at the M3 state opacity.
 */
export const buttonVariants = tv({
  base: [
    // Layout
    "relative",
    "inline-flex",
    "h-10",
    "shrink-0",
    "items-center",
    "justify-center",
    "gap-2",
    "px-6",
    "rounded-full",
    "text-label-large",
    "cursor-pointer",
    "select-none",
    // Motion
    "transition-[background-color,box-shadow]",
    "duration-short-4",
    "ease-standard",
    // State layer
    "before:absolute",
    "before:inset-0",
    "before:rounded-[inherit]",
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
  variants: {
    look: {
      filled: [
        "bg-primary",
        "text-on-primary",
        "before:bg-on-primary",
        "disabled:bg-on-surface/12",
      ],
      tonal: [
        "bg-secondary-container",
        "text-on-secondary-container",
        "before:bg-on-secondary-container",
        "disabled:bg-on-surface/12",
      ],
      elevated: [
        "bg-surface-container-low",
        "text-primary",
        "shadow-1",
        "hover:shadow-2",
        "active:shadow-1",
        "before:bg-primary",
        "disabled:bg-on-surface/12",
        "disabled:shadow-none",
      ],
      // The outline is an inset ring, not a border, as in Material 3.
      outlined: [
        "bg-transparent",
        "text-primary",
        "inset-ring",
        "inset-ring-outline",
        "before:bg-primary",
        "disabled:inset-ring-on-surface/12",
      ],
      text: ["bg-transparent", "px-3", "text-primary", "before:bg-primary"],
    },
  },
  defaultVariants: { look: "filled" },
});

export type ButtonLook = keyof typeof buttonVariants.variants.look;

export const buttonLooks = Object.keys(
  buttonVariants.variants.look,
) as ButtonLook[];

export type ButtonProps = Omit<PropsOf<"button">, "onClick$"> & {
  /** Named, and passed on by name: a handler is never left to the `...rest` spread. */
  onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
  /** The button's text. Children, if any, go after it. */
  label?: string;
  /** The Material 3 button kind. Defaults to "filled". */
  look?: ButtonLook;
  /** An icon before the label. */
  leadingIcon?: IconName;
};

/** A Material 3 common button. */
export const Button = component$<ButtonProps>(
  ({
    label,
    look,
    leadingIcon,
    type = "button",
    class: className,
    onClick$,
    ...rest
  }) => {
    return (
      <button
        {...rest}
        type={type}
        class={[buttonVariants({ look }), className]}
        onClick$={onClick$}
      >
        {leadingIcon && <Icon name={leadingIcon} size="sm" />}
        {label}
        <Slot />
      </button>
    );
  },
);
