import {
  $,
  component$,
  createContextId,
  isBrowser,
  sync$,
  useComputed$,
  useContext,
  useContextProvider,
  useId,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Button } from "../button";
import { IconButton } from "../icon-button";
import { rovingKeys } from "../../utils/roving-focus";
import { whenModal } from "../../utils/top-layer";
import { Modal } from "../modal";
import { ScrollField } from "../scroll-field";
import type { ScrollFieldMode } from "../scroll-field";
import { useBindings } from "../../utils/bindings";
import { useBoundSignal } from "../../utils/use-bound-signal";

/**
 * Material Design 3 (Expressive) time pickers: dial, input and scroll; modal (all three) and
 * inline (input and scroll); 12- or 24-hour. From e-store's `components/time-picker/` (its dial
 * maths, slider keys, draft-until-OK), rebuilt on the M3 time picker specs, guidelines and
 * accessibility pages read 2026-11-23. The scroll and input fields are our `ScrollField` (M3's
 * anatomy names the time fields "Scroll field"). See `time-picker.md`.
 *
 * @see https://m3.material.io/components/time-pickers/specs
 * @see https://m3.material.io/components/time-pickers/accessibility
 */

/* ------------------------------------------------------------------ */
/*  Time helpers (a time is "HH:mm", 24-hour, as `<input type=time>`)  */
/* ------------------------------------------------------------------ */

/** `{ hour (0-23), minute }` of "HH:mm"; `null` if it is not one. */
export const parseTime = (time: string | undefined) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:mm". */
export const formatTime = (hour: number, minute: number) =>
  `${pad(hour)}:${pad(minute)}`;

/** The hour as the dial or field shows it: 1-12, or 0-23. */
const shownHour = (hour: number, use24h: boolean) =>
  use24h ? hour : hour % 12 || 12;

/** The 24-hour value of a shown hour, keeping the period. */
const fromShownHour = (shown: number, pm: boolean, use24h: boolean) =>
  use24h ? shown : (shown % 12) + (pm ? 12 : 0);

const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad(i));

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

export const timePickerVariants = tv({
  slots: {
    // The dial picker's hour / minute fields: toggles (M3 accessibility), 100 x 120dp
    // (132 wide for the 24-hour vertical dial), display-large.
    field: [
      "relative flex h-30 w-25 shrink-0 cursor-pointer items-center justify-center rounded-lg",
      "focus-ring bg-surface-container-lowest text-display-large text-on-surface tabular-nums",
      "aria-pressed:text-primary aria-pressed:inset-ring-2 aria-pressed:inset-ring-primary",
      "after:absolute after:inset-0 after:rounded-[inherit] after:bg-on-surface after:opacity-0",
      "hover:after:opacity-8 focus-visible:after:opacity-10 active:after:opacity-10",
      "disabled:cursor-default disabled:text-on-surface/38",
    ],
    separator:
      "flex w-4 shrink-0 items-center justify-center text-display-large text-on-surface",
    periods: "flex shrink-0 gap-2",
    period: [
      "relative flex cursor-pointer items-center justify-center rounded-lg text-title-medium",
      "focus-ring bg-surface-container-lowest text-on-surface-variant",
      "aria-checked:bg-primary-container aria-checked:text-on-primary-container",
      "after:absolute after:inset-0 after:rounded-[inherit] after:bg-current after:opacity-0",
      "hover:after:opacity-8 focus-visible:after:opacity-10 active:after:opacity-10",
      "disabled:cursor-default disabled:opacity-38",
    ],
    dial: [
      "relative size-64 shrink-0 touch-none rounded-full bg-surface-container-lowest select-none",
      "focus-ring cursor-pointer aria-disabled:cursor-default aria-disabled:opacity-38",
    ],
    dialNumber: [
      "pointer-events-none absolute flex size-12 -translate-1/2 items-center justify-center",
      "rounded-full text-body-large text-on-surface",
      "data-on:text-on-primary",
    ],
    handle:
      "pointer-events-none absolute size-12 -translate-1/2 rounded-full bg-primary",
  },
});

/* ------------------------------------------------------------------ */
/*  Props and context                                                 */
/* ------------------------------------------------------------------ */

type TimePickerLabels = {
  /** Default "Hour". */
  hourLabel?: string;
  /** Default "Minute". */
  minuteLabel?: string;
  /** Default "AM". */
  amLabel?: string;
  /** Default "PM". */
  pmLabel?: string;
  /** The AM / PM group's name. Default "Period". */
  periodLabel?: string;
  /** The keyboard toggle's name. Default "Switch to text input". */
  toInputLabel?: string;
  /** The way back from text input. Default "Switch to clock" (dial) / "Switch to scroll fields". */
  toPickerLabel?: string;
  /** Shown below the fields when a typed value matches no hour / minute. Default "Enter a valid time" (M3). */
  invalidLabel?: string;
};

export type TimePickerBaseProps = TimePickerLabels & {
  /** The time, "HH:mm" 24-hour (`""`: none, shown as 12:00 AM / 00:00). */
  value?: string;
  "bind:value"?: Signal<string>;
  /** Called with the committed time. */
  onTimeChange$?: QRL<(value: string) => void>;
  /** 24-hour clock: no AM / PM (M3). Default `false`. */
  use24h?: boolean;
  disabled?: boolean;
  /** Posts the time ("HH:mm") under this name. */
  name?: string;
};

type View = "dial" | "input" | "scroll";

type TimeContext = {
  hour: Signal<number>;
  minute: Signal<number>;
  selecting: Signal<"hour" | "minute">;
  view: Signal<View>;
  fieldMode: Readonly<Signal<ScrollFieldMode>>;
  /** Fields whose typed text matches no value (input view). */
  invalid: Signal<{ hour: boolean; minute: boolean }>;
  cfg: Readonly<Signal<ReturnType<typeof timeConfig>>>;
  /** Inline pickers commit every change. */
  onDraft$?: QRL<() => void>;
};

const timeContextId = createContextId<TimeContext>("ui-time-picker");

const timeConfig = (
  props: TimePickerBaseProps & { orientation?: string; inline?: boolean },
) => ({
  use24h: props.use24h ?? false,
  disabled: props.disabled ?? false,
  horizontal: props.orientation === "horizontal",
  inline: props.inline ?? false,
  hourLabel: props.hourLabel ?? "Hour",
  minuteLabel: props.minuteLabel ?? "Minute",
  amLabel: props.amLabel ?? "AM",
  pmLabel: props.pmLabel ?? "PM",
  periodLabel: props.periodLabel ?? "Period",
  toInputLabel: props.toInputLabel ?? "Switch to text input",
  toPickerLabel: props.toPickerLabel,
  invalidLabel: props.invalidLabel ?? "Enter a valid time",
});

/* ------------------------------------------------------------------ */
/*  Parts                                                             */
/* ------------------------------------------------------------------ */

/**
 * AM / PM: a radio group (M3 accessibility: "Use radio button semantics"), one Tab stop, the
 * arrow keys move and select.
 */
const Periods = component$<{ layout: "stack" | "row" | "inline" }>(
  ({ layout }) => {
    const ctx = useContext(timeContextId);
    const v = timePickerVariants();
    const setPm = $(async (pm: boolean) => {
      const h = ctx.hour.value % 12;
      ctx.hour.value = pm ? h + 12 : h;
      await ctx.onDraft$?.();
    });
    const size =
      layout === "row"
        ? "h-10 w-25"
        : layout === "inline"
          ? "h-10 w-10"
          : "h-14 w-14";
    return (
      <div
        role="radiogroup"
        aria-label={ctx.cfg.value.periodLabel}
        class={[v.periods(), layout === "row" ? "flex-row" : "flex-col"]}
        // Arrows move to the other period and choose it (`utils/roving-focus.ts`).
        data-roving=""
        data-roving-items='[role="radio"]'
        data-roving-home-end="false"
        data-roving-select=""
        onKeyDown$={rovingKeys}
      >
        {(["am", "pm"] as const).map((p) => {
          const checked = ctx.hour.value >= 12 === (p === "pm");
          return (
            <button
              key={p}
              type="button"
              role="radio"
              data-period={p}
              aria-checked={checked ? "true" : "false"}
              tabIndex={checked ? 0 : -1}
              disabled={ctx.cfg.value.disabled}
              class={[
                v.period(),
                size,
                layout === "inline" ? "text-label-large" : "",
              ]}
              onClick$={() => setPm(p === "pm")}
            >
              {p === "am" ? ctx.cfg.value.amLabel : ctx.cfg.value.pmLabel}
            </button>
          );
        })}
      </div>
    );
  },
);

/** The dial picker's two fields: toggles that choose what the dial sets. */
const DialFields = component$(() => {
  const ctx = useContext(timeContextId);
  const v = timePickerVariants();
  return (
    <div class="flex">
      <button
        type="button"
        data-time-hour=""
        aria-pressed={ctx.selecting.value === "hour" ? "true" : "false"}
        aria-label={`${ctx.cfg.value.hourLabel} ${shownHour(ctx.hour.value, ctx.cfg.value.use24h)}`}
        disabled={ctx.cfg.value.disabled}
        class={[
          v.field(),
          ctx.cfg.value.use24h && !ctx.cfg.value.horizontal ? "w-33" : "",
        ]}
        onClick$={() => (ctx.selecting.value = "hour")}
      >
        {pad(shownHour(ctx.hour.value, ctx.cfg.value.use24h))}
      </button>
      <span class={v.separator()} aria-hidden="true">
        :
      </span>
      <button
        type="button"
        aria-pressed={ctx.selecting.value === "minute" ? "true" : "false"}
        aria-label={`${ctx.cfg.value.minuteLabel} ${ctx.minute.value}`}
        disabled={ctx.cfg.value.disabled}
        class={[
          v.field(),
          ctx.cfg.value.use24h && !ctx.cfg.value.horizontal ? "w-33" : "",
        ]}
        onClick$={() => (ctx.selecting.value = "minute")}
      >
        {pad(ctx.minute.value)}
      </button>
    </div>
  );
});

/** The scroll / input picker's fields: two ScrollFields (input mode = the input picker). */
const ScrollFields = component$<{ fill?: boolean }>(({ fill }) => {
  const ctx = useContext(timeContextId);
  const errorId = useId();
  const showError = useComputed$(
    () =>
      ctx.view.value === "input" &&
      (ctx.invalid.value.hour || ctx.invalid.value.minute),
  );
  return (
    <div class={["flex min-w-0 flex-col", fill ? "flex-1" : ""]}>
      <div
        class="flex min-w-0"
        // Space / Enter on a scroll field activates it for typing (M3 scroll-fields
        // accessibility). Here that is the picker's input view, both fields at once, so the
        // keyboard toggle shows it and OK reads the typed text (a lone field in input mode did
        // neither). The field itself focuses its input.
        onKeyDown$={(event) => {
          if (
            ctx.view.value === "scroll" &&
            (event.key === "Enter" || event.key === " ") &&
            (event.target as Element).matches("[role='listbox']")
          ) {
            ctx.view.value = "input";
          }
        }}
      >
        <ScrollField
          data-time-hour=""
          label={ctx.cfg.value.hourLabel}
          // Numeric ranges, shown zero-padded: typing "5" then Enter is 05 (a string list would
          // complete "5" to "50").
          min={ctx.cfg.value.use24h ? 0 : 1}
          max={ctx.cfg.value.use24h ? 23 : 12}
          pad={2}
          loop
          reserveMessage={false}
          // M3: one error below the picker, not one per field.
          invalidText=""
          aria-describedby={showError.value ? errorId : undefined}
          onInvalidChange$={(bad) =>
            (ctx.invalid.value = { ...ctx.invalid.value, hour: bad })
          }
          value={shownHour(ctx.hour.value, ctx.cfg.value.use24h)}
          mode={ctx.fieldMode.value}
          disabled={ctx.cfg.value.disabled}
          class={[
            fill ? "min-w-25 flex-1" : "w-25",
            // The container's height (no message line): 120 (M3 input picker), 140 inline.
            ctx.cfg.value.inline ? "h-35" : "h-30",
          ]}
          onValueChange$={async (shown) => {
            ctx.hour.value = fromShownHour(
              Number(shown),
              ctx.hour.value >= 12,
              ctx.cfg.value.use24h,
            );
            await ctx.onDraft$?.();
          }}
        />
        <span
          class="flex w-4 shrink-0 items-center justify-center text-display-large text-on-surface"
          aria-hidden="true"
        >
          :
        </span>
        <ScrollField
          label={ctx.cfg.value.minuteLabel}
          min={0}
          max={59}
          pad={2}
          loop
          reserveMessage={false}
          invalidText=""
          aria-describedby={showError.value ? errorId : undefined}
          onInvalidChange$={(bad) =>
            (ctx.invalid.value = { ...ctx.invalid.value, minute: bad })
          }
          value={ctx.minute.value}
          mode={ctx.fieldMode.value}
          disabled={ctx.cfg.value.disabled}
          class={[
            fill ? "min-w-25 flex-1" : "w-25",
            ctx.cfg.value.inline ? "h-35" : "h-30",
          ]}
          onValueChange$={async (m) => {
            ctx.minute.value = Number(m);
            await ctx.onDraft$?.();
          }}
        />
      </div>
      {/* M3 guidelines: "Errors should appear below the time picker, and highlight the invalid
          field with an error color scheme". Always in the DOM (a live region); empty, no size. */}
      <p
        id={errorId}
        aria-live="polite"
        class="pt-1 text-body-small text-error empty:pt-0"
      >
        {showError.value ? ctx.cfg.value.invalidLabel : ""}
      </p>
    </div>
  );
});

/** Where a pointer is on the dial: the hour (0-23) or minute it points at. */
const dialValueAt = (
  x: number,
  y: number,
  rect: DOMRect,
  unit: "hour" | "minute",
  use24h: boolean,
  pm: boolean,
) => {
  const dx = x - (rect.left + rect.width / 2);
  const dy = y - (rect.top + rect.height / 2);
  let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  if (unit === "minute") return Math.round(angle / 6) % 60;
  const step = Math.round(angle / 30) % 12;
  if (!use24h) return step + (pm ? 12 : 0);
  // 24-hour (M3): outer ring 0-11, inner ring 12-23. The rings split halfway between radii.
  const inner = Math.hypot(dx, dy) < (rect.width / 256) * 86;
  return step + (inner ? 12 : 0);
};

/**
 * Sets the dial's unit from a pointer position. A plain module function, so it runs at once
 * inside the handler: as a `$()` QRL with an `await` in front, a quick click's `pointerup` ran
 * first, moved the dial on to the minutes, and the click then set the MINUTE (the owner's "a click
 * does not select", 2026-11-23).
 */
const setFromPointer = (
  ctx: TimeContext,
  event: PointerEvent,
  el: HTMLElement,
) => {
  const unit = ctx.selecting.value;
  const next = dialValueAt(
    event.clientX,
    event.clientY,
    el.getBoundingClientRect(),
    unit,
    ctx.cfg.value.use24h,
    ctx.hour.value >= 12,
  );
  if (unit === "hour") ctx.hour.value = next;
  else ctx.minute.value = next;
};

/**
 * Marks a press on the dial and captures the pointer AT ONCE (a `sync$`), so the release can
 * tell a press that began on the dial from one that began elsewhere, however late the `$()`
 * handlers load.
 */
const markDialPress = sync$((event: PointerEvent, el: HTMLElement) => {
  if (el.getAttribute("aria-disabled") === "true") return;
  el.setAttribute("data-pressed", "");
  el.setPointerCapture(event.pointerId);
});

/** Dial keys: Right / Down clockwise, Left / Up counter-clockwise (M3 accessibility). */
const preventDialKeys = sync$((event: KeyboardEvent) => {
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(
      event.key,
    )
  )
    event.preventDefault();
});

/**
 * The clock dial: 256dp, the selector handle 48dp, the track 2dp, the centre 8dp. An APG
 * slider (`role="slider"`), named as M3 says: "Hour 7 of 12", "Hour 7" (24-hour), "Minute 24 of
 * 60".
 */
const Dial = component$(() => {
  const ctx = useContext(timeContextId);
  const v = timePickerVariants();
  const dragging = useSignal(false);

  const model = useComputed$(() => {
    const c = ctx.cfg.value;
    const hourMode = ctx.selecting.value === "hour";
    const value = hourMode ? ctx.hour.value : ctx.minute.value;
    const inner = hourMode && c.use24h && value >= 12;
    const index = hourMode ? value % 12 : value / 5;
    const radius = inner ? 68 : 104;
    const angle = (index / 12) * 2 * Math.PI;
    const numbers: { label: string; x: number; y: number; on: boolean }[] = [];
    const ring = (labels: string[], r: number, values: number[]) =>
      labels.forEach((label, i) => {
        const a = (i / 12) * 2 * Math.PI;
        numbers.push({
          label,
          x: 128 + r * Math.sin(a),
          y: 128 - r * Math.cos(a),
          on: values[i] === value,
        });
      });
    if (!hourMode) {
      ring(
        Array.from({ length: 12 }, (_, i) => pad(i * 5)),
        104,
        Array.from({ length: 12 }, (_, i) => i * 5),
      );
    } else if (c.use24h) {
      ring(
        HOURS_24.slice(0, 12),
        104,
        Array.from({ length: 12 }, (_, i) => i),
      );
      ring(
        HOURS_24.slice(12),
        68,
        Array.from({ length: 12 }, (_, i) => i + 12),
      );
    } else {
      const pm = value >= 12 ? 12 : 0;
      ring(
        ["12", ...Array.from({ length: 11 }, (_, i) => String(i + 1))],
        104,
        Array.from({ length: 12 }, (_, i) => i + pm),
      );
    }
    return {
      hourMode,
      value,
      x: 128 + radius * Math.sin(angle),
      y: 128 - radius * Math.cos(angle),
      between: !hourMode && value % 5 !== 0,
      numbers,
      text: hourMode
        ? c.use24h
          ? `${c.hourLabel} ${value}`
          : `${c.hourLabel} ${shownHour(value, false)} of 12`
        : `${c.minuteLabel} ${value} of 60`,
    };
  });

  /** When the last press ended: a press handled after its own release is ignored. */
  const lastUp = useSignal(0);

  return (
    <div
      role="slider"
      tabIndex={ctx.cfg.value.disabled ? -1 : 0}
      aria-label={
        model.value.hourMode
          ? ctx.cfg.value.hourLabel
          : ctx.cfg.value.minuteLabel
      }
      aria-valuemin={model.value.hourMode ? (ctx.cfg.value.use24h ? 0 : 1) : 0}
      aria-valuemax={
        model.value.hourMode ? (ctx.cfg.value.use24h ? 23 : 12) : 59
      }
      aria-valuenow={
        model.value.hourMode
          ? shownHour(model.value.value, ctx.cfg.value.use24h)
          : model.value.value
      }
      aria-valuetext={model.value.text}
      aria-disabled={ctx.cfg.value.disabled ? "true" : undefined}
      class={v.dial()}
      // Tap or drag (M3): the value follows the pointer from the dial's centre, snapped to the
      // nearest hour / minute; the release moves on from hours to minutes. Each handler sets the
      // value from its own event, so a tap works whichever handler Qwik runs first.
      onPointerDown$={[
        markDialPress,
        $((event: PointerEvent, el: HTMLElement) => {
          if (ctx.cfg.value.disabled || event.timeStamp < lastUp.value) return;
          dragging.value = true;
          setFromPointer(ctx, event, el);
        }),
      ]}
      onPointerMove$={async (event, el) => {
        if (!dragging.value) return;
        // The button is up (its release was missed): stop following the pointer.
        if (!event.buttons) {
          dragging.value = false;
          return;
        }
        setFromPointer(ctx, event, el);
      }}
      onPointerUp$={async (event, el) => {
        // Only a press that began on the dial (marked at once by `markDialPress`).
        if (ctx.cfg.value.disabled || !el.hasAttribute("data-pressed")) return;
        el.removeAttribute("data-pressed");
        lastUp.value = event.timeStamp;
        dragging.value = false;
        setFromPointer(ctx, event, el);
        // The hour chosen, the dial moves on to the minutes (M3 time pickers; e-store's too).
        if (ctx.selecting.value === "hour") ctx.selecting.value = "minute";
        await ctx.onDraft$?.();
      }}
      onKeyDown$={[
        preventDialKeys,
        $(async (event: KeyboardEvent) => {
          if (ctx.cfg.value.disabled) return;
          if (event.key === "Enter") {
            if (ctx.selecting.value === "hour") ctx.selecting.value = "minute";
            return;
          }
          const delta =
            event.key === "ArrowRight" || event.key === "ArrowDown"
              ? 1
              : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0;
          if (!delta) return;
          if (ctx.selecting.value === "minute") {
            ctx.minute.value = (ctx.minute.value + delta + 60) % 60;
          } else if (ctx.cfg.value.use24h) {
            ctx.hour.value = (ctx.hour.value + delta + 24) % 24;
          } else {
            // 12-hour: round the face, keeping the period.
            const pm = ctx.hour.value >= 12 ? 12 : 0;
            ctx.hour.value = (((ctx.hour.value % 12) + delta + 12) % 12) + pm;
          }
          await ctx.onDraft$?.();
        }),
      ]}
    >
      <svg
        class="pointer-events-none absolute inset-0 size-full"
        aria-hidden="true"
      >
        <line
          x1="128"
          y1="128"
          x2={model.value.x}
          y2={model.value.y}
          stroke="var(--color-primary)"
          stroke-width="2"
        />
        <circle cx="128" cy="128" r="4" fill="var(--color-primary)" />
      </svg>
      <span
        class={v.handle()}
        aria-hidden="true"
        style={{ left: `${model.value.x}px`, top: `${model.value.y}px` }}
      >
        {model.value.between && (
          <span class="absolute inset-s-1/2 top-1/2 size-1 -translate-1/2 rounded-full bg-on-primary" />
        )}
      </span>
      {model.value.numbers.map((n) => (
        <span
          key={`${n.label}-${n.x}`}
          aria-hidden="true"
          data-on={n.on ? "" : undefined}
          class={v.dialNumber()}
          style={{ left: `${n.x}px`, top: `${n.y}px` }}
        >
          {n.label}
        </span>
      ))}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Modal                                                             */
/* ------------------------------------------------------------------ */

export type TimePickerModalProps = TimePickerBaseProps & {
  /** The picker it opens with. Default "dial". */
  variant?: View;
  /** The dial picker's layout (M3). Default "vertical". */
  orientation?: "vertical" | "horizontal";
  /** Open state. Without it the picker renders its own opener (a text button). */
  "bind:open"?: Signal<boolean>;
  /** The dialog's name. Default "Select time" / "Enter time" (input). */
  title?: string;
  /** Default "Cancel". */
  cancelLabel?: string;
  /** Default "OK". */
  okLabel?: string;
  /** The opener's text with no time. Default "Select time". */
  emptyLabel?: string;
  /** BCP 47 locale for the opener's text. Default "en-US". */
  locale?: string;
  class?: PropsOf<"dialog">["class"];
};

/**
 * The modal time picker (M3: modal for dial, input and scroll), on our `Modal` (native
 * `<dialog>`). The time is a draft until OK; Cancel, Escape and a scrim click leave it.
 */
const ModalPicker = component$<TimePickerModalProps>((props) => {
  const { valueSig: value } = useBindings(props, { value: "" });
  const open = useBoundSignal(props["bind:open"], false);
  const ownOpener = !props["bind:open"];
  const hour = useSignal(0);
  const minute = useSignal(0);
  const selecting = useSignal<"hour" | "minute">("hour");
  const view = useSignal<View>(props.variant ?? "dial");
  const invalid = useSignal({ hour: false, minute: false });
  // Counts the opens: the fields are keyed by it, so text typed in an earlier open (an invalid
  // "99" left by Cancel or Escape) does not come back with the next one.
  const opens = useSignal(0);
  const bodyRef = useSignal<HTMLElement>();
  const cfg = useComputed$(() => timeConfig(props));
  const fieldMode = useComputed$<ScrollFieldMode>(() =>
    view.value === "scroll" ? "scroll" : "input",
  );
  const labels = useComputed$(() => ({
    title:
      props.title ?? (view.value === "input" ? "Enter time" : "Select time"),
    cancelLabel: props.cancelLabel ?? "Cancel",
    okLabel: props.okLabel ?? "OK",
    emptyLabel: props.emptyLabel ?? "Select time",
    toPickerLabel:
      props.toPickerLabel ??
      ((props.variant ?? "dial") === "scroll"
        ? "Switch to scroll fields"
        : "Switch to clock"),
  }));

  useContextProvider(timeContextId, {
    hour,
    minute,
    selecting,
    view,
    fieldMode,
    invalid,
    cfg,
  });

  // Each open starts from the committed time, in the first view, focus on the hour field (M3).
  useTask$(async ({ track }) => {
    if (!track(open) || !isBrowser) return;
    const t = parseTime(value.value) ?? { hour: 0, minute: 0 };
    hour.value = t.hour;
    minute.value = t.minute;
    selecting.value = "hour";
    view.value = props.variant ?? "dial";
    invalid.value = { hour: false, minute: false };
    opens.value++;
    // Not awaited: a task blocks this component's render, and the dialog opens after it.
    void (async () => {
      if (!(await whenModal(bodyRef.value))) return;
      await new Promise((r) => requestAnimationFrame(r));
      const first = bodyRef.value?.querySelector<HTMLElement>(
        "[data-time-hour]:is(button), [data-time-hour] :is(input, [tabindex='0'])",
      );
      first?.focus();
      // The input picker: typing replaces the hour ("5" is 05, not 075).
      if (first instanceof HTMLInputElement) first.select();
    })();
  });

  const confirm = $(async () => {
    let h = hour.value;
    let m = minute.value;
    if (view.value === "input") {
      // Read the typed text here: OK pressed straight after typing comes before the fields'
      // own `change` handlers have committed it (or flagged it), and would close with the last
      // valid time. Text that is no hour / minute keeps the picker open with M3's "Enter a
      // valid time".
      const use24h = cfg.value.use24h;
      const [hourInput, minuteInput] = Array.from(
        bodyRef.value?.querySelectorAll<HTMLInputElement>(
          "input[data-scroll-field-control]",
        ) ?? [],
      );
      const typed = (
        el: HTMLInputElement | undefined,
        lo: number,
        hi: number,
      ) => {
        const text = el?.value.trim() ?? "";
        const n = /^\d{1,2}$/.test(text) ? Number(text) : NaN;
        return n >= lo && n <= hi ? n : null;
      };
      const th = typed(hourInput, use24h ? 0 : 1, use24h ? 23 : 12);
      const tm = typed(minuteInput, 0, 59);
      if (th === null || tm === null) {
        invalid.value = { hour: th === null, minute: tm === null };
        // Back to the first invalid field, so it can be corrected at once. OK is not disabled
        // instead: a disabled button gives no reason and leaves the Tab order.
        (th === null ? hourInput : minuteInput)?.focus();
        return;
      }
      h = fromShownHour(th, hour.value >= 12, use24h);
      m = tm;
    }
    const next = formatTime(h, m);
    if (next !== value.value) {
      value.value = next;
      await props.onTimeChange$?.(next);
    }
    open.value = false;
  });

  const openerText = useComputed$(() => {
    const t = parseTime(value.value);
    if (!t) return labels.value.emptyLabel;
    return new Intl.DateTimeFormat(props.locale ?? "en-US", {
      hour: "numeric",
      minute: "2-digit",
      hourCycle: cfg.value.use24h ? "h23" : "h12",
    }).format(new Date(2000, 0, 1, t.hour, t.minute));
  });

  const horizontalDial = useComputed$(
    () => view.value === "dial" && cfg.value.horizontal,
  );
  const startView = props.variant ?? "dial";

  return (
    <>
      {ownOpener && (
        <Button
          look="text"
          leadingIcon="schedule"
          label={openerText.value}
          disabled={props.disabled}
          aria-haspopup="dialog"
          onClick$={() => (open.value = true)}
        />
      )}
      {props.name && (
        <input type="hidden" name={props.name} value={value.value} />
      )}
      <Modal.Root bind:open={open}>
        <Modal.Content
          aria-label={labels.value.title}
          data-qds-time-picker={view.value}
          class={props.class}
        >
          <div
            ref={bodyRef}
            // M3: the time picker's container is surface-container-low (the Modal's own is a
            // basic dialog's, surface-container-high), padding 12dp.
            class={[
              "flex flex-col rounded-[inherit] bg-surface-container-low [--field-bg:var(--color-surface-container-low)]",
              horizontalDial.value ? "p-6" : "p-3",
            ]}
          >
            <div
              class={[
                "flex",
                horizontalDial.value
                  ? "flex-row items-start gap-13"
                  : "flex-col items-center",
              ]}
            >
              <div
                class={[
                  "flex",
                  horizontalDial.value ? "flex-col gap-4" : "flex-row gap-2",
                ]}
              >
                {view.value === "dial" ? (
                  <DialFields />
                ) : (
                  <ScrollFields key={opens.value} />
                )}
                {!cfg.value.use24h && (
                  <Periods layout={horizontalDial.value ? "row" : "stack"} />
                )}
              </div>
              {view.value === "dial" && (
                <div class={horizontalDial.value ? "" : "mt-6"}>
                  <Dial />
                </div>
              )}
            </div>
            <div
              class={[
                "flex items-center gap-2",
                // Input and scroll: 8dp, then a 48dp row (M3 input picker 304x200:
                // 12 + 120 + 8 + 48 + 12).
                view.value === "dial" ? "mt-2" : "mt-2 min-h-12",
              ]}
            >
              <IconButton
                icon={
                  view.value === "input"
                    ? startView === "scroll"
                      ? "keyboard"
                      : "schedule"
                    : "keyboard"
                }
                toggle={startView === "scroll"}
                selected={
                  startView === "scroll" ? view.value === "input" : undefined
                }
                label={
                  view.value === "input"
                    ? labels.value.toPickerLabel
                    : cfg.value.toInputLabel
                }
                disabled={cfg.value.disabled}
                onClick$={() => {
                  if (view.value === "input") {
                    view.value = startView === "input" ? "dial" : startView;
                  } else {
                    view.value = "input";
                  }
                  selecting.value = "hour";
                  // Leaving input drops the typed text, so its error too.
                  invalid.value = { hour: false, minute: false };
                }}
              />
              <span class="flex-1" />
              <Button
                look="text"
                label={labels.value.cancelLabel}
                onClick$={() => (open.value = false)}
              />
              <Button
                look="text"
                label={labels.value.okLabel}
                disabled={cfg.value.disabled}
                onClick$={confirm}
              />
            </div>
          </div>
        </Modal.Content>
      </Modal.Root>
    </>
  );
});

/* ------------------------------------------------------------------ */
/*  Inline                                                            */
/* ------------------------------------------------------------------ */

export type TimePickerInlineProps = TimePickerBaseProps & {
  /** Scroll fields (default) or text input; the keyboard toggle switches (M3). */
  variant?: "scroll" | "input";
  class?: PropsOf<"div">["class"];
  /** The group's name (screen readers). Default "Time". */
  label?: string;
};

/**
 * The inline time picker (M3: inline for input and scroll): the two fields fill the width
 * (at least 100dp each), with AM / PM (40dp) and the keyboard toggle (40dp) in a column at the
 * end. No Cancel / OK: each change is the value.
 */
const InlinePicker = component$<TimePickerInlineProps>((props) => {
  const { valueSig: value } = useBindings(props, { value: "" });
  // Seeded by the task below (it runs on the server too), not read here (rule Q12).
  const hour = useSignal(0);
  const minute = useSignal(0);
  const selecting = useSignal<"hour" | "minute">("hour");
  const view = useSignal<View>(props.variant ?? "scroll");
  const invalid = useSignal({ hour: false, minute: false });
  const cfg = useComputed$(() => timeConfig({ ...props, inline: true }));
  const fieldMode = useComputed$<ScrollFieldMode>(() =>
    view.value === "input" ? "input" : "scroll",
  );

  // A value set from outside moves the fields.
  useTask$(({ track }) => {
    const t = parseTime(track(value));
    if (!t) return;
    hour.value = t.hour;
    minute.value = t.minute;
  });

  const onDraft$ = $(async () => {
    const next = formatTime(hour.value, minute.value);
    if (next === value.value) return;
    value.value = next;
    await props.onTimeChange$?.(next);
  });

  useContextProvider(timeContextId, {
    hour,
    minute,
    selecting,
    view,
    fieldMode,
    invalid,
    cfg,
    onDraft$,
  });

  return (
    <div
      role="group"
      aria-label={props.label ?? "Time"}
      data-qds-time-picker="inline"
      class={["flex min-h-35 w-full gap-2", props.class]}
    >
      <ScrollFields fill />
      <div class="flex shrink-0 flex-col gap-2">
        {!cfg.value.use24h && <Periods layout="inline" />}
        <IconButton
          toggle
          icon="keyboard"
          label={cfg.value.toInputLabel}
          selected={view.value === "input"}
          disabled={cfg.value.disabled}
          onSelectedChange$={(on) => {
            view.value = on ? "input" : "scroll";
          }}
        />
      </div>
      {props.name && (
        <input type="hidden" name={props.name} value={value.value} />
      )}
    </div>
  );
});

export const TimePicker = {
  Modal: ModalPicker,
  Inline: InlinePicker,
};
