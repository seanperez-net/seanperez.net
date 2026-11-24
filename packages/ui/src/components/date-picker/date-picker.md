# DatePicker

Material Design 3 date pickers: docked, modal (single and range) and modal date input.
https://m3.material.io/components/date-pickers/overview

From e-store's `components/date-picker/date-picker.tsx` (part names `Root` / `Input` / `Content` /
`Modal`, `mode`, `bind:value`, `bind:startDate` / `bind:endDate`, `onDateChange$`,
`onRangeChange$`, draft-until-OK, typed-date parsing, range header), rebuilt on the M3 specs,
guidelines and accessibility pages read 2026-11-23. The day grid is `CalendarGrid`
(`components/calendar/`).

## Usage

```tsx
// Docked (M3: medium and expanded windows): a field, the calendar under it.
<DatePicker.Root label="Date" bind:value={date}>
  <DatePicker.Input />
  <DatePicker.Content />
</DatePicker.Root>

// Modal (M3: compact windows), single date. Renders its own opener without bind:open.
<DatePicker.Modal bind:value={date} />

// Modal date input first (the edit / calendar icon switches views).
<DatePicker.Modal initialView="input" bind:value={date} />

// Range: months scroll vertically; full screen below 600px.
<DatePicker.Modal mode="range" bind:startDate={start} bind:endDate={end} />
```

## API

`DatePicker.Root` (docked)

| Prop                                                                                                                                                                    | Default                | Notes                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `value` / `bind:value` / `onDateChange$`                                                                                                                                | `""`                   | `YYYY-MM-DD`; written on OK, on Enter on a day, or a typed date on Enter / blur |
| `min` / `max`                                                                                                                                                           |                        | `YYYY-MM-DD`                                                                    |
| `today`                                                                                                                                                                 | viewer's clock at open | Ring                                                                            |
| `locale`                                                                                                                                                                | `"en-US"`              | Names                                                                           |
| `label`                                                                                                                                                                 |                        | Field label                                                                     |
| `supportingText`                                                                                                                                                        | `"MM/DD/YYYY"`         | M3 helper text gives the format                                                 |
| `error`, `required`, `disabled`, `name`                                                                                                                                 |                        | `name` posts `YYYY-MM-DD`                                                       |
| `inputVariant`                                                                                                                                                          | `"outlined"`           | M3 docked shows outlined                                                        |
| `clearable` / `clearLabel`                                                                                                                                              | `false` / `"Clear"`    | M3 accessibility: optional Clear                                                |
| `cancelLabel`, `okLabel`, `previousMonthLabel`, `nextMonthLabel`, `previousYearLabel`, `nextYearLabel`, `dialogLabel`, `invalidDateText`, `tooEarlyText`, `tooLateText` | English                | Every string is a prop                                                          |

`DatePicker.Input`: `calendarIcon` (`"calendar_today"`), `openLabel`, `placeholder`.
`DatePicker.Content`: placement only (`class`).

`DatePicker.Modal`

| Prop                                                                                                                                                                                                                                                  | Default            | Notes                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| `mode`                                                                                                                                                                                                                                                | `"single"`         | `"range"`: two taps                                                |
| `initialView`                                                                                                                                                                                                                                         | `"calendar"`       | `"input"` = M3 modal date input                                    |
| `value` / `bind:value` / `onDateChange$`                                                                                                                                                                                                              |                    | single                                                             |
| `startDate`, `endDate`, binds, `onRangeChange$`                                                                                                                                                                                                       |                    | range                                                              |
| `bind:open`                                                                                                                                                                                                                                           |                    | Without it, its own opener (text button, the date or `emptyLabel`) |
| `min`, `max`, `today`, `locale`, `disabled`, `clearable`                                                                                                                                                                                              |                    |                                                                    |
| `title`, `inputTitle`, `startDateLabel`, `endDateLabel`, `dateLabel`, `placeholder` (`mm/dd/yyyy`), `saveLabel`, `closeLabel`, `cancelLabel`, `okLabel`, `emptyLabel`, `toInputLabel`, `toCalendarLabel`, `yearMenuLabel`, `calendarIcon`, `editIcon` | English / M3 icons |                                                                    |

## Behaviour and ARIA

- Docked: `<div popover="auto" role="dialog">` opened by the field's trailing icon button
  (`popovertarget`: native toggle, Escape and outside click dismiss). CSS anchor positioning:
  under the field, above if it fits there, else under it scrolling; kept inside narrow windows.
  The header holds `< Mon ▾ >` and `< Year ▾ >`; a menu button swaps the grid for a `List`
  listbox (check on the chosen row), the other menu button disabled and the arrows hidden (M3).
  Six rows always, with outside days dimmed (M3 docked 456dp).
- Modal: our `Modal` (`<dialog>`, focus trap, Escape, scrim click). Header: supporting text
  (`label-large`), headline (`headline-large`: "Mon, Aug 17"), the edit / calendar icon button;
  then the "Month Year ▾" button and the arrows; the year view is a 3-column grid of 72x36 pills. Its keys are `rovingKeys` with
  `data-roving-columns="3"`: Left / Right a year (wrapping), Up / Down a row (2026-11-23; before
  that Up / Down also stepped one year), Home / End the first / last year.
- Range: X and Save at the top, headline `title-large` ("Aug 17 – 23"), weekdays once, every
  month under a `title-small` subhead in one vertical scroll (M3 range spec). Full screen below
  600px (read when it opens, not in render), a 360dp dialog up to 640px tall from 600px.
- Input view: `TextField`s ("Date"; range: start and end side by side), `mm/dd/yyyy`; formats
  accepted: `/ - . space`, leading zeros optional; errors on OK.
- Keys: the grid's (see `calendar.md`); Enter on a day picks and saves (single; M3 "Enter: Saves
  and closes"); Shift+M / Shift+Y focus the month / year menu (M3 keyboard table).
- Focus: on open, the selected day or today; Close / Cancel / OK / Save return it to the opener
  (native dialog / popover).

## Proof (2026-11-23)

| Item                                                                                     | Status                                                                                                         |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Docked 360 wide, `surface-container-high`, level 3; header 64; menu buttons; Cancel / OK | PROOFED: m3 specs (docked). Measured 360x460 in Chrome                                                         |
| Docked opens below the field; outside click / Escape dismiss                             | PROOFED: m3 guidelines                                                                                         |
| Month / year menus: list, check icon, other button disabled, arrows hidden               | PROOFED: m3 specs drawings. Selected row uses `List`'s `secondary` indicator (HOUSE; M3 draws surface-variant) |
| Modal 360, header 120 (supporting text, headline, edit icon), divider, Cancel / OK       | PROOFED: m3 specs (modal). Corner 28dp is Modal's (shape value not printed on the page)                        |
| Year grid 3 columns, 72x36, selected primary                                             | PROOFED: m3 specs                                                                                              |
| Range full screen, X + Save, title-large headline, vertical months                       | PROOFED: m3 specs (range) and guidelines ("recommended on compact"). The 600px switch is OURS                  |
| Modal date input 328 wide, "Enter date(s)", calendar icon back, two fields for a range   | PROOFED: m3 specs (modal input)                                                                                |
| Text entry always available; calendar icon the entry point                               | PROOFED: m3 accessibility                                                                                      |
| Formats on Enter / blur, no masks, accepted separators                                   | PROOFED: m3 accessibility                                                                                      |
| Shift+M / Shift+Y, Enter saves, PageUp / PageDown ±month, Shift ±year                    | PROOFED: m3 accessibility keyboard table                                                                       |
| Tooltips on prev / next with shortcut keys                                               | NOT DONE: needs the Tooltip component (another agent's); names are `aria-label`                                |
| `popovertarget` instead of a click handler                                               | PROOFED: HTML spec; e-store used JS (a click handler re-opened what light dismiss had closed)                  |

## Left out (e-store extras not in M3)

`Trigger` looks `tonal` / `text`, `Content size="compact"`, e-store's month-grid heading popover,
and everything listed in `calendar.md`.

## Added from M3 (e-store lacked)

Docked month / year menus and Cancel / OK; Shift+M / Shift+Y; Enter saves; optional Clear;
range as a scrolling month list with X / Save; modal date input as a first view; side-by-side
range fields; accepted typed separators; six-row docked grid.

## Second agent review (2026-11-23)

A fresh agent read our code and e-store's (it could not load m3.material.io: the site renders
with JavaScript). Fixed from it: a disabled or out-of-range Tab stop left the grid unreachable
(now `tabDateFor` + disabled days focusable, start clamped into min / max); up to 25 Tab stops
in the range list and focus lost past its last month (one stop, `moveTo` clamped); a picked date
did not clear a typed error when the value was unchanged; one `Intl.DateTimeFormat` per cell
(now cached); "Date is too late" for an end before the start (`endBeforeStartText`); 25 region
landmarks (months are `<div>`s now); both docked lists named "Choose date" (`monthListLabel`,
`yearListLabel`); year pills `aria-current` -> `aria-pressed`; signal reads in component bodies;
`pick` re-implemented `nextTapRange`.

Open, for the owner:

- `mode`, `initialView` and the own-opener choice are read once (mount-only); change them with a
  `key`, as the playground does.
- Full screen below 600px is measured when the picker opens (`matchMedia` in the task), not
  pure CSS: `Modal` has no breakpoint-switched position. Stale if the window is resized while
  open. A `Modal` variant would fix it (Modal belongs to another agent).
- (Fixed 2026-11-23) The modal dialog is named by `aria-labelledby` to its visible supporting
  text ("Select date" / `title`), now that `Modal.Content` keeps a passed `aria-labelledby`. The
  docked popover keeps `aria-label` (`dialogLabel`): it shows no title.
- Arrows do not stop at min / max months; the docked month list does not disable months outside
  min / max; the year grid's Up / Down move one year, not one row.
- Weeks always start on Sunday and the typed format is always MM/DD/YYYY, whatever `locale`
  (M3: the input format follows the locale).
- Years before 100 and `isDateStr` range checks are not handled.
- The range list covers 12 months either side of the start (M3's scrolls without limit).
