import type { ClassList } from "@qwik.dev/core";
import { $, component$, Slot, useOnDocument } from "@qwik.dev/core";

/**
 * Material Design 3 ripple: global event delegation. From e-store's `components/ripple`.
 * Specs: https://m3.material.io/foundations/interaction/states/overview
 *
 * Two parts:
 * 1. `RippleProvider`: place once in the layout, handles ALL ripples via document listeners
 * 2. `RippleSurface`: place inside any interactive element, the animation target
 *
 * Interactive elements just need a `data-ripple` attribute and a `<RippleSurface />` child.
 *
 * The state machine matches material-web:
 * - Touch: INACTIVE → TOUCH_DELAY → HOLDING → WAITING_FOR_CLICK → INACTIVE
 * - Mouse/Pen: INACTIVE → WAITING_FOR_CLICK → INACTIVE
 * - Keyboard: INACTIVE → (press+release) → INACTIVE
 *
 * Key: the ripple ends on CLICK, not pointerup, so it stays visible long enough.
 *
 * @see https://github.com/material-components/material-web/blob/main/ripple/internal/ripple.ts
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API
 */

// ── Constants (matching material-web) ──

const PRESS_GROW_MS = 450;
const MINIMUM_PRESS_MS = 225;
const INITIAL_ORIGIN_SCALE = 0.2;
const PADDING = 10;
const SOFT_EDGE_MINIMUM_SIZE = 75;
const SOFT_EDGE_CONTAINER_RATIO = 0.35;
const TOUCH_DELAY_MS = 150;

// ── State machine (matching material-web enum State) ──

const INACTIVE = 0;
const TOUCH_DELAY = 1;
const HOLDING = 2;
const WAITING_FOR_CLICK = 3;

// ── Types ──

interface RippleState {
  state: number;
  growAnimation: Animation | null;
  fadeAnimation: Animation | null;
  rippleStartEvent: PointerEvent | null;
  touchDelayId: number | undefined;
}

// ── WeakMap to track per-element state (no leaks) ──

const rippleStates = new WeakMap<Element, RippleState>();

function getState(el: Element): RippleState {
  let s = rippleStates.get(el);
  if (!s) {
    s = {
      state: INACTIVE,
      growAnimation: null,
      fadeAnimation: null,
      rippleStartEvent: null,
      touchDelayId: undefined,
    };
    rippleStates.set(el, s);
  }
  return s;
}

// ── DOM helpers ──

function findRippleHost(
  target: EventTarget | null,
): { host: HTMLElement; surface: HTMLElement } | null {
  const host = (target as HTMLElement)?.closest?.(
    "[data-ripple]",
  ) as HTMLElement | null;
  if (!host) return null;
  if (
    host.hasAttribute("disabled") ||
    host.getAttribute("aria-disabled") === "true"
  )
    return null;

  // `:scope >`: the host's own surface, not one of a control nested inside it.
  const surface = host.querySelector(
    ":scope > [data-ripple-surface]",
  ) as HTMLElement | null;
  if (!surface) return null;

  return { host, surface };
}

function isTouch(event: PointerEvent) {
  return event.pointerType === "touch";
}

function shouldReactToEvent(event: PointerEvent, rs: RippleState) {
  if (!event.isPrimary) return false;

  if (
    rs.rippleStartEvent &&
    rs.rippleStartEvent.pointerId !== event.pointerId
  ) {
    return false;
  }

  if (event.type === "pointerenter" || event.type === "pointerleave") {
    return !isTouch(event);
  }

  const isPrimaryButton = event.buttons === 1;
  return isTouch(event) || isPrimaryButton;
}

// ── Animation helpers ──

/**
 * The ripple's start size and end scale for a surface of `width` × `height` (material-web's
 * maths), or `null` when it is too small to draw: a surface measured while hidden (a button under
 * `display: none`, one removed by its own click before this lazy handler ran) is 0 × 0, and the
 * start size is floored, so anything under 5px would divide by zero into `scale(Infinity)`, which
 * the browser rejects with an "Invalid keyframe value" warning.
 */
export function rippleGeometry(
  width: number,
  height: number,
): { initialSize: number; rippleScale: number } | null {
  const maxDim = Math.max(height, width);
  const initialSize = Math.floor(maxDim * INITIAL_ORIGIN_SCALE);
  if (!(initialSize > 0)) return null;
  const softEdgeSize = Math.max(
    SOFT_EDGE_CONTAINER_RATIO * maxDim,
    SOFT_EDGE_MINIMUM_SIZE,
  );
  const hypotenuse = Math.sqrt(width ** 2 + height ** 2);
  const maxRadius = hypotenuse + PADDING;
  const rippleScale = (maxRadius + softEdgeSize) / initialSize;
  return Number.isFinite(rippleScale) ? { initialSize, rippleScale } : null;
}

function getTranslationCoordinates(
  surface: HTMLElement,
  initialSize: number,
  positionEvent?: PointerEvent | null,
) {
  const { width, height } = surface.getBoundingClientRect();

  // End in center
  const endPoint = {
    x: (width - initialSize) / 2,
    y: (height - initialSize) / 2,
  };

  let startPoint;
  if (positionEvent) {
    const { scrollX, scrollY } = window;
    const { left, top } = surface.getBoundingClientRect();
    const documentX = scrollX + left;
    const documentY = scrollY + top;
    startPoint = {
      x: positionEvent.pageX - documentX - initialSize / 2,
      y: positionEvent.pageY - documentY - initialSize / 2,
    };
  } else {
    // Center (keyboard)
    startPoint = {
      x: width / 2 - initialSize / 2,
      y: height / 2 - initialSize / 2,
    };
  }

  return { startPoint, endPoint };
}

function startPressAnimation(
  surface: HTMLElement,
  rs: RippleState,
  positionEvent?: PointerEvent | null,
) {
  surface.setAttribute("data-pressed", "");
  rs.growAnimation?.cancel();
  rs.fadeAnimation?.cancel();

  // Reduced motion (not in e-store): WAAPI animations ignore CSS media queries, so the check is
  // here. No ripple is drawn; the press state (`data-pressed`) still applies.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    rs.growAnimation = null;
    rs.fadeAnimation = null;
    return;
  }

  const { width, height } = surface.getBoundingClientRect();
  const size = rippleGeometry(width, height);
  // Nothing to draw on a hidden surface; the press state (`data-pressed`) still applies.
  if (!size) {
    rs.growAnimation = null;
    rs.fadeAnimation = null;
    return;
  }
  const { initialSize, rippleScale } = size;
  const { startPoint, endPoint } = getTranslationCoordinates(
    surface,
    initialSize,
    positionEvent,
  );

  // Grow animation: expand the ripple circle
  rs.growAnimation = surface.animate(
    {
      top: [0, 0],
      left: [0, 0],
      height: [`${initialSize}px`, `${initialSize}px`],
      width: [`${initialSize}px`, `${initialSize}px`],
      transform: [
        `translate(${startPoint.x}px, ${startPoint.y}px) scale(1)`,
        `translate(${endPoint.x}px, ${endPoint.y}px) scale(${rippleScale})`,
      ],
    },
    {
      pseudoElement: "::after",
      duration: PRESS_GROW_MS,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      fill: "forwards",
    },
  );

  // Fade-in animation: fast opacity ramp (105ms, matching material-web)
  rs.fadeAnimation = surface.animate(
    { opacity: [0, 0.12] },
    {
      pseudoElement: "::after",
      duration: 105,
      easing: "linear",
      fill: "forwards",
    },
  );
}

function fadeOutRipple(surface: HTMLElement, rs: RippleState) {
  surface.removeAttribute("data-pressed");
  // Cancel any existing fade-in, start fade-out (375ms linear, matching material-web)
  rs.fadeAnimation?.cancel();
  // Nothing was drawn (reduced motion, hidden surface): nothing to fade.
  if (!rs.growAnimation) {
    rs.fadeAnimation = null;
    return;
  }
  rs.fadeAnimation = surface.animate(
    { opacity: [0.12, 0] },
    {
      pseudoElement: "::after",
      duration: 375,
      easing: "linear",
      fill: "forwards",
    },
  );
}

function endPressAnimation(surface: HTMLElement, rs: RippleState) {
  rs.rippleStartEvent = null;
  rs.state = INACTIVE;
  window.clearTimeout(rs.touchDelayId);
  rs.touchDelayId = undefined;

  const animation = rs.growAnimation;
  let pressAnimationPlayState = Infinity;
  if (typeof animation?.currentTime === "number") {
    pressAnimationPlayState = animation.currentTime;
  }

  if (pressAnimationPlayState >= MINIMUM_PRESS_MS) {
    // Animation has played long enough, fade out immediately
    fadeOutRipple(surface, rs);
    return;
  }

  // Wait for minimum press time, then fade out
  const remaining = MINIMUM_PRESS_MS - pressAnimationPlayState;
  setTimeout(() => {
    if (rs.growAnimation !== animation) {
      // A new press started: don't interfere
      return;
    }
    fadeOutRipple(surface, rs);
  }, remaining);
}

// ── Provider Component ──

export interface RippleProviderProps {
  class?: ClassList;
}

/**
 * Global ripple event delegation provider.
 * Place once in your app layout. Handles all ripple animations
 * for any element with a `data-ripple` attribute.
 *
 * ```tsx
 * // In layout.tsx
 * <RippleProvider>
 *   <Slot />
 * </RippleProvider>
 * ```
 */
export const RippleProvider = component$<RippleProviderProps>(() => {
  // ── pointerdown: start ripple ──
  useOnDocument(
    "pointerdown",
    $((event: PointerEvent) => {
      const target = findRippleHost(event.target);
      if (!target) return;

      const rs = getState(target.surface);
      if (!shouldReactToEvent(event, rs)) return;

      rs.rippleStartEvent = event;

      if (!isTouch(event)) {
        // Mouse/pen: start immediately, wait for click to end
        rs.state = WAITING_FOR_CLICK;
        startPressAnimation(target.surface, rs, event);
        return;
      }

      // Touch: delay to distinguish scroll from press
      rs.state = TOUCH_DELAY;
      window.clearTimeout(rs.touchDelayId);
      rs.touchDelayId = window.setTimeout(() => {
        if (rs.state !== TOUCH_DELAY) return;
        rs.state = HOLDING;
        startPressAnimation(target.surface, rs, rs.rippleStartEvent);
      }, TOUCH_DELAY_MS);
    }),
  );

  // ── pointerup: transition state (do NOT end animation: wait for click) ──
  useOnDocument(
    "pointerup",
    $((event: PointerEvent) => {
      const target = findRippleHost(event.target);
      if (!target) return;

      const rs = getState(target.surface);
      if (!shouldReactToEvent(event, rs)) return;

      if (rs.state === HOLDING) {
        // Touch held long enough: wait for click to finish
        rs.state = WAITING_FOR_CLICK;
        return;
      }

      if (rs.state === TOUCH_DELAY) {
        // Touch released before delay: show quick press animation then wait for click
        rs.state = WAITING_FOR_CLICK;
        startPressAnimation(target.surface, rs, rs.rippleStartEvent);
        return;
      }
    }),
  );

  // ── click: end the ripple animation ──
  useOnDocument(
    "click",
    $((event: Event) => {
      const target = findRippleHost(event.target);
      if (!target) return;

      const rs = getState(target.surface);

      // Check disabled
      if (
        target.host.hasAttribute("disabled") ||
        target.host.getAttribute("aria-disabled") === "true"
      )
        return;

      if (rs.state === WAITING_FOR_CLICK) {
        // Normal flow: pointer started it, click finishes it
        endPressAnimation(target.surface, rs);
        return;
      }

      if (rs.state === INACTIVE) {
        // Keyboard-synthesized click (Enter/Space): no pointer events fired
        startPressAnimation(target.surface, rs);
        endPressAnimation(target.surface, rs);
      }
    }),
  );

  // ── pointerleave: end if pointer leaves element ──
  useOnDocument(
    "pointerleave",
    $((event: PointerEvent) => {
      const target = findRippleHost(event.target);
      if (!target) return;
      // Qwik listens on the document in the capture phase, so this also sees `pointerleave` from
      // the host's children (its icon, its label). Only the host itself ends the ripple (fix,
      // not in e-store: there the ripple stopped when the pointer crossed from icon to label).
      if (event.target !== target.host) return;

      const rs = getState(target.surface);
      if (!shouldReactToEvent(event, rs)) return;

      if (rs.state !== INACTIVE) {
        endPressAnimation(target.surface, rs);
      }
    }),
  );

  // ── pointercancel: end animation ──
  useOnDocument(
    "pointercancel",
    $((event: PointerEvent) => {
      const target = findRippleHost(event.target);
      if (!target) return;

      const rs = getState(target.surface);
      if (!shouldReactToEvent(event, rs)) return;

      endPressAnimation(target.surface, rs);
    }),
  );

  // ── contextmenu: end animation ──
  useOnDocument(
    "contextmenu",
    $(() => {
      // Walk all surfaces that might be pressed and end them
      const pressed = document.querySelectorAll(
        "[data-ripple-surface][data-pressed]",
      );
      pressed.forEach((surface) => {
        const rs = rippleStates.get(surface);
        if (rs) {
          endPressAnimation(surface as HTMLElement, rs);
        }
      });
    }),
  );

  return <Slot />;
});

// ── Surface Component ──

export interface RippleSurfaceProps {
  class?: ClassList;
}

/**
 * Ripple animation surface. Place as a child of any `data-ripple` element.
 *
 * The `::after` pseudo-element is the press ripple. Opacity uses asymmetric timing to match
 * material-web:
 * - Fade-in: 105ms (fast appear on press)
 * - Fade-out: 375ms linear (slow dissolve on release)
 *
 * ```tsx
 * <button data-ripple class="relative overflow-hidden">
 *   <RippleSurface />
 *   Click me
 * </button>
 * ```
 */
export const RippleSurface = component$<RippleSurfaceProps>(
  ({ class: className }) => {
    return (
      <span
        data-qds-ripple=""
        data-ripple-surface
        class={[
          "pointer-events-none",
          "absolute inset-0 overflow-hidden rounded-[inherit]",
          "-webkit-tap-highlight-color-transparent",
          // Press ripple layer (::after)
          // No inset, no CSS opacity transitions: size/position/opacity are all WAAPI-controlled
          "after:absolute after:opacity-0 after:content-['']",
          "after:bg-[radial-gradient(closest-side,currentColor_max(calc(100%-70px),65%),transparent_100%)]",
          "after:origin-center",
          className,
        ]}
        aria-hidden="true"
      />
    );
  },
);
