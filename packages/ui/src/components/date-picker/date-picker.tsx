import {
  $,
  Slot,
  component$,
  createContextId,
  isBrowser,
  useComputed$,
  useContext,
  useContextProvider,
  useId,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { Button } from "../button";
import { CalendarGrid, focusDay } from "../calendar/calendar-grid";
import {
  addMonths,
  clampDate,
  daysInMonth,
  nextTapRange,
  tabDateFor,
  formatHeaderDate,
  formatMonthYear,
  formatRangeHeader,
  isDateStr,
  isOutOfRange,
  monthNames,
  parseDateStr,
  parseTypedDate,
  toDateStr,
  toTypedDate,
  todayStr,
} from "../calendar/calendar";
import type { IconName } from "../icon";
import { IconButton } from "../icon-button";
import { List } from "../list";
import { Modal } from "../modal";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldSupportingText,
  textFieldVariants,
} from "../text-field";
import { whenModal } from "../../utils/top-layer";
import { useBindings } from "../../utils/bindings";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { rovingKeys } from "../../utils/roving-focus";

/**
 * Material Design 3 date pickers: the docked date picker (`DatePicker.Root` + `Input` +
 * `Content`), the modal date picker and the modal date input (`DatePicker.Modal`, single date or
 * range). From e-store's `components/date-picker/date-picker.tsx` (same part names), rebuilt on
 * the M3 specs read 2026-11-23; see `date-picker.md` for every difference.
 *
 * @see https://m3.material.io/components/date-pickers/specs
 * @see https://m3.material.io/components/date-pickers/guidelines
 * @see https://m3.material.io/components/date-pickers/accessibility
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/
 */

/* ------------------------------------------------------------------ */
/*  Shared                                                            */
/* ------------------------------------------------------------------ */

/** Why a typed date is refused, or `""`. */
const typedDateError = (
  text: string,
  min: string,
  max: string,
  messages: { invalid: string; early: string; late: string },
): string => {
  const date = parseTypedDate(text);
  if (!date) return messages.invalid;
  if (min && date < min) return messages.early;
  if (max && date > max) return messages.late;
  return "";
};

/** The first and last year a year list offers. */
const yearSpan = (min: string, max: string, around: number) => ({
  first: isDateStr(min) ? parseDateStr(min).year : around - 100,
  last: isDateStr(max) ? parseDateStr(max).year : around + 100,
});

/**
 * Shift+M / Shift+Y move focus to the month / year menu button (M3 date pickers accessibility,
 * "Keyboard navigation"). Not in a text field, where they are letters.
 */
const shortcutKeys = $((event: KeyboardEvent, root: HTMLElement) => {
  const target = event.target as HTMLElement;
  if (!event.shiftKey || target.matches("input, textarea")) return;
  const key = event.key.toLowerCase();
  const which = key === "m" ? "month" : key === "y" ? "year" : "";
  if (!which) return;
  root
    .querySelector<HTMLElement>(`[data-date-picker-menu="${which}"]`)
    ?.focus();
});

/** The text-button labels every picker shows; each is a prop with this default. */
type ActionLabels = {
  /** Default "Cancel". */
  cancelLabel?: string;
  /** Default "OK". */
  okLabel?: string;
};

/** Labels of the month navigation (screen readers). */
type NavLabels = {
  /** Default "Previous month". */
  previousMonthLabel?: string;
  /** Default "Next month". */
  nextMonthLabel?: string;
};

/** The messages a typed date can get. */
type TypedDateMessages = {
  /** Default "Invalid date. Use MM/DD/YYYY". */
  invalidDateText?: string;
  /** Default "Date is too early". */
  tooEarlyText?: string;
  /** Default "Date is too late". */
  tooLateText?: string;
};

/* ------------------------------------------------------------------ */
/*  Docked date picker                                                */
/* ------------------------------------------------------------------ */

export type DatePickerRootProps = ActionLabels &
  NavLabels &
  TypedDateMessages & {
    /** The date, `YYYY-MM-DD` (`""`: none). */
    value?: string;
    /** Two-way: written when a date is confirmed (OK, or a typed date on Enter / blur). */
    "bind:value"?: Signal<string>;
    /** Called with the confirmed date. */
    onDateChange$?: QRL<(value: string) => void>;
    /** Earliest date, `YYYY-MM-DD`. */
    min?: string;
    /** Latest date, `YYYY-MM-DD`. */
    max?: string;
    /** Today (`YYYY-MM-DD`) for the ring. Default: the viewer's clock when the picker opens. */
    today?: string;
    /** BCP 47 locale for month and day names. Default "en-US". */
    locale?: string;
    disabled?: boolean;
    /** The text field's label ("Date"). */
    label?: string;
    /** The line under the field: the format. Default "MM/DD/YYYY" (M3). */
    supportingText?: string;
    /** An error to show instead (marks the field invalid). */
    error?: string;
    required?: boolean;
    /** Posts the date (`YYYY-MM-DD`) in a form under this name. */
    name?: string;
    /** M3 text field style. Default "outlined" (M3 docked spec). */
    inputVariant?: "outlined" | "filled";
    /** Show a Clear text button (M3 accessibility: optional; off by default). */
    clearable?: boolean;
    /** Default "Clear". */
    clearLabel?: string;
    /** Default "Previous year". */
    previousYearLabel?: string;
    /** Default "Next year". */
    nextYearLabel?: string;
    /** The dropdown's dialog name. Default "Choose date". */
    dialogLabel?: string;
    /** The month list's name. Default "Month". */
    monthListLabel?: string;
    /** The year list's name. Default "Year". */
    yearListLabel?: string;
    class?: PropsOf<"div">["class"];
  };

/** Every plain prop of the docked picker, with its default. */
const dockedConfig = (props: DatePickerRootProps) => ({
  min: props.min ?? "",
  max: props.max ?? "",
  today: props.today,
  locale: props.locale ?? "en-US",
  disabled: props.disabled ?? false,
  label: props.label,
  supportingText: props.supportingText ?? "MM/DD/YYYY",
  error: props.error,
  required: props.required ?? false,
  name: props.name,
  inputVariant: props.inputVariant ?? "outlined",
  clearable: props.clearable ?? false,
  clearLabel: props.clearLabel ?? "Clear",
  cancelLabel: props.cancelLabel ?? "Cancel",
  okLabel: props.okLabel ?? "OK",
  previousMonthLabel: props.previousMonthLabel ?? "Previous month",
  nextMonthLabel: props.nextMonthLabel ?? "Next month",
  previousYearLabel: props.previousYearLabel ?? "Previous year",
  nextYearLabel: props.nextYearLabel ?? "Next year",
  dialogLabel: props.dialogLabel ?? "Choose date",
  monthListLabel: props.monthListLabel ?? "Month",
  yearListLabel: props.yearListLabel ?? "Year",
  invalidDateText: props.invalidDateText ?? "Invalid date. Use MM/DD/YYYY",
  tooEarlyText: props.tooEarlyText ?? "Date is too early",
  tooLateText: props.tooLateText ?? "Date is too late",
});

type DockedView = "day" | "month" | "year";

type DockedContext = {
  value: Signal<string>;
  draft: Signal<string>;
  text: Signal<string>;
  typedError: Signal<string>;
  viewYear: Signal<number>;
  viewMonth: Signal<number>;
  view: Signal<DockedView>;
  focused: Signal<string>;
  today: Signal<string>;
  open: Signal<boolean>;
  inputId: string;
  popoverId: string;
  anchor: string;
  /** Every plain prop, reactive (the context object is captured once). */
  cfg: Readonly<Signal<ReturnType<typeof dockedConfig>>>;
  onDateChange$?: QRL<(value: string) => void>;
};

const dockedContextId = createContextId<DockedContext>("ui-date-picker-docked");

/** Holds the docked picker's state. Put `DatePicker.Input` and `DatePicker.Content` in it. */
const Root = component$<DatePickerRootProps>((props) => {
  const { valueSig: value } = useBindings(props, { value: "" });
  const draft = useSignal("");
  const text = useSignal("");
  const typedError = useSignal("");
  const now = todayStr();
  const today = useSignal(now);
  const viewYear = useSignal(parseDateStr(now).year);
  const viewMonth = useSignal(parseDateStr(now).month);
  const view = useSignal<DockedView>("day");
  const focused = useSignal("");
  const open = useSignal(false);
  const inputId = useId();
  const popoverId = `${inputId}-picker`;

  const cfg = useComputed$(() => dockedConfig(props));

  // The field shows the confirmed date, reformatted (M3: format after Enter or leaving the field).
  useTask$(({ track }) => {
    const v = track(value);
    text.value = toTypedDate(v);
    typedError.value = "";
  });

  useContextProvider(dockedContextId, {
    value,
    draft,
    text,
    typedError,
    viewYear,
    viewMonth,
    view,
    focused,
    today,
    open,
    inputId,
    popoverId,
    anchor: `--date-picker-${inputId}`,
    cfg,
    onDateChange$: props.onDateChange$,
  });

  return (
    <div
      data-qds-date-picker=""
      class={["relative inline-block w-full max-w-90", props.class]}
    >
      <Slot />
    </div>
  );
});

export type DatePickerInputProps = {
  /** The trailing icon button's icon. Default "calendar_today". */
  calendarIcon?: IconName;
  /** The trailing icon button's name. Default "Open date picker". */
  openLabel?: string;
  /** Shown while the field is focused and empty. */
  placeholder?: string;
  class?: PropsOf<"div">["class"];
};

/**
 * The docked picker's text field: type a date, or open the calendar with the trailing icon
 * button (M3 accessibility: "The calendar icon is the exclusive entry point for the date picker").
 * Built from `TextField`'s own parts, with an icon button in its trailing track.
 */
const Input = component$<DatePickerInputProps>(
  ({
    calendarIcon = "calendar_today",
    openLabel = "Open date picker",
    placeholder,
    class: className,
  }) => {
    const ctx = useContext(dockedContextId);
    const descriptionId = `${ctx.inputId}-description`;

    /** Reads the typed text: a valid date is confirmed, anything else gets an error. */
    const commitTyped = $(async () => {
      const c = ctx.cfg.value;
      const raw = ctx.text.value.trim();
      if (!raw) {
        ctx.typedError.value = "";
        if (ctx.value.value) {
          ctx.value.value = "";
          await ctx.onDateChange$?.("");
        }
        return;
      }
      const error = typedDateError(raw, c.min, c.max, {
        invalid: c.invalidDateText,
        early: c.tooEarlyText,
        late: c.tooLateText,
      });
      ctx.typedError.value = error;
      if (error) return;
      const date = parseTypedDate(raw);
      ctx.text.value = toTypedDate(date);
      if (date !== ctx.value.value) {
        ctx.value.value = date;
        await ctx.onDateChange$?.(date);
      }
    });

    return (
      <div
        data-qds-date-picker-input=""
        // M3 shows a text field's focus with its active indicator, not a ring.
        data-focus-indicator="active-indicator"
        class={["group/text-field", className]}
      >
        <div
          class={textFieldVariants({ variant: ctx.cfg.value.inputVariant })}
          style={{ anchorName: ctx.anchor }}
        >
          <TextFieldInput
            id={ctx.inputId}
            variant={ctx.cfg.value.inputVariant}
            labelled={!!ctx.cfg.value.label}
            bind:value={ctx.text}
            placeholder={placeholder}
            inputMode="numeric"
            autocomplete="off"
            required={ctx.cfg.value.required}
            disabled={ctx.cfg.value.disabled}
            invalid={
              !!(ctx.cfg.value.error || ctx.typedError.value) &&
              !ctx.cfg.value.disabled
            }
            aria-describedby={descriptionId}
            onKeyDown$={(event) => {
              if (event.key === "Enter") return commitTyped();
            }}
            onBlur$={commitTyped}
          />
          <span class="col-start-5 row-start-1 flex items-center pe-1">
            <IconButton
              icon={calendarIcon}
              label={openLabel}
              disabled={ctx.cfg.value.disabled}
              aria-haspopup="dialog"
              aria-expanded={ctx.open.value ? "true" : "false"}
              aria-controls={ctx.popoverId}
              data-date-picker-opener=""
              // Native toggle: the browser opens and closes the popover, and a click on the
              // opener while it is open closes it (no light-dismiss-then-reopen race).
              popovertarget={ctx.popoverId}
            />
          </span>
          <TextFieldLabel
            label={ctx.cfg.value.label}
            required={ctx.cfg.value.required}
            variant={ctx.cfg.value.inputVariant}
            for={ctx.inputId}
          />
        </div>
        <TextFieldSupportingText
          id={descriptionId}
          error={ctx.cfg.value.error || ctx.typedError.value}
          supportingText={ctx.cfg.value.supportingText}
        />
        {ctx.cfg.value.name && (
          <input
            type="hidden"
            name={ctx.cfg.value.name}
            value={ctx.value.value}
          />
        )}
      </div>
    );
  },
);

/** The month / year menu button of the docked header: `< Aug ▾ >`. */
const DockedMenuButton = component$<{
  which: "month" | "year";
  label: string;
  previousLabel: string;
  nextLabel: string;
  arrows: boolean;
  disabled: boolean;
  expanded: boolean;
  onPrevious$: QRL<() => void>;
  onNext$: QRL<() => void>;
  onToggle$: QRL<() => void>;
}>((props) => (
  <div class="flex items-center">
    {props.arrows && (
      <IconButton
        icon="chevron_left"
        flipIconInRtl
        label={props.previousLabel}
        onClick$={props.onPrevious$}
      />
    )}
    <Button
      look="text"
      tone="muted"
      label={props.label}
      trailingIcon="arrow_drop_down"
      disabled={props.disabled}
      aria-haspopup="listbox"
      aria-expanded={props.expanded ? "true" : "false"}
      data-date-picker-menu={props.which}
      onClick$={props.onToggle$}
    />
    {props.arrows && (
      <IconButton
        icon="chevron_right"
        flipIconInRtl
        label={props.nextLabel}
        onClick$={props.onNext$}
      />
    )}
  </div>
));

/**
 * The docked picker's dropdown: a `popover="auto"` dialog under the field (Escape and an outside
 * click dismiss it, as M3 says), 360dp, with the month and year menus, the day grid and the
 * Cancel / OK actions. A day chosen is a draft until OK.
 */
const Content = component$<{ class?: PropsOf<"div">["class"] }>(
  ({ class: className }) => {
    const ctx = useContext(dockedContextId);
    const rootRef = useSignal<HTMLElement>();

    const show = $(async (date: string) => {
      const { year, month } = parseDateStr(date);
      ctx.viewYear.value = year;
      ctx.viewMonth.value = month;
      ctx.focused.value = date;
    });

    const close = $(() => {
      rootRef.value?.hidePopover();
      document
        .querySelector<HTMLElement>(`[aria-controls="${ctx.popoverId}"]`)
        ?.focus();
    });

    const onToggle$ = $(async (event: ToggleEvent) => {
      const isOpen = event.newState === "open";
      ctx.open.value = isOpen;
      if (!isOpen) return;
      const c = ctx.cfg.value;
      ctx.today.value = isDateStr(c.today) ? c.today : todayStr();
      ctx.draft.value = ctx.value.value;
      ctx.view.value = "day";
      const start = clampDate(ctx.value.value || ctx.today.value, c.min, c.max);
      await show(start);
      await focusDay(rootRef.value, start, true);
    });

    const moveMonth = $(async (delta: number) => {
      const next = addMonths(ctx.viewYear.value, ctx.viewMonth.value, delta);
      ctx.viewYear.value = next.year;
      ctx.viewMonth.value = next.month;
    });

    const confirm = $(async () => {
      const date = ctx.draft.value;
      // A typed error is replaced by the picked date even when the value does not change.
      ctx.text.value = toTypedDate(date);
      ctx.typedError.value = "";
      if (date !== ctx.value.value) {
        ctx.value.value = date;
        await ctx.onDateChange$?.(date);
      }
      await close();
    });

    const clear = $(() => {
      ctx.draft.value = "";
    });

    const pickView = $(async (next: DockedView) => {
      ctx.view.value = ctx.view.value === next ? "day" : next;
      if (ctx.view.value === "day") return;
      // The chosen month / year is in view and takes the focus.
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const option = rootRef.value?.querySelector<HTMLElement>(
          '[data-date-picker-list] [aria-selected="true"]',
        );
        if (option) {
          option.scrollIntoView({ block: "center" });
          option.focus();
          return;
        }
      }
    });

    const backToDays = $(async (which: DockedView) => {
      ctx.view.value = "day";
      await new Promise((r) => requestAnimationFrame(r));
      rootRef.value
        ?.querySelector<HTMLElement>(`[data-date-picker-menu="${which}"]`)
        ?.focus();
    });

    return (
      <div
        ref={rootRef}
        id={ctx.popoverId}
        popover="auto"
        role="dialog"
        aria-label={ctx.cfg.value.dialogLabel}
        data-qds-date-picker-content=""
        onToggle$={onToggle$}
        onKeyDown$={shortcutKeys}
        style={{
          positionAnchor: ctx.anchor,
          insetBlockStart: "anchor(end)",
          // Lined up with the field, kept 8px inside a narrow window.
          insetInlineStart:
            "max(0.5rem, min(anchor(start), calc(100dvw - min(22.5rem, 100dvw - 1rem) - 0.5rem)))",
          // Below the field (M3); above it if it fits there; else below, scrolling (our menu's
          // fallback, `menu.css`).
          positionTryFallbacks: "flip-block, --qds-menu-scroll-below",
        }}
        class={[
          "fixed inset-auto m-0 scrollbar-pane w-90 max-w-[calc(100dvw-1rem)] overflow-y-auto p-0",
          "rounded-lg bg-surface-container-high text-on-surface shadow-3",
          className,
        ]}
      >
        <div class="flex h-16 items-center justify-between px-3">
          <DockedMenuButton
            which="month"
            label={monthNames(ctx.cfg.value.locale)[ctx.viewMonth.value].slice(
              0,
              3,
            )}
            previousLabel={ctx.cfg.value.previousMonthLabel}
            nextLabel={ctx.cfg.value.nextMonthLabel}
            arrows={ctx.view.value === "day"}
            disabled={ctx.view.value === "year"}
            expanded={ctx.view.value === "month"}
            onPrevious$={() => moveMonth(-1)}
            onNext$={() => moveMonth(1)}
            onToggle$={() => pickView("month")}
          />
          <DockedMenuButton
            which="year"
            label={String(ctx.viewYear.value)}
            previousLabel={ctx.cfg.value.previousYearLabel}
            nextLabel={ctx.cfg.value.nextYearLabel}
            arrows={ctx.view.value === "day"}
            disabled={ctx.view.value === "month"}
            expanded={ctx.view.value === "year"}
            onPrevious$={() => moveMonth(-12)}
            onNext$={() => moveMonth(12)}
            onToggle$={() => pickView("year")}
          />
        </div>

        {ctx.view.value === "day" ? (
          <>
            <div class="px-3">
              <CalendarGrid
                year={ctx.viewYear.value}
                month={ctx.viewMonth.value}
                selected={ctx.draft.value}
                today={ctx.today.value}
                min={ctx.cfg.value.min}
                max={ctx.cfg.value.max}
                locale={ctx.cfg.value.locale}
                tabDate={tabDateFor(
                  ctx.viewYear.value,
                  ctx.viewMonth.value,
                  [ctx.focused.value, ctx.draft.value, ctx.today.value],
                  ctx.cfg.value.min,
                  ctx.cfg.value.max,
                )}
                outsideDays
                onPick$={async (date, enter) => {
                  ctx.draft.value = date;
                  ctx.focused.value = date;
                  if (enter) await confirm();
                }}
                onFocusDate$={(date) => {
                  ctx.focused.value = date;
                }}
                onMove$={async (date) => {
                  await show(date);
                  await focusDay(rootRef.value, date);
                }}
              />
            </div>
            <div class="flex items-center gap-2 px-3 pt-2 pb-3">
              {ctx.cfg.value.clearable && (
                <Button
                  look="text"
                  label={ctx.cfg.value.clearLabel}
                  onClick$={clear}
                />
              )}
              <span class="flex-1" />
              <Button
                look="text"
                label={ctx.cfg.value.cancelLabel}
                onClick$={close}
              />
              <Button
                look="text"
                label={ctx.cfg.value.okLabel}
                onClick$={confirm}
              />
            </div>
          </>
        ) : (
          <div
            data-date-picker-list=""
            class="scrollbar-pane max-h-98 overflow-y-auto border-t border-outline-variant [--scrollbar-track-margin:0px]"
          >
            {ctx.view.value === "month" ? (
              <List.Root
                interactive
                indicator="secondary"
                aria-label={ctx.cfg.value.monthListLabel}
                value={String(ctx.viewMonth.value)}
                onValueChange$={async (v) => {
                  ctx.viewMonth.value = Number(v);
                  await backToDays("month");
                }}
              >
                {monthNames(ctx.cfg.value.locale).map((name, i) => (
                  <List.Item
                    key={name}
                    value={String(i)}
                    headline={name}
                    startIcon={i === ctx.viewMonth.value ? "check" : undefined}
                    start={
                      i === ctx.viewMonth.value ? undefined : (
                        <span class="size-6" />
                      )
                    }
                  />
                ))}
              </List.Root>
            ) : (
              <List.Root
                interactive
                indicator="secondary"
                aria-label={ctx.cfg.value.yearListLabel}
                value={String(ctx.viewYear.value)}
                onValueChange$={async (v) => {
                  ctx.viewYear.value = Number(v);
                  await backToDays("year");
                }}
              >
                {(() => {
                  const { first, last } = yearSpan(
                    ctx.cfg.value.min,
                    ctx.cfg.value.max,
                    parseDateStr(ctx.today.value).year,
                  );
                  return Array.from(
                    { length: last - first + 1 },
                    (_, i) => first + i,
                  ).map((y) => (
                    <List.Item
                      key={y}
                      value={String(y)}
                      headline={String(y)}
                      startIcon={y === ctx.viewYear.value ? "check" : undefined}
                      start={
                        y === ctx.viewYear.value ? undefined : (
                          <span class="size-6" />
                        )
                      }
                    />
                  ));
                })()}
              </List.Root>
            )}
          </div>
        )}
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Modal date picker and modal date input                           */
/* ------------------------------------------------------------------ */

export type DatePickerModalProps = ActionLabels &
  NavLabels &
  TypedDateMessages & {
    /** `single` (default) picks one date; `range` a start and an end (two taps). */
    mode?: "single" | "range";
    /**
     * The view it opens in: `calendar` (the M3 modal date picker, default) or `input` (the M3
     * modal date input). The edit / calendar icon button switches between them.
     */
    initialView?: "calendar" | "input";
    value?: string;
    "bind:value"?: Signal<string>;
    onDateChange$?: QRL<(value: string) => void>;
    startDate?: string;
    endDate?: string;
    "bind:startDate"?: Signal<string>;
    "bind:endDate"?: Signal<string>;
    onRangeChange$?: QRL<(start: string, end: string) => void>;
    min?: string;
    max?: string;
    today?: string;
    locale?: string;
    disabled?: boolean;
    /** The supporting text over the headline. Default "Select date" / "Select dates". */
    title?: string;
    /** Open state. Without it the picker renders its own opener (a text button showing the date). */
    "bind:open"?: Signal<boolean>;
    /** The headline in input view. Default "Enter date" / "Enter dates". */
    inputTitle?: string;
    /** Range: the end still to pick, in the headline. Default "End date". */
    endDateLabel?: string;
    /** Range: the start still to pick, in the headline. Default "Start date". */
    startDateLabel?: string;
    /** Single input view: the field's label. Default "Date". */
    dateLabel?: string;
    /** Field placeholder. Default "mm/dd/yyyy" (M3). */
    placeholder?: string;
    /** Range, calendar view (full screen): the confirm button. Default "Save". */
    saveLabel?: string;
    /** Range, calendar view: the close button's name. Default "Close". */
    closeLabel?: string;
    /** Opener text with nothing picked. Default "Select date" / "Select dates". */
    emptyLabel?: string;
    calendarIcon?: IconName;
    editIcon?: IconName;
    /** Default "Switch to text input". */
    toInputLabel?: string;
    /** Default "Switch to calendar". */
    toCalendarLabel?: string;
    /** Default "Choose year". */
    yearMenuLabel?: string;
    /** Range input: the end is before the start. Default "End date is before start date". */
    endBeforeStartText?: string;
    /** Clear text button (M3: optional). */
    clearable?: boolean;
    clearLabel?: string;
    class?: PropsOf<"dialog">["class"];
  };

const MODAL_BINDS = { value: "", startDate: "", endDate: "" };

/**
 * The M3 modal date picker (single date: a 360dp dialog; range: full screen, months in a
 * vertical scroll, as the M3 range spec) and the modal date input (`initialView="input"`, or the
 * edit icon), on our `Modal` (native `<dialog>`). Drafts until OK / Save; Cancel, the close button,
 * Escape and a scrim click leave the value alone.
 */
const ModalPicker = component$<DatePickerModalProps>((props) => {
  const {
    valueSig: value,
    startDateSig: startDate,
    endDateSig: endDate,
  } = useBindings(props, MODAL_BINDS);
  const open = useBoundSignal(props["bind:open"], false);
  const ownOpener = !props["bind:open"];
  const isRange = (props.mode ?? "single") === "range";
  // The visible supporting text ("Select date") names the dialog.
  const titleId = useId();
  const draft = useSignal("");
  const draftStart = useSignal("");
  const draftEnd = useSignal("");
  const text = useSignal("");
  const startText = useSignal("");
  const endText = useSignal("");
  const error = useSignal("");
  const startError = useSignal("");
  const endError = useSignal("");
  const inputView = useSignal(false);
  const yearView = useSignal(false);
  const now = todayStr();
  const today = useSignal(now);
  const viewYear = useSignal(parseDateStr(now).year);
  const viewMonth = useSignal(parseDateStr(now).month);
  const focused = useSignal("");
  const bodyRef = useSignal<HTMLElement>();
  /** Below 600px (M3 compact). Read when the picker opens, never in render (rule L19). */
  const compact = useSignal(false);

  const cfg = useComputed$(() => {
    const range = (props.mode ?? "single") === "range";
    return {
      min: props.min ?? "",
      max: props.max ?? "",
      locale: props.locale ?? "en-US",
      disabled: props.disabled ?? false,
      title: props.title ?? (range ? "Select dates" : "Select date"),
      inputTitle: props.inputTitle ?? (range ? "Enter dates" : "Enter date"),
      startDateLabel: props.startDateLabel ?? "Start date",
      endDateLabel: props.endDateLabel ?? "End date",
      dateLabel: props.dateLabel ?? "Date",
      placeholder: props.placeholder ?? "mm/dd/yyyy",
      cancelLabel: props.cancelLabel ?? "Cancel",
      okLabel: props.okLabel ?? "OK",
      saveLabel: props.saveLabel ?? "Save",
      closeLabel: props.closeLabel ?? "Close",
      emptyLabel: props.emptyLabel ?? (range ? "Select dates" : "Select date"),
      calendarIcon: props.calendarIcon ?? ("calendar_today" as IconName),
      editIcon: props.editIcon ?? ("edit" as IconName),
      toInputLabel: props.toInputLabel ?? "Switch to text input",
      toCalendarLabel: props.toCalendarLabel ?? "Switch to calendar",
      yearMenuLabel: props.yearMenuLabel ?? "Choose year",
      previousMonthLabel: props.previousMonthLabel ?? "Previous month",
      nextMonthLabel: props.nextMonthLabel ?? "Next month",
      clearable: props.clearable ?? false,
      clearLabel: props.clearLabel ?? "Clear",
      messages: {
        invalid: props.invalidDateText ?? "Invalid date. Use MM/DD/YYYY",
        early: props.tooEarlyText ?? "Date is too early",
        late: props.tooLateText ?? "Date is too late",
        endBeforeStart:
          props.endBeforeStartText ?? "End date is before start date",
      },
    };
  });

  const show = $((date: string) => {
    const { year, month } = parseDateStr(date);
    viewYear.value = year;
    viewMonth.value = month;
    focused.value = date;
  });

  /** Each open starts from the confirmed value, in the initial view. */
  useTask$(async ({ track }) => {
    const isOpen = track(open);
    if (!isOpen || !isBrowser) return;
    today.value = isDateStr(props.today) ? props.today : todayStr();
    compact.value = matchMedia("(width < 600px)").matches;
    draft.value = value.value;
    draftStart.value = startDate.value;
    draftEnd.value = endDate.value;
    text.value = toTypedDate(value.value);
    startText.value = toTypedDate(startDate.value);
    endText.value = toTypedDate(endDate.value);
    error.value = startError.value = endError.value = "";
    inputView.value = (props.initialView ?? "calendar") === "input";
    yearView.value = false;
    const start = clampDate(
      (isRange ? startDate.value : value.value) || today.value,
      props.min,
      props.max,
    );
    await show(start);
    if (inputView.value) return;
    // Not awaited: a task blocks this component's render, and the dialog opens after it.
    void (async () => {
      const root = bodyRef.value;
      if (!(await whenModal(root))) return;
      if (isRange) {
        root
          ?.querySelector(`[data-month="${start.slice(0, 7)}"]`)
          ?.scrollIntoView({ block: "start" });
      }
      await focusDay(root, start, true);
    })();
  });

  const closeDialog = $(() => {
    open.value = false;
  });

  const confirm = $(async () => {
    const c = cfg.value;
    if (isRange) {
      if (inputView.value) {
        startError.value = typedDateError(
          startText.value,
          c.min,
          c.max,
          c.messages,
        );
        endError.value = typedDateError(
          endText.value,
          c.min,
          c.max,
          c.messages,
        );
        if (startError.value || endError.value) return;
        const s = parseTypedDate(startText.value);
        const e = parseTypedDate(endText.value);
        if (e < s) {
          endError.value = c.messages.endBeforeStart;
          return;
        }
        draftStart.value = s;
        draftEnd.value = e;
      }
      if (!draftStart.value || !draftEnd.value) return;
      startDate.value = draftStart.value;
      endDate.value = draftEnd.value;
      await props.onRangeChange$?.(draftStart.value, draftEnd.value);
      return closeDialog();
    }
    if (inputView.value) {
      error.value = text.value.trim()
        ? typedDateError(text.value, c.min, c.max, c.messages)
        : "";
      if (error.value) return;
      draft.value = parseTypedDate(text.value);
    }
    if (draft.value !== value.value) {
      value.value = draft.value;
      await props.onDateChange$?.(draft.value);
    }
    return closeDialog();
  });

  const toggleView = $(async () => {
    const c = cfg.value;
    if (inputView.value) {
      // Input to calendar: whatever parses is kept.
      if (isRange) {
        const s = parseTypedDate(startText.value);
        const e = parseTypedDate(endText.value);
        if (s && !isOutOfRange(s, c.min, c.max)) {
          draftStart.value = s;
          draftEnd.value =
            e && e >= s && !isOutOfRange(e, c.min, c.max) ? e : "";
        }
      } else {
        const d = parseTypedDate(text.value);
        if (d && !isOutOfRange(d, c.min, c.max)) draft.value = d;
      }
      inputView.value = false;
      const start = (isRange ? draftStart.value : draft.value) || today.value;
      await show(start);
      await new Promise((r) => requestAnimationFrame(r));
      await focusDay(bodyRef.value, start);
    } else {
      text.value = toTypedDate(draft.value);
      startText.value = toTypedDate(draftStart.value);
      endText.value = toTypedDate(draftEnd.value);
      error.value = startError.value = endError.value = "";
      inputView.value = true;
    }
  });

  const pick = $(async (date: string, enter?: boolean) => {
    focused.value = date;
    if (isRange) {
      const next = nextTapRange(draftStart.value, draftEnd.value, date);
      draftStart.value = next.start;
      draftEnd.value = next.end;
    } else {
      draft.value = date;
      // M3 accessibility: "Enter: Saves and closes" (a range saves with its button).
      if (enter) await confirm();
    }
  });

  const toggleYears = $(async () => {
    yearView.value = !yearView.value;
    await new Promise((r) => requestAnimationFrame(r));
    const target = bodyRef.value?.querySelector<HTMLElement>(
      yearView.value
        ? '[data-year][aria-pressed="true"]'
        : '[data-date-picker-menu="year"]',
    );
    target?.scrollIntoView({ block: "center" });
    target?.focus();
  });

  /** The headline: the date (or range) being picked. */
  const headline = useComputed$(() => {
    const c = cfg.value;
    if (inputView.value) return c.inputTitle;
    if (isRange)
      return formatRangeHeader(
        draftStart.value,
        draftEnd.value,
        c.locale,
        c.startDateLabel,
        c.endDateLabel,
      );
    return draft.value ? formatHeaderDate(draft.value, c.locale) : c.title;
  });

  const openerText = useComputed$(() => {
    const c = cfg.value;
    if (isRange)
      return startDate.value && endDate.value
        ? formatRangeHeader(startDate.value, endDate.value, c.locale, "", "")
        : c.emptyLabel;
    return value.value
      ? new Intl.DateTimeFormat(c.locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(
          new Date(
            parseDateStr(value.value).year,
            parseDateStr(value.value).month,
            parseDateStr(value.value).day,
          ),
        )
      : c.emptyLabel;
  });

  /** Range calendar: the months listed (12 before the anchor to 12 after, within min / max). */
  const rangeMonths = useComputed$(() => {
    if (!isRange) return [];
    const c = cfg.value;
    const anchor = parseDateStr(startDate.value || today.value);
    const months: { year: number; month: number }[] = [];
    for (let d = -12; d <= 12; d++) {
      const m = addMonths(anchor.year, anchor.month, d);
      const firstDay = toDateStr(m.year, m.month, 1);
      const lastDay = toDateStr(m.year, m.month, 31);
      if ((c.max && firstDay > c.max) || (c.min && lastDay < c.min)) continue;
      months.push(m);
    }
    return months;
  });

  const moveTo = $(async (date: string) => {
    let target = date;
    if (isRange) {
      // Stay inside the listed months (their Tab stop and cells exist only there).
      const months = rangeMonths.value;
      if (months.length) {
        const firstDay = toDateStr(months[0].year, months[0].month, 1);
        const last = months[months.length - 1];
        const lastDay = toDateStr(
          last.year,
          last.month,
          daysInMonth(last.year, last.month),
        );
        target = clampDate(date, firstDay, lastDay);
      }
      focused.value = target;
    } else await show(target);
    await focusDay(bodyRef.value, target);
  });

  // The range picker's months scroll vertically (M3 range spec), full screen on compact windows
  // (M3 guidelines: "Full-screen ... recommended on compact"), a tall dialog on larger ones.
  const calendarRange = isRange;

  return (
    <>
      {ownOpener && (
        <Button
          look="text"
          leadingIcon={props.calendarIcon ?? "calendar_today"}
          label={openerText.value}
          disabled={props.disabled}
          aria-haspopup="dialog"
          onClick$={() => (open.value = true)}
        />
      )}
      <Modal.Root
        bind:open={open}
        position={
          calendarRange && !inputView.value && compact.value
            ? "fullScreen"
            : "center"
        }
      >
        <Modal.Content
          aria-labelledby={titleId}
          data-qds-date-picker-modal={isRange ? "range" : "single"}
          class={[
            inputView.value || !calendarRange || !compact.value
              ? inputView.value
                ? // M3 modal date input: 328dp wide.
                  "w-[min(20.5rem,calc(100dvw-2rem))]"
                : "w-[min(22.5rem,calc(100dvw-2rem))]"
              : "",
            calendarRange && !inputView.value && !compact.value
              ? "h-[min(40rem,calc(100dvh-3rem))]"
              : "",
            props.class,
          ]}
        >
          <div
            ref={bodyRef}
            class="flex min-h-0 flex-1 flex-col"
            onKeyDown$={shortcutKeys}
          >
            {calendarRange && !inputView.value && (
              <div class="flex h-14 shrink-0 items-center gap-1 ps-1 pe-3">
                <IconButton
                  icon="close"
                  label={cfg.value.closeLabel}
                  onClick$={closeDialog}
                />
                <span class="flex-1" />
                <Button
                  look="text"
                  label={cfg.value.saveLabel}
                  disabled={
                    !draftStart.value || !draftEnd.value || cfg.value.disabled
                  }
                  onClick$={confirm}
                />
              </div>
            )}
            {/* Header: supporting text, headline, the view switch. */}
            <div
              class={[
                "flex shrink-0 flex-col pe-3",
                calendarRange && !inputView.value
                  ? "ps-16 pb-3"
                  : "ps-6 pt-4 pb-3",
              ]}
            >
              <p id={titleId} class="text-label-large text-on-surface-variant">
                {cfg.value.title}
              </p>
              <div
                class={[
                  "flex items-center justify-between gap-2",
                  calendarRange && !inputView.value ? "mt-2" : "mt-9",
                ]}
              >
                <h2
                  aria-live="polite"
                  class={[
                    "min-w-0 text-on-surface",
                    calendarRange && !inputView.value
                      ? "text-title-large"
                      : "text-headline-large",
                  ]}
                >
                  {headline.value}
                </h2>
                <IconButton
                  icon={
                    inputView.value
                      ? cfg.value.calendarIcon
                      : cfg.value.editIcon
                  }
                  label={
                    inputView.value
                      ? cfg.value.toCalendarLabel
                      : cfg.value.toInputLabel
                  }
                  onClick$={toggleView}
                />
              </div>
            </div>
            <hr class="shrink-0 border-outline-variant" />

            {inputView.value ? (
              <div
                class={[
                  "flex gap-2 px-6 pt-4",
                  isRange ? "flex-row" : "flex-col",
                ]}
              >
                {isRange ? (
                  <>
                    <TextField
                      class="min-w-0 flex-1"
                      label={cfg.value.startDateLabel}
                      placeholder={cfg.value.placeholder}
                      inputMode="numeric"
                      autocomplete="off"
                      bind:value={startText}
                      error={startError.value}
                      disabled={cfg.value.disabled}
                      autofocus
                      onKeyDown$={(event) => {
                        if (event.key === "Enter") return confirm();
                      }}
                    />
                    <TextField
                      class="min-w-0 flex-1"
                      label={cfg.value.endDateLabel}
                      placeholder={cfg.value.placeholder}
                      inputMode="numeric"
                      autocomplete="off"
                      bind:value={endText}
                      error={endError.value}
                      disabled={cfg.value.disabled}
                      onKeyDown$={(event) => {
                        if (event.key === "Enter") return confirm();
                      }}
                    />
                  </>
                ) : (
                  <TextField
                    label={cfg.value.dateLabel}
                    placeholder={cfg.value.placeholder}
                    inputMode="numeric"
                    autocomplete="off"
                    bind:value={text}
                    error={error.value}
                    disabled={cfg.value.disabled}
                    autofocus
                    onKeyDown$={(event) => {
                      if (event.key === "Enter") return confirm();
                    }}
                  />
                )}
              </div>
            ) : calendarRange ? (
              <>
                {/* Weekdays once, over the scrolling months (M3 range spec). */}
                <div class="shrink-0 px-3" aria-hidden="true">
                  <CalendarGrid
                    year={viewYear.value}
                    month={viewMonth.value}
                    today=""
                    locale={cfg.value.locale}
                    tabDate=""
                    days={false}
                    onPick$={() => {}}
                    onMove$={() => {}}
                  />
                </div>
                <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                  {rangeMonths.value.map((m) => {
                    const prefix = toDateStr(m.year, m.month, 1).slice(0, 8);
                    return (
                      <div
                        key={prefix}
                        data-month={prefix.slice(0, 7)}
                        aria-label={formatMonthYear(
                          m.year,
                          m.month,
                          cfg.value.locale,
                        )}
                        class="pt-5"
                      >
                        <h3
                          aria-hidden="true"
                          class="ps-4 pb-2 text-title-small text-on-surface-variant"
                        >
                          {formatMonthYear(m.year, m.month, cfg.value.locale)}
                        </h3>
                        <CalendarGrid
                          year={m.year}
                          month={m.month}
                          rangeStart={draftStart.value}
                          rangeEnd={draftEnd.value}
                          today={today.value}
                          min={cfg.value.min}
                          max={cfg.value.max}
                          disabled={cfg.value.disabled}
                          locale={cfg.value.locale}
                          weekdays={false}
                          tabDate={
                            // One Tab stop in the whole list: the focused day's month
                            // (`focused` is kept inside the listed months by `moveTo`).
                            focused.value.startsWith(prefix)
                              ? focused.value
                              : ""
                          }
                          onPick$={pick}
                          onFocusDate$={(date) => {
                            focused.value = date;
                          }}
                          onMove$={moveTo}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div class="flex min-h-0 flex-col px-3">
                <div class="flex h-14 shrink-0 items-center justify-between">
                  <Button
                    look="text"
                    tone="muted"
                    label={formatMonthYear(
                      viewYear.value,
                      viewMonth.value,
                      cfg.value.locale,
                    )}
                    trailingIcon="arrow_drop_down"
                    class={yearView.value ? "[&_svg]:rotate-180" : ""}
                    aria-label={`${cfg.value.yearMenuLabel}: ${formatMonthYear(viewYear.value, viewMonth.value, cfg.value.locale)}`}
                    aria-expanded={yearView.value ? "true" : "false"}
                    data-date-picker-menu="year"
                    onClick$={toggleYears}
                  />
                  {!yearView.value && (
                    <div class="flex">
                      <IconButton
                        icon="chevron_left"
                        flipIconInRtl
                        label={cfg.value.previousMonthLabel}
                        onClick$={() => {
                          const m = addMonths(
                            viewYear.value,
                            viewMonth.value,
                            -1,
                          );
                          viewYear.value = m.year;
                          viewMonth.value = m.month;
                        }}
                      />
                      <IconButton
                        icon="chevron_right"
                        flipIconInRtl
                        label={cfg.value.nextMonthLabel}
                        onClick$={() => {
                          const m = addMonths(
                            viewYear.value,
                            viewMonth.value,
                            1,
                          );
                          viewYear.value = m.year;
                          viewMonth.value = m.month;
                        }}
                      />
                    </div>
                  )}
                </div>
                {yearView.value ? (
                  <div
                    role="group"
                    aria-label={cfg.value.yearMenuLabel}
                    class="scrollbar-pane grid h-72 grid-cols-3 content-start gap-y-2 overflow-y-auto py-1 [--scrollbar-track-margin:0px]"
                    // Left / Right step a year, Up / Down a row of the 3-column grid.
                    data-roving=""
                    data-roving-columns="3"
                    onKeyDown$={[rovingKeys]}
                  >
                    {(() => {
                      const { first: from, last } = yearSpan(
                        cfg.value.min,
                        cfg.value.max,
                        parseDateStr(today.value).year,
                      );
                      return Array.from(
                        { length: last - from + 1 },
                        (_, i) => from + i,
                      ).map((y) => (
                        <button
                          key={y}
                          type="button"
                          data-year={y}
                          tabIndex={y === viewYear.value ? 0 : -1}
                          // A raw <button>: no library primitive is a 72x36 year pill (rule U7).
                          aria-pressed={y === viewYear.value ? "true" : "false"}
                          class={[
                            "relative mx-auto h-9 w-18 focus-ring cursor-pointer rounded-full text-body-large",
                            "text-on-surface-variant aria-pressed:bg-primary aria-pressed:text-on-primary",
                            "after:absolute after:inset-0 after:rounded-full after:bg-current after:opacity-0",
                            "hover:after:opacity-8 focus-visible:after:opacity-10 active:after:opacity-10",
                          ]}
                          onClick$={async () => {
                            viewYear.value = y;
                            await toggleYears();
                          }}
                        >
                          {y}
                        </button>
                      ));
                    })()}
                  </div>
                ) : (
                  <CalendarGrid
                    year={viewYear.value}
                    month={viewMonth.value}
                    selected={draft.value}
                    rangeStart={isRange ? draftStart.value : undefined}
                    rangeEnd={isRange ? draftEnd.value : undefined}
                    today={today.value}
                    min={cfg.value.min}
                    max={cfg.value.max}
                    disabled={cfg.value.disabled}
                    locale={cfg.value.locale}
                    tabDate={tabDateFor(
                      viewYear.value,
                      viewMonth.value,
                      [focused.value, draft.value, today.value],
                      cfg.value.min,
                      cfg.value.max,
                    )}
                    onPick$={pick}
                    onFocusDate$={(date) => {
                      focused.value = date;
                    }}
                    onMove$={moveTo}
                  />
                )}
              </div>
            )}

            {!(calendarRange && !inputView.value) && (
              <div class="flex shrink-0 items-center gap-2 px-3 pt-2 pb-3">
                {cfg.value.clearable && (
                  <Button
                    look="text"
                    label={cfg.value.clearLabel}
                    onClick$={() => {
                      draft.value = draftStart.value = draftEnd.value = "";
                      text.value = startText.value = endText.value = "";
                    }}
                  />
                )}
                <span class="flex-1" />
                <Button
                  look="text"
                  label={cfg.value.cancelLabel}
                  onClick$={closeDialog}
                />
                <Button
                  look="text"
                  label={cfg.value.okLabel}
                  disabled={
                    cfg.value.disabled ||
                    (isRange &&
                      !inputView.value &&
                      !(draftStart.value && draftEnd.value))
                  }
                  onClick$={confirm}
                />
              </div>
            )}
          </div>
        </Modal.Content>
      </Modal.Root>
    </>
  );
});

export const DatePicker = {
  Root,
  Input,
  Content,
  Modal: ModalPicker,
};
