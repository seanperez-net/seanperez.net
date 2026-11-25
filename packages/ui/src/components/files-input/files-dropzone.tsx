import { Slot, component$, useContext } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { filesContextId } from "./files-context";

/**
 * The drop zone: the field's container, under the transparent `Files.Input`. From e-store's
 * `components/files-input/files-dropzone.tsx` (2026-11-23), outlined and filled.
 *
 * Colors, widths and the filled state layer are TextField's (material-web
 * `tokens/versions/v0_192/_md-comp-{outlined,filled}-text-field.scss`): outlined 1dp `outline`,
 * hover `on-surface`, focus 3dp `primary`, error `error` (hover `on-error-container`), disabled
 * `on-surface` 12%; filled `surface-container-highest`, a 1dp `on-surface-variant` line (3dp
 * `primary` on focus), the `on-surface` 8% hover layer, disabled container `on-surface` 4% and
 * line 38%.
 *
 * Changed from e-store:
 * - A `<div>`, not a `<label>`: a label's content model is phrasing content with no labelable
 *   descendant other than its control (HTML), and the zone holds `<div>`s, a list and remove
 *   buttons. The input covers the zone, so a click still opens the picker; the name comes from
 *   `Files.Label`.
 * - The outline is a 1dp dashed `outline` (the text-field width; dashed marks a drop target,
 *   HOUSE: no M3 token), not a 2dp `::before` border; e-store's 38% disabled outline, unstyled
 *   filled line color and missing hover layer follow the tokens above.
 * - `data-dragging` on Root (a drag with files over the zone): the focus look plus the hover layer
 *   (HOUSE: M3 has no drop-target state).
 * - Reduced motion turns the transitions off; logical utilities.
 */
export const filesDropZoneVariants = tv({
  base: [
    "relative",
    "flex",
    "min-h-40",
    "w-full",
    "flex-col",
    "items-center",
    "justify-center",
    "pt-6",
    "pb-4",
    "text-on-surface-variant",
    "group-has-disabled/files:text-on-surface/38",
    // The state layer: hover (8%) and a drag over the zone.
    "after:pointer-events-none",
    "after:absolute",
    "after:inset-0",
    "after:rounded-[inherit]",
    "after:bg-on-surface",
    "after:opacity-0",
    "after:transition-opacity",
    "after:duration-spring-fast-effects",
    "motion-reduce:after:transition-none",
    "group-data-dragging/files:after:opacity-8",
  ],
  variants: {
    variant: {
      outlined: [
        "rounded-xs",
        "outline-1",
        "outline-dashed",
        "-outline-offset-1",
        "outline-outline",
        "transition-[outline-color,outline-width,outline-offset]",
        "duration-spring-fast-effects",
        "ease-spring-fast-effects",
        "motion-reduce:transition-none",
        "group-not-focus-within/files:group-hover/files:outline-on-surface",
        "group-focus-within/files:outline-3",
        "group-focus-within/files:-outline-offset-3",
        "group-focus-within/files:outline-primary",
        "group-data-dragging/files:outline-3",
        "group-data-dragging/files:-outline-offset-3",
        "group-data-dragging/files:outline-primary",
        "group-has-aria-invalid/files:outline-error",
        "group-has-aria-invalid/files:group-not-focus-within/files:group-hover/files:outline-on-error-container",
        "group-has-disabled/files:outline-on-surface/12",
        "group-has-disabled/files:group-hover/files:outline-on-surface/12",
      ],
      filled: [
        "rounded-xs-top",
        "bg-surface-container-highest",
        "group-has-disabled/files:bg-on-surface/4",
        "group-hover/files:after:opacity-8",
        "group-has-disabled/files:group-hover/files:after:opacity-0",
        // The active indicator: 1dp `on-surface-variant`, 3dp `primary` on focus.
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
        "group-not-focus-within/files:group-hover/files:before:border-on-surface",
        "group-focus-within/files:before:border-b-3",
        "group-focus-within/files:before:border-primary",
        "group-data-dragging/files:before:border-b-3",
        "group-data-dragging/files:before:border-primary",
        "group-has-aria-invalid/files:before:border-error",
        "group-has-aria-invalid/files:group-not-focus-within/files:group-hover/files:before:border-on-error-container",
        "group-has-disabled/files:before:border-on-surface/38",
        "group-has-disabled/files:group-hover/files:before:border-on-surface/38",
      ],
    },
  },
  defaultVariants: { variant: "outlined" },
});

export type FilesDropzoneProps = PropsOf<"div">;

export const FilesDropzone = component$<FilesDropzoneProps>(
  ({ class: className, ...rest }) => {
    const ctx = useContext(filesContextId);
    return (
      <div
        {...rest}
        data-qds-files-dropzone=""
        class={[filesDropZoneVariants({ variant: ctx.variant }), className]}
      >
        <Slot />
      </div>
    );
  },
);
