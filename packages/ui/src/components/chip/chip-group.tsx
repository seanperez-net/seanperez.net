import { Slot, component$, sync$ } from "@qwik.dev/core";
import type { PropsOf, QRL } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { rovingKeys } from "../../utils/roving-focus";

/**
 * A row of chips, from e-store's `components/chip/chip-group.tsx` (2026-11-23).
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ (one Tab stop, arrows between
 * chips) and https://m3.material.io/components/chips/accessibility (Backspace / Delete removes
 * the focused input chip).
 *
 * Changed from e-store (see chip.md "Where it differs"):
 * - No `useVisibleTask$`: e-store set the roving tabindex in an eager visible task (JavaScript
 *   on every page with chips, at load). Here the first `focusin` sets it, in a `sync$`.
 * - After a Backspace / Delete removal, focus is placed when the chip has actually left the DOM
 *   (a `MutationObserver`), not after a `setTimeout(0)` that can run before Qwik re-renders.
 * - `{...rest}` first, handlers composed by name.
 */
export const chipGroupVariants = tv({
  base: "flex gap-2",
  variants: {
    /** `wrap`: more rows. `scroll`: one row that scrolls sideways (a 4dp gutter keeps shadows). */
    overflow: {
      wrap: "flex-wrap",
      scroll: "-m-1 scrollbar-none flex-nowrap overflow-x-auto p-1",
    },
  },
  defaultVariants: { overflow: "wrap" },
});

export type ChipGroupProps = Omit<
  PropsOf<"div">,
  "role" | "onKeyDown$" | "onFocusIn$"
> & {
  /** The group's accessible name ("Filter by category"). */
  label?: string;
  /** Which arrows move between chips. */
  orientation?: "horizontal" | "vertical";
  overflow?: "wrap" | "scroll";
  onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLDivElement) => void>;
  onFocusIn$?: QRL<(event: FocusEvent, element: HTMLDivElement) => void>;
};

/** The focused chip keeps the group's one Tab stop; the other chips leave the Tab order. */
const rovingOnFocus = sync$((event: FocusEvent) => {
  // `target`, not `currentTarget`: with Qwik's document delegation that can be the document.
  const target = event.target as HTMLElement | null;
  const group = target?.closest?.(
    "[data-qds-chip-group]",
  ) as HTMLElement | null;
  if (!target || !group) return;
  const main = (chip: Element) =>
    (chip.tagName === "BUTTON"
      ? chip
      : chip.querySelector(
          "button:not([data-qds-chip-trailing])",
        )) as HTMLElement | null;
  const chips = Array.from(
    group.querySelectorAll(
      ":scope > [data-qds-chip]:not([aria-disabled='true'])",
    ),
  );
  const current = target.closest("[data-qds-chip]");
  if (!current || !chips.includes(current)) return;
  // The current chip's remove button (input chips) stays a Tab stop beside it; the other
  // chips' remove buttons leave the Tab order with their chips.
  for (const chip of chips) {
    const on = chip === current ? 0 : -1;
    const button = main(chip);
    if (button) button.tabIndex = on;
    const remove = chip.querySelector<HTMLElement>("[data-qds-chip-trailing]");
    if (remove) remove.tabIndex = on;
  }
});

/**
 * Backspace / Delete removes the focused input chip (M3 chips accessibility) and focuses the chip
 * that takes its place. The arrows, Home and End are the shared `utils/roving-focus.ts`; the
 * Tab stop then follows focus through `rovingOnFocus`.
 */
const removeOnKey = sync$((event: KeyboardEvent) => {
  if (event.key !== "Backspace" && event.key !== "Delete") return;
  // `target`, not `currentTarget`: with Qwik's document delegation that can be the document.
  const target = event.target as HTMLElement | null;
  const group = target?.closest?.(
    "[data-qds-chip-group]",
  ) as HTMLElement | null;
  if (!target || !group) return;
  const main = (chip: Element) =>
    (chip.tagName === "BUTTON"
      ? chip
      : chip.querySelector(
          "button:not([data-qds-chip-trailing])",
        )) as HTMLElement | null;
  const enabled = () =>
    Array.from(
      group.querySelectorAll(
        ":scope > [data-qds-chip]:not([aria-disabled='true'])",
      ),
    )
      .map(main)
      .filter((el): el is HTMLElement => !!el && !el.hasAttribute("disabled"));
  const chip = target.closest("[data-qds-chip]");
  const index = chip ? enabled().indexOf(main(chip) as HTMLElement) : -1;
  if (index === -1) return;
  const remove = chip?.querySelector<HTMLElement>("[data-qds-chip-trailing]");
  if (!remove || remove.hasAttribute("disabled")) return;
  event.preventDefault();
  // Focus the chip that takes this one's place once it has gone from the DOM.
  const observer = new MutationObserver(() => {
    if (chip?.isConnected) return;
    observer.disconnect();
    const rest = enabled();
    if (rest.length === 0) return;
    const to = rest[Math.min(index, rest.length - 1)];
    rest.forEach((el) => (el.tabIndex = el === to ? 0 : -1));
    to.focus();
  });
  observer.observe(group, { childList: true, subtree: true });
  // An unkeyed list may reuse this chip's node: stop watching after a second regardless.
  setTimeout(() => observer.disconnect(), 1000);
  remove.click();
});

export const ChipGroup = component$<ChipGroupProps>(
  ({
    label,
    orientation = "horizontal",
    overflow,
    onKeyDown$,
    onFocusIn$,
    class: className,
    ...rest
  }) => (
    <div
      {...rest}
      data-qds-chip-group=""
      data-overflow={overflow}
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      // Arrows (one axis, mirrored in right-to-left text), Home / End, wrapping, between the
      // chips' main buttons (the remove buttons stay Tab stops beside them).
      data-roving={orientation}
      data-roving-items=":scope > button[data-qds-chip], :scope > [data-qds-chip]:not([aria-disabled='true']) > button:not([data-qds-chip-trailing])"
      onKeyDown$={[removeOnKey, rovingKeys, onKeyDown$]}
      onFocusIn$={[rovingOnFocus, onFocusIn$]}
      class={[chipGroupVariants({ overflow }), className]}
    >
      <Slot />
    </div>
  ),
);
