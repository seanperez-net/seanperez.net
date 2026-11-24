import { component$, useContext } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { filesContextId } from "./files-context";

/**
 * The field's label, always floated (the zone is never empty: it holds the prompt or the files).
 * From e-store's `components/files-input/files-label.tsx` (2026-11-23). Placed as TextField's
 * floated label: body-small, outlined on the outline 12dp from the start with 4dp padding on a
 * patch of `--field-bg`, filled 8dp from the top and 16dp from the start.
 *
 * Changed from e-store (PROOFED 2026-11-23 against material-web
 * `_md-comp-{outlined,filled}-text-field.scss`, as TextField): hover turns it `on-surface` on
 * outlined only; an invalid field's label goes `on-error-container` on hover and stays `error` on
 * focus; logical insets (e-store `ml-3`); the `--field-bg` patch is a class, not an inline style;
 * the `withLeadingIcon` margin is left out (no part draws a leading icon).
 */
export const filesInputLabelVariants = tv({
  base: [
    "pointer-events-none",
    "absolute",
    "z-20",
    "max-w-[calc(100%-2rem)]",
    "truncate",
    "select-none",
    "text-body-small",
    "text-on-surface-variant",
    "transition-colors",
    "duration-spring-fast-effects",
    "ease-spring-fast-effects",
    "motion-reduce:transition-none",
    "group-focus-within/files:text-primary",
    "group-data-dragging/files:text-primary",
    "group-has-aria-invalid/files:text-error",
    "group-has-aria-invalid/files:group-hover/files:text-on-error-container",
    "group-has-aria-invalid/files:group-focus-within/files:text-error",
    "group-has-aria-invalid/files:group-focus-within/files:group-hover/files:text-error",
    "group-has-disabled/files:text-on-surface/38",
    "group-has-disabled/files:group-hover/files:text-on-surface/38",
  ],
  variants: {
    variant: {
      outlined: [
        "-top-2",
        "inset-s-3",
        "rounded-full",
        "px-1",
        "bg-(--field-bg,var(--color-surface))",
        "group-not-focus-within/files:group-hover/files:text-on-surface",
      ],
      filled: ["top-2", "inset-s-4"],
    },
  },
  defaultVariants: { variant: "outlined" },
});

export const FilesLabel = component$(() => {
  const ctx = useContext(filesContextId);
  if (!ctx.label) return null;
  return (
    <label
      for={ctx.id}
      data-qds-files-label=""
      class={filesInputLabelVariants({ variant: ctx.variant })}
    >
      {ctx.label}
      {/* The input carries `required`; the star is for the eye only. */}
      {ctx.required && <span aria-hidden="true">*</span>}
    </label>
  );
});
