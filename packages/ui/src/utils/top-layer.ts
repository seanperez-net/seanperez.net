/**
 * Helpers for elements in the browser's top layer. From e-store's `utils/top-layer.ts`
 * (`openModal` and `openPopover`; its notice helpers are left out).
 */

/** What {@link openPopover} uses of an element; any `HTMLElement` is one. */
export interface PopoverTarget {
  readonly isConnected: boolean;
  matches(selectors: string): boolean;
  removeAttribute(qualifiedName: string): void;
  showPopover(): void;
}

/**
 * `el.showPopover()` only when it can succeed: the element is in the document and not already
 * open (the browser throws `InvalidStateError` otherwise: HTML spec, "check popover validity").
 * Returns whether the popover is open afterwards.
 */
export function openPopover(el: PopoverTarget): boolean {
  if (!el.isConnected) return false;
  // Opened again while its exit plays: the exit is dropped and the enter transition runs back
  // from where it is (see `closeAnimated`).
  el.removeAttribute(CLOSING_ATTR);
  if (!el.matches(":popover-open")) el.showPopover();
  // A cancelled `beforetoggle` leaves it closed (HTML spec, showPopover).
  return el.matches(":popover-open");
}

/** What {@link openModal} uses of a dialog; any `HTMLDialogElement` is one. */
export interface ModalTarget {
  readonly isConnected: boolean;
  readonly open: boolean;
  matches(selectors: string): boolean;
  hidePopover(): void;
  removeAttribute(qualifiedName: string): void;
  showModal(): void;
}

/**
 * `dialog.showModal()` without `InvalidStateError`: nothing for a detached dialog, nothing for
 * one already modal. A dialog left `open` but not `:modal` (a server-rendered `open`) is closed
 * and shown again as a modal, and an open popover is hidden first (`showModal()` throws on an
 * element in the popover showing state: HTML spec). Returns whether the dialog is modal afterwards.
 */
export function openModal(dialog: ModalTarget): boolean {
  if (!dialog.isConnected) return false;
  // Opened again while its exit plays (see `closeAnimated`).
  dialog.removeAttribute(CLOSING_ATTR);
  if (dialog.matches(":modal")) return true;
  if (dialog.matches(":popover-open")) dialog.hidePopover();
  if (dialog.open) dialog.removeAttribute("open");
  dialog.showModal();
  // A cancelled `beforetoggle` leaves it closed (HTML spec, showModal step 6).
  return dialog.matches(":modal");
}

/**
 * Set on a top-layer element while its exit transition plays. Its CSS gives the closed look
 * (`open:data-closing:...` classes) while it is still open, so it is still in the top layer,
 * above the page, with its `::backdrop`.
 */
export const CLOSING_ATTR = "data-closing";

/** What {@link closeAnimated} uses of an element; any `HTMLElement` is one. */
export interface ClosingTarget {
  readonly isConnected: boolean;
  hasAttribute(qualifiedName: string): boolean;
  setAttribute(qualifiedName: string, value: string): void;
  removeAttribute(qualifiedName: string): void;
  getAnimations?(options?: { subtree?: boolean }): Animation[];
}

/**
 * Plays a top-layer element's exit transition, THEN takes it out of the top layer with `hide`
 * (`dialog.close()`, `el.hidePopover()`). Removing it first (`close()` straight away) drops it
 * from the top layer at once: the scrim is gone and only a browser that can transition `overlay`
 * keeps it painted on top for the exit. Chrome can; Safari (iOS included) and Firefox cannot
 * (MDN / caniuse `overlay`, 2026-11-24), so there the exit ran under the page or not at all.
 *
 * Waits on the transitions the attribute starts on the element itself and its `::backdrop`
 * (`getAnimations()` also brings the style up to date, so they exist when read), never on its
 * content's (a spinner inside would never end). A timeout ends the wait if one never finishes.
 * Opened again before the exit ends (`openModal` / `openPopover` remove the attribute), it is
 * not hidden. With reduced motion the durations are 0: nothing to wait for, it hides at once.
 * Resolves with whether it hid the element. Material-web's dialog does the same with WAAPI
 * (`dialog/internal/dialog.ts` `close()`: animate, then `dialog.close()`).
 */
export async function closeAnimated(
  el: ClosingTarget,
  hide: () => void,
  timeoutMs = 600,
): Promise<boolean> {
  if (!el.isConnected) {
    hide();
    return true;
  }
  if (el.hasAttribute(CLOSING_ATTR)) return false;
  el.setAttribute(CLOSING_ATTR, "");
  const running = (el.getAnimations?.({ subtree: true }) ?? []).filter(
    (animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      const timing = effect?.getComputedTiming();
      return (
        effect?.target === el &&
        timing?.endTime !== Infinity &&
        animation.playState === "running"
      );
    },
  );
  if (running.length > 0) {
    await Promise.race([
      Promise.all(running.map((animation) => animation.finished.catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }
  // Re-opened while the exit played: leave it open.
  if (!el.hasAttribute(CLOSING_ATTR)) return false;
  hide();
  el.removeAttribute(CLOSING_ATTR);
  return true;
}

/**
 * Marks a `popover="manual"` notice (the snackbar) that re-shows itself above every overlay
 * opened after it. From e-store's `utils/top-layer.ts` (`STAYS_ON_TOP_ATTR`, `stayOnTop`).
 */
export const STAYS_ON_TOP_ATTR = "data-stays-on-top";

/**
 * Keeps `el` above later top-layer overlays. Top-layer order is insertion order (HTML spec), so a
 * modal or popover opened after `el` covers it; this hides and re-shows `el` on each such
 * `toggle`. Under a `showModal()` the notice is still inert, as everything outside the modal is.
 * Returns the cleanup that removes the listener.
 */
export function stayOnTop(el: HTMLElement): () => void {
  const raise = (e: Event) => {
    const target = e.target as Element | null;
    if ((e as ToggleEvent).newState !== "open") return;
    if (!target || target === el || target.closest(`[${STAYS_ON_TOP_ATTR}]`))
      return;
    // A tooltip opened over the page does not need to go under the notice.
    if (target.getAttribute("role") === "tooltip") return;
    if (!el.isConnected || !el.matches(":popover-open")) return;
    el.hidePopover();
    el.showPopover();
  };
  document.addEventListener("toggle", raise, true);
  return () => document.removeEventListener("toggle", raise, true);
}

/**
 * Waits (up to ~1s) until `el`'s `<dialog>` is modal; whether it is. For focus work started by
 * a task when a picker opens (the task cannot await it: it would block the render that opens the
 * dialog). Date and time pickers, 2026-11-23.
 */
export const whenModal = async (el: Element | null | undefined) => {
  for (let i = 0; i < 60; i++) {
    if (el?.closest("dialog")?.matches(":modal")) return true;
    await new Promise((r) => requestAnimationFrame(r));
  }
  return false;
};
