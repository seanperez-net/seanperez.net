import {
  $,
  component$,
  sync$,
  useComputed$,
  useId,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { useBoundSignal } from "../../utils/use-bound-signal";

/**
 * Material Design 3 Expressive scroll field. NEW, not in e-store, and no web implementation exists
 * (M3 lists Jetpack Compose only): built from the M3 pages alone, read 2026-11-23:
 * https://m3.material.io/components/scroll-fields/overview, /specs (token table, "expand all";
 * the Web / Expressive token set has the same values as Android / Standard), /guidelines,
 * /accessibility. Proof per item in `scroll-field.md`.
 *
 * A vertical list of values; the one in the centre is the value. Two input modes (M3 overview):
 * `scroll` (the list) and `input` (the "active" state in the specs: the same container with a 2dp
 * `primary` outline, the value alone in `primary`, a `primary` caret, editable).
 *
 * The motion is the browser's: a CSS scroll-snap list (`snap-y snap-mandatory`, items
 * `snap-center`), so swipe, wheel and trackpad scroll and snap natively. Script only reads the
 * centred item (on `scroll`, for the highlight) and commits it (on `scrollend`), moves one step for
 * Up / Down and a tap on an inactive value, and puts the list at the value when it is first seen
 * (one `useVisibleTask$`: a scroll position cannot be rendered on the server).
 *
 * Geometry: the selected value has a 64px line (display-large), the others 52px (display-medium),
 * with a 16px gap (`items gap`): centre to centre 32 + 16 + 26 = 74px. Snapping needs one pitch
 * whichever item is selected, so every item box is 58px (the mean) and the 64px line overflows
 * its box by 3px each side: the same 74px. A spacer of `50% - 45px` (half a box and the gap)
 * before and after the items lets the first and last item reach the centre; item k is then
 * centred at `scrollTop = 74 * k`.
 */
export const scrollFieldVariants = tv({
  slots: {
    // The container's row, then the message line (20px). The default height (`reserveMessage`
    // variant) has zero specificity (`:where`), so a `class="h-full"` (fill) or `h-[160px]`
    // (custom fixed size, M3 specs: Measurements) on the field wins in any stylesheet order.
    root: [
      "group/scroll-field",
      "relative",
      "inline-grid",
      "grid-rows-[minmax(0,1fr)_auto]",
      "align-top",
    ],
    // Positions the two outside tap targets against the container. Min height 120dp.
    box: ["relative", "flex", "min-h-[120px]"],
    // The container: `surface-container-lowest`, 16dp corners, hugging its contents down to a
    // per-size minimum width (specs: Measurements).
    container: [
      "relative",
      "flex",
      "flex-1",
      "flex-col",
      "overflow-hidden",
      "rounded-lg",
      "bg-surface-container-lowest",
      // The `input` mode's 2dp outline (an inset ring, so the focus ring can be the outline), on
      // the ACTIVE field only: the one being typed in (M3 time picker Color drawing: the other
      // input field has none). Invalid: `error-container` fill and an `error` outline, focused
      // or not (M3 time picker States, "Error"; guidelines "highlight the invalid field").
      "data-[mode=input]:ring-inset",
      "data-[mode=input]:ring-primary",
      "data-[mode=input]:has-[input:focus]:ring-2",
      "data-[mode=input]:has-aria-invalid:ring-2",
      "data-[mode=input]:has-aria-invalid:ring-error",
      "data-[mode=input]:has-aria-invalid:bg-error-container",
      // Focus indicator: 3dp `secondary`, 2dp outside (our focus-ring tokens).
      "outline-0",
      "outline-offset-2",
      "outline-focus-ring",
      "has-[[data-scroll-field-control]:focus-visible]:outline-3",
      // State layer: `on-surface`, hover 8%, focus 10%.
      "after:pointer-events-none",
      "after:absolute",
      "after:inset-0",
      "after:bg-on-surface",
      "after:opacity-0",
      "after:transition-opacity",
      "after:duration-spring-fast-effects",
      "motion-reduce:after:transition-none",
      "group-not-data-disabled/scroll-field:hover:after:opacity-8",
      "has-[[data-scroll-field-control]:focus-visible]:after:opacity-10",
      // Disabled: container 38%, outline `on-surface` 38%, no state layer.
      "group-data-disabled/scroll-field:bg-surface-container-lowest/38",
      "group-data-disabled/scroll-field:data-[mode=input]:ring-2",
      "group-data-disabled/scroll-field:data-[mode=input]:ring-on-surface/38",
      "group-data-disabled/scroll-field:after:opacity-0",
      "forced-colors:border",
      "forced-colors:border-[CanvasText]",
    ],
    scroller: [
      "relative",
      "flex",
      "h-full",
      "flex-col",
      "items-stretch",
      "gap-4",
      "overflow-y-auto",
      "overscroll-contain",
      "snap-y",
      "snap-mandatory",
      // The spec drawings show no scroll bar: the cropped values say there is more.
      "scrollbar-none",
      "outline-none",
      "cursor-default",
      "select-none",
      "group-data-disabled/scroll-field:overflow-hidden",
    ],
    spacer: ["shrink-0", "h-[calc(50%-45px)]"],
    // The longest value at the selected size, 0px high: the container keeps its width whichever
    // value is centred (review: the width followed the centred item).
    sizer: [
      "invisible",
      "h-0",
      "overflow-hidden",
      "whitespace-nowrap",
      "text-display-large",
      "font-medium",
    ],
    copy: ["flex", "flex-col", "gap-4"],
    item: [
      "flex",
      "h-[58px]",
      "shrink-0",
      "snap-center",
      "items-center",
      "justify-center",
      "whitespace-nowrap",
      // Unselected: display-medium (45 / 52, 400), `outline`.
      "text-display-medium",
      "text-outline",
      // Selected: display-large (57 / 64, -0.25) at weight 500, `on-surface`.
      // Chromium puts the list at the selected value before any script runs.
      "aria-selected:[scroll-initial-target:nearest]",
      "data-active:text-display-large",
      "data-active:font-medium",
      "data-active:text-on-surface",
      "group-data-invalid/scroll-field:data-active:text-error",
      // Selection transition: M3's fast spatial spring (damping 0.9, stiffness 1400).
      "transition-[font-size,line-height,letter-spacing,color]",
      "duration-spring-fast",
      "ease-spring-fast-spatial",
      "motion-reduce:transition-none",
      "group-data-disabled/scroll-field:opacity-38",
      "group-data-disabled/scroll-field:data-active:text-on-surface",
    ],
    // As wide as the container, which the hidden sizer sizes (the longest value): `w-0` keeps
    // the input's own intrinsic width out of it (a `size` attribute made it 114px at display-large
    // and overflowed a 100dp field).
    input: [
      "h-full",
      "w-0",
      "min-w-full",
      "bg-transparent",
      "text-center",
      "text-display-large",
      "font-medium",
      // `on-surface` at rest, `primary` while typed in (the active field).
      "text-on-surface",
      "focus:text-primary",
      "caret-primary",
      "outline-none",
      "aria-invalid:text-on-error-container",
      "aria-invalid:caret-error",
      "disabled:text-on-surface",
      "disabled:opacity-38",
    ],
    // A tap target outside the container, so an inactive value keeps 48dp to the pointer (M3
    // accessibility: "stretches outside the container"). The neighbour shows `50% - 45px` inside
    // the container; this adds the rest of 48px, so it exists below a 186px-high container.
    outside: [
      "absolute",
      "inset-x-0",
      "h-[max(0px,calc(93px-50%))]",
      "group-data-disabled/scroll-field:hidden",
    ],
    message: ["min-h-5", "px-4", "pt-1", "text-body-small", "text-error"],
  },
  variants: {
    /**
     * `true`: the 20px message line is always there (the height is container + line, 220 by
     * default). `false`: the height is the CONTAINER's (200 by default, M3's), the root is
     * `content-box`, and a message, when there is one, adds its line as bottom padding below that
     * height; an empty line has no size (it stays in the DOM as the live region).
     */
    reserveMessage: {
      // Positioned, so it paints over the outside tap target that may reach below the box.
      true: { root: "[:where(&)]:h-[220px]", message: "relative" },
      false: {
        root: ["[:where(&)]:h-[200px]", "box-content", "data-message:pb-5"],
        // Out of the grid, from the top of the bottom padding (a wrapped message runs on below
        // it rather than over the container); positioned, so it paints over the outside tap
        // target. Empty, it has no size.
        message: [
          "absolute",
          "inset-x-0",
          "top-[calc(100%-1.25rem)]",
          "empty:min-h-0",
          "empty:pt-0",
        ],
      },
    },
    /** Minimum width and side padding (specs: Measurements). */
    size: {
      sm: {
        container: "min-w-[100px]",
        item: "px-4",
        input: "px-4",
        sizer: "px-4",
      },
      md: {
        container: "min-w-[120px]",
        item: "px-4",
        input: "px-4",
        sizer: "px-4",
      },
      lg: {
        container: "min-w-[186px]",
        item: "px-6",
        input: "px-6",
        sizer: "px-6",
      },
    },
  },
  defaultVariants: { size: "sm", reserveMessage: true },
});

export type ScrollFieldValue = string | number;
export type ScrollFieldMode = "scroll" | "input";
export type ScrollFieldSize = "sm" | "md" | "lg";

export type ScrollFieldProps = Omit<
  PropsOf<"div">,
  "children" | "onChange$" | "onInput$"
> & {
  /** The values, top to bottom. Takes precedence over `min` / `max` / `step`. */
  options?: readonly ScrollFieldValue[];
  /** A numeric range instead of `options`: first value. Default 0. */
  min?: number;
  /** Last value of the range. Default 99. */
  max?: number;
  /** Interval between values (M3: "add intervals between values"). Default 1. */
  step?: number;
  /**
   * Minimum digits of a numeric value's whole part, zero-padded for display (`pad={2}`: 05). The
   * values stay numbers and typing stays numeric ("5" then Enter is 5, shown 05). Default none.
   */
  pad?: number;
  /** The value, without a bound signal. Default: the first option. */
  value?: ScrollFieldValue;
  /** The value, two-way. */
  "bind:value"?: Signal<ScrollFieldValue>;
  /** Called once per committed change (after the scroll settles, a key, a tap, or text entry). */
  onValueChange$?: QRL<(value: ScrollFieldValue) => void>;
  /** `scroll` (default) or `input` (text entry). Bind it to the page's keyboard toggle. */
  mode?: ScrollFieldMode;
  /** The mode, two-way. Space / Enter on the field sets it to `input`. */
  "bind:mode"?: Signal<ScrollFieldMode>;
  /** `sm` 1-2 digits (min 100dp), `md` 3 digits (120dp), `lg` 4 digits (186dp). Default `sm`. */
  size?: ScrollFieldSize;
  /** An infinitely looping list (M3 overview: "finite or an infinitely looping list"). */
  loop?: boolean;
  /** The accessible name (M3: label each field when several sit side by side). */
  label?: string;
  /** The id(s) of a visible label, instead of `label`. */
  "aria-labelledby"?: string;
  /** Id(s) of text that describes the control (a host's own error line), before the field's own. */
  "aria-describedby"?: string;
  /**
   * Called when typed text starts or stops matching no value (input mode), so a host can show
   * its own error (pass `invalidText=""` to hide the field's).
   */
  onInvalidChange$?: QRL<(invalid: boolean) => void>;
  disabled?: boolean;
  /** An error shown below the field; the value is highlighted in `error`. */
  error?: string;
  /** Shown when typed text matches no value. */
  invalidText?: string;
  /** Form field name: a hidden input carries the value. */
  name?: string;
  /**
   * Keep the 20px message line even when there is no message (default `true`). `false`: the
   * field is the container's height (M3's 200) and a message adds its line below only while it
   * shows; a fixed height (`class`) is then the container's. For hosts that show no `error`.
   */
  reserveMessage?: boolean;
};

/** An option as shown: a number's whole part zero-padded to `pad` digits. */
const display = (option: ScrollFieldValue, pad: number | undefined) => {
  if (typeof option !== "number" || !pad) return String(option);
  const [whole, fraction] = String(Math.abs(option)).split(".");
  return `${option < 0 ? "-" : ""}${whole.padStart(pad, "0")}${fraction === undefined ? "" : `.${fraction}`}`;
};

/** The list of values from `options`, or `min..max` by `step`. */
const toOptions = (
  options: readonly ScrollFieldValue[] | undefined,
  min: number,
  max: number,
  step: number,
): ScrollFieldValue[] => {
  if (options) return [...options];
  const list: number[] = [];
  const by = step > 0 ? step : 1;
  // Count in steps so decimals do not drift (0.1 + 0.2).
  const decimals = (String(by).split(".")[1] ?? "").length;
  for (let n = 0; min + n * by <= max + 1e-9; n++) {
    list.push(Number((min + n * by).toFixed(decimals)));
  }
  return list;
};

/** Every item element of the list, in DOM order (with `loop`, three copies). */
const itemsOf = (scroller: HTMLElement) =>
  Array.from(scroller.querySelectorAll<HTMLElement>("[data-phys]"));

/** The physical index of the item nearest the centre. */
const centredPhys = (scroller: HTMLElement) => {
  const items = itemsOf(scroller);
  if (items.length < 2) return 0;
  const pitch = items[1].offsetTop - items[0].offsetTop;
  const first = items[0].offsetTop + items[0].offsetHeight / 2;
  const centre = scroller.scrollTop + scroller.clientHeight / 2;
  const phys = Math.round((centre - first) / pitch);
  return Math.max(0, Math.min(items.length - 1, phys));
};

/** Scroll so physical item `phys` is centred. */
const centreOn = (scroller: HTMLElement, phys: number, smooth: boolean) => {
  const item = itemsOf(scroller)[phys];
  if (!item) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({
    top: item.offsetTop + item.offsetHeight / 2 - scroller.clientHeight / 2,
    behavior: smooth && !reduce ? "smooth" : "instant",
  });
};

/** What the list was last put at: the list length, the loop and the index. */
const placedKey = (count: number, loop: boolean, i: number) =>
  `${count}:${loop}:${i}`;

export const ScrollField = component$<ScrollFieldProps>((props) => {
  // The `_` names only take the field's own props out of `rest`; they are read live as
  // `props.x` (in JSX and closures), not from this snapshot.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    options: _options,
    min: _min,
    max: _max,
    step: _step,
    pad: _pad,
    value: initialValue,
    "bind:value": bindValue,
    onValueChange$,
    onInvalidChange$,
    mode: initialMode,
    "bind:mode": bindMode,
    size: _size,
    loop: _loop,
    label: _label,
    "aria-labelledby": _labelledBy,
    "aria-describedby": _describedBy,
    disabled: _disabled,
    error: _error,
    invalidText: _invalidText,
    name: _name,
    reserveMessage: _reserveMessage,
    class: className,
    ...rest
  } = props;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // Read only in useComputed$ closures: the live props proxy, typed to the fields read.
  const reactive: Pick<
    ScrollFieldProps,
    | "options"
    | "min"
    | "max"
    | "step"
    | "value"
    | "mode"
    | "size"
    | "pad"
    | "reserveMessage"
  > = props;

  const options = useComputed$(() =>
    toOptions(
      reactive.options,
      reactive.min ?? 0,
      reactive.max ?? 99,
      reactive.step ?? 1,
    ),
  );
  const value = useBoundSignal<ScrollFieldValue>(
    bindValue,
    initialValue ??
      props.options?.[0] ??
      // The first value of the range.
      props.min ??
      0,
    useComputed$(() => reactive.value),
  );
  const mode = useBoundSignal<ScrollFieldMode>(
    bindMode,
    initialMode ?? "scroll",
    useComputed$(() => reactive.mode),
  );
  // The selected index (0 when the value is not in the list). Compared as text, so "7" and 7
  // are the same value (review).
  const selected = useComputed$(() =>
    Math.max(
      0,
      options.value.findIndex((o) => String(o) === String(value.value)),
    ),
  );
  // The item drawn as active: follows the scroll before it settles.
  const centred = useSignal(-1);
  // Text being typed in `input` mode (null: show the value), and whether it matched nothing.
  const draft = useSignal<string | null>(null);
  const unmatched = useSignal(false);
  const focusInput = useSignal(false);
  const scrollerRef = useSignal<HTMLElement>();
  const inputRef = useSignal<HTMLInputElement>();
  const id = useId();
  const messageId = `${id}-message`;

  /** Commit index `i` as the value. */
  const commit = $((i: number) => {
    const next = options.value[i];
    if (next === undefined || next === value.value) return;
    value.value = next;
    onValueChange$?.(next);
  });

  /** Typed text matched nothing (or matches again): tell the host once per change. */
  const setUnmatched = $((next: boolean) => {
    if (unmatched.value === next) return;
    unmatched.value = next;
    onInvalidChange$?.(next);
  });

  /** One step up (-1) or down (+1): Up / Down keys and taps on the inactive values. */
  const move = $((delta: number) => {
    if (props.disabled) return;
    const count = options.value.length;
    const scroller = scrollerRef.value;
    if (!count || !scroller) return;
    // Step from the item a running step is heading for (quick presses add up), else from the
    // item centred now (a wheel scroll that has not settled), never from the saved value: the
    // value and the list must not disagree (review).
    let base = scroller.dataset.target
      ? Number(scroller.dataset.target)
      : centredPhys(scroller);
    const total = itemsOf(scroller).length;
    if (!props.loop && (base + delta < 0 || base + delta >= total)) return;
    if (base + delta < 0 || base + delta >= total) {
      // Only with a loop and many quick presses: jump back to the middle copy first.
      base = count + (base % count);
      centreOn(scroller, base, false);
    }
    const to = (base + delta) % count;
    centred.value = to;
    // With a loop, move to the physical neighbour (it may sit in the next copy); `settle` then
    // re-centres on the middle copy.
    scroller.dataset.target = String(base + delta);
    scroller.dataset.placed = placedKey(count, !!props.loop, to);
    centreOn(scroller, base + delta, true);
    commit(to);
  });

  /** Read the centred item after the scroll settles, re-centre a loop, commit. */
  const settle = $(() => {
    const scroller = scrollerRef.value;
    if (!scroller) return;
    delete scroller.dataset.target;
    const count = options.value.length;
    if (!count) return;
    const phys = centredPhys(scroller);
    const i = phys % count;
    if (props.loop && Math.floor(phys / count) !== 1) {
      centreOn(scroller, count + i, false);
    }
    centred.value = i;
    scroller.dataset.placed = placedKey(count, !!props.loop, i);
    commit(i);
  });

  // Put the list at the value when it is first seen, when the value changes from outside, and
  // when the field returns from `input` mode (a new list element). In `input` mode, focus the
  // input when Space / Enter asked for it.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const i = track(() => selected.value);
    const m = track(() => mode.value);
    track(() => options.value);
    track(() => props.loop);
    // Tracked too: a host may switch the mode (a bound or controlled `mode`) before or after the
    // key handler asks for focus.
    const wantsFocus = track(() => focusInput.value);
    if (m === "input") {
      if (wantsFocus) {
        focusInput.value = false;
        inputRef.value?.focus();
        inputRef.value?.select();
      }
      return;
    }
    draft.value = null;
    setUnmatched(false);
    const scroller = scrollerRef.value;
    if (!scroller) return;
    centred.value = i;
    // Keyed by count and loop too: a new list or loop with the same index re-centres (review).
    const key = placedKey(options.value.length, !!props.loop, i);
    if (scroller.dataset.placed === key) return;
    scroller.dataset.placed = key;
    centreOn(scroller, (props.loop ? options.value.length : 0) + i, false);
  });

  const copies = useComputed$(() => (props.loop ? [0, 1, 2] : [1]));
  const numeric = useComputed$(() =>
    options.value.every((o) => typeof o === "number"),
  );
  const decimal = useComputed$(() =>
    options.value.some((o) => typeof o === "number" && !Number.isInteger(o)),
  );
  const longestText = useComputed$(() =>
    options.value
      .map((o) => display(o, reactive.pad))
      .reduce((a, b) => (b.length > a.length ? b : a), ""),
  );
  const message = useComputed$(() =>
    props.disabled
      ? ""
      : props.error ||
        (mode.value === "input" && unmatched.value
          ? (props.invalidText ?? "Enter a value from the list")
          : ""),
  );
  const describedBy = useComputed$(
    () =>
      [props["aria-describedby"], message.value ? messageId : undefined]
        .filter(Boolean)
        .join(" ") || undefined,
  );
  // Class strings per slot, recomputed when `size` changes (not read in the component body).
  const slots = useComputed$(() => {
    const v = scrollFieldVariants({
      size: reactive.size ?? "sm",
      reserveMessage: reactive.reserveMessage ?? true,
    });
    return {
      root: v.root(),
      box: v.box(),
      container: v.container(),
      scroller: v.scroller(),
      spacer: v.spacer(),
      sizer: v.sizer(),
      copy: v.copy(),
      item: v.item(),
      input: v.input(),
      outside: v.outside(),
      message: v.message(),
    };
  });

  return (
    <div
      {...rest}
      data-qds-scroll-field=""
      data-disabled={props.disabled || undefined}
      data-invalid={(!props.disabled && !!props.error) || undefined}
      data-message={!!message.value || undefined}
      class={[slots.value.root, className]}
    >
      <div class={slots.value.box}>
        {mode.value === "scroll" && (
          <div
            aria-hidden="true"
            data-scroll-field-outside="before"
            class={[slots.value.outside, "bottom-full"]}
            onClick$={() => move(-1)}
          />
        )}
        <div data-mode={mode.value} class={slots.value.container}>
          <div aria-hidden="true" class={slots.value.sizer}>
            {longestText.value}
          </div>
          {mode.value === "scroll" ? (
            // APG listbox (single select, selection follows focus) with aria-activedescendant:
            // M3's keys are "Up / Down: selects option above or below in scroll field's list".
            <div
              ref={scrollerRef}
              data-scroll-field-control=""
              role="listbox"
              tabIndex={props.disabled ? -1 : 0}
              aria-label={props["aria-labelledby"] ? undefined : props.label}
              aria-labelledby={props["aria-labelledby"]}
              aria-activedescendant={`${id}-${selected.value}`}
              aria-disabled={props.disabled || undefined}
              aria-invalid={(!props.disabled && !!props.error) || undefined}
              aria-describedby={describedBy.value}
              class={slots.value.scroller}
              onKeyDown$={[
                sync$((event: KeyboardEvent) => {
                  if (
                    event.key === "ArrowUp" ||
                    event.key === "ArrowDown" ||
                    event.key === " " ||
                    event.key === "Enter"
                  ) {
                    event.preventDefault();
                  }
                }),
                $((event: KeyboardEvent) => {
                  if (props.disabled) return;
                  if (event.key === "ArrowUp") move(-1);
                  else if (event.key === "ArrowDown") move(1);
                  else if (event.key === " " || event.key === "Enter") {
                    // "Space or Enter: activates the scroll field" (M3 accessibility).
                    focusInput.value = true;
                    mode.value = "input";
                  }
                }),
              ]}
              onScroll$={(_, el) => {
                const count = options.value.length;
                if (!count) return;
                const i = centredPhys(el) % count;
                if (centred.value !== i) centred.value = i;
                // No `scrollend` (Safari before 26.2): settle after 150ms without scrolling.
                if (!("onscrollend" in window)) {
                  clearTimeout(Number(el.dataset.timer));
                  el.dataset.timer = String(setTimeout(() => settle(), 150));
                }
              }}
              onScrollend$={() => settle()}
              onClick$={(event, el) => {
                // A tap on an inactive value scrolls to it.
                const item = (event.target as Element).closest<HTMLElement>(
                  "[data-phys]",
                );
                if (!item || props.disabled) return;
                const phys = Number(item.dataset.phys);
                if (phys !== centredPhys(el)) centreOn(el, phys, true);
              }}
            >
              <div aria-hidden="true" class={slots.value.spacer} />
              {copies.value.map((copy) => (
                <div
                  key={copy}
                  // The loop's extra copies are drawing only.
                  aria-hidden={copy === 1 ? undefined : "true"}
                  role={copy === 1 ? "none" : undefined}
                  class={slots.value.copy}
                >
                  {options.value.map((option, i) => {
                    const phys =
                      (copies.value.length === 3 ? copy : 0) *
                        options.value.length +
                      i;
                    return (
                      <div
                        key={`${copy}-${i}`}
                        data-phys={phys}
                        id={copy === 1 ? `${id}-${i}` : undefined}
                        role={copy === 1 ? "option" : undefined}
                        aria-selected={
                          copy === 1 ? i === selected.value : undefined
                        }
                        data-active={
                          i ===
                            (centred.value < 0
                              ? selected.value
                              : centred.value) || undefined
                        }
                        class={slots.value.item}
                      >
                        {display(option, props.pad)}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div aria-hidden="true" class={slots.value.spacer} />
            </div>
          ) : (
            <input
              ref={inputRef}
              data-scroll-field-control=""
              type="text"
              inputMode={
                numeric.value ? (decimal.value ? "decimal" : "numeric") : "text"
              }
              autoComplete="off"
              aria-autocomplete={numeric.value ? undefined : "inline"}
              aria-label={props["aria-labelledby"] ? undefined : props.label}
              aria-labelledby={props["aria-labelledby"]}
              aria-invalid={
                (!props.disabled && (!!props.error || unmatched.value)) ||
                undefined
              }
              aria-describedby={describedBy.value}
              disabled={props.disabled}
              value={draft.value ?? display(value.value, props.pad)}
              class={slots.value.input}
              onInput$={(event, el) => {
                // "For strings, the selection should auto-complete based on the initial
                // character entered" (M3 guidelines): complete inline, the rest selected.
                const typed = el.value;
                const inserting = (event as InputEvent).inputType?.startsWith(
                  "insert",
                );
                if (!numeric.value && inserting && typed) {
                  const match = options.value.find((o) =>
                    String(o).toLowerCase().startsWith(typed.toLowerCase()),
                  );
                  if (match !== undefined) {
                    el.value = String(match);
                    el.setSelectionRange(typed.length, el.value.length);
                  }
                }
                draft.value = el.value;
                setUnmatched(false);
              }}
              onChange$={(_, el) => {
                const text = el.value.trim().toLowerCase();
                const i = options.value.findIndex(
                  (o) =>
                    String(o).toLowerCase() === text ||
                    display(o, props.pad).toLowerCase() === text ||
                    (typeof o === "number" &&
                      text !== "" &&
                      Number(text) === o),
                );
                if (i < 0) {
                  setUnmatched(true);
                  return;
                }
                setUnmatched(false);
                draft.value = null;
                commit(i);
              }}
            />
          )}
        </div>
        {mode.value === "scroll" && (
          <div
            aria-hidden="true"
            data-scroll-field-outside="after"
            class={[slots.value.outside, "top-full"]}
            onClick$={() => move(1)}
          />
        )}
      </div>
      {props.name && (
        <input
          type="hidden"
          name={props.name}
          value={String(value.value)}
          disabled={props.disabled}
        />
      )}
      <div
        id={messageId}
        // An error that appears is announced, as the text field's line.
        aria-live="polite"
        class={slots.value.message}
      >
        {message.value}
      </div>
    </div>
  );
});
