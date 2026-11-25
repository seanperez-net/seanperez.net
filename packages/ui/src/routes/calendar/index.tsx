import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  CalendarGrid,
  IconButton,
  Layout,
  addMonths,
  focusDay,
  formatMonthYear,
  nextTapRange,
  parseDateStr,
  tabDateFor,
  todayStr,
} from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

/**
 * `CalendarGrid` on its own: the date pickers' month grid. M3 has no stand-alone calendar, so
 * the month arrows here stand in for a picker's header.
 */
export default component$(() => {
  const knobs = useKnobs({
    selection: knob.select(["single", "range"] as const, "single"),
    outsideDays: knob.boolean(false),
    weekdays: knob.boolean(true),
    days: knob.boolean(true),
    disabled: knob.boolean(false),
    min: knob.text("", "min (YYYY-MM-DD)"),
    max: knob.text("", "max (YYYY-MM-DD)"),
    locale: knob.text("en-US"),
  });
  const now = todayStr();
  const year = useSignal(parseDateStr(now).year);
  const month = useSignal(parseDateStr(now).month);
  const selected = useSignal("");
  const rangeStart = useSignal("");
  const rangeEnd = useSignal("");
  const focused = useSignal("");
  const gridRef = useSignal<HTMLElement>();

  return (
    <>
      <Layout.PaneHeader title="Calendar" />
      <Knobs knobs={knobs}>
        <div ref={gridRef} class="grid w-full max-w-sm gap-2">
          <div class="flex items-center justify-between">
            <IconButton
              icon="chevron_left"
              label="Previous month"
              flipIconInRtl
              onClick$={() => {
                const prev = addMonths(year.value, month.value, -1);
                year.value = prev.year;
                month.value = prev.month;
              }}
            />
            <span class="text-title-small text-on-surface-variant">
              {formatMonthYear(year.value, month.value, knobs.values.locale)}
            </span>
            <IconButton
              icon="chevron_right"
              label="Next month"
              flipIconInRtl
              onClick$={() => {
                const next = addMonths(year.value, month.value, 1);
                year.value = next.year;
                month.value = next.month;
              }}
            />
          </div>
          <CalendarGrid
            year={year.value}
            month={month.value}
            selected={
              knobs.values.selection === "single" ? selected.value : undefined
            }
            rangeStart={
              knobs.values.selection === "range" ? rangeStart.value : undefined
            }
            rangeEnd={
              knobs.values.selection === "range" ? rangeEnd.value : undefined
            }
            today={now}
            min={knobs.values.min || undefined}
            max={knobs.values.max || undefined}
            disabled={knobs.values.disabled}
            locale={knobs.values.locale}
            tabDate={tabDateFor(
              year.value,
              month.value,
              [focused.value, selected.value, rangeStart.value, now],
              knobs.values.min || undefined,
              knobs.values.max || undefined,
            )}
            outsideDays={knobs.values.outsideDays}
            weekdays={knobs.values.weekdays}
            days={knobs.values.days}
            onPick$={(date) => {
              focused.value = date;
              if (knobs.values.selection === "single") {
                selected.value = date;
              } else {
                const range = nextTapRange(
                  rangeStart.value,
                  rangeEnd.value,
                  date,
                );
                rangeStart.value = range.start;
                rangeEnd.value = range.end;
              }
            }}
            onFocusDate$={(date) => {
              focused.value = date;
            }}
            onMove$={async (date) => {
              const { year: y, month: m } = parseDateStr(date);
              year.value = y;
              month.value = m;
              await focusDay(gridRef.value, date);
            }}
          />
          <p class="text-body-medium text-on-surface-variant">
            {knobs.values.selection === "single"
              ? `selected: "${selected.value}"`
              : `rangeStart: "${rangeStart.value}", rangeEnd: "${rangeEnd.value}"`}
          </p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Calendar: @seanperez/ui" };
