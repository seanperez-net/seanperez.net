import { component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";

/**
 * The line under a text field: supporting text, or the error that replaces it. From e-store's
 * `components/text-field/text-field-supporting-text.tsx` (2026-11-23). body-small,
 * `on-surface-variant`, `error` when the field is invalid, `on-surface` 38% when disabled;
 * 16dp from the sides and 4dp under the container (m3.material.io text-fields specs). The line is
 * reserved even when empty, so an error appearing does not move what is below.
 *
 * Changed from e-store: its `mt-.5` is not a Tailwind class (nothing was applied) and its
 * disabled color read `aria-disabled`, which no element in the field carries; this reads
 * `:disabled`.
 */
export type TextFieldSupportingTextProps = PropsOf<"div"> & {
  error?: string;
  supportingText?: string;
};

export const TextFieldSupportingText = component$<TextFieldSupportingTextProps>(
  ({ error, supportingText, class: className, ...rest }) => (
    <div
      {...rest}
      data-qds-text-field-supporting-text=""
      // An error that appears is announced (material-web sets role="alert" on it).
      aria-live="polite"
      class={[
        "min-h-5 px-4 pt-1 text-body-small text-on-surface-variant",
        "group-has-disabled/text-field:text-on-surface/38",
        "group-has-aria-invalid/text-field:text-error",
        className,
      ]}
    >
      {error || supportingText}
    </div>
  ),
);
