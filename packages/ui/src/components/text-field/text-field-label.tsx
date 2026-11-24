import { component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";

/**
 * The floating label. From e-store's `components/text-field/text-field-label.tsx` (2026-11-23).
 *
 * It rests over the empty input (body-large, centred on the 56dp container's first line) and
 * floats (body-small) while the input is focused or holds text: outlined onto the outline, at
 * 16dp from the start, on a patch of `--field-bg`; filled 8dp from the top. Driven by the input's
 * state through `peer-*` (`:focus`, `:placeholder-shown`): no JavaScript.
 *
 * Changed from e-store (PROOFED 2026-11-23 against material-web
 * `_md-comp-{outlined,filled}-text-field.scss`): hover turns the label `on-surface` on outlined
 * only (filled `hover-label-text-color` is `on-surface-variant`); hover over an invalid field
 * turns it `on-error-container`; a focused invalid field keeps `error`. Logical insets
 * (`inset-s-*`) instead of `ml-*`, and no transition under `prefers-reduced-motion`.
 */
export const textFieldLabelVariants = tv({
  base: [
    "pointer-events-none",
    "absolute",
    "top-7",
    "-translate-y-1/2",
    "max-w-[calc(100%-2rem)]",
    "truncate",
    "select-none",
    "text-body-large",
    "text-on-surface-variant",
    "transition-all",
    "duration-spring-fast",
    "ease-spring-fast-spatial",
    "motion-reduce:transition-none",
    "peer-focus:translate-y-0",
    "peer-focus:text-body-small",
    "peer-focus:text-primary",
    "peer-not-placeholder-shown:translate-y-0",
    "peer-not-placeholder-shown:text-body-small",
    "peer-aria-invalid:text-error",
    "peer-aria-invalid:group-hover/text-field:text-on-error-container",
    "peer-aria-invalid:peer-focus:text-error",
    "peer-aria-invalid:peer-focus:group-hover/text-field:text-error",
    "peer-disabled:text-on-surface/38",
    "peer-disabled:group-hover/text-field:text-on-surface/38",
  ],
  variants: {
    variant: {
      outlined: [
        "rounded-full",
        "group-hover/text-field:text-on-surface",
        "peer-focus:group-hover/text-field:text-primary",
        "peer-focus:-top-2",
        "peer-focus:inset-s-3",
        "peer-focus:px-1",
        "peer-focus:bg-(--field-bg,var(--color-surface))",
        "peer-not-placeholder-shown:-top-2",
        "peer-not-placeholder-shown:inset-s-3",
        "peer-not-placeholder-shown:px-1",
        "peer-not-placeholder-shown:bg-(--field-bg,var(--color-surface))",
      ],
      filled: ["peer-focus:top-2", "peer-not-placeholder-shown:top-2"],
      // e-store's: no floating label (`TextField` names the input with `aria-label` instead).
      plain: "hidden",
      tonal: "hidden",
    },
    margin: {
      default: "inset-s-4",
      withLeadingIcon: "inset-s-13",
    },
  },
  defaultVariants: { variant: "outlined", margin: "default" },
});

export type TextFieldLabelProps = PropsOf<"label"> &
  VariantProps<typeof textFieldLabelVariants> & {
    label?: string;
    required?: boolean;
    hasLeadingIcon?: boolean;
  };

export const TextFieldLabel = component$<TextFieldLabelProps>(
  ({ label, required, hasLeadingIcon, variant, class: className, ...rest }) => {
    if (!label) return null;
    return (
      <label
        {...rest}
        data-qds-text-field-label=""
        class={[
          textFieldLabelVariants({
            variant,
            margin: hasLeadingIcon ? "withLeadingIcon" : "default",
          }),
          className,
        ]}
      >
        {label}
        {/* The input carries `required`; the star is for the eye only. */}
        {required && <span aria-hidden="true">*</span>}
      </label>
    );
  },
);
