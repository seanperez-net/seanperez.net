import {
  $,
  Slot,
  component$,
  createContextId,
  sync$,
  useComputed$,
  useContext,
  useContextProvider,
  isBrowser,
  useOnDocument,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { openPopover } from "../../utils/top-layer";
import { placeTooltip } from "./tooltip-place";
import type { TooltipSide } from "./tooltip-place";

/**
 * Material Design 3 tooltips as a component: a DESCRIPTION tooltip (extra text that is not the
 * control's name) or a RICH tooltip (subhead, text, up to two text buttons). A plain LABEL tooltip
 * (the tip repeats an icon button's name) needs no component: `TooltipProvider` and the
 * `data-tooltip` attribute.
 *
 * e-store's `Tooltip` (Root / Trigger / Content, `delay`, `open` / `bind:open`, `type`, the
 * trigger's `sync$` hover / focus markers, Escape) with M3's rich variant, persistent rich tips,
 * the 1.5s exit and one tooltip at a time added. See `tooltip.md` for what differs.
 *
 * @see https://m3.material.io/components/tooltips/specs
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
 */

export const tooltipContentVariants = tv({
  slots: {
    root: [
      // Undo the UA popover box; placed in window coordinates by `placeTooltip`.
      "fixed",
      "m-0",
      "inset-auto",
      "border-0",
      "w-max",
      "opacity-0",
      "transition-[opacity,display,overlay]",
      "transition-discrete",
      "duration-short-3",
      "ease-standard",
      "open:opacity-100",
      "starting:open:opacity-0",
    ],
    subhead: ["text-title-small", "text-on-surface-variant"],
    text: [],
    actions: ["-ms-3", "flex", "gap-2", "empty:hidden"],
  },
  variants: {
    variant: {
      // M3 plain: inverse-surface, body-small, 4dp corners, 24dp min height, 40-320dp wide.
      plain: {
        root: [
          "rounded-xs",
          "bg-inverse-surface",
          "px-2",
          "py-1",
          "text-body-small",
          "text-inverse-on-surface",
          "min-h-6",
          "min-w-10",
          "max-w-[min(20rem,calc(100vw-1rem))]",
          "text-center",
        ],
      },
      // M3 rich: surface-container, level 2, 12dp corners; 12dp top, 8dp bottom, 16dp sides.
      rich: {
        root: [
          // `open:` only: a bare `flex` beat the UA's `[popover]:not(:popover-open)
          // { display: none }`, so a CLOSED rich tip stayed in the page as an invisible
          // (opacity 0) box over its control and swallowed its hover and clicks.
          "open:flex",
          "flex-col",
          "gap-1",
          "rounded-md",
          "bg-surface-container",
          "shadow-2",
          "px-4",
          "pt-3",
          "pb-2",
          "max-w-[min(20rem,calc(100vw-1rem))]",
          "text-start",
          // Without actions the bottom padding matches the top.
          "not-has-[[data-tooltip-actions]>*]:pb-3",
        ],
        text: ["text-body-medium", "text-on-surface-variant"],
      },
    },
  },
  defaultVariants: { variant: "plain" },
});

/**
 * What the tip is to its control.
 * - `description` (default): extra text. Give the CONTROL `aria-describedby` = the Root's `id`
 *   (`Tooltip.Content` takes that id), so it is in the server HTML on the focusable element.
 * - `label`: the tip repeats the control's own name; it is `aria-hidden` (prefer `data-tooltip`
 *   and `TooltipProvider` for this).
 */
export type TooltipType = "description" | "label";

type TooltipContext = {
  open: Signal<boolean>;
  contentId: string;
  triggerRef: Signal<HTMLElement | undefined>;
  contentRef: Signal<HTMLElement | undefined>;
  delay: Readonly<Signal<number>>;
  type: Readonly<Signal<TooltipType>>;
  persistent: Readonly<Signal<boolean>>;
  hideTimer: Signal<number | undefined>;
};

const tooltipContextId = createContextId<TooltipContext>("ui-tooltip");

/** M3: a tooltip leaves 1.5s after the pointer leaves its control. */
const HIDE_AFTER_MS = 1500;

export type TooltipRootProps = {
  /**
   * The tip's id (`Tooltip.Content`'s). Put it in the control's `aria-describedby` for a
   * description tooltip.
   */
  id: string;
  /** ms of hover before it shows. Default 700 (e-store's; M3 gives none). */
  delay?: number;
  /** Open at first (a persistent rich tip that explains a new feature on page load). */
  open?: boolean;
  "bind:open"?: Signal<boolean>;
  /** `description` (default) or `label` (see `TooltipType`). */
  type?: TooltipType;
  /**
   * M3 persistent rich tooltip: opens on a CLICK of the control (not hover or focus) and stays
   * until the user interacts with something else (light dismiss, `popover="auto"`).
   */
  persistent?: boolean;
};

/** Holds the state; renders no element. */
const Root = component$<TooltipRootProps>((props) => {
  const reactive: Pick<
    TooltipRootProps,
    "open" | "delay" | "type" | "persistent"
  > = props;
  const open = useBoundSignal(
    props["bind:open"],
    props.open ?? false,
    useComputed$(() => reactive.open),
  );
  const triggerRef = useSignal<HTMLElement>();
  const contentRef = useSignal<HTMLElement>();
  const hideTimer = useSignal<number>();
  // Signals, not the values at creation: a change of `delay`, `type` or `persistent` applies
  // to the mounted tip (read in JSX and in the handlers), no remount needed.
  const delay = useComputed$(() => reactive.delay ?? 700);
  const type = useComputed$<TooltipType>(() => reactive.type ?? "description");
  const persistent = useComputed$(() => reactive.persistent ?? false);
  useContextProvider(tooltipContextId, {
    open,
    contentId: props.id,
    triggerRef,
    contentRef,
    delay,
    type,
    persistent,
    hideTimer,
  });
  return <Slot />;
});

const clearTimer = (timer: Signal<number | undefined>) => {
  if (timer.value !== undefined) {
    clearTimeout(timer.value);
    timer.value = undefined;
  }
};

// The markers are set synchronously, in event order, so a lazily loaded `$` half that runs
// late acts only on what is true now (e-store's). The element is the second argument.
const markHover = sync$((_: Event, el: Element) =>
  el.setAttribute("data-tooltip-hover", ""),
);
const unmarkHover = sync$((_: Event, el: Element) =>
  el.removeAttribute("data-tooltip-hover"),
);
const markFocus = sync$((_: Event, el: Element) => {
  // Keyboard focus only: a click that focuses the control does not pin a tip beside it.
  if (el.matches(":focus-visible, :has(:focus-visible)")) {
    el.setAttribute("data-tooltip-focus", "");
  }
});
const unmarkFocus = sync$((_: Event, el: Element) =>
  el.removeAttribute("data-tooltip-focus"),
);

export type TooltipTriggerProps = Omit<
  PropsOf<"span">,
  | "onPointerEnter$"
  | "onPointerLeave$"
  | "onFocusIn$"
  | "onFocusOut$"
  | "onKeyDown$"
  | "onClick$"
> & {
  onClick$?: QRL<(event: PointerEvent, element: HTMLSpanElement) => void>;
};

/**
 * Wraps the control (a `<span>`, `display: inline-flex`) and listens for hover, keyboard focus,
 * Escape and, for a persistent tip, the click. Put `aria-describedby` on the control itself.
 */
const Trigger = component$<TooltipTriggerProps>(
  ({ class: className, onClick$, ...rest }) => {
    const ctx = useContext(tooltipContextId);
    const showTimer = useSignal<number>();

    // The hover and focus handlers are always attached and do nothing for a persistent tip
    // (M3: hovering does not trigger it, a click does), so `persistent` can change live.
    const enter$ = $((_: Event, el: Element) => {
      if (ctx.persistent.value) return;
      clearTimer(showTimer);
      clearTimer(ctx.hideTimer);
      if (!el.hasAttribute("data-tooltip-hover")) return;
      showTimer.value = window.setTimeout(() => {
        showTimer.value = undefined;
        if (el.hasAttribute("data-tooltip-hover")) ctx.open.value = true;
      }, ctx.delay.value);
    });
    const leave$ = $((_: Event, el: Element) => {
      if (ctx.persistent.value) return;
      clearTimer(showTimer);
      clearTimer(ctx.hideTimer);
      ctx.hideTimer.value = window.setTimeout(() => {
        ctx.hideTimer.value = undefined;
        if (el.hasAttribute("data-tooltip-focus")) return;
        if (ctx.contentRef.value?.hasAttribute("data-tooltip-hover")) return;
        ctx.open.value = false;
      }, HIDE_AFTER_MS);
    });
    const focus$ = $((_: Event, el: Element) => {
      if (ctx.persistent.value) return;
      clearTimer(showTimer);
      clearTimer(ctx.hideTimer);
      if (el.hasAttribute("data-tooltip-focus")) ctx.open.value = true;
    });
    const blur$ = $((event: FocusEvent) => {
      // A persistent tip is closed by light dismiss (`popover="auto"`), not by blur.
      if (ctx.persistent.value) return;
      clearTimer(showTimer);
      // Tab from the control into the tip's own buttons keeps it (focus order: control, tip).
      const to = event.relatedTarget as Node | null;
      if (to && ctx.contentRef.value?.contains(to)) return;
      ctx.open.value = false;
    });
    const key$ = $((event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clearTimer(showTimer);
      ctx.open.value = false;
    });
    const toggle$ = $(() => {
      if (!ctx.persistent.value) return;
      // A click on the control first light-dismisses the open tip (pointerdown is outside the
      // `popover="auto"`); that click is the close, not a reopen.
      const closedAt = Number(ctx.contentRef.value?.dataset.closedAt ?? 0);
      if (!ctx.open.value && Date.now() - closedAt < 400) return;
      ctx.open.value = !ctx.open.value;
    });

    return (
      <span
        {...rest}
        ref={ctx.triggerRef}
        class={["inline-flex", className]}
        data-tooltip-trigger=""
        // M3: hovering does not trigger a persistent rich tooltip; a click does (the handlers
        // check `ctx.persistent`).
        onPointerEnter$={[markHover, enter$]}
        onPointerLeave$={[unmarkHover, leave$]}
        onFocusIn$={[markFocus, focus$]}
        onFocusOut$={[unmarkFocus, blur$]}
        onKeyDown$={key$}
        onClick$={[toggle$, onClick$]}
      >
        <Slot />
      </span>
    );
  },
);

/**
 * Escape anywhere closes an open tip (WCAG 1.4.13 dismissible) and goes no further, so a dialog
 * around the control stays open (as `TooltipProvider`). A `sync$` (it cancels the key); the tip's
 * `toggle` event then updates its state.
 */
const escapeTip = sync$((event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  const open = document.querySelectorAll<HTMLElement>(
    "[data-tooltip-content]:popover-open",
  );
  if (open.length === 0) return;
  event.preventDefault();
  event.stopPropagation();
  open.forEach((tip) => tip.hidePopover());
});

const markTipHover = sync$((_: Event, el: Element) =>
  el.setAttribute("data-tooltip-hover", ""),
);
const unmarkTipHover = sync$((_: Event, el: Element) =>
  el.removeAttribute("data-tooltip-hover"),
);

export type TooltipContentProps = Omit<
  PropsOf<"div">,
  "role" | "id" | "popover" | "onToggle$"
> & {
  /** `plain` (default) or `rich`. */
  variant?: "plain" | "rich";
  /** Where it sits. Default: `top` for plain, `bottom` for rich (M3). Moves to stay on screen. */
  side?: TooltipSide;
  /** Rich only: the subhead (M3 title-small). */
  subhead?: string;
};

/**
 * The tip: a top-layer popover with `role="tooltip"`. Default slot: the supporting text.
 * Rich: `q:slot="actions"` for up to two text buttons (`Button look="text"`).
 */
const Content = component$<TooltipContentProps>(
  ({ variant = "plain", side, subhead, class: className, ...rest }) => {
    const ctx = useContext(tooltipContextId);
    const v = tooltipContentVariants({ variant });
    const rich = variant === "rich";
    const where: TooltipSide = side ?? (rich ? "bottom" : "top");

    const apply$ = $((isOpen: boolean) => {
      const el = ctx.contentRef.value;
      const host = ctx.triggerRef.value;
      if (!el || !el.isConnected) return;
      if (isOpen) {
        // One tooltip at a time (M3): any other open one closes; its `toggle` syncs its state.
        document
          .querySelectorAll<HTMLElement>(
            "[data-tooltip-content]:popover-open, [data-tooltip-tip]:popover-open",
          )
          .forEach((other) => {
            if (other !== el) other.hidePopover();
          });
        openPopover(el);
        if (host) placeTooltip(el, host, where, rich ? "start" : "center");
      } else if (el.matches(":popover-open")) {
        el.hidePopover();
      }
    });

    useTask$(({ track, cleanup }) => {
      const isOpen = track(() => ctx.open.value);
      if (!isBrowser) return;
      void apply$(isOpen);
      if (!isOpen) return;
      // Follows its control while the page or a pane scrolls (`scroll` does not bubble: the
      // capture phase), once a frame, only while open.
      const follow = new AbortController();
      let frame = 0;
      document.addEventListener(
        "scroll",
        () => {
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            const el = ctx.contentRef.value;
            const host = ctx.triggerRef.value;
            if (el?.matches(":popover-open") && host) {
              placeTooltip(el, host, where, rich ? "start" : "center");
            }
          });
        },
        { capture: true, passive: true, signal: follow.signal },
      );
      cleanup(() => follow.abort());
    });

    // `open` at first: the task above ran on the server, where there is no element yet.
    useOnDocument(
      "qinit",
      $(() => {
        if (ctx.open.value) void apply$(true);
      }),
    );
    useOnDocument("keydown", escapeTip);

    const tipLeave$ = $(() => {
      const trigger = ctx.triggerRef.value;
      if (trigger?.hasAttribute("data-tooltip-hover")) return;
      if (trigger?.hasAttribute("data-tooltip-focus")) return;
      clearTimer(ctx.hideTimer);
      ctx.hideTimer.value = window.setTimeout(() => {
        ctx.hideTimer.value = undefined;
        ctx.open.value = false;
      }, HIDE_AFTER_MS);
    });
    const tipEnter$ = $(() => clearTimer(ctx.hideTimer));
    // Closed by the browser (light dismiss of a persistent tip, another tip opening) or by us.
    const toggled$ = $((event: ToggleEvent, el: HTMLElement) => {
      if (event.newState === "closed") el.dataset.closedAt = String(Date.now());
      ctx.open.value = event.newState === "open";
    });

    return (
      <>
        <div
          {...rest}
          ref={ctx.contentRef}
          id={ctx.contentId}
          role="tooltip"
          popover={ctx.persistent.value ? "auto" : "manual"}
          aria-hidden={ctx.type.value === "label" ? "true" : undefined}
          data-tooltip-content=""
          data-variant={variant}
          class={[v.root(), className]}
          onPointerEnter$={[markTipHover, tipEnter$]}
          onPointerLeave$={[unmarkTipHover, tipLeave$]}
          onToggle$={toggled$}
        >
          {rich && subhead && <p class={v.subhead()}>{subhead}</p>}
          <div class={v.text()}>
            <Slot />
          </div>
          {rich && (
            <div class={v.actions()} data-tooltip-actions="">
              <Slot name="actions" />
            </div>
          )}
        </div>
      </>
    );
  },
);

/** M3 tooltips: `Tooltip.Root`, `Tooltip.Trigger`, `Tooltip.Content`. */
export const Tooltip = { Root, Trigger, Content };
