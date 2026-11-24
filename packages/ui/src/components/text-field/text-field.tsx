import { Slot, component$, useId } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { appendId } from "../../utils/aria-ids";
import type { IconName } from "../icon";
import { TextFieldAffix } from "./text-field-affix";
import { TextFieldIcon } from "./text-field-icon";
import { TextFieldInput } from "./text-field-input";
import type { TextFieldInputProps } from "./text-field-input";
import { TextFieldLabel } from "./text-field-label";
import { TextFieldSupportingText } from "./text-field-supporting-text";

/**
 * Material Design 3 text field, outlined (default) and filled. From e-store's
 * `components/text-field/text-field.tsx` (2026-11-23).
 * Specs: https://m3.material.io/components/text-fields/specs
 *
 * A five-track grid (leading icon | prefix | input | suffix | trailing icon), e-store's. Focus is
 * shown by the ACTIVE INDICATOR, not a focus ring: the outline (outlined) or the bottom line
 * (filled) goes 1 -> 3px `primary` (material-web overrides the 2px token to 3px,
 * `tokens/_md-comp-outlined-text-field.scss` "remove when focus tokens update to 3px").
 *
 * Changed from e-store (PROOFED 2026-11-23 against material-web
 * `tokens/versions/v0_192/_md-comp-{outlined,filled}-text-field.scss`):
 * - Disabled outlined outline is `on-surface` 12% (e-store 38%); disabled filled container is
 *   `on-surface` 4% and its line `on-surface` 38% (e-store: none / never applied, its selector read
 *   an `aria-disabled` no element carried).
 * - Filled: the resting line is `on-surface-variant` (e-store `outline`); hover paints the
 *   `on-surface` 8% state layer (e-store none).
 * - State lives in `:disabled` / `aria-invalid` on the input (read with `has-*`), not in
 *   `aria-disabled` / `aria-invalid` on the wrapper `<div>` (ARIA in HTML: a generic element takes
 *   neither; axe `aria-allowed-attr`).
 * - Reduced motion turns the outline and line transitions off.
 *
 * Added 2026-11-23 from e-store: `plain` (an underline, no container) and `tonal` (a
 * `surface-container` box with an inset `primary` ring on focus). Neither is an M3 text field
 * type (M3 has filled and outlined), so neither is PROOFED against M3; both hide the floating
 * label and name the input with `aria-label` (e-store's). `density="compact"`: a 36dp row with
 * the label inline before the input and no reserved supporting-text line (e-store's, Gmail's
 * compose rows), plus an `input-start` slot on the input's line (a recipient field's chips).
 * Left out: `ide` (a VS Code input, e-store's code editor) and `feel` (store.google.com).
 */
export const textFieldVariants = tv({
  base: [
    "relative",
    "grid",
    "w-full",
    "cursor-text",
    "text-start",
    "has-disabled:cursor-default",
  ],
  variants: {
    variant: {
      outlined: [
        "min-h-14",
        "rounded-xs",
        "outline",
        "outline-1",
        "-outline-offset-1",
        "outline-outline",
        "transition-[outline-color,outline-width,outline-offset]",
        "duration-spring-fast-effects",
        "ease-spring-fast-effects",
        "motion-reduce:transition-none",
        "not-focus-within:hover:outline-on-surface",
        "focus-within:outline-3",
        "focus-within:-outline-offset-3",
        "focus-within:outline-primary",
        "has-aria-invalid:outline-error",
        "has-aria-invalid:not-focus-within:hover:outline-on-error-container",
        "has-disabled:outline-on-surface/12",
        "has-disabled:hover:outline-on-surface/12",
      ],
      filled: [
        "min-h-14",
        "rounded-xs-top",
        "bg-surface-container-highest",
        "has-disabled:bg-on-surface/4",
        // The active indicator: 1px `on-surface-variant`, 3px `primary` on focus.
        "before:pointer-events-none",
        "before:absolute",
        "before:inset-x-0",
        "before:bottom-0",
        "before:border-b",
        "before:border-on-surface-variant",
        "before:transition-[border-color,border-width]",
        "before:duration-spring-fast-effects",
        "before:ease-spring-fast-effects",
        "motion-reduce:before:transition-none",
        "not-focus-within:hover:before:border-on-surface",
        "focus-within:before:border-b-3",
        "focus-within:before:border-primary",
        "has-aria-invalid:before:border-error",
        "has-aria-invalid:not-focus-within:hover:before:border-on-error-container",
        "has-disabled:before:border-on-surface/38",
        "has-disabled:hover:before:border-on-surface/38",
        // The hover state layer, `on-surface` 8%.
        "after:pointer-events-none",
        "after:absolute",
        "after:inset-0",
        "after:rounded-[inherit]",
        "after:bg-on-surface",
        "after:opacity-0",
        "after:transition-opacity",
        "after:duration-spring-fast-effects",
        "motion-reduce:after:transition-none",
        "hover:after:opacity-8",
        "has-disabled:hover:after:opacity-0",
      ],
      /*
       * e-store's: an underline only. 1px, hover `on-surface`, focus 2px `primary`, error `error`,
       * disabled 38%. Its colour at rest and its height follow `density` (compoundVariants).
       */
      plain: [
        "before:pointer-events-none",
        "before:absolute",
        "before:inset-x-0",
        "before:bottom-0",
        "before:border-b",
        "before:transition-[border-color,border-width]",
        "before:duration-spring-fast-effects",
        "before:ease-spring-fast-effects",
        "motion-reduce:before:transition-none",
        "not-focus-within:hover:before:border-on-surface",
        "focus-within:before:border-b-2",
        "focus-within:before:border-primary",
        "has-aria-invalid:before:border-error",
        "has-disabled:before:border-on-surface/38",
        "has-disabled:hover:before:border-on-surface/38",
      ],
      /*
       * e-store's: a `surface-container` box, 4dp corners, a 2px inset `primary` ring on focus,
       * `error-container` when invalid.
       */
      tonal: [
        "min-h-14",
        "rounded-xs",
        "bg-surface-container",
        "focus-within:ring-2",
        "focus-within:ring-inset",
        "focus-within:ring-primary",
        "has-aria-invalid:bg-error-container",
        "has-aria-invalid:focus-within:ring-error",
      ],
    },
    /**
     * `default`: 16dp start and end tracks. `compact` (e-store's): no start inset, so the text
     * lines up with what the field sits in, and a 36dp row.
     */
    density: {
      default:
        "grid-cols-[minmax(1rem,max-content)_minmax(auto,max-content)_1fr_minmax(auto,max-content)_minmax(1rem,max-content)]",
      compact:
        "grid-cols-[0_minmax(auto,max-content)_1fr_minmax(auto,max-content)_minmax(1rem,max-content)]",
    },
  },
  compoundVariants: [
    // e-store's: the plain line is `on-surface-variant` with a 56dp row, `outline-variant` compact.
    {
      variant: "plain",
      density: "default",
      class: "min-h-14 before:border-on-surface-variant",
    },
    {
      variant: "plain",
      density: "compact",
      class: "before:border-outline-variant",
    },
  ],
  defaultVariants: { variant: "outlined", density: "default" },
});

export type TextFieldProps = Omit<TextFieldInputProps, "labelled" | "invalid"> &
  VariantProps<typeof textFieldVariants> & {
    /** The floating label, and the input's accessible name. */
    label?: string;
    /** The line under the field. */
    supportingText?: string;
    /** An error message: replaces the supporting text and marks the input invalid. */
    error?: string;
    /** Text before the input ("$"). */
    prefixText?: string;
    /** Text after the input (".com"). */
    suffixText?: string;
    /** A Material Symbols name from `Icon`, before the input. */
    leadingIcon?: IconName;
    /** A Material Symbols name from `Icon`, after the input. */
    trailingIcon?: IconName;
    /** Classes for the OUTER wrapper (layout only: `flex-1`, `w-64`). */
    class?: string;
  };

/** The variants with no floating label: the input is named by `aria-label` instead. */
const UNLABELLED = new Set(["plain", "tonal"]);

export const TextField = component$<TextFieldProps>(
  ({
    variant = "outlined",
    density = "default",
    label,
    supportingText,
    error,
    prefixText,
    suffixText,
    leadingIcon,
    trailingIcon,
    required,
    disabled,
    id: idProp,
    class: className,
    "aria-describedby": describedBy,
    "aria-label": ariaLabel,
    ...inputProps
  }) => {
    // Unique per instance unless the caller passes `id` (e-store's: it was `name`, and two fields
    // with one name shared an id).
    const generatedId = useId();
    const fieldId = idProp ?? generatedId;
    const descriptionId = `${fieldId}-description`;
    const hasDescription = !!(error || supportingText);
    // A disabled field is not validated: its error keeps the disabled colours (M3 disabled tokens
    // win) and the input is not marked invalid.
    const invalid = !!error && !disabled;
    const compact = density === "compact";
    // `plain` / `tonal` show no label: it names the input directly (e-store's).
    const floating = !!label && !compact && !UNLABELLED.has(variant);
    const named = UNLABELLED.has(variant) && !compact;
    const input = (
      <TextFieldInput
        {...inputProps}
        id={fieldId}
        variant={variant}
        density={density}
        labelled={floating}
        aria-label={named ? (ariaLabel ?? label) : ariaLabel}
        required={required}
        disabled={disabled}
        invalid={invalid}
        // The caller's own description ids are kept.
        aria-describedby={
          hasDescription
            ? appendId(describedBy, descriptionId)
            : describedBy || undefined
        }
        aria-errormessage={invalid ? descriptionId : undefined}
      />
    );

    return (
      // `class` lands on this outer box, the one the parent lays out (e-store's).
      <div
        data-qds-text-field=""
        // M3 shows a text field's focus with its active indicator, not a ring.
        data-focus-indicator="active-indicator"
        class={["group/text-field", className]}
      >
        <div class={textFieldVariants({ variant, density })}>
          {leadingIcon && (
            <TextFieldIcon position="leading" name={leadingIcon} />
          )}
          {/* Compact: the label sits in the prefix track, so a compact field takes no prefix. */}
          {prefixText && !compact && (
            <TextFieldAffix
              type="prefix"
              variant={variant}
              labelled={floating}
              text={prefixText}
            />
          )}
          {compact && label && (
            <label
              for={fieldId}
              data-qds-text-field-inline-label=""
              class="col-start-2 row-start-1 self-center pe-2 text-body-medium whitespace-nowrap text-on-surface-variant group-has-disabled/text-field:text-on-surface/38"
            >
              {label}
              {required && <span aria-hidden="true">*</span>}
            </label>
          )}
          {compact ? (
            // e-store's `input-start` slot: chips on the input's line, before it; they wrap,
            // and the input takes the rest of the last line.
            <div
              data-qds-text-field-input-row=""
              class="col-start-3 row-start-1 flex min-w-0 flex-wrap items-center gap-x-1 [&>input]:w-auto [&>input]:min-w-24 [&>input]:flex-1"
            >
              <Slot name="input-start" />
              {input}
            </div>
          ) : (
            input
          )}
          {suffixText && (
            <TextFieldAffix
              type="suffix"
              variant={variant}
              labelled={floating}
              text={suffixText}
            />
          )}
          {trailingIcon && (
            <TextFieldIcon position="trailing" name={trailingIcon} />
          )}
          {/* After the input: it follows the input's state through `peer-*`. */}
          <TextFieldLabel
            label={floating ? label : undefined}
            required={required}
            variant={variant}
            for={fieldId}
            hasLeadingIcon={!!leadingIcon}
          />
        </div>
        {/* A compact row reserves no line while there is nothing to say (e-store's). */}
        {(!compact || hasDescription) && (
          <TextFieldSupportingText
            id={descriptionId}
            error={error}
            supportingText={supportingText}
          />
        )}
      </div>
    );
  },
);
