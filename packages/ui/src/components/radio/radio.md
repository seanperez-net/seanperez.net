# Radio

Material 3 radio button group. From e-store's `components/radio/` (2026-11-23).

- M3: https://m3.material.io/components/radio-button/specs (tokens: material-web v0_192 `_md-comp-radio-button.scss`)
- APG: https://www.w3.org/WAI/ARIA/apg/patterns/radio/

## Parts

| Part                | Element                                       | What                                                          |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `Radio.Group`       | `<div role="radiogroup">`                     | Holds the value, the keys, the `name`                         |
| `Radio.Item`        | `<div role="radio">` + `<input type="radio">` | One option; the hidden native radio posts the form            |
| `Radio.Indicator`   | `<span aria-hidden>`                          | 20dp ring, 10dp dot, 40dp state layer, 48dp touch target      |
| `Radio.Label`       | `<span id="{itemId}-label">`                  | The item's name (`aria-labelledby`)                           |
| `Radio.Description` | `<div id="{itemId}-description">`             | Helper text (`aria-describedby`); also usable outside an item |

## API

`Radio.Group`: `value` (`string`, starting value), `bind:value` (`Signal<string>`),
`onValueChange$`, `name` (generated when absent), `required`, `disabled`, `orientation`
(`"vertical"` default | `"horizontal"`), `onKeyDown$`, `onFocusIn$`, `...PropsOf<"div">`.

`Radio.Item`: `value` (required), `disabled`, `id` (wins over the generated one), `onClick$`,
`onKeyDown$`, `...PropsOf<"div">`. An `aria-label` replaces the `Radio.Label` reference.

## ARIA and keys

- Group: `role="radiogroup"`, `aria-orientation`, `aria-required`, `aria-disabled`. Give it a name
  (`aria-label`, or a `<fieldset>` + `<legend>` around it).
- Item: `role="radio"`, `aria-checked`, `aria-disabled`, `aria-labelledby`, `aria-describedby`.
- Arrows (all four, both orientations, as APG): move focus AND choose, wrapping, skipping disabled.
  In right-to-left text ArrowLeft goes forward (as ChipGroup). The shared
  `utils/roving-focus.ts` (`rovingKeys` with `data-roving-select`, `data-roving-home-end="false"`).
- Space chooses the focused item. Enter does nothing (APG lists Space only).
- Tab: ONE stop per group. The chosen item is the stop; with nothing chosen every item renders
  `tabindex="0"` until one takes focus, and then that one is the only stop. The focused value is
  state (`focusedValue`, set on `focusin`), and the tabindexes are rendered from it, so a value
  set from outside moves the stop too. Known gap: a `value` that matches no item leaves the
  group with no Tab stop.
- The hidden native radio (form posting) is `aria-hidden`, `tabindex="-1"`, and a sibling of the
  item (a focusable child of `role="radio"` would be nested interactive content).

## Usage

```tsx
const value = useSignal("standard");
<Radio.Group bind:value={value} name="delivery" aria-label="Delivery">
  <Radio.Item value="standard">
    <Radio.Indicator />
    <Radio.Label>Standard</Radio.Label>
    <Radio.Description>3 to 5 days</Radio.Description>
  </Radio.Item>
</Radio.Group>;
```

## Styles

`radioGroupVariants` (orientation) and `radioVariants` slots: `item`, `indicator`, `dot`,
`label`, `description`, `input`. Colors from M3 tokens: unselected `on-surface-variant`
(`on-surface` on hover), selected `primary`, disabled `on-surface` 38%, chosen or not (fixed in
the 2026-11-23 review: a chosen disabled item kept its `primary` ring, measured in Chrome).
Focus: the `focus-ring` utility on the item (8dp corners), as e-store; M3 draws it around the
40dp state layer instead (spec mismatch, left as e-store's). Motion has `motion-reduce` guards.

## Where it differs from e-store

- `{...rest}` first, the item's handlers after it; e-store spread `rest` last, so a consumer
  `onClick$` replaced the selection handler.
- Disabled styles key on `aria-disabled` (`group-aria-disabled/radio:`); e-store used
  `disabled:`, which never matches a `div`, so a disabled item looked enabled apart from the cursor.
- One Tab stop with nothing chosen (above); e-store left every item a Tab stop.
- Space only; e-store also chose on Enter.
- The checked state is a `useComputed$` read in JSX; e-store read it in the item body.
- The indicator has M3's 40dp state layer and the 48dp `touch-target`; hover darkens the ring.
- `Radio.Swatch` (e-store's color / finish picker) is NOT ported: removed 2026-11-23 (owner: a
  shop component, "we are not making a store").

## Not done / owner decision

A native `<input type="radio">` per item (styled with `appearance: none`, inside a `<label>`)
would give the keys, the single Tab stop, the checked state and form posting from the browser,
with no hidden input and no key handlers. That is a different design from e-store's: not built.

PROOFED 2026-11-23: APG radio group (keys, tab stop), material-web radio tokens (sizes,
colors), Qwik rc.5 (`sync$` cannot capture; signals in JSX). Checked in Chrome: arrows, Space,
Tab, disabled skip, hidden inputs follow the value, 48px target, 40px state layer.
