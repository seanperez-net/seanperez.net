/**
 * Places a top-layer tooltip (`position: fixed`) beside its control, in window coordinates.
 * M3 (m3.material.io/components/tooltips/guidelines, read 2026-11-23): a plain tooltip sits
 * above its control, 4dp away (below in an app bar); a rich one at the bottom, extending
 * toward the inline end; either moves to stay on screen. Kept 8dp inside the window.
 *
 * One measured path for every browser. CSS anchor positioning would follow scroll by itself
 * (MDN: Baseline since 2026-09, so older browsers still lack it, and this library loads no
 * polyfill); moving to it is an open option for the owner. The callers re-place on scroll.
 */
export type TooltipSide = "top" | "bottom" | "left" | "right";

const GAP = 4;
const EDGE = 8;

export function placeTooltip(
  tip: HTMLElement,
  host: Element,
  side: TooltipSide,
  /** `center` (plain) or `start` (rich: from the control's middle toward the inline end). */
  align: "center" | "start" = "center",
): void {
  const box = host.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rtl = getComputedStyle(host).direction === "rtl";
  let top: number;
  let left: number;

  if (side === "left" || side === "right") {
    // `left` / `right` are physical here; flip when there is no room.
    let toLeft = side === "left";
    if (toLeft && box.left - GAP - w < EDGE) toLeft = false;
    else if (!toLeft && box.right + GAP + w > vw - EDGE) toLeft = true;
    left = toLeft ? box.left - GAP - w : box.right + GAP;
    top = box.top + box.height / 2 - h / 2;
  } else {
    let below = side === "bottom";
    if (!below && box.top - GAP - h < EDGE) below = true;
    else if (
      below &&
      box.bottom + GAP + h > vh - EDGE &&
      box.top - GAP - h >= EDGE
    )
      below = false;
    top = below ? box.bottom + GAP : box.top - GAP - h;
    const middle = box.left + box.width / 2;
    left = align === "start" ? (rtl ? middle - w : middle) : middle - w / 2;
  }

  left = Math.min(Math.max(left, EDGE), vw - EDGE - w);
  top = Math.min(Math.max(top, EDGE), vh - EDGE - h);
  tip.style.top = `${Math.round(top)}px`;
  tip.style.left = `${Math.round(left)}px`;
}
