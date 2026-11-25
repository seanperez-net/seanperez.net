import { $, component$, sync$, useComputed$ } from "@qwik.dev/core";
import type { PropsOf, QRL } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import {
  GRID_KEYS,
  buildMonthGrid,
  formatFullDate,
  formatMonthYear,
  isOutOfRange,
  moveFocusDate,
  weekdayNames,
} from "./calendar";

/**
 * One month of days: the M3 date picker's day grid, as the WAI-ARIA APG date picker dialog's
 * "Date Grid" (`<table role="grid">`, each day a focusable `role="gridcell"` with `aria-selected`,
 * ONE Tab stop, the arrow keys move focus).
 *
 * The grid part of e-store's `Calendar` (`Grid`, `GridHead`, `GridBody`, `Cell`, `CellTrigger`),
 * reduced to what the M3 date pickers use. Changed from e-store:
 * - The day is the focusable gridcell itself (APG), not a `<button aria-pressed>` inside a
 *   gridcell: the selected state is read from the focused element, and a date is not a toggle.
 * - Outside-month days are shown only when `outsideDays` (M3 docked picker), and are not
 *   interactive (M3 modal picker: blank).
 * - Range days: the two ends are filled `primary` circles, the days between `on-secondary-
 *   container` on a `secondary-container` band (M3 range selection color roles).
 * - The state layer is one overlay in the day's text color at 8% (hover) / 10% (focus, press),
 *   which is each state's token color (M3 date pickers tokens).
 *
 * @see https://m3.material.io/components/date-pickers/specs
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/
 */
export const calendarGridVariants = tv({
  slots: {
    table: "w-full table-fixed border-separate border-spacing-0 text-center",
    head: "h-12 p-0 text-center align-middle text-body-large font-normal text-on-surface",
    cell: [
      "group/day relative h-12 p-0 text-center align-middle text-body-large",
      // The ring (M3 focus indicator) is the round 48dp cell's, drawn inside its edge, just
      // outside the 40dp day.
      "focus-ring-inward rounded-full",
      "cursor-pointer select-none aria-disabled:cursor-default",
      // The range band between the two ends: secondary-container, 40dp high.
      "before:absolute before:inset-y-1 before:inset-s-0 before:inset-e-0 before:hidden",
      "before:bg-secondary-container",
      "data-range:before:block data-[range=single]:before:hidden",
      "data-[range=end]:before:inset-e-1/2 data-[range=start]:before:inset-s-1/2",
    ],
    day: [
      "relative inline-flex size-10 items-center justify-center rounded-full",
      "text-on-surface tabular-nums",
      // State layer, in the text color (its token color in every state).
      "after:absolute after:inset-0 after:rounded-full after:bg-current after:opacity-0",
      "after:transition-opacity after:duration-short-2 motion-reduce:after:transition-none",
      "group-hover/day:after:opacity-8 group-focus-visible/day:after:opacity-10",
      "group-active/day:after:opacity-10",
      "group-aria-disabled/day:text-on-surface/38 group-aria-disabled/day:after:hidden",
      // Today: a 1dp primary ring, primary text.
      "group-data-today/day:text-primary group-data-today/day:inset-ring",
      "group-data-today/day:inset-ring-primary",
      // Selected (a single date or a range end): filled primary.
      "group-data-fill/day:bg-primary group-data-fill/day:text-on-primary",
      // Inside a range.
      "group-data-[range=middle]/day:text-on-secondary-container",
    ],
    outside:
      "inline-flex size-10 items-center justify-center text-on-surface/38",
  },
});

export type CalendarGridProps = Omit<PropsOf<"table">, "onKeyDown$"> & {
  /** The month shown: its year and 0-based month. */
  year: number;
  month: number;
  /** The selected date (single selection). */
  selected?: string;
  /** Range selection: its start, and its end (`""` while only the start is picked). */
  rangeStart?: string;
  rangeEnd?: string;
  /** Today, `YYYY-MM-DD` (`aria-current="date"`, the ring). */
  today: string;
  min?: string;
  max?: string;
  /** Every day is disabled. */
  disabled?: boolean;
  /** BCP 47 locale for the names. */
  locale: string;
  /** The day that is the grid's Tab stop when it is in this month. */
  tabDate: string;
  /** Show the neighbouring months' days, dimmed (M3 docked picker). Default `false`. */
  outsideDays?: boolean;
  /** Render the weekday row (`<thead>`). Default `true`. */
  weekdays?: boolean;
  /** Render the days (`<tbody>`). Default `true`; `false` for a weekday row on its own. */
  days?: boolean;
  /**
   * A day was chosen (click, Enter, Space). `enter`: by the Enter key, which M3 says also saves
   * and closes ("Enter: Saves and closes"); the picker decides.
   */
  onPick$: QRL<(date: string, enter?: boolean) => void>;
  /**
   * A grid key moved focus to `date` (already checked against `min` / `max`). The picker shows
   * that month, then calls `focusDay`.
   */
  onMove$: QRL<(date: string) => void>;
  /** A day received focus (it becomes the Tab stop). */
  onFocusDate$?: QRL<(date: string) => void>;
};

/** Cancels the grid keys and Space on a day at once, so the page does not scroll. */
const preventGridKeys = sync$((event: KeyboardEvent) => {
  const day = (event.target as HTMLElement | null)?.closest?.("[data-date]");
  if (!day) return;
  if (
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      "Enter",
      " ",
    ].includes(event.key)
  )
    event.preventDefault();
});

/**
 * Moves focus to `date`'s day inside `root`, waiting for the month to render (a few frames), and
 * once more if a late render replaced the cell. It never takes focus back from an element outside
 * `root` that the user moved to, except on the first try when `take` (a picker that just opened).
 */
export const focusDay = async (
  root: Element | null | undefined,
  date: string,
  take = false,
) => {
  if (!root) return;
  const selector = `[data-date="${date}"]`;
  let settled = 0;
  for (let i = 0; i < 60 && settled < 3; i++) {
    const cell = root.querySelector<HTMLElement>(selector);
    const active = root.ownerDocument.activeElement;
    if (cell) {
      if (active === cell) settled++;
      else if (
        take ||
        !active ||
        active === root.ownerDocument.body ||
        root.contains(active)
      ) {
        cell.focus();
        take = false;
      } else return;
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};

export const CalendarGrid = component$<CalendarGridProps>(
  ({
    year,
    month,
    selected,
    rangeStart,
    rangeEnd,
    today,
    min,
    max,
    disabled,
    locale,
    tabDate,
    outsideDays = false,
    weekdays = true,
    days = true,
    onPick$,
    onMove$,
    onFocusDate$,
    class: className,
    ...rest
  }) => {
    const weeks = useComputed$(() => buildMonthGrid(year, month, outsideDays));
    const v = calendarGridVariants();
    const names = useComputed$(() => ({
      narrow: weekdayNames(locale, "narrow"),
      long: weekdayNames(locale, "long"),
    }));

    const onKeyDown$ = $(
      async (event: KeyboardEvent, table: HTMLTableElement) => {
        const cell = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-date]",
        );
        const date = cell?.dataset.date;
        if (!cell || !date) return;
        if (event.key === "Enter" || event.key === " ") {
          if (cell.getAttribute("aria-disabled") !== "true")
            await onPick$(date, event.key === "Enter");
          return;
        }
        if (!GRID_KEYS.includes(event.key)) return;
        const rtl = getComputedStyle(table).direction === "rtl";
        const next = moveFocusDate(date, event.key, event.shiftKey, rtl);
        if (!next || isOutOfRange(next, min, max)) return;
        await onMove$(next);
      },
    );

    return (
      <table
        {...rest}
        role="grid"
        aria-label={formatMonthYear(year, month, locale)}
        class={[v.table(), className]}
        onKeyDown$={[preventGridKeys, onKeyDown$]}
      >
        {weekdays && (
          <thead>
            <tr>
              {names.value.narrow.map((name, i) => (
                <th
                  key={i}
                  scope="col"
                  abbr={names.value.long[i]}
                  class={v.head()}
                >
                  <span aria-hidden="true">{name}</span>
                  <span class="sr-only">{names.value.long[i]}</span>
                </th>
              ))}
            </tr>
          </thead>
        )}
        {days && (
          <tbody>
            {weeks.value.map((week) => (
              <tr key={week[0].date}>
                {week.map((entry) => {
                  if (entry.outside) {
                    return (
                      <td key={entry.date} role="gridcell" class={v.cell()}>
                        {outsideDays && (
                          <span class={v.outside()} aria-hidden="true">
                            {entry.day}
                          </span>
                        )}
                      </td>
                    );
                  }
                  const date = entry.date;
                  const ranged = !!rangeStart;
                  const inRange =
                    ranged &&
                    (rangeEnd
                      ? date >= rangeStart && date <= rangeEnd
                      : date === rangeStart);
                  const range = !inRange
                    ? undefined
                    : !rangeEnd || rangeStart === rangeEnd
                      ? "single"
                      : date === rangeStart
                        ? "start"
                        : date === rangeEnd
                          ? "end"
                          : "middle";
                  const fill = ranged
                    ? !!range && range !== "middle"
                    : selected === date;
                  const off = !!disabled || isOutOfRange(date, min, max);
                  return (
                    <td
                      key={date}
                      role="gridcell"
                      data-date={date}
                      // Disabled days stay focusable (APG), so the grid never loses its Tab stop.
                      tabIndex={tabDate === date ? 0 : -1}
                      aria-selected={
                        inRange || (!ranged && selected === date)
                          ? "true"
                          : "false"
                      }
                      aria-disabled={off ? "true" : undefined}
                      aria-current={today === date ? "date" : undefined}
                      aria-label={formatFullDate(date, locale)}
                      data-range={range}
                      data-fill={fill ? "" : undefined}
                      data-today={today === date && !fill ? "" : undefined}
                      class={v.cell()}
                      onClick$={() => {
                        if (!off) return onPick$(date);
                      }}
                      onFocus$={() => onFocusDate$?.(date)}
                    >
                      <span class={v.day()}>{entry.day}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    );
  },
);
