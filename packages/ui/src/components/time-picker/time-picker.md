# TimePicker

Material Design 3 (Expressive) time pickers: dial, input and scroll; modal (all three) and
inline (input and scroll); 12- or 24-hour. https://m3.material.io/components/time-pickers/overview

From e-store's `components/time-picker/time-picker.tsx` (dial geometry 256 / radius 104 and 68,
slider role, pointer capture, hour-then-minute on release, draft until OK), rebuilt on the M3
Expressive specs and accessibility pages read 2026-11-23. The input and scroll fields are our
`ScrollField` (M3's anatomy names the time fields "Scroll field").

## Usage

```tsx
<TimePicker.Modal bind:value={time} />                          // dial, vertical
<TimePicker.Modal variant="dial" orientation="horizontal" bind:value={time} />
<TimePicker.Modal variant="input" use24h bind:value={time} />
<TimePicker.Modal variant="scroll" bind:value={time} />
<TimePicker.Inline variant="scroll" bind:value={time} />        // no Cancel / OK
```

The value is `"HH:mm"`, 24-hour (as `<input type="time">`), whatever the display.

## API

Shared: `value` / `bind:value` / `onTimeChange$`, `use24h` (`false`), `disabled`, `name`,
`hourLabel` ("Hour"), `minuteLabel` ("Minute"), `amLabel` ("AM"), `pmLabel` ("PM"), `periodLabel`
("Period"), `toInputLabel` ("Switch to text input"), `toPickerLabel` ("Switch to clock" for the
dial, "Switch to scroll fields" for scroll), `invalidLabel` ("Enter a valid time",
the text in M3's guidelines drawing).

`TimePicker.Modal`: `variant` (`"dial"` | `"input"` | `"scroll"`, default `"dial"`),
`orientation` (`"vertical"` | `"horizontal"`, dial only), `bind:open` (without it, its own opener
text button), `title` ("Select time", "Enter time" in the input view), `cancelLabel` ("Cancel"),
`okLabel` ("OK"), `emptyLabel` ("Select time"), `locale` (opener text, "en-US"), `class`.

`TimePicker.Inline`: `variant` (`"scroll"` default | `"input"`), `label` (group name, "Time"), `class`.

Also exported: `formatTime`, `parseTime` (the `"HH:mm"` helpers) and `timePickerVariants` (tv).

## Behaviour and ARIA

- Dial picker: the hour and minute fields are toggle buttons (`aria-pressed`, M3: "fields are
  toggles on the dial picker"); the dial is an APG slider: `aria-valuetext` "Hour 7 of 12",
  "Hour 7" (24-hour), "Minute 24 of 60" (M3 labels). Right / Down clockwise, Left / Up
  counter-clockwise, Enter on the hour moves to the minutes (M3 keys). Tap or drag (pointer
  capture, `touch-action: none`); the release on the hour moves to the minutes. 24-hour: outer
  ring 00-11, inner ring 12-23 (M3 text).
- Input picker: two `ScrollField`s in input mode. Scroll picker: two looping `ScrollField`s
  (hours, minutes) in scroll mode with one keyboard toggle (`IconButton toggle icon="keyboard"`)
  that puts both in input mode (M3: "a way to also input text").
- Input view (2026-11-23): only the field being typed in is outlined in `primary` with a `primary`
  value; the other is plain `surface-container-lowest` / `on-surface` (M3 Color drawing). The ":"
  separator is 16dp wide between the 100dp fields. A value that matches no hour / minute ("99",
  "77", on Enter or leaving the field) keeps the last valid time, turns THAT field to the error
  scheme (`error-container` fill, `error` outline, `on-error-container` value, `aria-invalid`),
  and shows ONE line, "Enter a valid time" (`text-body-small text-error`), below the fields
  (M3 guidelines: "Errors should appear below the time picker, and highlight the invalid field
  with an error color scheme"). The line is a polite live region and each invalid field's
  `aria-describedby`; the picker grows by its 20px while it shows. Fixing the value, or leaving
  the input view, clears it. Hours and minutes are numeric ranges shown zero-padded
  (`ScrollField pad={2}`): "5" then Enter is 05.
- AM / PM: a radio group (M3 accessibility), arrows move and select, one Tab stop.
- Modal: our `Modal`; the inner surface is `surface-container-low`, padding 12; focus starts on
  the hour field (M3). The start icon switches dial and input (`keyboard` / `schedule`), or scroll
  and input (a toggle). Cancel, Escape and the scrim leave the value.
- Inline: fields fill the width (100dp each at least), a column of AM, PM (40dp) and the
  keyboard toggle; every change is the value.

## Proof (2026-11-23)

| Item                                                                                                                               | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertical dial 304x472, padding 12, fields 100x120 (132 for 24-hour), periods 56 + 8 + 56, dial 256, handle 48, track 2, centre 8   | PROOFED: m3 specs. Measured 304x472 in Chrome                                                                                                                                                                                                                                                                                                                                                                                                         |
| Horizontal dial: padding 24, 52 gap, period pills under the fields                                                                 | PROOFED: m3 specs                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Input 304x200: padding 12, fields 100x120, separator 16, gap 8, periods 56, then 8 and a 48dp action row (12 + 120 + 8 + 48 + 12)  | PROOFED 2026-11-23: m3 specs Measurements drawing ("Modal time picker (input & scroll)"). Measured in Chrome: dialog 304x200, fields 100x120, separator 16, action row 48 at +140. Scroll variant also 304x200. Before: 304x204, and the fields were 114 wide in input mode, covering the separator                                                                                                                                                   |
| No headline, no "Hour" / "Minute" supporting text (Expressive)                                                                     | PROOFED 2026-11-23: m3 specs Anatomy. The Expressive "Input & dial time picker" anatomy has no headline and no supporting text; "Headline" and "Time input field supporting text / label text" are listed only under Baseline ("no longer recommended"). e-store renders the baseline headline ("Select time" / "Enter time") and "Hour" / "Minute" under its inputs: NOT taken. The dialog is named by `aria-label` (no visible heading to point at) |
| Input field states: active outlined, error fill + outline                                                                          | PROOFED 2026-11-23: m3 specs Color (only the active field outlined) and States ("Error": light `error-container` fill / `error` outline; dark the same roles) drawings. Error placement: m3 guidelines "Input time picker" (one message below, the invalid field highlighted)                                                                                                                                                                         |
| Dial view fields: selected = `surface-container-lowest`, 2dp `primary` outline, `primary` value                                    | PROOFED 2026-11-23: m3 specs Color drawing (dial picker's hour field, light and dark). Not `primary-container` (that is the selected AM / PM)                                                                                                                                                                                                                                                                                                         |
| Colors: fields / dial `surface-container-lowest`, active field primary outline + primary text, period selected `primary-container` | PROOFED: m3 specs (Expressive)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Field and period corner radius                                                                                                     | NOT PROOFED: 16dp (`rounded-lg`, ScrollField's); not printed on the page                                                                                                                                                                                                                                                                                                                                                                              |
| Dial labels, keys, toggles, radio group, initial focus                                                                             | PROOFED: m3 accessibility                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Hour then minute on release                                                                                                        | e-store's; matches M3's demos (not stated in the text)                                                                                                                                                                                                                                                                                                                                                                                                |
| Scroll variant on ScrollField                                                                                                      | PROOFED: m3 specs anatomy ("Scroll field"); ScrollField's own proof in `scroll-field.md`                                                                                                                                                                                                                                                                                                                                                              |
| Inline AM / PM as 40dp buttons beside the fields                                                                                   | PROOFED: m3 specs (inline scroll drawing). The coordinator suggested AM / PM as a third string ScrollField; M3's inline drawing shows buttons, so buttons were kept. OWNER DECISION                                                                                                                                                                                                                                                                   |
| Tap bug fixed 2026-11-23 (owner: "a click does not select")                                                                        | The pointer value was set inside an awaited QRL; a quick click's `pointerup` ran first and moved to the minutes, so the click set the minute. Now set synchronously by a module function in each handler; checked with real clicks and a drag in Chrome                                                                                                                                                                                               |

No mouse-wheel handling on the dial: it is in neither M3 nor e-store. (The wheel the owner saw
working is the scroll variant's `ScrollField`.)

## Against e-store (2026-11-23, input view)

e-store's `InputMode`: baseline visuals (`surface-container-highest` fields 96x72, "Enter time"
headline, "Hour" / "Minute" supporting text, AM / PM as a bordered pressed-button column) and NO
validation: it clamps a typed value into range on every keystroke (99 becomes 12), so a mistake is
silently changed and no error ever shows. Ours keeps e-store's `inputmode="numeric"` and the field
names (`aria-label` "Hour" / "Minute"), and follows M3 Expressive for the rest: 100x120 fields, no
headline or supporting text, the M3 error line and error field scheme instead of clamping.

## Invalid values and OK (decided 2026-11-23, PROOFED 2026-11-23)

- OK never commits or closes while a field is invalid: the dialog stays open, the error line stays,
  and focus moves to the first invalid field. OK is NOT disabled (a disabled button gives no
  reason and leaves the Tab order). Sources: m3 time-pickers guidelines, "The OK button confirms
  the selection and closes the modal" and "Errors should appear below the time picker, and
  highlight the invalid field with an error color scheme"; m3 scroll-fields guidelines, errors
  "should highlight the incorrect value". An invalid field is not a selection.
- OK reads the typed text itself (digits, hour 1-12 or 0-23, minute 0-59): pressing OK straight
  after typing comes before the fields' own `change` handlers have committed the text, and closed
  with the LAST valid time (bug found in Chrome 2026-11-23: "5" then OK gave 07:30, "99" then OK
  closed silently). Checked again with real keys and clicks: "99" + OK stays open with the error,
  "4" + OK gives 04:30.
- Each open starts with fresh fields (keyed by the open count): an invalid "99" left by Cancel or
  Escape came back, red, on the next open, without the error line (bug found in Chrome).
- Focus on open selects the hour's text, so typing replaces it ("5" is 05, not "075").
- Inline (no OK): an invalid value is never committed; the last valid time stays the value and
  the error shows until the text is fixed or the view changes.

References read 2026-11-23 (RULE 2: ideas, not truth):

- Jetpack Compose material3 `TimePicker.kt` (androidx/androidx `androidx-main`, last commit on the
  file 5e7904ae): `TimeInput` rejects non-digits and a third digit outright, keeps an out-of-range
  number visible with `isError` and a per-field error supporting text (polite live region), and
  exposes `TimePickerState.isInputValid`; the dialog's confirm button is the app's, so blocking
  OK is left to the caller. Validation is per keystroke. Same outcome as ours (text kept, field in
  error, nothing silently clamped); we validate on Enter / leaving the field, as `ScrollField`
  does, and do not filter keystrokes (not in M3's text).
- Angular Material `src/material/timepicker/timepicker-input.ts` (angular/components `main`,
  last commit on the file aff31f10): one text input for the whole time, parsed on every `input`,
  an unparsable text kept and reported as the `matTimepickerParse` form error (shown by the app's
  `mat-error`), reformatted on blur only when valid. No OK button (a dropdown of times). Nothing
  to adopt beyond what we do.

## Inline gap (checked 2026-11-23, NOT built)

The coordinator asked for the 24dp token as the gap between the inline fields. The m3
time-pickers specs token table ("expand all") lists "Time pickers inline scroll field items gap
24dp" next to "Time pickers separator width 16dp", and the inline Measurements drawing ("Inline
time picker (input & scroll)") prints 16 between the two fields and 8 before the AM / PM column.
"Items gap" is the scroll field's own name for the vertical gap between VALUES (scroll-fields
specs: items gap 16dp), so the 24dp token reads as the inline picker's value spacing, not the gap
between the fields. The fields stay 16dp apart (the separator). Applying 24dp between values
needs a ScrollField item-gap option (its 74px pitch is fixed); left for the owner.

## Left out (e-store extras not in M3)

PageUp / PageDown / Home / End on the dial, e-store's baseline (pre-Expressive) visuals, its
`Trigger` and `PopoverContent` (a time picker in a popover; M3 has modal and inline only).

## ScrollField options used (2026-11-23)

- `reserveMessage={false}`: the fields are the container's height (120; 140 inline), so the input
  picker is M3's 304x200. `invalidText=""` hides the field's own message; `onInvalidChange$` and
  `aria-describedby` let the picker show M3's single "Enter a valid time" line below both fields.
- Numeric ranges with `pad={2}` (minutes 0-59, hours 1-12 or 0-23) instead of padded string
  lists: they show 05, and typing "5" then Enter gives 05 (a string list completed "5" to "50").

## Second agent review (2026-11-23)

Fixed from it: a release over the dial from a press that began elsewhere set a value (now a
`sync$` marks the press on the dial); signal reads in component bodies; `whenModal` moved to
`utils/top-layer.ts`.

Open, for the owner:

- No visible "Select time" headline: e-store renders one; our 304x472 matches M3's Expressive
  dial measurements only without it (re-checked 2026-11-23: the Expressive anatomy has no
  headline; it is a baseline part). So the dialog is named by `aria-label` (`title`, "Select
  time"): there is no visible heading to point `aria-labelledby` at (now possible: `Modal.Content`
  keeps a passed `aria-labelledby` since 2026-11-23).
- No Home / End / PageUp / PageDown on the dial (APG slider lists them; M3's key table does not).
- An empty value shows 12:00 AM / 00:00, so OK without a change commits "00:00".
- `variant` is read once (mount-only).

## Fixes 2026-11-25

- The hidden `<input name>` (Modal and Inline) carries `disabled` with the picker, so a disabled
  picker posts nothing (HTML "constructing the entry list" skips disabled controls). Spec:
  `time-picker.spec.tsx`. PROOFED: HTML spec; second agent agreed.
- `ModalPicker` reads no props in its body (rule Q12, Qwik rc.5 best practices: "Avoid reading
  signals, stores, or reactive props directly in a component body"): `ownOpener` and
  `startView` are `useComputed$`, and `view` is seeded by a `useTask$` on `startView` (it runs on
  the server too), so a changed `variant` now also changes the view. Run in Chrome: variant knob
  `input` opens "Enter time" with "Switch to clock"; dial opens the dial, focus on "Hour 7".
  PROOFED: Qwik MCP best practices (2.0.0-rc.5); second agent agreed. Left as is: `useBindings` /
  `useBoundSignal` read props in the body by design (shared helpers), and `InlinePicker` still
  seeds `view` from `props.variant` (not in this item).
- Not fixed here (same bug, other component): `DatePicker`'s hidden input has no `disabled`.
