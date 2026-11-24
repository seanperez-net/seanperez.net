# Select

Material Design 3 select (exposed dropdown menu): a text-field-shaped combobox that opens a menu of
options. Popover API + CSS anchor positioning, no headless library. From e-store's
`components/select/select.tsx` (2026-11-23).

- M3: https://m3.material.io/components/menus/specs, https://m3.material.io/components/text-fields/specs
- APG: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/
- Tokens checked: material-web `_md-comp-{outlined,filled}-select.scss`, `_md-comp-menu.scss`

## Parts

| Part                    | Element                                    |
| ----------------------- | ------------------------------------------ |
| `Select.Root`           | `<div>`, context, state                    |
| `Select.Label`          | `<label for=trigger>`, floating            |
| `Select.Trigger`        | `<button role="combobox" popovertarget>`   |
| `Select.Value`          | the chosen option's label, or placeholder  |
| `Select.Content`        | `<div role="listbox" popover="auto">`      |
| `Select.Item`           | `<div role="option">`                      |
| `Select.ItemIndicator`  | check on the chosen option                 |
| `Select.SupportingText` | the line under the field (and the error)   |
| `Select.HiddenSelect`   | native `<select>`: form value, no-JS field |

## API

### Select.Root

| Prop                             | Type                                             | Default      | Description                                                                                 |
| -------------------------------- | ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------- |
| `value`                          | `string`                                         | `""`         | A later value from the parent replaces it                                                   |
| `bind:value`                     | `Signal<string>`                                 | -            | Two-way value                                                                               |
| `onValueChange$`                 | `QRL<(value: string) => void>`                   | -            | Only when the USER picks                                                                    |
| `options`                        | `SelectOption[]` (`{ value, label, disabled? }`) | -            | Labels by value (a value set from outside shows its label), and the native select's options |
| `variant`                        | `"outlined" \| "filled"`                         | `"outlined"` | May change after render                                                                     |
| `disabled`, `required`           | `boolean`                                        | `false`      |                                                                                             |
| `name`                           | `string`                                         | -            | Form key (on `HiddenSelect`)                                                                |
| `error`                          | `string`                                         | -            | Shown by `SupportingText`; marks the combobox invalid (not while disabled)                  |
| `id`                             | `string`                                         | `useId()`    | The TRIGGER's id                                                                            |
| `aria-label` / `aria-labelledby` | `string`                                         | -            | Names the combobox when there is no `Select.Label`                                          |

`Select.Label`: `label`. `Select.Trigger`: `dropdownIcon` (`IconName`, `arrow_drop_down`); no
`variant` override (Label and Value read Root's, so an override split the field). `Select.Value`: `placeholder` (floats the label). `Select.Item`: `value`
(required), `disabled`. `Select.ItemIndicator`: `icon` (`check`). `Select.SupportingText`:
`supportingText`. `Select.HiddenSelect`: `options`, `placeholder`, `dropdownIcon`.

Always render `Select.SupportingText`: the trigger's `aria-describedby` points at it, it shows the
error, and it reserves the line.

## Keyboard (APG select-only combobox)

DOM focus stays on the combobox; the active option is `aria-activedescendant` (and `data-active`).

| Key                           | Closed                              | Open                                      |
| ----------------------------- | ----------------------------------- | ----------------------------------------- |
| `ArrowDown`, `Enter`, `Space` | opens, active = chosen (else first) | Down: next; Enter / Space: pick and close |
| `ArrowUp`, `Home` / `End`     | opens on the first / first / last   | previous / first / last (no wrap)         |
| `PageUp` / `PageDown`         | -                                   | 10 options                                |
| `Alt+ArrowUp`                 | -                                   | pick and close                            |
| `Escape`                      | -                                   | closes (Popover API), focus stays         |
| `Tab`                         | -                                   | picks the active option, focus moves on   |
| letters                       | open and go to the first match      | type-ahead (500ms buffer, repeat cycles)  |

Disabled options are skipped. A mouse press on an option does not take focus off the combobox
(`preventdefault:mousedown` on the listbox).

## Look

Field as `TextField` (56dp; focus = 3dp `primary` outline / line; error and disabled tokens).
Menu: `surface-container`, elevation 2, 4dp corners, 8dp vertical padding, as wide as the field
(`anchor-size(width)`), below it, flipping above when there is no room. Options 48dp, 12dp sides,
body-large; hover `on-surface` 8%, active 10% (plus the inward focus ring after a key), chosen
`secondary-container`.

## Without JavaScript (e-store's)

`HiddenSelect` is `display: none` with JS (still submitted). Under `@media (scripting: none)` it is
the visible field in the trigger's place, styled with the trigger's classes, named by the label.
Give `options` for that.

## Browser support

Popover API and CSS anchor positioning: current Chrome, Edge, Safari and Firefox. Checked in Chrome
only. e-store's anchor polyfill is not ported (a dynamic `import()`).

## Where it differs from e-store

PROOFED 2026-11-23 against the APG select-only combobox example, ARIA in HTML, the material-web
token files and Chrome.

- Focus stays on the combobox (`aria-activedescendant`); e-store moved DOM focus into the options,
  which the APG combobox pattern does not do. One `sync$` on the trigger handles every key. Tab
  picks; arrows do not wrap; PageUp / PageDown and Alt+ArrowUp added (APG).
- The label rests at 28dp (the field's centre); e-store's `top-1/2` was half of the Root, which
  includes the supporting text.
- Field colours as the text field tokens (e-store faded the whole trigger to 38% when disabled);
  outlined uses `outline`, not `ring`.
- The error replaces the supporting text and is referenced (`aria-describedby`,
  `aria-errormessage`); e-store printed it in a second, unreferenced line. `aria-required` added.
- `variant` is reactive (e-store's context held a plain value); Trigger has no `variant` override.
- A required, empty select that fails form validation shows the browser's `validationMessage` in
  the supporting-text line (e-store: red with no text, WCAG 1.4.1 / 3.3.1).
- The menu is placed with logical insets (`inset-inline-start: anchor(start)`), so it lines up in
  RTL (checked in Chrome with `dir="rtl"`); e-store's `left: anchor(start)` does not.
- The arrow follows the state (`primary` open, `error`, disabled 38%); the filled value sits 8dp
  from the bottom like the text field's text (e-store 6dp). A Space keyup is cancelled so no
  browser toggles the popover shut after a keyboard open.
- Not done (second agent's points, left open): a form reset does not reset the select; the label
  does not float on focus alone (e-store's behaviour, not checked against material-web).
- No z-index on the popover (top layer). Signals read in JSX.
- Review 2026-11-23 (second pass), fixed and run in Chrome: the disabled colours keyed on
  `group-has-disabled/select:`, which also matched `HiddenSelect`'s `<option disabled>`, so a
  Select with one disabled option drew its label, arrow and supporting text at 38%; they now key
  on the trigger's `:disabled`. A focused or open invalid field kept a `primary` label and arrow;
  they are `error` now (M3 `error-focus-*`). Same bug in e-store (findings 107, 108).

Added 2026-11-23 from e-store: `variant="plain" | "tonal"` (no floating label: the hidden label
names the combobox through `aria-labelledby`, as a `display:none` label cannot through `for`;
40dp, 14px; tonal `surface-container`, `error-container` when invalid), `density="compact"`
(36dp, plain and tonal), `Select.Group` (`role="group"`, `aria-labelledby` its GroupLabel: a fix,
e-store's group had no name), `Select.GroupLabel`, `Select.ErrorMessage` (the description id,
`aria-live`, the error or the native validation message). The list has `scrollbar-pane`.
plain / tonal / compact are e-store's looks, NOT in M3, NOT PROOFED. Checked in Chrome:
heights, sizes, names, tonal invalid colour, ArrowDown skips group labels, group names.

## Select or Dropdown

`Dropdown` is an ACTION menu (APG menu button: `role="menu"`, `menuitem`, `menuitemcheckbox`); it
has no value. `Select` picks ONE value for a form (`listbox` / `option`, a native select behind it).
Ported 2026-11-23 as `Dropdown` on `Menu`'s parts: see `dropdown/dropdown.md`.
