import { component$, useComputed$, useId } from "@qwik.dev/core";
import type { CSSProperties, PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 Expressive slider: standard, centered and range, horizontal or vertical,
 * five sizes. https://m3.material.io/components/sliders/specs
 *
 * Built as Google's material-web `md-slider` is: a REAL `<input type="range">` per handle does
 * the keyboard, the screen reader, RTL, forms and the accessible name. It covers the whole
 * slider with its own drawing transparent (`opacity-0`, a 4px thumb so the native thumb travels
 * exactly where the drawn handle does). The track segments, handle(s), stops, inset icon and
 * value indicator are spans placed from two custom properties, `--start` and `--end` (fractions
 * 0..1), which the root sets in `style` from the value: the server HTML is already right before
 * any JavaScript runs. Focus and press styling come from CSS (`peer-focus-visible`,
 * `peer-active`); the only script updates the value on `input`.
 *
 * Geometry, along the track's INLINE axis (logical, so RTL mirrors it, and the vertical slider
 * is the same drawing in `writing-mode: vertical-lr; direction: rtl`, which puts the start at the
 * bottom). For a fraction f the 4px handle slot starts at `f * (100% - 4px)`; each track segment
 * stops 6px before the slot and starts 6px after it (the gap is SPACE, not a painted shadow, so
 * it works on any background).
 */
export const sliderVariants = tv({
  slots: {
    root: ["group/slider", "relative", "min-w-0", "text-on-surface"],
    label: ["text-body-large", "text-on-surface-variant", "select-none"],
    // The box the parts are placed in. It is at least 48px across the track (M3 touch target),
    // more when the handle is taller.
    track: [
      "relative",
      "block-[max(48px,var(--slider-handle))]",
      "[--slider-gap:6px]",
      "[--slider-inner:2px]",
      // Windows High Contrast repaints backgrounds as Canvas, which would hide every part; keep
      // them and use system colors instead (per part below). NOT checked in forced colors.
      "forced-colors:forced-color-adjust-none",
    ],
    // The native thumb is 48px along the track (a finger-sized target: iOS Safari only drags a
    // range from its thumb), and the input reaches 22px past each end of the track. The thumb's
    // centre then travels `22px... W - 22px` of the input = `2px + f * (100% - 4px)` of the
    // track: exactly the drawn handle's centre, so the browser's pointer-to-value mapping and
    // the drawing agree. (Second agent's review, 2026-11-23; md-slider has its own Safari fix.)
    input: [
      "absolute",
      "inset-y-0",
      "-inset-s-5.5",
      "m-0",
      "block-full",
      "inline-[calc(100%+44px)]",
      "appearance-none",
      "bg-transparent",
      "opacity-0",
      "cursor-pointer",
      "disabled:cursor-default",
      "-webkit-tap-highlight-color-transparent",
      "[&::-webkit-slider-runnable-track]:appearance-none",
      "[&::-webkit-slider-thumb]:appearance-none",
      "[&::-webkit-slider-thumb]:inline-12",
      "[&::-webkit-slider-thumb]:block-(--slider-handle)",
      "[&::-moz-range-thumb]:appearance-none",
      "[&::-moz-range-thumb]:border-0",
      "[&::-moz-range-thumb]:inline-12",
      "[&::-moz-range-thumb]:block-(--slider-handle)",
    ],
    segment: [
      "pointer-events-none",
      "absolute",
      "inset-y-0",
      "my-auto",
      "block-(--slider-track)",
    ],
    // A stop on the inactive track's outer end(s), 4dp in from the end (material-web
    // `stop-indicator-trailing-space`).
    endStop: [
      "absolute",
      "inset-y-0",
      "my-auto",
      "size-1",
      "rounded-full",
      "bg-on-secondary-container",
      "group-data-disabled/slider:bg-on-surface/38",
      "forced-colors:bg-[CanvasText]",
    ],
    tick: [
      "pointer-events-none",
      "absolute",
      "inset-y-0",
      "my-auto",
      "size-1",
      "rounded-full",
      "data-[on=active]:bg-on-primary",
      "data-[on=inactive]:bg-on-secondary-container",
      "data-[on=hidden]:hidden",
      "group-data-disabled/slider:data-[on=active]:bg-inverse-on-surface",
      "group-data-disabled/slider:data-[on=inactive]:bg-on-surface/38",
      "forced-colors:data-[on=active]:bg-[HighlightText]",
      "forced-colors:data-[on=inactive]:bg-[CanvasText]",
    ],
    // The inset icon: in the active track, or (`iconMoved`) just past the handle when the
    // active track is too short for it. Container queries on the active segment decide which.
    icon: [
      "pointer-events-none",
      "absolute",
      "inset-y-0",
      "my-auto",
      "flex",
      "inset-s-(--slider-icon-pad)",
      "[&>svg]:inline-(--slider-icon)",
      "[&>svg]:block-(--slider-icon)",
      "block-(--slider-icon)",
      "text-on-primary",
      "group-data-disabled/slider:text-inverse-on-surface",
    ],
    iconMoved: [
      "pointer-events-none",
      "absolute",
      "inset-y-0",
      "my-auto",
      "hidden",
      "inset-s-[calc(100%+var(--slider-gap)*2+4px+var(--slider-icon-pad))]",
      "[&>svg]:inline-(--slider-icon)",
      "[&>svg]:block-(--slider-icon)",
      "block-(--slider-icon)",
      "text-on-secondary-container",
      "group-data-disabled/slider:text-on-surface/38",
    ],
    handle: [
      "pointer-events-none",
      "absolute",
      "inset-y-0",
      "my-auto",
      "block-(--slider-handle)",
      "rounded-full",
      "bg-primary",
      "[--slider-handle-width:4px]",
      "inline-(--slider-handle-width)",
      // Narrowed about its centre by a margin, so only the width animates, never the position
      // (a position transition made the handle trail the track while dragging).
      "ms-[calc((4px-var(--slider-handle-width))/2)]",
      // The focus ring hugs the bar: our focus-ring tokens (secondary, 3px, 2px out).
      "outline-0",
      "outline-offset-2",
      "outline-focus-ring",
      "transition-[inline-size,margin-inline-start]",
      "duration-short-3",
      "ease-standard",
      "motion-reduce:transition-none",
      "group-data-disabled/slider:bg-on-surface/38",
      "forced-colors:bg-[CanvasText]",
      "forced-colors:group-data-disabled/slider:bg-[GrayText]",
    ],
    // A zero-width anchor at the handle's centre; flex centring keeps the bubble centred on it
    // whatever its width, in either direction.
    indicator: [
      "pointer-events-none",
      "absolute",
      "flex",
      "inline-0",
      "justify-center",
      "inset-be-[calc(50%+var(--slider-handle)/2+12px)]",
      "opacity-0",
      "scale-75",
      "transition-[opacity,scale]",
      "duration-short-3",
      "ease-standard",
      "motion-reduce:transition-none",
    ],
    bubble: [
      "grid",
      "place-items-center",
      "[writing-mode:horizontal-tb]",
      "h-11",
      "min-w-12",
      "px-3",
      "rounded-full",
      "bg-inverse-surface",
      "text-inverse-on-surface",
      "text-label-large",
      "whitespace-nowrap",
    ],
  },
  variants: {
    orientation: {
      horizontal: {
        root: ["grid", "w-full", "gap-1"],
        // A touch drag moves the slider; a vertical swipe still scrolls the page.
        input: ["touch-pan-y"],
      },
      vertical: {
        root: ["inline-grid", "justify-items-center", "gap-2"],
        input: ["touch-pan-x"],
        // Zero at the bottom: the inline axis runs upward. The native input inherits this, so
        // it is a vertical range input (Chrome 124, Firefox 120, Safari 16.5: MDN BCD).
        track: [
          "[writing-mode:vertical-lr]",
          "[direction:rtl]",
          "inline-(--slider-length,15rem)",
        ],
      },
    },
    /** Track height, outer corner, handle height, inset icon size and padding (M3 specs). */
    size: {
      xs: {
        root: [
          "[--slider-track:16px]",
          "[--slider-outer:8px]",
          "[--slider-handle:44px]",
        ],
      },
      sm: {
        root: [
          "[--slider-track:24px]",
          "[--slider-outer:8px]",
          "[--slider-handle:44px]",
        ],
      },
      md: {
        root: [
          "[--slider-track:40px]",
          "[--slider-outer:12px]",
          "[--slider-handle:52px]",
          "[--slider-icon:24px]",
          "[--slider-icon-pad:6px]",
        ],
        // The icon needs 24 + 2 * 6 = 36px of active track (container queries take no var()).
        icon: ["[@container(inline-size<36px)]:hidden"],
        iconMoved: ["[@container(inline-size<36px)]:flex"],
      },
      lg: {
        root: [
          "[--slider-track:56px]",
          "[--slider-outer:16px]",
          "[--slider-handle:68px]",
          "[--slider-icon:24px]",
          "[--slider-icon-pad:6px]",
        ],
        icon: ["[@container(inline-size<36px)]:hidden"],
        iconMoved: ["[@container(inline-size<36px)]:flex"],
      },
      xl: {
        root: [
          "[--slider-track:96px]",
          "[--slider-outer:28px]",
          "[--slider-handle:108px]",
          "[--slider-icon:32px]",
          "[--slider-icon-pad:8px]",
        ],
        icon: ["[@container(inline-size<48px)]:hidden"],
        iconMoved: ["[@container(inline-size<48px)]:flex"],
      },
    },
    /** Which track segment: its color and whether it clips its end stop. */
    tone: {
      active: {
        segment: [
          "@container",
          "bg-primary",
          "group-data-disabled/slider:bg-on-surface/38",
          "forced-colors:bg-[Highlight]",
          "forced-colors:group-data-disabled/slider:bg-[GrayText]",
        ],
      },
      inactive: {
        segment: [
          "overflow-hidden",
          "bg-secondary-container",
          "group-data-disabled/slider:bg-on-surface/12",
          "forced-colors:bg-[Canvas]",
          "forced-colors:outline",
          "forced-colors:outline-1",
          "forced-colors:-outline-offset-1",
          "forced-colors:outline-[CanvasText]",
        ],
      },
    },
    /** Which input drives a handle or indicator (`end` is also the single handle). */
    handle: {
      start: {
        handle: [
          "peer-focus-visible/start:[--slider-handle-width:2px]",
          "peer-active/start:[--slider-handle-width:2px]",
          "peer-focus-visible/start:outline-3",
        ],
        indicator: [
          "peer-focus-visible/start:opacity-100",
          "peer-focus-visible/start:scale-100",
          "peer-active/start:opacity-100",
          "peer-active/start:scale-100",
        ],
      },
      end: {
        handle: [
          "peer-focus-visible/end:[--slider-handle-width:2px]",
          "peer-active/end:[--slider-handle-width:2px]",
          "peer-focus-visible/end:outline-3",
        ],
        indicator: [
          "peer-focus-visible/end:opacity-100",
          "peer-focus-visible/end:scale-100",
          "peer-active/end:opacity-100",
          "peer-active/end:scale-100",
        ],
      },
    },
  },
  defaultVariants: { orientation: "horizontal", size: "xs" },
});

export type SliderVariant = "standard" | "centered" | "range";
export type SliderOrientation = "horizontal" | "vertical";
export type SliderSize = "xs" | "sm" | "md" | "lg" | "xl";
/** Which value changed: `value` (standard, centered), or a range's `start` / `end`. */
export type SliderHandle = "value" | "start" | "end";

export type SliderProps = Omit<
  PropsOf<"div">,
  "children" | "onInput$" | "onChange$"
> & {
  /** `standard` (default), `centered` (fills from the middle), `range` (two handles). */
  variant?: SliderVariant;
  /** `vertical` is for standard and centered only; a range is always horizontal. */
  orientation?: SliderOrientation;
  /** Track and handle size, M3 XS to XL. Default `xs`. */
  size?: SliderSize;
  min?: number;
  max?: number;
  step?: number;
  /** Show a stop at every step (keep the steps few). */
  stops?: boolean;
  /**
   * The stop on the inactive track's end (M3 Expressive). `false` leaves it out, as
   * material-web's `md-slider` (no stop) in the Material Web catalog's theme menu. Default true.
   */
  endStops?: boolean;
  /** Standard / centered: the value, two-way. */
  "bind:value"?: Signal<number>;
  /** Standard / centered: the value without a bound signal (default min, centered: the middle). */
  value?: number;
  /** Range: the lower value, two-way. */
  "bind:start"?: Signal<number>;
  /** Range: the lower value without a bound signal (default min). */
  start?: number;
  /** Range: the upper value, two-way. */
  "bind:end"?: Signal<number>;
  /** Range: the upper value without a bound signal (default max). */
  end?: number;
  /** Called on every move with the new value and which handle moved. */
  onValueChange$?: QRL<(value: number, handle: SliderHandle) => void>;
  /** Standard, md / lg / xl only: an icon inside the active track. */
  icon?: IconName;
  /** The icon shown instead at the minimum (e.g. `volume_off`). */
  iconAtMin?: IconName;
  /** Show the value above the handle while it is pressed or keyboard-focused. */
  valueIndicator?: boolean;
  disabled?: boolean;
  /** Form field name (standard, centered). */
  name?: string;
  /** Range: form field names of the two handles. */
  startName?: string;
  endName?: string;
  /** A visible label above the slider, linked to the input(s). */
  label?: string;
  /** Range: each handle's own accessible name. */
  startLabel?: string;
  endLabel?: string;
  /** Text read and shown for the value instead of the number (sets `aria-valuetext`). */
  valueText?: string;
  /** Range: the same for each handle. */
  startValueText?: string;
  endValueText?: string;
};

// The handle slot's start for a fraction custom property: `f * (100% - 4px)`.
const slot = (fraction: string) => `var(${fraction}) * (100% - 4px)`;
const before = (fraction: string) => `${slot(fraction)} - var(--slider-gap)`;
const after = (fraction: string) =>
  `${slot(fraction)} + 4px + var(--slider-gap)`;

type Corner = "outer" | "inner" | "none";
const radius = (corner: Corner) =>
  corner === "outer"
    ? "var(--slider-outer)"
    : corner === "inner"
      ? "var(--slider-inner)"
      : "0px";

/** A segment from `from` to `to` (CSS lengths along the track), with its two ends' corners. */
const segmentStyle = (
  from: string,
  to: string,
  startCorner: Corner,
  endCorner: Corner,
): CSSProperties => ({
  insetInlineStart: `calc(${from})`,
  inlineSize: `max(0px, (${to}) - (${from}))`,
  borderStartStartRadius: radius(startCorner),
  borderEndStartRadius: radius(startCorner),
  borderStartEndRadius: radius(endCorner),
  borderEndEndRadius: radius(endCorner),
});

/** The handle slot (its narrowing is a margin in the `handle` slot's classes). */
const handleStyle = (fraction: string): CSSProperties => ({
  insetInlineStart: `calc(${slot(fraction)})`,
});

const indicatorStyle = (fraction: string): CSSProperties => ({
  insetInlineStart: `calc(${slot(fraction)} + 2px)`,
});

// Range: each input takes the pointer on its own side of the midpoint between the two handles
// (material-web's clip-path idea), so a press goes to the nearer handle. Measured in the INPUT,
// which reaches 22px past each end of the track: 22px + 2px + m * (track - 4px).
const MID = "calc((var(--start) + var(--end)) / 2 * (100% - 48px) + 24px)";
const rangeInputClass = {
  start: `[clip-path:inset(0_calc(100%-var(--slider-mid))_0_0)] rtl:[clip-path:inset(0_0_0_calc(100%-var(--slider-mid)))]`,
  end: `[clip-path:inset(0_0_0_var(--slider-mid))] rtl:[clip-path:inset(0_var(--slider-mid)_0_0)]`,
};

/** More stops than this are not drawn (M3: "avoid too many"). */
const MAX_STOPS = 100;

/** A Material 3 slider. See `slider.md`. */
export const Slider = component$<SliderProps>(
  ({
    variant = "standard",
    orientation: givenOrientation = "horizontal",
    size = "xs",
    min = 0,
    max = 100,
    step = 1,
    stops = false,
    endStops = true,
    "bind:value": givenValue,
    value: valueProp,
    "bind:start": givenStart,
    start: startProp,
    "bind:end": givenEnd,
    end: endProp,
    onValueChange$,
    icon,
    iconAtMin,
    valueIndicator = false,
    disabled = false,
    name,
    startName,
    endName,
    label,
    startLabel = "Minimum",
    endLabel = "Maximum",
    valueText,
    startValueText,
    endValueText,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
    id: givenId,
    class: className,
    style,
    ...rest
  }) => {
    const id = useId();
    const labelId = `${id}-label`;
    // `id` names the input of a single slider (so an outside `<label for>` reaches it), and the
    // group of a range.
    const inputId = useComputed$(() =>
      variant !== "range" && givenId ? givenId : `${id}-end`,
    );

    const value = useBoundSignal(
      givenValue,
      valueProp ?? (variant === "centered" ? (min + max) / 2 : min),
      useComputed$(() => valueProp),
    );
    const startValue = useBoundSignal(
      givenStart,
      startProp ?? min,
      useComputed$(() => startProp),
    );
    const endValue = useBoundSignal(
      givenEnd,
      endProp ?? max,
      useComputed$(() => endProp),
    );

    const isRange = useComputed$(() => variant === "range");
    const orientation = useComputed$<SliderOrientation>(() =>
      variant === "range" ? "horizontal" : givenOrientation,
    );

    const fractions = useComputed$(() => {
      const span = max - min || 1;
      const f = (v: number) => Math.min(1, Math.max(0, (v - min) / span));
      if (variant === "range") {
        // Sorted, so a start above the end (from props) still draws a sane range.
        const a = startValue.value;
        const b = endValue.value;
        return { start: f(Math.min(a, b)), end: f(Math.max(a, b)) };
      }
      return { start: variant === "centered" ? 0.5 : 0, end: f(value.value) };
    });

    // Centered: which side of the middle the handle is on, for the corners at the middle.
    const high = useComputed$(() => value.value >= (min + max) / 2);

    const segments = useComputed$(() => {
      if (variant === "range") {
        return {
          before: segmentStyle("0px", before("--start"), "outer", "inner"),
          active: segmentStyle(
            after("--start"),
            before("--end"),
            "inner",
            "inner",
          ),
          after: segmentStyle(after("--end"), "100%", "inner", "outer"),
        };
      }
      if (variant === "centered") {
        // The active track runs from the middle to the handle, on either side.
        const up = high.value;
        return {
          before: segmentStyle(
            "0px",
            `min(50%, ${before("--end")})`,
            "outer",
            up ? "none" : "inner",
          ),
          active: segmentStyle(
            `min(50%, ${after("--end")})`,
            `max(50%, ${before("--end")})`,
            up ? "none" : "inner",
            up ? "inner" : "none",
          ),
          after: segmentStyle(
            `max(50%, ${after("--end")})`,
            "100%",
            up ? "inner" : "none",
            "outer",
          ),
        };
      }
      return {
        before: undefined,
        active: segmentStyle("0px", before("--end"), "outer", "inner"),
        after: segmentStyle(after("--end"), "100%", "inner", "outer"),
      };
    });

    // Stops at each step between the ends (the ends have their own stops). Each knows whether
    // it is on the active track, and the one under a handle is hidden.
    const ticks = useComputed$(() => {
      if (!stops || step <= 0) return [];
      const span = max - min;
      // Steps that fit strictly inside min..max (a step need not divide the span).
      const count = Math.ceil(span / step - 1e-9);
      if (span <= 0 || count < 2 || count > MAX_STOPS) return [];
      const lo =
        variant === "range"
          ? startValue.value
          : variant === "centered"
            ? Math.min(value.value, (min + max) / 2)
            : min;
      const hi =
        variant === "range"
          ? endValue.value
          : variant === "centered"
            ? Math.max(value.value, (min + max) / 2)
            : value.value;
      const handles =
        variant === "range"
          ? [startValue.value, endValue.value]
          : [value.value];
      const list: { key: number; offset: string; on: string }[] = [];
      for (let k = 1; k < count; k++) {
        const v = min + k * step;
        if (variant === "centered" && Math.abs(v - (min + max) / 2) < step / 2)
          continue;
        const under = handles.some((h) => Math.abs(h - v) < step / 2);
        list.push({
          key: k,
          offset: `calc(${(k * step) / span} * (100% - 4px))`,
          on: under ? "hidden" : v > lo && v < hi ? "active" : "inactive",
        });
      }
      return list;
    });

    const showIcon = useComputed$(
      () =>
        !!icon &&
        variant === "standard" &&
        (size === "md" || size === "lg" || size === "xl"),
    );
    const iconName = useComputed$<IconName | undefined>(() =>
      iconAtMin && Math.max(min, value.value) <= min ? iconAtMin : icon,
    );

    // Class strings, not the tv() functions: a computed signal's value must serialise.
    const styles = useComputed$(() => {
      const s = sliderVariants({ orientation: orientation.value, size });
      return {
        root: s.root(),
        label: s.label(),
        track: s.track(),
        input: s.input(),
        active: s.segment({ tone: "active" }),
        inactive: s.segment({ tone: "inactive" }),
        endStop: s.endStop(),
        tick: s.tick(),
        icon: s.icon({ size }),
        iconMoved: s.iconMoved({ size }),
        handleStart: s.handle({ handle: "start" }),
        handleEnd: s.handle({ handle: "end" }),
        indicatorStart: s.indicator({ handle: "start" }),
        indicatorEnd: s.indicator({ handle: "end" }),
        bubble: s.bubble(),
      };
    });

    // `aria-labelledby` from the consumer wins; else the visible label; else `aria-label`.
    const labelledBy = useComputed$(
      () => ariaLabelledby ?? (label ? labelId : undefined),
    );

    // The root's custom properties, joined with the consumer's own `style`.
    const rootStyle = useComputed$(() => {
      const vars = `--start:${fractions.value.start};--end:${fractions.value.end};--slider-mid:${MID}`;
      if (!style) return vars;
      if (typeof style === "string") return `${vars};${style}`;
      return {
        ...(style as CSSProperties),
        "--start": String(fractions.value.start),
        "--end": String(fractions.value.end),
        "--slider-mid": MID,
      };
    });

    return (
      <div
        {...rest}
        id={variant === "range" ? givenId : undefined}
        role={isRange.value ? "group" : undefined}
        aria-labelledby={isRange.value ? labelledBy.value : undefined}
        aria-label={isRange.value && !labelledBy.value ? ariaLabel : undefined}
        data-variant={variant}
        data-orientation={orientation.value}
        data-size={size}
        data-disabled={disabled || undefined}
        class={[styles.value.root, className]}
        style={rootStyle.value}
      >
        {label &&
          (isRange.value ? (
            <span id={labelId} class={styles.value.label}>
              {label}
            </span>
          ) : (
            <label id={labelId} for={inputId.value} class={styles.value.label}>
              {label}
            </label>
          ))}
        <div class={styles.value.track}>
          {isRange.value && (
            <input
              id={`${id}-start`}
              type="range"
              autocomplete="off"
              min={min}
              max={max}
              step={step}
              value={startValue.value}
              name={startName}
              disabled={disabled}
              aria-label={startLabel}
              aria-describedby={ariaDescribedby}
              aria-valuetext={startValueText}
              class={["peer/start", styles.value.input, rangeInputClass.start]}
              onInput$={(_, input) => {
                // The start never passes the end.
                const next = Math.min(input.valueAsNumber, endValue.value);
                if (next !== input.valueAsNumber) input.valueAsNumber = next;
                startValue.value = next;
                if (onValueChange$) onValueChange$(next, "start");
              }}
            />
          )}
          <input
            id={inputId.value}
            type="range"
            // Firefox restores a reloaded form control's value without an `input` event, which
            // would leave the drawing behind the real value.
            autocomplete="off"
            min={min}
            max={max}
            step={step}
            value={isRange.value ? endValue.value : value.value}
            name={isRange.value ? endName : name}
            disabled={disabled}
            aria-label={
              isRange.value
                ? endLabel
                : labelledBy.value
                  ? undefined
                  : ariaLabel
            }
            aria-labelledby={isRange.value ? undefined : ariaLabelledby}
            aria-describedby={ariaDescribedby}
            aria-valuetext={isRange.value ? endValueText : valueText}
            aria-orientation={
              orientation.value === "vertical" ? "vertical" : undefined
            }
            class={[
              "peer/end",
              styles.value.input,
              isRange.value && rangeInputClass.end,
            ]}
            onInput$={(_, input) => {
              if (variant === "range") {
                // The end never passes the start.
                const next = Math.max(input.valueAsNumber, startValue.value);
                if (next !== input.valueAsNumber) input.valueAsNumber = next;
                endValue.value = next;
                if (onValueChange$) onValueChange$(next, "end");
                return;
              }
              value.value = input.valueAsNumber;
              if (onValueChange$) onValueChange$(input.valueAsNumber, "value");
            }}
          />

          {segments.value.before && (
            <span class={styles.value.inactive} style={segments.value.before}>
              {endStops && (
                <span
                  class={styles.value.endStop}
                  style={{ insetInlineStart: "4px" }}
                />
              )}
            </span>
          )}
          <span class={styles.value.inactive} style={segments.value.after}>
            {endStops && (
              <span
                class={styles.value.endStop}
                style={{ insetInlineEnd: "4px" }}
              />
            )}
          </span>
          {/* After the inactive segments, so the icon that moves past the handle paints over them. */}
          <span class={styles.value.active} style={segments.value.active}>
            {showIcon.value && iconName.value && (
              <>
                <span class={styles.value.icon}>
                  <Icon name={iconName.value} />
                </span>
                <span class={styles.value.iconMoved}>
                  <Icon name={iconName.value} />
                </span>
              </>
            )}
          </span>

          {ticks.value.map((tick) => (
            <span
              key={tick.key}
              data-on={tick.on}
              class={styles.value.tick}
              style={{ insetInlineStart: tick.offset }}
            />
          ))}

          {isRange.value && (
            <span
              class={styles.value.handleStart}
              style={handleStyle("--start")}
            />
          )}
          <span class={styles.value.handleEnd} style={handleStyle("--end")} />

          {valueIndicator && isRange.value && (
            <span
              aria-hidden="true"
              class={styles.value.indicatorStart}
              style={indicatorStyle("--start")}
            >
              <span class={styles.value.bubble}>
                {startValueText ??
                  Math.min(max, Math.max(min, startValue.value))}
              </span>
            </span>
          )}
          {valueIndicator && (
            <span
              aria-hidden="true"
              class={styles.value.indicatorEnd}
              style={indicatorStyle("--end")}
            >
              <span class={styles.value.bubble}>
                {isRange.value
                  ? (endValueText ??
                    Math.min(max, Math.max(min, endValue.value)))
                  : (valueText ?? Math.min(max, Math.max(min, value.value)))}
              </span>
            </span>
          )}
        </div>
      </div>
    );
  },
);
