/**
 * Pure detent logic for `Sheet` (no DOM, no Qwik): which detent a key moves to, and which detent a
 * released drag snaps to. From e-store's `components/sheet/sheet-detents.ts` unchanged except the
 * comments (its unit tests were not carried over).
 */

/** One resting height of a sheet. */
export interface SheetDetent {
  /** Stable id, the value of `bind:detent` (`'peek'`, `'half'`, `'full'`). */
  id: string;
  /**
   * Any CSS length for the sheet's height at this detent: `rem`, or `%` of the containing block
   * (the viewport for `anchor="viewport"`, the positioned parent for `anchor="container"`), or a
   * `calc()` of them. Never px (the user's text size must scale it).
   */
  size: string;
  /** Announced when the sheet settles here (a polite live region). */
  label?: string;
}

/**
 * The defaults (e-store's). Peek 14.25rem is e-store's own number (M3 gives no peek height); half
 * the height; full leaves 4.5rem (72dp, M3's top margin for an expanded bottom sheet on a compact
 * window) so the app bar stays in view.
 */
export const DEFAULT_SHEET_DETENTS: SheetDetent[] = [
  { id: "peek", size: "14.25rem", label: "Collapsed" },
  { id: "half", size: "50%", label: "Half open" },
  { id: "full", size: "calc(100% - 4.5rem)", label: "Expanded" },
];

/** Index of `id` in `detents`, or 0 when it is not one of them. */
export function detentIndex(
  detents: readonly SheetDetent[],
  id: string | undefined,
): number {
  const i = detents.findIndex((d) => d.id === id);
  return i < 0 ? 0 : i;
}

/**
 * The detent index a key on the handle moves to, or `null` when the key does nothing.
 * ArrowUp / ArrowDown step one detent (no wrap), Home / End go to the smallest / largest.
 * Enter and Space are the button's own click (`cycleDetent`), not handled here.
 */
export function detentIndexForKey(
  key: string,
  index: number,
  count: number,
): number | null {
  if (count < 1) return null;
  switch (key) {
    case "ArrowUp":
      return Math.min(index + 1, count - 1);
    case "ArrowDown":
      return Math.max(index - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Enter / Space / a tap on the handle: the next larger detent, wrapping to the smallest. */
export function cycleDetent(index: number, count: number): number {
  return count < 1 ? 0 : (index + 1) % count;
}

/** How far ahead (ms) a release's velocity is projected before picking the nearest detent. */
export const SHEET_FLING_MS = 150;

/**
 * The detent a released drag snaps to: the one nearest the height the sheet would reach if it kept
 * its release velocity for `SHEET_FLING_MS` (a flick carries on to the next detent).
 *
 * @param heights - each detent's height in px, smallest first (measured at drag start)
 * @param height - the sheet's height at release, px
 * @param velocity - px per ms, positive = growing (dragged up)
 */
export function snapDetentIndex(
  heights: readonly number[],
  height: number,
  velocity = 0,
): number {
  if (heights.length === 0) return 0;
  const projected = height + velocity * SHEET_FLING_MS;
  let best = 0;
  for (let i = 1; i < heights.length; i++) {
    if (
      Math.abs(heights[i]! - projected) < Math.abs(heights[best]! - projected)
    )
      best = i;
  }
  return best;
}
