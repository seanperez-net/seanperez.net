import { component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";

/**
 * Material Design 3 Expressive progress indicators: linear and circular, determinate and
 * indeterminate, flat or wavy, default (4dp) or thick (8dp).
 *
 * e-store's `Progress` (compound `Progress.Linear` / `Progress.Circular`, `value` / `max`,
 * `valueText`, `aria-label` / `aria-labelledby`, `role="progressbar"`) brought up to M3
 * Expressive: the 4dp gap between the active indicator and the track, the stop indicator, the
 * `secondary-container` track, the wave and the thick variant. The motion is in
 * `tokens/components/progress.css` (Compose material3 timings).
 *
 * @see https://m3.material.io/components/progress-indicators/specs
 * @see https://www.w3.org/TR/wai-aria-1.2/#progressbar
 */

export type ProgressThickness = "default" | "thick";

type ProgressCommonProps = {
  /** Progress, 0 to `max`. Omit for indeterminate. */
  value?: number;
  /** The value of a finished process. Default 1. */
  max?: number;
  /** M3 Expressive wavy active indicator. */
  wavy?: boolean;
  /** `default` (4dp) or `thick` (8dp, M3's sample of the configurable thickness). */
  thickness?: ProgressThickness;
  /** Human-readable progress for screen readers (`aria-valuetext`), e.g. "Step 3 of 5". */
  valueText?: string;
  /** What is in progress, e.g. "Loading news article" (M3: every progress bar is named). */
  "aria-label"?: string;
  /** Id of a visible element naming it (instead of `aria-label`). */
  "aria-labelledby"?: string;
  class?: PropsOf<"div">["class"];
  id?: string;
};

/** The fraction done, 0..1, or null when indeterminate. */
const fraction = (value: number | undefined, max: number): number | null =>
  value === undefined || value === null || Number.isNaN(value)
    ? null
    : Math.min(Math.max(value / (max || 1), 0), 1);

/** Compose's default amplitude: flat up to 10% and from 95%. */
const waveShows = (p: number) => p > 0.1 && p < 0.95;

// ── Linear ──────────────────────────────────────────────────────────────────

export const linearProgressVariants = tv({
  slots: {
    // Flex follows the text direction, so the determinate bar fills from the inline start in
    // right-to-left text by itself. The indeterminate bar is drawn in physical coordinates and is
    // mirrored instead (`indeterminateRtl`).
    root: ["relative", "flex", "w-full", "items-center", "overflow-hidden"],
    indicator: ["shrink-0", "rounded-full", "bg-primary"],
    track: ["relative", "flex-1", "rounded-full", "bg-secondary-container"],
    stop: [
      "absolute",
      "inset-e-0",
      "top-1/2",
      "size-1",
      "-translate-y-1/2",
      "rounded-full",
      "bg-primary",
    ],
    line: ["absolute", "rounded-full", "bg-primary"],
  },
  variants: {
    thickness: {
      default: {
        root: "h-1",
        indicator: "h-1",
        track: "h-1",
        line: "inset-y-0",
      },
      // Thick: 8dp, and the stop indicator 2dp in from the end.
      thick: {
        root: "h-2",
        indicator: "h-2",
        track: "h-2",
        stop: "inset-e-0.5",
        line: "inset-y-0",
      },
    },
    /** With the wave the box is 10dp (thick 14dp); the track stays flat in the middle. */
    wavy: {
      true: {
        indicator: "h-full rounded-none motion-reduce:animate-none",
        line: "rounded-none motion-reduce:animate-none",
      },
      false: {},
    },
    /** Nothing done yet: no active indicator, no gap. */
    empty: { true: { indicator: "hidden" }, false: { track: "ms-1" } },
  },
  compoundVariants: [
    { wavy: true, thickness: "default", class: { root: "h-2.5" } },
    { wavy: true, thickness: "thick", class: { root: "h-3.5" } },
  ],
  defaultVariants: { thickness: "default", wavy: false, empty: false },
});

export type LinearProgressProps = ProgressCommonProps & {
  /**
   * The 4dp dot at the end of the track. M3: keep it unless the track has 3:1 contrast with
   * what is around it. Default `true`. Determinate only.
   */
  stopIndicator?: boolean;
};

/** The gap the two moving lines cut in the track: 4dp, less while a line is shorter. */
const gap = (h: string, t: string) =>
  `min(4px, (var(${h}) - var(${t})) * 1000px)`;
const cut = (h: string, t: string) =>
  `linear-gradient(to right, #000 calc(var(${t}) * 100% - ${gap(h, t)}), transparent 0 calc(var(${h}) * 100% + ${gap(h, t)}), #000 0)`;
const indeterminateTrackMask = `${cut("--progress-h1", "--progress-t1")}, ${cut("--progress-h2", "--progress-t2")}`;

const Linear = component$<LinearProgressProps>(
  ({
    value,
    max = 1,
    wavy = false,
    thickness = "default",
    stopIndicator = true,
    valueText,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    class: className,
    id,
  }) => {
    const p = fraction(value, max);
    const thick = thickness === "thick";

    if (p === null) {
      const v = linearProgressVariants({ thickness, wavy });
      const waveClass = wavy
        ? thick
          ? "progress-wave-thick-short"
          : "progress-wave-short"
        : "";
      return (
        <div
          id={id}
          role="progressbar"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuetext={valueText}
          data-indeterminate=""
          class={[
            v.root(),
            "progress-lines [direction:ltr] rtl:-scale-x-100",
            className,
          ]}
        >
          <div
            class={[v.track(), "absolute inset-x-0 top-1/2 -translate-y-1/2"]}
            style={{
              maskImage: indeterminateTrackMask,
              maskComposite: "intersect",
            }}
          />
          {[1, 2].map((n) => (
            <div
              key={n}
              class={[v.line(), waveClass]}
              style={{
                left: `calc(var(--progress-t${n}) * 100%)`,
                width: `calc((var(--progress-h${n}) - var(--progress-t${n})) * 100%)`,
              }}
            />
          ))}
        </div>
      );
    }

    const showWave = wavy && waveShows(p);
    const v = linearProgressVariants({
      thickness,
      wavy: showWave,
      empty: p === 0,
    });
    return (
      <div
        id={id}
        role="progressbar"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={p * max}
        aria-valuetext={valueText}
        // A wavy bar keeps its box height whether or not the wave shows, so nothing jumps.
        class={[v.root(), wavy && (thick ? "h-3.5" : "h-2.5"), className]}
      >
        <div
          class={[
            v.indicator(),
            showWave && (thick ? "progress-wave-thick" : "progress-wave"),
            "transition-[width] duration-medium-1 ease-standard motion-reduce:transition-none",
          ]}
          style={{ width: `${p * 100}%` }}
        />
        <div class={v.track()}>
          {stopIndicator && <span class={v.stop()} aria-hidden="true" />}
        </div>
      </div>
    );
  },
);

// ── Circular ────────────────────────────────────────────────────────────────

/** Box, stroke and radius per variant (M3 specs: 40 / 44 flat, 48 / 52 wavy). */
const circleGeometry = (wavy: boolean, thick: boolean) => {
  const stroke = thick ? 8 : 4;
  const amplitude = wavy ? 1.6 : 0;
  const size = wavy ? (thick ? 52 : 48) : thick ? 44 : 40;
  const radius = (size - stroke) / 2 - amplitude;
  return { stroke, amplitude, size, radius };
};

/**
 * A closed wavy circle as an SVG path: radius `r + a·sin(kθ)`, with `k` whole waves of about
 * 15dp (Compose adjusts the wavelength so the wave closes). Starts at 3 o'clock, clockwise.
 */
const wavyCircle = (c: number, r: number, a: number, k: number) => {
  const steps = k * 16;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rr = r + a * Math.sin(k * t);
    const x = (c + rr * Math.cos(t)).toFixed(2);
    const y = (c + rr * Math.sin(t)).toFixed(2);
    d += `${i === 0 ? "M" : "L"}${x} ${y}`;
  }
  return `${d}Z`;
};

const circularStroke = "fill-none [stroke-linecap:round]";

const Circular = component$<ProgressCommonProps>(
  ({
    value,
    max = 1,
    wavy = false,
    thickness = "default",
    valueText,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    class: className,
    id,
  }) => {
    const p = fraction(value, max);
    const thick = thickness === "thick";
    const { stroke, amplitude, size, radius } = circleGeometry(wavy, thick);
    const c = size / 2;
    const circumference = 2 * Math.PI * radius;
    const waves = Math.max(1, Math.round(circumference / 15));
    // The 4dp gap between indicator and track, plus the two round caps, in pathLength units.
    const g = ((4 + stroke) / circumference) * 100;
    const showWave = wavy && (p === null || waveShows(p));
    const activeShape = showWave ? (
      <path
        d={wavyCircle(c, radius, amplitude, waves)}
        pathLength={100}
        stroke-width={stroke}
        class={[circularStroke, "stroke-primary"]}
        data-active=""
      />
    ) : (
      <circle
        cx={c}
        cy={c}
        r={radius}
        pathLength={100}
        stroke-width={stroke}
        class={[circularStroke, "stroke-primary"]}
        data-active=""
      />
    );

    if (p === null) {
      return (
        <div
          id={id}
          role="progressbar"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuetext={valueText}
          data-indeterminate=""
          class={["inline-flex shrink-0 progress-arc", className]}
          style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
        >
          {/* A full 1080deg turn every 6s, and a 90deg step every 1.5s on top (Compose). */}
          <div class="size-full animate-[progress-spin_6000ms_linear_infinite]">
            <div class="size-full animate-[progress-step_6000ms_linear_infinite]">
              <svg
                viewBox={`0 0 ${size} ${size}`}
                class="size-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx={c}
                  cy={c}
                  r={radius}
                  pathLength={100}
                  stroke-width={stroke}
                  class={[circularStroke, "stroke-secondary-container"]}
                  style={{
                    strokeDasharray: `max(0, 100 - var(--progress-arc) - ${2 * g}) 100`,
                    strokeDashoffset: `calc(-1 * (var(--progress-arc) + ${g}))`,
                  }}
                />
                <g style={{ strokeDasharray: "var(--progress-arc) 100" }}>
                  {activeShape}
                </g>
              </svg>
            </div>
          </div>
        </div>
      );
    }

    const arc = p * 100;
    const trackLength = 100 - arc - 2 * g;
    return (
      <div
        id={id}
        role="progressbar"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={p * max}
        aria-valuetext={valueText}
        class={["inline-flex shrink-0", className]}
        style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          class="size-full -rotate-90"
          aria-hidden="true"
        >
          {/* No active arc yet: the track is the whole ring. */}
          {(p === 0 || trackLength > 0) && (
            <circle
              cx={c}
              cy={c}
              r={radius}
              pathLength={100}
              stroke-width={stroke}
              class={[circularStroke, "stroke-secondary-container"]}
              style={
                p === 0
                  ? undefined
                  : {
                      strokeDasharray: `${trackLength} 100`,
                      strokeDashoffset: `${-(arc + g)}`,
                    }
              }
            />
          )}
          {p > 0 && (
            <g
              class={[
                // The wave travels one wavelength a second: the path turns by one wavelength
                // while its dash turns back as far, so the arc itself stays put.
                showWave &&
                  "*:origin-center *:animate-[progress-wave-turn_1s_linear_infinite] *:transform-view motion-reduce:*:animate-none",
                "transition-[stroke-dasharray] duration-medium-1 ease-standard motion-reduce:transition-none",
              ]}
              style={{
                strokeDasharray: `${arc} 100`,
                "--progress-wave-deg": `${360 / waves}deg`,
                "--progress-wave-units": `${100 / waves}`,
              }}
            >
              {activeShape}
            </g>
          )}
        </svg>
      </div>
    );
  },
);

export type CircularProgressProps = ProgressCommonProps;

/** M3 progress indicators: `Progress.Linear`, `Progress.Circular`. */
export const Progress = {
  Linear,
  Circular,
};
