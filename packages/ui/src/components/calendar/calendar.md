# Calendar (helpers and `CalendarGrid`)

The date pickers' shared parts. Not a picker on its own: M3 has no stand-alone calendar component.

- `calendar.ts`: date maths on `YYYY-MM-DD` strings (no `Date` in state): `toDateStr`,
  `parseDateStr`, `isDateStr`, `todayStr`, `daysInMonth`, `addMonths`, `buildMonthGrid`,
  `isOutOfRange`, `moveFocusDate`, `nextTapRange`, `parseTypedDate`, `toTypedDate`, the `Intl`
  name and heading formatters.
- `calendar-grid.tsx`: `CalendarGrid`, one month as an APG date grid, and `focusDay`.

From e-store's `components/calendar/calendar.tsx` (helpers, cell states) and
`components/date-picker/date-picker.tsx` (typed-date parsing, header formats).

## CalendarGrid API

| Prop                     | Type                     | Notes                                                                                               |
| ------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------- |
| `year`, `month`          | `number`                 | The month shown (`month` 0-based)                                                                   |
| `selected`               | `string`                 | Single selection                                                                                    |
| `rangeStart`, `rangeEnd` | `string`                 | Range selection (`rangeEnd` `""` while picking)                                                     |
| `today`                  | `string`                 | Ring and `aria-current="date"`                                                                      |
| `min`, `max`, `disabled` |                          | Days outside are `aria-disabled`                                                                    |
| `locale`                 | `string`                 | Names                                                                                               |
| `tabDate`                | `string`                 | The one day with `tabindex=0`                                                                       |
| `outsideDays`            | `boolean`                | Docked: neighbouring months' days, dimmed, six rows always                                          |
| `weekdays` / `days`      | `boolean`                | Render the weekday row / the days (a weekday row alone for the range list)                          |
| `onPick$`                | `(date, enter?) => void` | Click, Enter, Space. `enter`: M3 "Enter saves and closes"                                           |
| `onMove$`                | `(date) => void`         | A grid key moved to `date` (already within min / max). The picker shows that month, then `focusDay` |
| `onFocusDate$`           | `(date) => void`         | A day got focus                                                                                     |

## ARIA and keys

- `<table role="grid">` named by the month; weekday `th scope="col"` (narrow letter shown, full name
  for screen readers); each day `td role="gridcell"` with `aria-selected`, `aria-label` = full
  date ("Monday, August 17, 2026", M3 accessibility), `aria-current="date"` on today.
- One Tab stop (roving `tabindex`). Arrows: a day / a week; Home / End: first / last day of the
  WEEK; PageUp / PageDown: a month, with Shift a year (day clamped). RTL swaps Left and Right.
  Enter / Space pick.

## Proof (2026-11-23)

| Item                                                                                             | Status                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Grid roles, one Tab stop, keys                                                                   | PROOFED: WAI-ARIA APG "Date Picker Dialog" example                                                                                    |
| Home / End = week                                                                                | PROOFED against APG. M3 accessibility says first / last day of the MONTH: the two disagree; we follow APG and e-store. OWNER DECISION |
| Day cells 48dp, 40dp circle, weekday row body-large on-surface                                   | PROOFED: m3 date pickers specs                                                                                                        |
| Today 1dp primary ring, primary text; selected primary / on-primary; outside days on-surface 38% | PROOFED: m3 specs                                                                                                                     |
| Range: ends primary, band secondary-container 40dp, text on-secondary-container                  | PROOFED: m3 specs (range)                                                                                                             |
| State layer 8% hover, 10% focus / press in the day's text colour                                 | PROOFED: m3 specs tokens                                                                                                              |
| Day as the gridcell itself (not `<button aria-pressed>` inside, as e-store)                      | PROOFED: APG example. CHANGED from e-store                                                                                            |
| Typed formats: slashes, dashes, dots, spaces, leading zero                                       | PROOFED: m3 accessibility. e-store took slashes and dashes only                                                                       |
| `focusDay` retries a few frames while the month renders                                          | OURS (e-store has the same idea)                                                                                                      |

## Left out (e-store extras not in M3)

Week numbers, the compact (Google Calendar) size, drag-to-select ranges, unavailable dates,
no-start dates, per-day content, nights count, e-store's month-grid heading popover.
