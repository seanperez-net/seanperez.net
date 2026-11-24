import { $, component$, sync$, useOnDocument, useSignal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { openPopover } from "../../utils/top-layer";
import { placeTooltip } from "./tooltip-place";

/**
 * The PLAIN tooltip for every control, from ONE place: document listeners and one shared
 * `role="tooltip"` element, the way `RippleProvider` (e-store's) does ripples. No per-control
 * component. (The listeners are document-wide: the first pointer move anywhere loads them.)
 * Exactly ONE per document: two would share the timers and both show tips.
 *
 * Opt in on the control with `data-tooltip`. The tip shows the control's own accessible name
 * (`aria-label`), so it is a LABEL tooltip (e-store's `Tooltip type="label"`): the tip is
 * `aria-hidden` and nothing points at it with `aria-describedby`, and a screen reader hears the
 * name once, from the control. `IconButton` sets `data-tooltip` by default. Extra text that is
 * NOT the name (a description) and rich tooltips are the `Tooltip` component.
 *
 * Differs from e-store (owner, 2026-11-23): global instead of a `Tooltip.Root` / `Trigger` /
 * `Content` around every control.
 *
 * Behaviour (m3.material.io/components/tooltips, read 2026-11-23):
 * - Shows after `delay` on hover (mouse / pen; touch has no hover), at once on KEYBOARD focus
 *   (`:focus-visible`; a click that focuses does not pin it).
 * - Above the control, 4dp away; below it with `data-tooltip-side="bottom"` (M3: in an app bar)
 *   or when there is no room above. Kept 8dp inside the window.
 * - Leaves 1.5s after the pointer leaves the control (M3 "disappear 1.5 seconds after navigating
 *   away"), and stays while the pointer is on the tip itself (WCAG 1.4.13 hoverable). Leaves at
 *   once on blur, and on Escape from anywhere (WCAG 1.4.13 dismissible).
 * - A new tip replaces the old one at once (M3: one tooltip at a time; there is only one).
 * - Escape is the tooltip's only: it does not also close a dialog around the control (APG).
 *   After it, the same control shows no tip again until the pointer has left it.
 * - Follows the control while the page or a pane scrolls (a Tab that scrolls a control into view
 *   keeps its tip).
 * - Not shown: a control inside `Tooltip.Trigger` (it has its own tip), a control named by
 *   `aria-labelledby` (only `aria-label` is read), any control on touch (no hover; `title` showed
 *   nothing there either), a disabled control on hover (it takes no pointer events).
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/title
 */
export const tooltipTipVariants = tv({
  base: [
    // Undo the UA popover box (inset 0, auto margins, Canvas, border, padding).
    "fixed",
    "m-0",
    "border-0",
    "inset-auto",
    // M3 plain tooltip: inverse-surface, body-small in inverse-on-surface, 4dp corners,
    // 24dp min height, 40dp min width, 320dp max width, 4dp / 8dp padding.
    "rounded-xs",
    "bg-inverse-surface",
    "px-2",
    "py-1",
    "text-body-small",
    "text-inverse-on-surface",
    "min-h-6",
    "min-w-10",
    // 320dp, and never wider than the window less its 8dp edges.
    "max-w-[min(20rem,calc(100vw-1rem))]",
    "w-max",
    "text-center",
    "break-words",
    "opacity-0",
    "transition-[opacity,display,overlay]",
    "transition-discrete",
    "duration-short-3",
    "ease-standard",
    "open:opacity-100",
    "starting:open:opacity-0",
  ],
});

/** M3: tooltips leave 1.5s after the pointer leaves the control. */
const HIDE_AFTER_MS = 1500;

type Timers = {
  show?: number;
  hide?: number;
  host?: HTMLElement;
  /** Closed with Escape: no tip again until the pointer leaves it. */
  dismissed?: HTMLElement;
  /** Ends the current tip's scroll listener. */
  follow?: AbortController;
};
/** One document, one tip: timers and the current host live here, never in Qwik state. */
const timers: Timers = {};

const hostOf = (target: EventTarget | null): HTMLElement | null => {
  const el = (target as Element | null)?.closest?.("[data-tooltip]");
  if (!(el instanceof HTMLElement)) return null;
  // A control with its own `Tooltip` would get two tips.
  if (el.closest("[data-tooltip-trigger]")) return null;
  return el.getAttribute("aria-label") ? el : null;
};

const clear = (key: "show" | "hide") => {
  if (timers[key] !== undefined) {
    clearTimeout(timers[key]);
    timers[key] = undefined;
  }
};

const hide = (tip: HTMLElement | undefined) => {
  clear("show");
  clear("hide");
  timers.host = undefined;
  timers.follow?.abort();
  timers.follow = undefined;
  if (tip?.matches(":popover-open")) tip.hidePopover();
};

const show = (tip: HTMLElement | undefined, host: HTMLElement) => {
  if (!tip || !host.isConnected) return;
  clear("hide");
  timers.host = host;
  // One tooltip at a time (M3): a `Tooltip` open elsewhere closes (its `toggle` syncs it).
  document
    .querySelectorAll<HTMLElement>("[data-tooltip-content]:popover-open")
    .forEach((other) => other.hidePopover());
  tip.textContent = host.getAttribute("aria-label") ?? "";
  const side = host.dataset.tooltipSide === "bottom" ? "bottom" : "top";
  if (!openPopover(tip)) return;
  placeTooltip(tip, host, side);
  // Placed in window coordinates: re-placed on any scroll (the page or a pane; `scroll` does
  // not bubble, so in the capture phase), once a frame.
  timers.follow?.abort();
  const follow = new AbortController();
  timers.follow = follow;
  let frame = 0;
  document.addEventListener(
    "scroll",
    () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (timers.host === host && host.isConnected) {
          placeTooltip(tip, host, side);
        }
      });
    },
    { capture: true, passive: true, signal: follow.signal },
  );
};

/**
 * Escape closes the tip and goes no further, so a dialog around the control stays open. A
 * `sync$` (it must cancel the key), so it only touches the DOM; `onToggle$` then resets the state.
 */
const escapeTip = sync$((event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  const tip = document.querySelector<HTMLElement>(
    "[data-tooltip-tip]:popover-open",
  );
  if (!tip) return;
  event.preventDefault();
  event.stopPropagation();
  tip.setAttribute("data-escaped", "");
  tip.hidePopover();
});

export type TooltipProviderProps = {
  /** ms of hover before a tip shows. Default 700 (e-store's `Tooltip` delay; M3 gives none). */
  delay?: number;
};

/**
 * Place ONCE (`Layout.Root` does). Renders the shared tip and the document listeners.
 */
export const TooltipProvider = component$<TooltipProviderProps>(
  ({ delay = 700 }) => {
    const tipRef = useSignal<HTMLElement>();

    useOnDocument(
      "pointerover",
      $((event: PointerEvent) => {
        const tip = tipRef.value;
        if (event.pointerType === "touch") return;
        if (tip && tip.contains(event.target as Node)) {
          clear("hide");
          return;
        }
        const host = hostOf(event.target);
        if (!host) {
          // Its control was removed or hidden under the pointer (no `pointerout` reached it).
          const current = timers.host;
          if (
            current &&
            (!current.isConnected || !current.contains(event.target as Node)) &&
            timers.hide === undefined
          ) {
            clear("show");
            timers.hide = window.setTimeout(() => hide(tip), HIDE_AFTER_MS);
          }
          return;
        }
        if (host === timers.dismissed) return;
        if (host === timers.host) {
          clear("hide");
          return;
        }
        // Another control: the old tip goes at once, the new one after the delay.
        hide(tip);
        timers.host = host;
        timers.show = window.setTimeout(() => {
          timers.show = undefined;
          show(tip, host);
        }, delay);
      }),
    );

    useOnDocument(
      "pointerout",
      $((event: PointerEvent) => {
        const tip = tipRef.value;
        const to = event.relatedTarget as Node | null;
        const gone = timers.dismissed;
        if (gone && !(to && gone.contains(to))) timers.dismissed = undefined;
        const host = timers.host;
        if (!host) return;
        // Still on the control or on the tip.
        if (to && (host.contains(to) || tip?.contains(to))) return;
        const from = event.target as Node;
        if (!host.contains(from) && !tip?.contains(from)) return;
        // Keyboard focus keeps it (it shows for the focus, not the hover).
        if (host.matches(":focus-visible, :has(:focus-visible)")) return;
        clear("show");
        clear("hide");
        timers.hide = window.setTimeout(() => hide(tip), HIDE_AFTER_MS);
      }),
    );

    useOnDocument(
      "focusin",
      $((event: FocusEvent) => {
        const host = hostOf(event.target);
        const tip = tipRef.value;
        if (!host || !(event.target as Element).matches(":focus-visible")) {
          return;
        }
        if (host !== timers.host) hide(tip);
        clear("show");
        show(tip, host);
      }),
    );

    useOnDocument(
      "focusout",
      $((event: FocusEvent) => {
        const host = hostOf(event.target);
        if (host && host === timers.host) hide(tipRef.value);
      }),
    );

    useOnDocument("keydown", escapeTip);

    // A press: the tip goes (a toggle's click changes its name, and the old one would stay).
    useOnDocument(
      "pointerdown",
      $((event: PointerEvent) => {
        const host = timers.host;
        if (!host || !host.contains(event.target as Node)) return;
        hide(tipRef.value);
        timers.dismissed = host;
      }),
    );

    // Closed from outside (Escape, a `Tooltip` opening): reset, so the next hover shows it.
    const toggled$ = $((event: ToggleEvent, tip: HTMLElement) => {
      if (event.newState !== "closed") return;
      if (tip.hasAttribute("data-escaped")) {
        tip.removeAttribute("data-escaped");
        timers.dismissed = timers.host;
      }
      if (timers.host) hide(tip);
    });

    return (
      <div
        ref={tipRef}
        popover="manual"
        role="tooltip"
        // The control already carries this text as its name: not read twice.
        aria-hidden="true"
        data-tooltip-tip=""
        class={tooltipTipVariants()}
        onToggle$={toggled$}
      />
    );
  },
);
