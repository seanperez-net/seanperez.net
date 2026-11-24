import { component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * A leading or trailing icon of a text field. From e-store's
 * `components/text-field/text-field-icon.tsx` (2026-11-23).
 *
 * Changed from e-store (PROOFED 2026-11-23 against material-web
 * `_md-comp-{outlined,filled}-text-field.scss` and m3.material.io/components/text-fields/specs):
 * - Takes an icon NAME (a CMS stores a string), not JSX.
 * - The trailing icon is always shown. e-store hid it until focus or input (`opacity-0`), which
 *   M3 does not do.
 * - Centred in the 56dp container in both variants (e-store bottom-aligned it in filled).
 * - Disabled is `on-surface` 38% off `:disabled` (e-store's `input:disabled` selector, kept).
 */
export const textFieldIconVariants = tv({
  base: [
    "row-start-1",
    // Decorative: a click goes through to the field (the input under it gets focus).
    "pointer-events-none",
    "flex",
    "items-center",
    "text-on-surface-variant",
    "group-has-disabled/text-field:text-on-surface/38",
  ],
  variants: {
    position: {
      // 12dp from the edge, 16dp to the text (M3).
      leading: "col-start-1 ps-3 pe-4",
      trailing: [
        "col-start-5 ps-4 pe-3",
        "group-has-aria-invalid/text-field:text-error",
        "group-has-aria-invalid/text-field:group-hover/text-field:text-on-error-container",
        "group-has-aria-invalid/text-field:group-focus-within/text-field:text-error",
      ],
    },
  },
});

export type TextFieldIconProps = PropsOf<"span"> & {
  position: "leading" | "trailing";
  name: IconName;
};

export const TextFieldIcon = component$<TextFieldIconProps>(
  ({ position, name, class: className, ...rest }) => (
    <span
      {...rest}
      data-qds-text-field-icon={position}
      class={[textFieldIconVariants({ position }), className]}
    >
      <Icon name={name} />
    </span>
  ),
);
