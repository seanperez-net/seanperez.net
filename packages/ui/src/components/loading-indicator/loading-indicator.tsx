import { component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";

/**
 * Material Design 3 Expressive loading indicator: seven Material shapes morphing in turn while
 * they spin, for a short wait (200ms to 5s) whose progress is not known. Default (no container,
 * `primary`) or contained (a `primary-container` circle, `on-primary-container` shape).
 *
 * NEW, not in e-store (e-store has no loading indicator). The motion is
 * `tokens/components/loading-indicator.css`, generated from androidx Compose's
 * `MaterialShapes.kt` / `LoadingIndicator.kt` by `scripts/loading-indicator-shapes.mjs`.
 *
 * @see https://m3.material.io/components/loading-indicator/specs
 * @see https://m3.material.io/components/loading-indicator/accessibility
 */
export const loadingIndicatorVariants = tv({
  slots: {
    root: [
      "inline-flex",
      "shrink-0",
      "items-center",
      "justify-center",
      "rounded-full",
    ],
    // The global turn: 360deg every 4666ms.
    spin: [
      "size-[79.1667%]",
      "animate-[loading-indicator-spin_4666ms_linear_infinite]",
    ],
    // A quarter turn with each morph (28 morphs = 7 turns, so the loop closes).
    step: [
      "size-full",
      "animate-[loading-indicator-step_18200ms_infinite]",
      "[animation-timing-function:var(--ease-expressive-fast-spatial)]",
    ],
    // The 38dp shape in the 48dp box (M3 measurements).
    shape: [
      "size-full",
      "animate-[loading-indicator-morph_4550ms_infinite]",
      "[animation-timing-function:var(--ease-expressive-default-effects)]",
      // Reduced motion: no morph, the soft burst only turns, slower (it must still show that
      // something is happening).
      "motion-reduce:animate-none",
      // The static polygon fills its box; the generated shapes use about 77% of it.
      "motion-reduce:scale-[0.77]",
      "motion-reduce:[clip-path:polygon(50%_0,61%_11%,75%_7%,79%_21%,93%_25%,89%_39%,100%_50%,89%_61%,93%_75%,79%_79%,75%_93%,61%_89%,50%_100%,39%_89%,25%_93%,21%_79%,7%_75%,11%_61%,0_50%,11%_39%,7%_25%,21%_21%,25%_7%,39%_11%)]",
    ],
  },
  variants: {
    contained: {
      false: { shape: "bg-primary" },
      true: {
        root: "bg-primary-container",
        shape: "bg-on-primary-container",
      },
    },
  },
  defaultVariants: { contained: false },
});

export type LoadingIndicatorProps = {
  /** M3 "contained": a circle behind the shape, for use over other content. */
  contained?: boolean;
  /**
   * Size in dp (= CSS px at 1rem 16px). M3: 48 by default, anywhere from 24 to 240. The shape
   * keeps its 38 : 48 ratio to the box.
   */
  size?: number;
  /** What is loading, e.g. "Loading news article" (M3: it uses the progressbar role and a label). */
  "aria-label"?: string;
  /** Id of a visible element naming it (instead of `aria-label`). */
  "aria-labelledby"?: string;
  class?: PropsOf<"div">["class"];
  id?: string;
};

/** The M3 Expressive loading indicator (indeterminate only). */
export const LoadingIndicator = component$<LoadingIndicatorProps>(
  ({
    contained = false,
    size = 48,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    class: className,
    id,
  }) => {
    const v = loadingIndicatorVariants({ contained });
    const dp = Math.min(Math.max(size, 24), 240);
    return (
      <div
        id={id}
        role="progressbar"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        class={[v.root(), className]}
        style={{ width: `${dp / 16}rem`, height: `${dp / 16}rem` }}
      >
        <div class={v.spin()} aria-hidden="true">
          <div class={v.step()}>
            <div class={v.shape()} />
          </div>
        </div>
      </div>
    );
  },
);
