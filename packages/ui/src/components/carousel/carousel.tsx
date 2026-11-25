import {
  $,
  Slot,
  component$,
  createContextId,
  sync$,
  useContext,
  useComputed$,
  useContextProvider,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import type { ClassList, QRL, ReadonlySignal, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Button } from "../button";
import { IconButton } from "../icon-button";
import type { IconName } from "../icon";
import { RippleSurface } from "../ripple";

/**
 * Material Design 3 carousel, from e-store's `components/carousel/carousel.tsx` (2026-11-23), cut
 * to what M3 has. Read 2026-11-23: https://m3.material.io/components/carousel/specs (token table,
 * every layout's measurements), /guidelines, /accessibility; material-web
 * `tokens/versions/v0_192/_md-comp-carousel-item.scss`.
 *
 * Two ways of working, as e-store's:
 * - CONTAINED (`multi-browse`, `hero`, `center-aligned-hero`): every visible item is fully on
 *   screen at a large, medium or small width (M3 "keylines"); the widths are set here from the
 *   container's width and the current item, and CSS animates them. Swipe, horizontal wheel,
 *   click, arrows and Tab move the current item.
 * - SCROLLING (`uncontained`, `uncontained-multi`, `full-screen`): native scrolling, items keep
 *   the size the caller gives them. `full-screen` scrolls vertically and always snaps (M3).
 */

const SLIDE = '[aria-roledescription="slide"]';
/** M3: small items are 40-56dp; e-store uses the maximum. */
const SMALL_W = 56;
/** M3: 8dp between items, 16dp leading / trailing padding. */
const GAP = 8;
const PAD = 16;
/** e-store's swipe thresholds (pointer events, contained layouts). */
const SWIPE_THRESHOLD = 30;
const SWIPE_RATIO = 1.2;


/**
 * A swipe must not start a native drag of a slide's link or text. A `sync$` handler, not the bare
 * `preventdefault:dragstart` attribute: qwikloader (installed `@qwik.dev/core` 2.0.0-rc.5,
 * `qwikloader.debug.js` `dispatch` / `addEventOrRoot`) only reads that attribute while handling an
 * event type some element has a handler for, and nothing registered `dragstart`.
 */
const cancelDragStart = sync$((event: DragEvent) => {
  event.preventDefault();
});

export type CarouselVariant =
  | "multi-browse"
  | "uncontained"
  | "uncontained-multi"
  | "hero"
  | "center-aligned-hero"
  | "full-screen";

export const carouselVariantNames: CarouselVariant[] = [
  "multi-browse",
  "uncontained",
  "uncontained-multi",
  "hero",
  "center-aligned-hero",
  "full-screen",
];

type SlotType = "large" | "medium" | "small";

function isContained(v: CarouselVariant): boolean {
  return v === "hero" || v === "center-aligned-hero" || v === "multi-browse";
}

/** The track's own items (not those of a carousel nested inside one). */
function slidesOf(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(SLIDE)).filter(
    (s) => s.parentElement === el,
  );
}

/**
 * Scrolls only the track to put `slide` at its leading edge (after `scroll-padding`); never the
 * page (reviewer 2026-11-23: `scrollIntoView` also scrolled the window). RTL-aware.
 */
function scrollTrackTo(el: HTMLElement, slide: HTMLElement, smooth: boolean) {
  const cs = getComputedStyle(el);
  const a = slide.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const behavior: ScrollBehavior = smooth ? "smooth" : "instant";
  if (cs.flexDirection === "column") {
    const pad = parseFloat(cs.scrollPaddingTop) || 0;
    el.scrollTo({ top: el.scrollTop + a.top - b.top - pad, behavior });
    return;
  }
  const rtl = cs.direction === "rtl";
  const pad =
    parseFloat(rtl ? cs.scrollPaddingRight : cs.scrollPaddingLeft) || 0;
  const delta = rtl ? a.right - b.right + pad : a.left - b.left - pad;
  el.scrollTo({ left: el.scrollLeft + delta, behavior });
}

/** "{index} of {count}" filled in (M3 accessibility: items read "N of M"). */
function fillLabel(template: string, index: number, count: number): string {
  return template
    .replace("{index}", String(index))
    .replace("{count}", String(count));
}

/**
 * The slot pattern for a container width. Multi-browse: e-store's responsive patterns (more
 * mediums on wider containers, M3 "On larger screens, more large and medium items are visible").
 * Hero: with `maxItemWidth`, as many large items as fit at or under it, then one small (M3: "On
 * larger screens, more large items are visible"; new, e-store always shows one large).
 */
function slotPattern(
  variant: CarouselVariant,
  width: number,
  maxItemWidth: number,
): SlotType[] {
  if (variant === "multi-browse" && maxItemWidth > 0) {
    // M3: "When the large item's max width is narrow enough, more items can be shown": as many
    // large items as fit at the maximum, then a medium with what is left (if it is wider than
    // a small one), then a small. New: e-store kept its fixed pattern and widened the medium.
    const room = width - PAD * 2 - SMALL_W - GAP;
    const large = Math.max(1, Math.floor(room / (maxItemWidth + GAP)));
    const left = room - large * (maxItemWidth + GAP);
    return [
      ...Array<SlotType>(large).fill("large"),
      ...(left - GAP > SMALL_W ? (["medium"] as SlotType[]) : []),
      "small",
    ];
  }
  if (variant === "multi-browse") {
    if (width >= 1200) return ["large", "medium", "medium", "medium", "small"];
    if (width >= 840) return ["large", "medium", "medium", "small"];
    if (width >= 600) return ["large", "medium", "small"];
    return ["large", "small"];
  }
  if (variant === "center-aligned-hero") return ["small", "large", "small"];
  // hero
  let large = 1;
  if (maxItemWidth > 0) {
    const room = width - PAD * 2 - SMALL_W;
    while ((room - large * GAP) / large > maxItemWidth) large++;
  }
  return [...Array<SlotType>(large).fill("large"), "small"];
}

/**
 * Lays out a contained carousel for the current item `idx`: each item in the window gets its
 * slot's width, the rest collapse to 0 and leave the tab order and the accessibility tree.
 *
 * Differs from e-store, which kept the pattern fixed and left the missing slots empty at the
 * ends (a blank 64px after the last hero item, a blank leading slot on a centred hero's first):
 * here the window never runs past either end. Past the end the pattern is reversed (the large
 * item at the trailing edge, as M3's end keylines); a centred hero's first and last items take
 * both small slots on the other side. The container is always filled.
 *
 * Reduced motion (M3 accessibility: "carousel items should no longer expand ... All items are the
 * same size"): every item gets the large width and the track scrolls the current one to its
 * start; the next one peeks at the edge. New: e-store only drops its scale effect.
 */
function applyLayout(
  el: HTMLElement,
  idx: number,
  variant: CarouselVariant,
  maxItemWidth: number,
) {
  const slides = slidesOf(el);
  const n = slides.length;
  if (n === 0) return;
  const width = el.clientWidth;
  let pattern = slotPattern(variant, width, maxItemWidth);
  if (pattern.length > n) pattern = pattern.slice(0, n);
  const len = pattern.length;

  // Which items the window shows, and which slot each one takes.
  let start: number;
  if (variant === "center-aligned-hero" && n < 3) {
    // One item: large. Two: the current one large, the other small (reviewer 2026-11-23: the
    // sliced pattern left a lone small item).
    pattern =
      n === 1 ? ["large"] : idx === 0 ? ["large", "small"] : ["small", "large"];
    start = 0;
  } else if (variant === "center-aligned-hero" && len === 3) {
    if (idx === 0) {
      pattern = ["large", "small", "small"];
      start = 0;
    } else if (idx === n - 1) {
      pattern = ["small", "small", "large"];
      start = n - 3;
    } else {
      start = idx - 1;
    }
  } else if (idx + len > n) {
    pattern = [...pattern].reverse();
    start = n - len;
  } else {
    start = idx;
  }

  const available = width - PAD * 2 - (len - 1) * GAP;
  const smallCount = pattern.filter((s) => s === "small").length;
  const mediumCount = pattern.filter((s) => s === "medium").length;
  const largeCount = pattern.filter((s) => s === "large").length || 1;
  const remaining = available - smallCount * SMALL_W;
  // e-store's split: with mediums, the large item takes 5/9 (one medium) or 40% (more).
  // With a maximum (multi-browse), large items take it and the one medium the rest; without,
  // e-store's split: the large item takes 5/9 next to one medium, 40% next to more.
  const withMax = maxItemWidth > 0 && variant === "multi-browse";
  const largeWidth = withMax
    ? mediumCount > 0
      ? maxItemWidth
      : remaining / largeCount
    : mediumCount > 0
      ? Math.round(remaining * (mediumCount > 1 ? 0.4 : 5 / 9))
      : remaining / largeCount;
  const mediumWidth =
    mediumCount > 0
      ? Math.round((remaining - largeWidth * largeCount) / mediumCount)
      : 0;
  const widthOf = (slot: SlotType) =>
    slot === "small" ? SMALL_W : slot === "medium" ? mediumWidth : largeWidth;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (let i = 0; i < n; i++) {
    const slide = slides[i];
    const s = slide.style;
    const slot = i - start;
    const shown = reduced || (slot >= 0 && slot < len);
    if (shown) {
      s.width = `${reduced ? largeWidth : widthOf(pattern[slot])}px`;
      s.opacity = "";
      s.marginInlineStart = i === (reduced ? 0 : start) ? `${PAD}px` : "0";
      s.marginInlineEnd =
        i === (reduced ? n - 1 : start + len - 1) ? `${PAD}px` : `${GAP}px`;
      slide.inert = false;
    } else {
      s.width = "0";
      s.opacity = "0";
      s.marginInlineStart = "0";
      s.marginInlineEnd = "0";
      // `inert`: out of the tab order and the accessibility tree, content included (reviewer
      // 2026-11-23: `aria-hidden` and `tabindex` alone left links inside it focusable).
      slide.inert = true;
    }
  }
  if (reduced) {
    if (slides[idx]) scrollTrackTo(el, slides[idx], false);
  } else {
    el.scrollLeft = 0;
  }
}

/**
 * A slide that takes focus while partly outside a scrolling track is scrolled to its snap
 * position at once (e-store's `revealFocusedSlide`, focus audit 2026-11-16: the browser's own
 * focus scroll moved it a few pixels and snapping pulled it back). A `sync$`: no module scope.
 */
const revealFocusedSlide = sync$((e: FocusEvent, sc: HTMLElement) => {
  const slide = (e.target as HTMLElement).closest?.(
    '[aria-roledescription="slide"]',
  ) as HTMLElement | null;
  if (!slide || slide.parentElement !== sc) return;
  const cs = getComputedStyle(sc);
  if (cs.overflowX !== "auto" && cs.overflowY !== "auto") return;
  const a = slide.getBoundingClientRect();
  const b = sc.getBoundingClientRect();
  if (cs.flexDirection === "column") {
    if (a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5) return;
    const pad = parseFloat(cs.scrollPaddingTop) || 0;
    sc.scrollTo({
      top: sc.scrollTop + a.top - b.top - pad,
      behavior: "instant",
    });
  } else {
    if (a.left >= b.left - 0.5 && a.right <= b.right + 0.5) return;
    const rtl = cs.direction === "rtl";
    const pad =
      parseFloat(rtl ? cs.scrollPaddingRight : cs.scrollPaddingLeft) || 0;
    const delta = rtl ? a.right - b.right + pad : a.left - b.left - pad;
    sc.scrollTo({ left: sc.scrollLeft + delta, behavior: "instant" });
  }
});

/**
 * Keys an item handles, cancelled synchronously (a `$` handler runs too late). Only keys pressed
 * on the item itself, not on a control inside it. Tab is taken only when there is another item
 * that way; at either end it leaves the carousel natively.
 */
const preventItemKeys = sync$((e: KeyboardEvent, el: HTMLElement) => {
  if (e.target !== el) return;
  const k = e.key;
  if (
    k === "Enter" ||
    k === " " ||
    k === "ArrowUp" ||
    k === "ArrowDown" ||
    k === "ArrowLeft" ||
    k === "ArrowRight"
  ) {
    e.preventDefault();
    return;
  }
  if (k !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
  const track = el.parentElement;
  // Scrolling layouts keep the native Tab order (every item is tabbable there).
  if (!track || getComputedStyle(track).overflowX !== "hidden") return;
  const slides = Array.from(track.children).filter(
    (c) =>
      c.getAttribute("aria-roledescription") === "slide" &&
      c.getAttribute("aria-disabled") !== "true",
  );
  const i = slides.indexOf(el);
  if (e.shiftKey ? i > 0 : i > -1 && i < slides.length - 1) e.preventDefault();
});

/** The tabbable element before or after the carousel (M3: Up / Down leave it). */
function focusOutside(root: Element, forward: boolean) {
  const all = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (el) =>
      !root.contains(el) &&
      !el.closest("[inert]") &&
      el.checkVisibility({ visibilityProperty: true }),
  );
  const flag = forward
    ? Node.DOCUMENT_POSITION_FOLLOWING
    : Node.DOCUMENT_POSITION_PRECEDING;
  const after = all.filter((el) => root.compareDocumentPosition(el) & flag);
  (forward ? after[0] : after[after.length - 1])?.focus();
}

interface CarouselContext {
  activeIndex: Signal<number>;
  itemCount: Signal<number>;
  variant: ReadonlySignal<CarouselVariant>;
  itemLabel: ReadonlySignal<string>;
  goTo: QRL<(index: number, announce?: boolean) => void>;
}

const CarouselCtx = createContextId<CarouselContext>("carousel");

const rootVariants = tv({
  // `contain-inline-size`: the carousel is as wide as its container, never as wide as its items
  // (a scroller's max-content is the whole row, which widened an `auto` grid track to fit it).
  base: "group/carousel relative w-full contain-inline-size",
  variants: {
    variant: {
      "multi-browse": "",
      hero: "",
      "center-aligned-hero": "",
      uncontained: "",
      "uncontained-multi": "",
      "full-screen": "flex h-full flex-col",
    },
  },
});

/** The track. Its fill is M3's container color, `surface` (which also sets `--field-bg`). */
const trackVariants = tv({
  base: "relative flex bg-surface select-none",
  variants: {
    variant: {
      // Contained: no native scroll; swipe through pointer events. Items vertically centred.
      "multi-browse":
        "[touch-action:pan-y] scroll-ps-4 items-center overflow-hidden py-2",
      hero: "[touch-action:pan-y] scroll-ps-4 items-center overflow-hidden py-2",
      "center-aligned-hero":
        "[touch-action:pan-y] scroll-ps-4 items-center overflow-hidden py-2",
      // Uncontained: 16dp leading padding only, items bleed past the trailing edge (M3).
      uncontained:
        "scroll-ps-4 items-center gap-2 overflow-x-auto overscroll-x-contain scroll-smooth py-2 ps-4 motion-reduce:scroll-auto",
      "uncontained-multi":
        "scroll-ps-4 items-center gap-2 overflow-x-auto overscroll-x-contain scroll-smooth py-2 ps-4 motion-reduce:scroll-auto",
      // Full-screen: vertical, edge to edge, 16dp between items, always snapping (M3).
      "full-screen":
        "min-h-0 flex-1 snap-y snap-mandatory flex-col gap-4 overflow-x-hidden overflow-y-auto scroll-smooth motion-reduce:scroll-auto",
    },
    /** M3 snap-scrolling for an uncontained carousel (default scrolling otherwise). */
    snap: {
      true: "snap-x snap-mandatory",
      false: "",
    },
  },
});

const itemVariants = tv({
  base: [
    "relative shrink-0 cursor-pointer overflow-hidden bg-surface",
    // State layer (M3: on-surface, hover 8%, focus 10%, pressed 10%).
    "before:pointer-events-none before:absolute before:inset-0 before:z-10 before:rounded-[inherit] before:bg-on-surface before:opacity-0 before:content-['']",
    "before:transition-opacity before:duration-short-4",
    "hover:before:opacity-hover focus-visible:before:opacity-focus active:before:opacity-focus",
    // M3 elevation: level 0, hovered level 1 (material-web carousel-item tokens; new, e-store none).
    "transition-shadow hover:shadow-1",
    // Media fills the item and is cropped from the centre: as an item narrows, its image is
    // masked from both sides, the look M3 draws for items changing size.
    "[&_img]:pointer-events-none [&_img]:size-full [&_img]:object-cover [&_img]:select-none [&_img]:[-webkit-user-drag:none]",
    "[&_video]:pointer-events-none [&_video]:size-full [&_video]:object-cover",
    // Disabled (M3: 38%). On the content, not the item, so the outlined item's outline keeps
    // its own disabled value (outline at 12%; reviewer 2026-11-23). The fill is the track's
    // color, so fading it changes nothing.
    "aria-disabled:pointer-events-none aria-disabled:cursor-default aria-disabled:*:opacity-38",
  ],
  variants: {
    variant: {
      // Contained: width animates; the ring goes outward (the track's margins give it room).
      "multi-browse":
        "focus-ring rounded-xl transition-[width,margin,opacity,box-shadow] duration-medium-2 ease-standard motion-reduce:transition-none",
      hero: "focus-ring rounded-xl transition-[width,margin,opacity,box-shadow] duration-medium-2 ease-standard motion-reduce:transition-none",
      "center-aligned-hero":
        "focus-ring rounded-xl transition-[width,margin,opacity,box-shadow] duration-medium-2 ease-standard motion-reduce:transition-none",
      // Scrolling: the scroller clips at its edges, so the ring goes inward.
      uncontained: "focus-ring-inward rounded-xl",
      "uncontained-multi": "focus-ring-inward rounded-xl",
      "full-screen": "h-full w-full focus-ring-inward snap-start",
    },
    /** M3's "with outline" token set: a 1dp `outline` border, `on-surface` on focus. */
    outlined: {
      true: [
        "after:pointer-events-none after:absolute after:inset-0 after:z-11 after:rounded-[inherit] after:border after:border-outline after:content-['']",
        "focus-visible:after:border-on-surface aria-disabled:after:border-outline/12",
      ],
      false: "",
    },
    snap: {
      true: "snap-start",
      false: "",
    },
  },
});

export interface CarouselRootProps {
  /** M3 layout. @default "hero" (e-store's default) */
  variant?: CarouselVariant;
  /**
   * The carousel's name (APG: a `region` named by `aria-label`; do not include the word
   * "carousel", the role description says it).
   */
  "aria-label": string;
  /**
   * Contained layouts: the large item's maximum width in px (M3: "Large items have a max width
   * that can be adjusted"). 0 = as wide as the layout allows. @default 0
   */
  maxItemWidth?: number;
  /**
   * Uncontained layouts: M3 snap-scrolling instead of default scrolling. Contained layouts move
   * one item at a time and `full-screen` always snaps (M3). @default false
   */
  snap?: boolean;
  /** Called when the current item changes. */
  onIndexChange$?: QRL<(index: number) => void>;
  /**
   * Each item's name and the swipe announcement, `{index}` and `{count}` filled in (M3
   * accessibility: "N of M"). A prop so it can be translated. @default "{index} of {count}"
   */
  itemLabel?: string;
  class?: ClassList;
  [key: `data-${string}`]: string | boolean | number | undefined;
}

const Root = component$<CarouselRootProps>((props) => {
  const { "aria-label": ariaLabel, onIndexChange$, class: className } = props;
  // Only `data-*` reaches the region; every other prop is the carousel's own.
  const rest = Object.fromEntries(
    Object.entries(props).filter(([key]) => key.startsWith("data-")),
  );
  const trackRef = useSignal<HTMLElement>();
  const activeIndex = useSignal(0);
  const itemCount = useSignal(0);
  // The variant and label as computed signals: the parts and the tasks follow the props.
  const variant = useComputed$<CarouselVariant>(() => props.variant ?? "hero");
  const itemLabel = useComputed$(() => props.itemLabel ?? "{index} of {count}");
  // What the live region says. Set only by swipe, wheel and click on a peeking item, the moves
  // that do not focus an item (keyboard focus already reads the item's own "N of M"; reviewer
  // 2026-11-23: e-store's region announced every move twice).
  const announcement = useSignal("");
  const swipeX = useSignal(0);
  const swipeY = useSignal(0);
  const swiping = useSignal(false);
  const lastWheel = useSignal(0);

  const goTo = $((index: number, announce = false) => {
    const el = trackRef.value;
    if (!el) return;
    const slides = slidesOf(el);
    if (slides.length === 0) return;
    const target = Math.max(0, Math.min(index, slides.length - 1));
    if (isContained(variant.value)) {
      applyLayout(el, target, variant.value, props.maxItemWidth ?? 0);
    } else {
      scrollTrackTo(
        el,
        slides[target],
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
    }
    if (target === activeIndex.value) return;
    activeIndex.value = target;
    if (announce)
      announcement.value = fillLabel(
        itemLabel.value,
        target + 1,
        slides.length,
      );
    onIndexChange$?.(target);
  });

  useContextProvider(CarouselCtx, {
    activeIndex,
    itemCount,
    variant,
    itemLabel,
    goTo,
  });

  // Contained: lay out now and on every resize; follow `variant` / `maxItemWidth`. Browser-only
  // work (it measures the track), as e-store's.
  // VISIBLE-TASK AUDIT 2026-11-25: KEEP — measures the track, ResizeObserver and MutationObserver with cleanup (docs /core/tasks/)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const v = track(() => variant.value);
    const max = track(() => props.maxItemWidth ?? 0);
    const el = trackRef.value;
    if (!el) return;
    // Clear what a previous contained layout wrote, for a switch to a scrolling one.
    for (const s of slidesOf(el)) {
      s.removeAttribute("style");
      s.inert = false;
    }
    // Count (and lay out) again when items are added or removed (reviewer 2026-11-23).
    const relayout = () => {
      const n = slidesOf(el).length;
      itemCount.value = n;
      if (activeIndex.value > Math.max(n - 1, 0))
        activeIndex.value = Math.max(n - 1, 0);
      if (isContained(v)) applyLayout(el, activeIndex.value, v, max);
    };
    relayout();
    const mo = new MutationObserver(relayout);
    mo.observe(el, { childList: true });
    cleanup(() => mo.disconnect());
    if (!isContained(v)) return;
    const ro = new ResizeObserver(relayout);
    ro.observe(el);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", relayout);
    cleanup(() => {
      ro.disconnect();
      mq.removeEventListener("change", relayout);
    });
  });

  // Scrolling layouts: the current item is the one most in view (e-store's IntersectionObserver).
  // VISIBLE-TASK AUDIT 2026-11-25: KEEP — IntersectionObserver on the slides with cleanup; no Qwik event gives ratios (docs /core/tasks/)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const v = track(() => variant.value);
    const el = trackRef.value;
    if (!el || isContained(v)) return;
    // Each item's last ratio, kept between callbacks (one callback lists only the items that
    // crossed a threshold; reviewer 2026-11-23). The current item is the first most in view.
    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          ratios.set(
            entry.target,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        const slides = slidesOf(el);
        let best = -1;
        let ratio = 0;
        slides.forEach((s, i) => {
          const r = ratios.get(s) ?? 0;
          if (r > ratio + 0.01) {
            best = i;
            ratio = r;
          }
        });
        if (best !== -1 && best !== activeIndex.value) {
          activeIndex.value = best;
          onIndexChange$?.(best);
        }
      },
      { root: el, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    const observeAll = () => {
      observer.disconnect();
      ratios.clear();
      for (const s of slidesOf(el)) observer.observe(s);
    };
    observeAll();
    const mo = new MutationObserver(observeAll);
    mo.observe(el, { childList: true });
    cleanup(() => {
      mo.disconnect();
      observer.disconnect();
    });
  });

  return (
    <div
      {...rest}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      data-carousel=""
      class={[rootVariants({ variant: props.variant ?? "hero" }), className]}
    >
      <Slot name="header" />
      {/* e-store's live region, for moves that do not focus an item (see `announcement`). */}
      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {announcement.value}
      </div>
      <div
        ref={trackRef}
        data-carousel-track=""
        class={trackVariants({
          variant: props.variant ?? "hero",
          snap:
            !!props.snap &&
            (props.variant === "uncontained" ||
              props.variant === "uncontained-multi"),
        })}
        onDragStart$={cancelDragStart}
        onFocusIn$={revealFocusedSlide}
        onClick$={(event: MouseEvent) => {
          const el = trackRef.value;
          // A swipe ends in a click on the item under the pointer: not a choice.
          if (el?.hasAttribute("data-swiped")) return;
          const slide = (event.target as HTMLElement).closest?.(
            SLIDE,
          ) as HTMLElement | null;
          if (!el || !slide || slide.parentElement !== el) return;
          if (slide.getAttribute("aria-disabled") === "true") return;
          const slides = Array.from(el.children).filter((c) =>
            c.matches(SLIDE),
          );
          const i = slides.indexOf(slide);
          if (i !== -1 && i !== activeIndex.value && isContained(variant.value))
            goTo(i, true);
        }}
        onPointerDown$={(e: PointerEvent, el: HTMLElement) => {
          // `data-swiped` lives until the next press: the item's and the track's click
          // handlers both read it, in whatever order they load (reviewer 2026-11-23).
          el.removeAttribute("data-swiped");
          if (!e.isPrimary || !isContained(variant.value)) return;
          swipeX.value = e.clientX;
          swipeY.value = e.clientY;
          swiping.value = true;
        }}
        onPointerMove$={(e: PointerEvent, el: HTMLElement) => {
          if (!swiping.value || !e.isPrimary) return;
          // The button was released outside the track (no pointerup here): stop, never swipe
          // on a later hover (reviewer 2026-11-23).
          if (e.buttons === 0) {
            swiping.value = false;
            return;
          }
          const dx = e.clientX - swipeX.value;
          const dy = Math.abs(e.clientY - swipeY.value);
          if (
            Math.abs(dx) > SWIPE_THRESHOLD &&
            Math.abs(dx) / Math.max(dy, 1) > SWIPE_RATIO
          ) {
            swiping.value = false;
            el.setAttribute("data-swiped", "");
            const rtl = getComputedStyle(el).direction === "rtl";
            const forward = rtl ? dx > 0 : dx < 0;
            goTo(activeIndex.value + (forward ? 1 : -1), true);
          }
        }}
        onPointerUp$={() => {
          swiping.value = false;
        }}
        onPointerLeave$={() => {
          swiping.value = false;
        }}
        onPointerCancel$={() => {
          swiping.value = false;
        }}
        // A horizontal trackpad swipe moves a contained carousel by one item (e-store's).
        onWheel$={[
          sync$((e: WheelEvent, el: HTMLElement) => {
            const cs = getComputedStyle(el);
            if (cs.overflowX !== "hidden" || cs.flexDirection === "column")
              return;
            if (
              Math.abs(e.deltaX) > Math.abs(e.deltaY) &&
              Math.abs(e.deltaX) >= 5
            )
              e.preventDefault();
          }),
          $((e: WheelEvent, el: HTMLElement) => {
            if (!isContained(variant.value)) return;
            if (
              Math.abs(e.deltaX) <= Math.abs(e.deltaY) ||
              Math.abs(e.deltaX) < 5
            )
              return;
            const now = Date.now();
            if (now - lastWheel.value < 300) return;
            lastWheel.value = now;
            const rtl = getComputedStyle(el).direction === "rtl";
            const forward = rtl ? e.deltaX < 0 : e.deltaX > 0;
            goTo(activeIndex.value + (forward ? 1 : -1), true);
          }),
        ]}
      >
        <Slot />
      </div>
      <Slot name="footer" />
    </div>
  );
});

export interface CarouselItemProps {
  /** The item's position, from 0: its name reads "N of M" (M3 accessibility). */
  index?: number;
  /** A name of its own instead of "N of M" (without the word "slide"). */
  "aria-label"?: string;
  /** Called when the item is activated: click, tap, Enter or Space. */
  onClick$?: QRL<(event: PointerEvent, element: HTMLDivElement) => void>;
  /** M3 disabled state: 38%, no interaction, out of the tab order. */
  disabled?: boolean;
  /** M3's "with outline" item: a 1dp `outline` border. New: e-store has none. */
  outlined?: boolean;
  class?: ClassList;
}

const Item = component$<CarouselItemProps>((props) => {
  const ctx = useContext(CarouselCtx);
  const { onClick$, class: className } = props;
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={
        props["aria-label"] ||
        (props.index !== undefined && ctx.itemCount.value > 0
          ? fillLabel(ctx.itemLabel.value, props.index + 1, ctx.itemCount.value)
          : undefined)
      }
      tabIndex={props.disabled ? -1 : 0}
      aria-disabled={props.disabled ? "true" : undefined}
      data-active={
        props.index !== undefined && ctx.activeIndex.value === props.index
          ? ""
          : undefined
      }
      data-ripple={props.disabled ? undefined : ""}
      class={[
        itemVariants({
          variant: ctx.variant.value,
          outlined: !!props.outlined,
          snap:
            ctx.variant.value === "uncontained" ||
            ctx.variant.value === "uncontained-multi",
        }),
        className,
      ]}
      onClick$={
        onClick$ &&
        $((event: PointerEvent, el: HTMLDivElement) => {
          // A swipe that ends on this item is not a click on it (reviewer 2026-11-23).
          if (el.parentElement?.hasAttribute("data-swiped")) return;
          return onClick$(event, el);
        })
      }
      onKeyDown$={[
        preventItemKeys,
        $(async (event: KeyboardEvent, el: HTMLElement) => {
          if (event.target !== el) return;
          if (event.key === "Enter" || event.key === " ") {
            el.click();
            return;
          }
          const root = el.closest('[aria-roledescription="carousel"]');
          if (!root) return;
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            focusOutside(root, event.key === "ArrowDown");
            return;
          }
          const track = el.parentElement;
          if (!track) return;
          const rtl = getComputedStyle(track).direction === "rtl";
          const back =
            (event.key === "Tab" && event.shiftKey) ||
            event.key === (rtl ? "ArrowRight" : "ArrowLeft");
          const forward =
            (event.key === "Tab" && !event.shiftKey) ||
            event.key === (rtl ? "ArrowLeft" : "ArrowRight");
          if (!back && !forward) return;
          // Scrolling layouts: Tab is the browser's (see `preventItemKeys`).
          if (event.key === "Tab" && !isContained(ctx.variant.value)) return;
          const slides = Array.from(track.children).filter((c) =>
            c.matches('[aria-roledescription="slide"]'),
          ) as HTMLElement[];
          let i = slides.indexOf(el);
          do {
            i += forward ? 1 : -1;
          } while (
            i >= 0 &&
            i < slides.length &&
            slides[i].getAttribute("aria-disabled") === "true"
          );
          if (i < 0 || i >= slides.length) return;
          // Focus first, then lay out: a key pressed while `goTo` runs then starts from the
          // new item (reviewer 2026-11-23). A collapsed item is `inert` until laid out.
          slides[i].inert = false;
          slides[i].focus({ preventScroll: isContained(ctx.variant.value) });
          await ctx.goTo(i);
        }),
      ]}
    >
      {!props.disabled && <RippleSurface class="z-20" />}
      <Slot />
    </div>
  );
});

export interface CarouselHeaderProps {
  /** Where the arrow button goes: the page with every item (M3 accessibility). */
  showAllHref?: string;
  /** Or what it does, when there is no page to link to. Omit both for no button. */
  onShowAll$?: QRL<() => void>;
  /** The arrow button's name. @default "Show all" */
  showAllLabel?: string;
  /** @default "arrow_forward" */
  showAllIcon?: IconName;
  class?: ClassList;
}

/**
 * M3 accessibility: a carousel with a header shows its "show all" as an arrow icon button (48dp
 * target) next to the header, aligned with the leading edge. Place it with `q:slot="header"`.
 * The title is the slot.
 */
const Header = component$<CarouselHeaderProps>((props) => {
  const {
    showAllHref,
    onShowAll$,
    showAllLabel = "Show all",
    showAllIcon = "arrow_forward",
    class: className,
  } = props;
  return (
    <div class={["flex items-center gap-1 px-4 pb-2", className]}>
      <div class="text-title-medium text-on-surface">
        <Slot />
      </div>
      {showAllHref ? (
        <IconButton
          type="link"
          href={showAllHref}
          icon={showAllIcon}
          label={showAllLabel}
          flipIconInRtl
        />
      ) : (
        onShowAll$ && (
          <IconButton
            icon={showAllIcon}
            label={showAllLabel}
            flipIconInRtl
            onClick$={onShowAll$}
          />
        )
      )}
    </div>
  );
});

export interface CarouselShowAllProps {
  /** The page with every item (M3: "a dedicated vertically-scrolling page"). */
  href?: string;
  /** Or what the button does. */
  onClick$?: QRL<() => void>;
  /** @default "Show all" */
  label?: string;
  class?: ClassList;
}

/**
 * M3 accessibility: a carousel without a header gets a "Show all" button below it (4dp padding).
 * Place it with `q:slot="footer"`. Differs from e-store: a link or a handler of the caller's, not
 * a built-in modal grid of the slides' images.
 */
const ShowAll = component$<CarouselShowAllProps>((props) => {
  const { href, onClick$, label = "Show all", class: className } = props;
  return (
    <div class={["flex justify-end p-1", className]}>
      {href ? (
        <Button type="link" href={href} look="text" label={label} />
      ) : (
        <Button look="text" label={label} onClick$={onClick$} />
      )}
    </div>
  );
});

export const Carousel = { Root, Item, Header, ShowAll };
