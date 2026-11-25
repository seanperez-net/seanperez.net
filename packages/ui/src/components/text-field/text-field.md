# Text field

Material Design 3 text field: outlined (default) or filled, with a floating label, supporting
text, an error, leading / trailing icons, prefix / suffix text, and a multi-line (`textarea`) mode.
From e-store's `components/text-field/` (2026-11-23).

- M3: https://m3.material.io/components/text-fields/specs
- MDN: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input
- Tokens checked: material-web `tokens/versions/v0_192/_md-comp-{outlined,filled}-text-field.scss`

## API (`TextField`)

| Prop                                                             | Type                                                                                      | Default      | Description                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| `variant`                                                        | `"outlined" \| "filled"`                                                                  | `"outlined"` | M3 style                                                                                 |
| `label`                                                          | `string`                                                                                  | -            | Floating label, and the input's accessible name (`<label for>`)                          |
| `value`                                                          | `string`                                                                                  | -            | The value; a later value from the parent replaces what is shown                          |
| `bind:value`                                                     | `Signal<string>`                                                                          | -            | Two-way value                                                                            |
| `onInput$`                                                       | `QRL<(event, element) => void>`                                                           | -            | After each keystroke (the value is already written to `bind:value`)                      |
| `onChange$`                                                      | `QRL<(event, element) => void>`                                                           | -            | Native `change`                                                                          |
| `type`                                                           | `"text" \| "email" \| "password" \| "tel" \| "url" \| "search" \| "number" \| "textarea"` | `"text"`     | `textarea` renders a `<textarea>`                                                        |
| `rows`                                                           | `number`                                                                                  | `10`         | `textarea` only (e-store's default)                                                      |
| `resize`                                                         | `"none" \| "vertical"`                                                                    | `"none"`     | `textarea` only                                                                          |
| `placeholder`                                                    | `string`                                                                                  | -            | Shown while the field is focused and empty (always, without a `label`)                   |
| `supportingText`                                                 | `string`                                                                                  | -            | The line under the field                                                                 |
| `error`                                                          | `string`                                                                                  | -            | Replaces the supporting text, marks the input `aria-invalid` (not while `disabled`)      |
| `leadingIcon`                                                    | `IconName`                                                                                | -            | An `Icon` name before the input                                                          |
| `trailingIcon`                                                   | `IconName`                                                                                | -            | An `Icon` name after the input (decorative; put a button beside the field for an action) |
| `prefixText`                                                     | `string`                                                                                  | -            | "$"                                                                                      |
| `suffixText`                                                     | `string`                                                                                  | -            | ".com"                                                                                   |
| `id`                                                             | `string`                                                                                  | `useId()`    | The input's id; the label's `for` and the description id (`${id}-description`) follow it |
| `name`, `required`, `disabled`, `autocomplete`, `maxLength`, ... | input attributes                                                                          | -            | Passed to the input                                                                      |
| `class`                                                          | `string`                                                                                  | -            | On the OUTER wrapper, for layout only (`flex-1`)                                         |

Parts (exported for custom compositions): `TextFieldInput`, `TextFieldLabel`, `TextFieldIcon`,
`TextFieldAffix`, `TextFieldSupportingText`, and their `tv()` variants.

## Anatomy

A five-track grid (e-store's): leading icon | prefix | input | suffix | trailing icon, 56dp high.
The label is absolutely positioned and follows the input's state through `peer-*`
(`:focus`, `:placeholder-shown`; the input always has a placeholder, a space if none was given):
it rests at the container's centre line in body-large and floats in body-small, onto the outline
(outlined, on a patch of `--field-bg`) or 8dp from the top (filled). Supporting text is a reserved
body-small line, 4dp under the container, 16dp from the sides.

## States (M3 tokens)

| State    | Outlined                                 | Filled                                                     |
| -------- | ---------------------------------------- | ---------------------------------------------------------- |
| Rest     | 1dp `outline`                            | `surface-container-highest`, 1dp `on-surface-variant` line |
| Hover    | `on-surface` outline, label `on-surface` | `on-surface` line, `on-surface` 8% state layer             |
| Focus    | 3dp `primary` outline, label `primary`   | 3dp `primary` line, label `primary`                        |
| Error    | `error` (hover `on-error-container`)     | same, on the line                                          |
| Disabled | outline `on-surface` 12%, text 38%       | container `on-surface` 4%, line 38%, text 38%              |

3dp, not the 2dp of the token file: material-web overrides it (`tokens/_md-comp-*-text-field.scss`,
"remove when focus tokens update to 3px").

## ARIA

- Native `<input>` / `<textarea>`, named by `<label for>`.
- `aria-describedby="${id}-description"` while there is supporting text or an error;
  `aria-errormessage` and `aria-invalid="true"` only while `error` is set and the field is enabled.
- The required star is `aria-hidden`; the input carries `required`.
- No focus ring: M3 shows focus with the active indicator (`data-focus-indicator="active-indicator"`).

## Usage

```tsx
const email = useSignal("");
<TextField name="email" type="email" label="Email" bind:value={email}
  supportingText="We never share it" />

<TextField name="bio" type="textarea" rows={3} variant="filled" label="Bio" />
```

## Where it differs from e-store

PROOFED 2026-11-23 against the material-web token files above, ARIA in HTML, Chrome.

- Disabled colors per the tokens; e-store's disabled rules read `aria-disabled`, which no element
  carried, so most never applied. State is read from the input (`:disabled`, `aria-invalid`), and
  the wrapper `<div>` carries no ARIA (a generic element takes neither attribute).
- A disabled field with an `error` is not marked invalid (disabled colors win).
- Filled: line `on-surface-variant` (e-store `outline`), hover state layer, hover label stays
  `on-surface-variant`; error hover `on-error-container` for the label too.
- The placeholder appears on focus (e-store hid it always).
- The trailing icon is always shown (e-store showed it only on focus or input; M3 does not hide it).
  Icons are centred in filled too, and are icon NAMES, not JSX.
- The input fills the field and carries the padding; e-store's `[textarea]:` classes are not valid
  Tailwind selectors and its supporting text's `mt-.5` is not a class.
- `bind:value` (through `useBindings`); e-store has `value` only.
- Logical insets, reduced-motion guards.
- The supporting-text line is `aria-live="polite"`, so an error that appears is announced
  (material-web uses `role="alert"`); a caller's own `aria-describedby` is kept (joined).
- Prefix / suffix are always shown without a label (e-store hid them until focus); icons are
  `pointer-events-none`, so a click on one reaches the input.

Added 2026-11-23 from e-store (NOT in M3, NOT PROOFED against M3; checked in Chrome):

| Prop               | Values                                                          | What                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`          | `plain`, `tonal` (beside outlined, filled)                      | No floating label (`aria-label` from `label`); plain an underline, tonal a 56dp surface-container box. e-store's tonal input sat at the top of its box; ours centres it |
| `density`          | `default`, `compact`                                            | compact: 14px text, an inline label in its own column, a 36dp row; no prefix                                                                                            |
| `textSize`         | `auto`, `title-large`, `headline-small`                         | A title field's type size                                                                                                                                               |
| `resize`           | adds `horizontal`, `both`                                       | Textarea                                                                                                                                                                |
| `type`             | adds `date`, `datetime-local`, `month`, `time`, `week`, `color` |                                                                                                                                                                         |
| `showPicker`       | `Signal<boolean>`                                               | Set to true from a user gesture: calls the input's `showPicker()`                                                                                                       |
| slot `input-start` |                                                                 | Content before the input in compact density                                                                                                                             |

Left out: `ide` (e-store's code-editor look) and `feel` (store.google.com). Not in e-store either:
the M3 character counter and the trailing error icon.

## The floated label on a colored container

An outlined field's floated label covers the outline with a patch of `--field-bg` (default
`surface`), e-store's mechanism. A container with any other fill MUST set `--field-bg` to its own
color, or the patch shows as a box (seen 2026-11-23 on the knobs panel, before it became a `Card`).
`Card` sets it from its variant (e-store's), and the knobs frame is an outlined `Card`. The same holds for `Select` and
`Combobox`.
The `.bg-surface*` rules in `tokens/utilities.css` match the plain class only: a fill set under a
variant (`md:bg-surface`, `max-md:bg-surface-container-low`) must set the variable under the same
variant (`md:[--field-bg:var(--color-surface)]`). Found 2026-11-23 on the supporting pane, where the
Theme companion's `layoutMode` Select painted the scaffold's `surface-container` over a `surface` pane.
