import { component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";

/**
 * Prefix or suffix text ("$", ".com"). From e-store's `components/text-field/text-field-affix.tsx`
 * (2026-11-23). Shown with the input text: while the field is focused or holds text, hidden while
 * the label rests over it. `on-surface-variant` (material-web `input-text-prefix-color` /
 * `-suffix-color`), 2dp from the text.
 *
 * Changed from e-store: filled takes the input's own padding (24dp top) so the affix sits on the
 * input's text line (e-store: `items-end pb-2`, the same line by another route); reduced motion
 * turns the fade off.
 */
export const textFieldAffixVariants = tv({
  base: [
    "pointer-events-none",
    "row-start-1",
    "flex",
    "items-center",
    "whitespace-nowrap",
    "select-none",
    "text-body-large",
    "text-on-surface-variant",
    "group-has-disabled/text-field:text-on-surface/38",
    "transition-opacity",
    "duration-spring-fast-effects",
    "ease-spring-fast-effects",
    "motion-reduce:transition-none",
  ],
  variants: {
    type: {
      prefix: "col-start-2 pe-0.5",
      suffix: "col-start-4 ps-0.5",
    },
    variant: {
      outlined: "",
      filled: "",
      plain: "",
      tonal: "",
    },
    /**
     * Hidden while the resting label covers its place, shown with the input text. Without a label
     * always shown (second agent's review; e-store hid it then too).
     */
    labelled: {
      true: [
        "opacity-0",
        "group-focus-within/text-field:opacity-100",
        "group-has-[[data-qds-text-field-input]:not(:placeholder-shown)]/text-field:opacity-100",
      ],
      false: "",
    },
  },
  compoundVariants: [
    // Filled without a label: the input is centred (`py-4`), so is the affix.
    { variant: "filled", labelled: true, class: "pt-6 pb-2" },
    { variant: "filled", labelled: false, class: "py-4" },
  ],
  defaultVariants: { variant: "outlined", labelled: true },
});

export type TextFieldAffixProps = PropsOf<"span"> &
  VariantProps<typeof textFieldAffixVariants> & { text: string };

export const TextFieldAffix = component$<TextFieldAffixProps>(
  ({ text, type, variant, labelled, class: className, ...rest }) => (
    <span
      {...rest}
      data-qds-text-field-affix={type}
      class={[textFieldAffixVariants({ type, variant, labelled }), className]}
    >
      {text}
    </span>
  ),
);
