# ScrollField

Material Design 3 Expressive scroll field: a vertical list of values, the centred one is the
value. https://m3.material.io/components/scroll-fields/overview

**NEW, not in e-store** (e-store has no scroll field) and **no web implementation exists** (M3's
availability table: Jetpack Compose only; no material-web token file). Built from the M3 pages
alone, read in Chrome on 2026-11-23: overview, specs (token table with "expand all"; the token set
menu checked for Light / Android / Standard and Light / Web / Expressive: the values are the same),
guidelines, accessibility. Research note: `packages/ui/.claude/notes/scroll-field-2026-11-23.md`.

**Reusable part.** Exported from `src/index.ts` (`ScrollField`, `scrollFieldVariants`, types). It
renders no label and no keyboard toggle of its own, so another component (the M3 scroll time
picker, whose anatomy lists "Scroll field") can embed it and place its own toggle and labels.

## Usage

```tsx
const mode = useSignal<ScrollFieldMode>("scroll");
const degrees = useSignal<ScrollFieldValue>(72);

<span id="temp">Temperature</span>
<IconButton toggle icon="keyboard" label="Type the values"
  selected={mode.value === "input"}
  onSelectedChange$={(on) => (mode.value = on ? "input" : "scroll")} />
<ScrollField aria-labelledby="temp" min={60} max={90} bind:value={degrees} bind:mode={mode} />
<ScrollField label="Unit" options={["oz", "L", "mL"]} value="L" bind:mode={mode} />
<ScrollField label="Minutes" options={minutes} loop size="sm" />
```

Always pair fields with a keyboard toggle near them (M3 accessibility: "Any scroll field needs a
way to also input text with a keyboard, like a toggle button next to the scroll fields"). One
toggle may drive several fields through one `bind:mode` signal (the guidelines' examples).

## API

| Prop                   | Type                              | Default                         | Notes                                                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`              | `readonly (string \| number)[]`   |                                 | The values, top to bottom. Wins over the range                                                                                                                                                                                                                                        |
| `min` / `max` / `step` | `number`                          | `0` / `99` / `1`                | A numeric range instead of `options` ("add intervals between values")                                                                                                                                                                                                                 |
| `pad`                  | `number`                          |                                 | Minimum digits of a number's whole part, zero-padded for display (`pad={2}`: 05). Values stay numbers; typing stays numeric ("5", Enter: 5, shown 05; "05" also matches)                                                                                                              |
| `value` / `bind:value` | `string \| number`                | first value                     |                                                                                                                                                                                                                                                                                       |
| `onValueChange$`       | `QRL<(value) => void>`            |                                 | Once per committed change                                                                                                                                                                                                                                                             |
| `mode` / `bind:mode`   | `"scroll" \| "input"`             | `"scroll"`                      | M3's two input modes                                                                                                                                                                                                                                                                  |
| `size`                 | `"sm" \| "md" \| "lg"`            | `"sm"`                          | 1-2 / 3 / 4 digits: min width 100 / 120 / 186dp, side padding 16 / 16 / 24dp                                                                                                                                                                                                          |
| `loop`                 | `boolean`                         | `false`                         | Infinitely looping list                                                                                                                                                                                                                                                               |
| `label`                | `string`                          |                                 | Accessible name (`aria-label`)                                                                                                                                                                                                                                                        |
| `aria-labelledby`      | `string`                          |                                 | A visible label's id instead of `label`                                                                                                                                                                                                                                               |
| `aria-describedby`     | `string`                          |                                 | Id(s) of the host's own description or error, put on the control before the field's own message id                                                                                                                                                                                    |
| `onInvalidChange$`     | `QRL<(invalid: boolean) => void>` |                                 | Typed text starts / stops matching no value (input mode). With `invalidText=""` a host shows its own error (the time picker does)                                                                                                                                                     |
| `disabled`             | `boolean`                         |                                 |                                                                                                                                                                                                                                                                                       |
| `error`                | `string`                          |                                 | Shown below; the value is drawn in `error`                                                                                                                                                                                                                                            |
| `invalidText`          | `string`                          | `"Enter a value from the list"` | Shown when typed text matches no value                                                                                                                                                                                                                                                |
| `name`                 | `string`                          |                                 | A hidden input posts the value                                                                                                                                                                                                                                                        |
| `reserveMessage`       | `boolean`                         | `true`                          | `true`: the 20px message line is always kept (default height 220). `false`: the field is the container's height (default 200, M3's); a message, while it shows, adds its line below (bottom padding of a `content-box` root). For hosts that pass no `error`, such as the time picker |
| `class`                |                                   |                                 | Placement only: `h-full` / `w-full` (fill) or a fixed `h-[...]`. With `reserveMessage` the height includes the 20px message line; without it, it is the container's                                                                                                                   |

Other `div` attributes go on the root.

## Behaviour

- Scroll mode: a CSS scroll-snap list (`scroll-snap-type: y mandatory`, items
  `scroll-snap-align: center`), so swipe, wheel and trackpad scroll and snap natively. The
  centred value is drawn active while scrolling (`scroll`), committed when it settles
  (`scrollend`; where `scrollend` is missing, 150ms after the last `scroll`).
- A tap on an inactive value scrolls to it. Below a 186px-high container an invisible target
  outside the container keeps 48dp for the value above / below.
- Up / Down move one value (smooth, instant with reduced motion); quick presses add up. With
  `loop` they wrap. Space / Enter set `mode` to `input` and focus the text.
- Input mode: the value alone in display-large. The field being typed in (focused) is the
  "active" one: a 2dp `primary` inset outline, the value in `primary`, a `primary` caret; a field
  in input mode that is not focused has no outline and an `on-surface` value (changed 2026-11-23,
  from the M3 time picker's Color drawing, whose fields are scroll fields: only the active input
  field is outlined; before, every input-mode field was). Enter / leaving the field commits; text
  that matches no value keeps the field invalid: `aria-invalid`, `error-container` fill, 2dp
  `error` outline, `on-error-container` value, focused or not (M3 time picker States "Error"),
  `invalidText` below. The input takes the container's width (`w-0 min-w-full`); the hidden
  sizer sets that width (before, the input's own `size` width made a 2-digit field 114px). For
  string lists the first characters complete the value inline, the rest selected
  (`aria-autocomplete="inline"`). `inputmode` is `numeric` (integers), `decimal` or `text`.
- The list starts at the value before any script in Chromium (`scroll-initial-target: nearest`
  on the selected option). Everywhere, one `useVisibleTask$` (default intersection-observer: when
  the field is first seen) puts it there, and again when the value, the list or `loop` changes
  from outside or the field returns from input mode.
- The container keeps the width of the longest value at the selected size (a hidden 0px-high
  copy), so it does not change width while scrolling.

## ARIA

- Scroll mode: the list is an APG **listbox** (single select, selection follows focus) with
  `aria-activedescendant` on the focused list, the options `role="option"` + `aria-selected`.
  Chosen over a spinbutton because M3's keys are "Up / Down: selects option above or below in
  scroll field's list", and the values run upward from the bottom: in an APG spinbutton Up
  _increases_ the value, which here is the option BELOW. The loop's two extra copies are
  `aria-hidden`. `aria-invalid` and `aria-describedby` (the message) when there is an error.
- Input mode: a native text input, named by `label` / `aria-labelledby`.
- The message line is `aria-live="polite"`, as the text field's.

## Proof (2026-11-23)

| Spec item                                                                                      | Ours                                                       | Status                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container height 200, min height 120                                                           | default 200 (`:where` root height), box `min-h-[120px]`    | PROOFED: specs tokens + Measurements drawing                                                                                                                                                                                             |
| Min width 100 / 120 / 186                                                                      | `size` sm / md / lg                                        | PROOFED: specs tokens AND the Measurements drawing say medium 120. The guidelines text says 144: the token table wins (owner may decide)                                                                                                 |
| Side padding 16 / 16 / 24                                                                      | item and input `px-4` / `px-6`                             | PROOFED: Measurements drawing                                                                                                                                                                                                            |
| Items gap 16                                                                                   | `gap-4`, centre to centre 74px                             | PROOFED: token. The 58px item box (mean of the 64 / 52 lines) is OURS, so snapping has one pitch                                                                                                                                         |
| Container shape: rounded, 16dp                                                                 | `rounded-lg` (16px)                                        | PROOFED: token detail panel; guidelines "corner radius shouldn't be less than 16dp"                                                                                                                                                      |
| Container color                                                                                | `surface-container-lowest`                                 | PROOFED: specs Color section                                                                                                                                                                                                             |
| Unselected item: `outline`, 45 / 52, 400                                                       | `text-display-medium text-outline`                         | PROOFED: token detail (display-medium)                                                                                                                                                                                                   |
| Selected item: `on-surface`, 57 / 64, -0.25, 500                                               | `text-display-large font-medium`                           | PROOFED: token detail (display-large at weight 500, M3's emphasized display-large)                                                                                                                                                       |
| Selection transition: spring damping 0.9, stiffness 1400                                       | `ease-spring-fast-spatial`, `duration-spring-fast`         | PROOFED: token = M3 fast spatial spring; our cubic-bezier is an approximation                                                                                                                                                            |
| State layer `on-surface` 8% hover, 10% focus                                                   | `after:` layer                                             | PROOFED: tokens                                                                                                                                                                                                                          |
| Focus indicator `secondary` 3dp, 2dp outside                                                   | `outline-focus-ring outline-3 outline-offset-2`            | PROOFED: tokens                                                                                                                                                                                                                          |
| Active (input): outline `primary` 2dp, value and caret `primary`                               | inset ring, `text-primary caret-primary`                   | PROOFED: tokens + anatomy (4, 5, 6) + States drawing                                                                                                                                                                                     |
| Disabled: container 38%, items 38%, active outline `on-surface` 38%, active value `on-surface` | as tokens                                                  | PROOFED: tokens                                                                                                                                                                                                                          |
| No scroll bar                                                                                  | `scrollbar-none`                                           | PROOFED: every spec drawing; overrides our `global.css` bar on purpose (the brief's exception)                                                                                                                                           |
| Swipe, tap inactive value, snap to centre                                                      | scroll snap, click                                         | PROOFED: guidelines Behavior; MDN scroll snap                                                                                                                                                                                            |
| Inactive targets min 48dp, outside the container                                               | outside strips                                             | PROOFED: accessibility "Targets"                                                                                                                                                                                                         |
| Keys Tab / Space-Enter / Up-Down                                                               | as spec                                                    | PROOFED: accessibility "Keyboard navigation". Space / Enter = activate = input mode is OUR reading of "activates" (the States drawings' active state is the input state)                                                                 |
| Two modes, text input with a keyboard toggle                                                   | `mode`; toggle placed by the page                          | PROOFED: overview, guidelines "Support keyboard input" (one toggle near paired fields)                                                                                                                                                   |
| Strings auto-complete from the first character                                                 | inline completion                                          | PROOFED: guidelines "Input behavior"                                                                                                                                                                                                     |
| Errors below, highlight the wrong value                                                        | message line, value in `error`                             | Text PROOFED (guidelines). Input mode colors PROOFED 2026-11-23 against the M3 time picker States drawing ("Error": `error-container` fill, `error` outline, light / dark); scroll-mode `error` value color still NOT PROOFED (no token) |
| Finite or infinitely looping                                                                   | `loop` (three copies, re-centred on the middle one)        | PROOFED: overview                                                                                                                                                                                                                        |
| Sizes small / medium / large                                                                   | `size`                                                     | PROOFED: overview, specs                                                                                                                                                                                                                 |
| Label fields side by side                                                                      | `label` / `aria-labelledby`; visible labels are the page's | PROOFED: guidelines. No grouping is defined by M3, so none here                                                                                                                                                                          |
| Fill container / custom fixed size                                                             | `class` on the root                                        | PROOFED: specs Measurements text                                                                                                                                                                                                         |
| High contrast                                                                                  | `forced-colors:` border                                    | NOT PROOFED: the specs show a high-contrast drawing only; not run in forced colors                                                                                                                                                       |
| listbox instead of spinbutton                                                                  |                                                            | PROOFED against the APG spinbutton and listbox patterns; a judgement call, see ARIA                                                                                                                                                      |
| `scrollend`                                                                                    | with a timer fallback                                      | MDN: Baseline 2025 (newly available); the fallback covers older Safari                                                                                                                                                                   |
| Qwik: `onScrollend$`, `sync$` preventDefault, `useVisibleTask$`                                |                                                            | PROOFED: installed rc.5 (`normalizeJsxEventName` lower-cases, so `onScrollend$` listens to `scrollend`; `PascalCaseNames` has no ScrollEnd)                                                                                              |

## Second agent's review (2026-11-23), what was done

A fresh agent read the code, the APG and the installed Qwik source (it could not load the M3
pages: they need JavaScript; it worked from the token list). Fixed: a key press after an unsettled
wheel scroll saved one value and scrolled to another (steps now start from the list's position);
the "already placed" check ignored a new list or `loop`; `"7"` did not match `7`; the width
followed the centred value; the server HTML showed option 0 until the task ran (Chromium);
the hidden input posted while disabled; the outside tap target covered the message; the hover
layer could show when disabled; an empty range (`min > max`) divided by zero; slot classes were
computed in the component body (Q12); `tabular-nums` removed (not in M3). Checked in Chrome.

Not changed, for the owner:

- **listbox or spinbutton.** The reviewer recommends `role="spinbutton"` on the list (one value,
  `aria-valuenow` / `aria-valuetext`, better with iOS VoiceOver, which barely supports
  `aria-activedescendant`), accepting that Down then moves to the next option, against the APG's
  "Up increases". Ours stays a listbox until the owner decides.
- **Leaving input mode.** Only the keyboard toggle (or the page's `bind:mode`) returns to scroll;
  with a plain `mode` prop and no toggle a field stays in input mode. M3 names no Escape or
  "Enter returns"; adding one would be behaviour M3 does not describe.
- `scrollbar-none` departs from the library rule "every scroller gets our bar"; kept because
  every M3 drawing shows none.
- The reserved 20px message line (now optional, `reserveMessage`, 2026-11-23), the `forced-colors` border, the `scrollend` timer
  fallback, `name` / hidden input, the English default `invalidText`: platform or form needs,
  not M3 items.
- With `loop`, a hard fling can reach the end of an outer copy before `scrollend` re-centres.
- A large range renders every value (three times with `loop`); M3 advises against long lists.

## Added 2026-11-23 (asked for by the time picker)

- `reserveMessage={false}`. M3's specs give the container 200 and no message line (no error
  tokens at all; the guidelines only say errors show below), so a field that never shows one can
  be exactly 200. The default stays `true` for existing users and so a message that appears does
  not move what is below. Without it the root is `box-sizing: content-box`, its height is the
  container's, and `data-message` adds `padding-bottom: 20px` holding the absolutely placed
  message; the empty message has no size but stays in the DOM (the live region and
  `aria-describedby` target). Only ONE line is added: a message that wraps (a
  100dp field fits about 15 characters a line) runs on below the field, over what follows.
- `pad`. Display only: options, value, `onValueChange$` and the hidden input stay numbers (the
  hidden input posts `5`, not `05`). The input shows the padded text and accepts either.

- Fixed 2026-11-23 (second-agent review of the time picker): the focus request from Space / Enter
  is tracked by the visible task, so the input is focused (and selected) also when a host switches
  `mode` itself in the same keypress (the time picker turns BOTH fields to input); before, focus
  fell to `<body>`. Checked in Chrome with real keys on `/time-picker/` and `/scroll-field/`.

## Left out

- Mouse drag on desktop (M3 says "swipe": touch drags natively; a mouse uses the wheel, a tap or
  the keys). Not added: it is not in the spec.
- Home / End / Page Up / Page Down are not handled: they are the scroll container's own keys
  (they scroll, snap, and the value commits on `scrollend`), so they work without code.

## Open questions

- Medium min width: 120 (tokens, drawing) or 144 (guidelines text)?
- Error colors: M3 gives none for this component.
- Space / Enter "activates": we read it as "switch to text input" (the specs' active state).
