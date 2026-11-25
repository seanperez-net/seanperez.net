import {
  $,
  Slot,
  component$,
  sync$,
  useComputed$,
  useId,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import type { QRL, Signal } from "@qwik.dev/core";
import { tv, type VariantProps } from "tailwind-variants/lite";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { openPopover } from "../../utils/top-layer";
import {
  DEFAULT_SHEET_DETENTS,
  cycleDetent,
  detentIndex,
  detentIndexForKey,
  snapDetentIndex,
  type SheetDetent,
} from "./sheet-detents";

/**
 * Material Design 3 STANDARD (non-modal) bottom sheet with detents: it sits at the bottom of the
 * window beside the page, which stays usable. No scrim, no focus trap, nothing is inert. (The
 * MODAL bottom sheet is `Modal position="bottom"`.)
 *
 * e-store's `Sheet` (`components/sheet/sheet.tsx`), smaller: no `anchor="container"`, no
 * bottom / floating yield (our layout has no bottom bar or floating buttons), no data-attribute
 * pass-through. See `sheet.md`.
 *
 * - A `popover="manual"` shown on the TOP LAYER once the page is live. Before that (SSR, no JS)
 *   the same element is `position: fixed` at the bottom edge: the author `display: flex` beats
 *   the UA's `[popover]:not(:popover-open) { display: none }`.
 * - Height is CSS: `--sheet-height` is the current detent's `size`, so SSR renders the right
 *   height with no measuring. A drag writes `--sheet-drag` in px and, on release, snaps to a
 *   detent. It animates `height`, not a transform, so content below the visible edge is never
 *   laid out off-screen; a keyboard focus below the visible edge raises the detent.
 * - The drag handle is a button (M3 accessibility: role button, labelled, in the tab order):
 *   Enter / Space cycle the detents, ArrowUp / ArrowDown / Home / End step them. That is also
 *   the single-pointer alternative to dragging (WCAG 2.5.7).
 *
 * @see https://m3.material.io/components/bottom-sheets/specs
 * @see https://m3.material.io/components/bottom-sheets/accessibility
 */
export const sheetVariants = tv({
  slots: {
    // `m-0 border-0 p-0 overflow-hidden` + the insets undo the UA popover box (inset 0, auto
    // margins, Canvas fill, border, padding, overflow auto). `max-w-160` = M3's 640dp cap.
    root: [
      "fixed inset-x-0 top-auto bottom-0 z-auto mx-auto my-0 box-border flex w-full max-w-160 flex-col",
      "overflow-hidden border-0 p-0",
      "rounded-t-xl bg-surface-container-low text-on-surface shadow-1",
      "h-[var(--sheet-drag,var(--sheet-height))] max-h-full",
      "transition-[height] duration-medium-4 ease-emphasized motion-reduce:transition-none",
      "data-[sheet-dragging]:transition-none data-[sheet-dragging]:select-none",
    ],
    // M3 drag handle: 32×4 indicator in a 48dp touch target, full width so the whole top edge
    // is a grip. `touch-none`: a touch drag here is always the sheet's, never a page pan.
    handle: [
      "flex h-12 w-full shrink-0 cursor-grab touch-none items-center justify-center",
      "rounded-t-xl border-0 bg-transparent p-0 active:cursor-grabbing",
      "focus-ring-inward",
    ],
    grabber:
      "pointer-events-none h-1 w-8 rounded-full bg-on-surface-variant/40",
    // `touch-pan-x`: a vertical touch drag reaches the sheet's pointer listeners, a sideways
    // one still scrolls a chip row.
    header: "shrink-0 touch-pan-x",
    body: "min-h-0 flex-1 overscroll-contain pb-[env(safe-area-inset-bottom,0px)]",
    status: "sr-only",
  },
  variants: {
    /** Internal: the sheet is at its largest detent, so the body scrolls itself. */
    atTop: {
      true: { body: "overflow-y-auto" },
      false: { body: "touch-pan-x overflow-hidden" },
    },
  },
  defaultVariants: { atTop: false },
});

export type SheetVariantProps = VariantProps<typeof sheetVariants>;

export interface SheetProps {
  /** Resting heights, smallest first. Default `DEFAULT_SHEET_DETENTS` (peek / half / full). */
  detents?: SheetDetent[];
  /** Initial detent id when not bound. Default: the first (smallest). */
  detent?: string;
  /** The current detent id, two-way. */
  "bind:detent"?: Signal<string>;
  /** Fires with the new detent id after a drag, a key or a tap on the handle moves the sheet. */
  onDetentChange$?: QRL<(id: string) => void>;
  /** Accessible name of the sheet region. */
  label?: string;
  /** Accessible name of the drag handle button. */
  handleLabel?: string;
  id?: string;
  class?: string;
}

export const Sheet = component$<SheetProps>(
  ({
    detents = DEFAULT_SHEET_DETENTS,
    detent,
    "bind:detent": bindDetent,
    onDetentChange$,
    label = "Sheet",
    handleLabel = "Resize sheet",
    id,
    class: className,
  }) => {
    const current = useBoundSignal(bindDetent, detent ?? detents[0]?.id ?? "");
    const announce = useSignal("");
    const rootRef = useSignal<HTMLElement>();
    const localId = useId();
    const bodyId = `${localId}-body`;
    const index = useComputed$(() => detentIndex(detents, current.value));

    const setIndex = $((i: number) => {
      const d = detents[i];
      if (!d) return;
      announce.value = d.label ?? d.id;
      if (d.id === current.value) return;
      current.value = d.id;
      onDetentChange$?.(d.id);
    });

    // Native listeners: a drag needs synchronous pointer capture and click swallowing, which a
    // lazily loaded `$()` handler cannot give. `document-ready`: a popover is `display: none`
    // to the intersection observer until shown. (e-store's reason, kept: the last resort applies.)
    // VISIBLE-TASK AUDIT 2026-11-25: KEEP — drag needs synchronous pointer capture and native listeners; popover is display:none so document-ready (docs best-practices sync$ note)
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(
      ({ cleanup }) => {
        const el = rootRef.value;
        if (!el) return;
        if (el.popover) openPopover(el);

        /** Each detent's height in px, by laying a probe out with the same containing block. */
        const measure = (): number[] => {
          const probe = document.createElement("div");
          probe.style.cssText =
            "position:fixed;visibility:hidden;pointer-events:none;inset-inline:0;bottom:0;";
          document.body.appendChild(probe);
          const out = detents.map((d) => {
            probe.style.height = d.size;
            return probe.getBoundingClientRect().height;
          });
          probe.remove();
          return out;
        };

        let drag: {
          pointerId: number;
          startY: number;
          startH: number;
          heights: number[];
          active: boolean;
          lastY: number;
          lastT: number;
          v: number;
          h: number;
        } | null = null;
        let swallowClick = false;

        const settle = (i: number) => {
          const d = detents[i];
          if (d) el.style.setProperty("--sheet-height", d.size);
          el.removeAttribute("data-sheet-dragging");
          el.style.removeProperty("--sheet-drag");
          void setIndex(i);
        };

        const onDown = (e: PointerEvent) => {
          if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
          const t = e.target as Element | null;
          // At the top detent the body scrolls; a drag starts only on the handle or header.
          if (
            t?.closest("[data-sheet-body]") &&
            el.hasAttribute("data-sheet-at-top")
          ) {
            return;
          }
          const h = el.getBoundingClientRect().height;
          drag = {
            pointerId: e.pointerId,
            startY: e.clientY,
            startH: h,
            heights: measure(),
            active: false,
            lastY: e.clientY,
            lastT: e.timeStamp,
            v: 0,
            h,
          };
        };

        const onMove = (e: PointerEvent) => {
          if (!drag || e.pointerId !== drag.pointerId) return;
          const dy = drag.startY - e.clientY;
          if (!drag.active) {
            if (Math.abs(dy) < 6) return;
            drag.active = true;
            try {
              el.setPointerCapture(e.pointerId);
            } catch {
              // A pointer that is no longer active (a synthetic event): drag without capture.
            }
            el.setAttribute("data-sheet-dragging", "");
          }
          const min = Math.min(...drag.heights);
          const max = Math.max(...drag.heights);
          drag.h = Math.min(max, Math.max(min, drag.startH + dy));
          const dt = e.timeStamp - drag.lastT;
          if (dt > 0) {
            const inst = (drag.lastY - e.clientY) / dt;
            drag.v = drag.v * 0.2 + inst * 0.8;
          }
          drag.lastY = e.clientY;
          drag.lastT = e.timeStamp;
          el.style.setProperty("--sheet-drag", `${drag.h}px`);
        };

        const onUp = (e: PointerEvent) => {
          if (!drag || e.pointerId !== drag.pointerId) return;
          const d = drag;
          drag = null;
          if (!d.active) return;
          // The click that follows a drag must not press the handle or a row under it.
          swallowClick = true;
          setTimeout(() => (swallowClick = false), 0);
          // A pause before release is not a flick.
          const v = e.timeStamp - d.lastT > 100 ? 0 : d.v;
          settle(snapDetentIndex(d.heights, d.h, v));
        };

        const onCancel = (e: PointerEvent) => {
          if (!drag || e.pointerId !== drag.pointerId) return;
          const active = drag.active;
          drag = null;
          if (active) settle(detentIndex(detents, current.value));
        };

        const onKey = (e: KeyboardEvent) => {
          if (e.key !== "Escape" || !drag?.active) return;
          drag = null;
          settle(detentIndex(detents, current.value));
        };

        // Window capture runs before qwikloader's document listeners.
        const onClick = (e: MouseEvent) => {
          if (!swallowClick) return;
          swallowClick = false;
          e.stopPropagation();
          e.preventDefault();
        };

        el.addEventListener("pointerdown", onDown);
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerup", onUp);
        el.addEventListener("pointercancel", onCancel);
        window.addEventListener("keydown", onKey, true);
        window.addEventListener("click", onClick, true);

        // Keyboard focus on body content that is clipped below the current detent raises the
        // sheet to the smallest detent that shows it whole (the largest, which scrolls, when
        // none does), so a Tab never lands on something the user cannot see. Rows already
        // visible in a peeked sheet stay where they are and are not touched. Only
        // `:focus-visible` (a key, or a text field): a tap on a half-visible row does not
        // throw the sheet open.
        const body = el.querySelector<HTMLElement>("[data-sheet-body]");
        let revealTimer: ReturnType<typeof setTimeout> | undefined;
        const onFocusIn = (e: FocusEvent) => {
          const t = e.target as HTMLElement | null;
          if (!body || !t || drag?.active || !t.matches(":focus-visible"))
            return;
          const atTop = el.hasAttribute("data-sheet-at-top");
          const sheetBox = el.getBoundingClientRect();
          const bodyBox = body.getBoundingClientRect();
          const box = t.getBoundingClientRect();
          if (!atTop) {
            // Where the target sits in the body's content, whatever the browser's focus
            // scroll did to the clipped body.
            const contentBottom = box.bottom - bodyBox.top + body.scrollTop;
            const needed = bodyBox.top - sheetBox.top + contentBottom;
            if (body.scrollTop === 0 && needed <= sheetBox.height + 1) return;
            const heights = measure();
            let next = heights.findIndex((h) => h + 1 >= needed);
            if (next < 0) next = detents.length - 1;
            // Undo the browser's focus scroll of the clipped body: below the largest detent
            // the content starts at the top; at it, `reveal` scrolls only as far as needed.
            body.scrollTop = 0;
            settle(next);
            if (next !== detents.length - 1) return;
          }
          // At the largest detent the body scrolls: once the height has settled, bring the
          // target fully into the body's view (not `scrollIntoView`, which would also
          // scroll the page or pane around the sheet).
          clearTimeout(revealTimer);
          const reveal = () => {
            if (document.activeElement !== t) return;
            const b = body.getBoundingClientRect();
            const r = t.getBoundingClientRect();
            if (r.bottom > b.bottom) body.scrollTop += r.bottom - b.bottom;
            else if (r.top < b.top) body.scrollTop -= b.top - r.top;
          };
          const ms =
            parseFloat(getComputedStyle(el).transitionDuration) * 1000 || 0;
          revealTimer = setTimeout(reveal, atTop ? 0 : ms + 20);
        };
        el.addEventListener("focusin", onFocusIn);

        cleanup(() => {
          el.removeEventListener("focusin", onFocusIn);
          clearTimeout(revealTimer);
          el.removeEventListener("pointerdown", onDown);
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onCancel);
          window.removeEventListener("keydown", onKey, true);
          window.removeEventListener("click", onClick, true);
        });
      },
      { strategy: "document-ready" },
    );

    // Derived in `useComputed$`, not read in the body (Q12; e-store read them in the body).
    const atTop = useComputed$(() => index.value === detents.length - 1);
    const size = useComputed$(() => detents[index.value]?.size ?? "");
    const v = sheetVariants();

    return (
      <section
        ref={rootRef}
        id={id}
        aria-label={label}
        popover="manual"
        data-sheet=""
        data-sheet-detent={current.value}
        data-sheet-at-top={atTop.value ? "" : undefined}
        style={{ "--sheet-height": size.value }}
        class={[v.root(), className]}
      >
        <button
          type="button"
          class={v.handle()}
          aria-label={handleLabel}
          aria-expanded={index.value > 0}
          aria-controls={bodyId}
          data-sheet-handle=""
          onClick$={() => setIndex(cycleDetent(index.value, detents.length))}
          onKeyDown$={[
            sync$((e: KeyboardEvent) => {
              if (
                e.key === "ArrowUp" ||
                e.key === "ArrowDown" ||
                e.key === "Home" ||
                e.key === "End"
              ) {
                e.preventDefault();
              }
            }),
            $((e: KeyboardEvent) => {
              const next = detentIndexForKey(
                e.key,
                index.value,
                detents.length,
              );
              if (next !== null) return setIndex(next);
            }),
          ]}
        >
          <span class={v.grabber()} aria-hidden="true" />
        </button>
        <div class={v.header()} data-sheet-header="">
          <Slot name="header" />
        </div>
        <div
          id={bodyId}
          class={sheetVariants({ atTop: atTop.value }).body()}
          data-sheet-body=""
        >
          <Slot />
        </div>
        <span class={v.status()} aria-live="polite" data-sheet-status="">
          {announce.value}
        </span>
      </section>
    );
  },
);
