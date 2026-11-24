import { Slot, component$, sync$ } from "@qwik.dev/core";
import type { PropsOf, QRL } from "@qwik.dev/core";

/**
 * A native `<label>` that does not select its own text on a double-click. From e-store's
 * `components/label/label.tsx` (2026-11-23).
 *
 * Changed from e-store:
 * - A plain `<label>`, not e-store's `Render` (polymorphic `as`), which this library has not
 *   ported (see `.claude/notes/port-foundations-2026-11-23.md`).
 * - The skip for form controls is inside the `sync$`. e-store checked it in a second, async `$()`
 *   that returned either way (dead code), so a double-click on a word in an input wrapped by the
 *   label could not select that word.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label
 */
export type LabelProps = Omit<PropsOf<"label">, "onMouseDown$"> & {
  onMouseDown$?: QRL<(event: MouseEvent, element: HTMLLabelElement) => void>;
};

/** Double-click (and more) on the label text: no text selection. Controls inside are left alone. */
const preventTextSelection = sync$((event: MouseEvent) => {
  if (event.defaultPrevented || event.detail < 2) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest?.("button, input, select, textarea")) return;
  event.preventDefault();
});

export const Label = component$<LabelProps>(({ onMouseDown$, ...rest }) => (
  <label
    {...rest}
    data-qds-label=""
    onMouseDown$={[preventTextSelection, onMouseDown$]}
  >
    <Slot />
  </label>
));
