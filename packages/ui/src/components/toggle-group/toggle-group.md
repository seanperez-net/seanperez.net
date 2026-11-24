# ToggleGroup (segmented button)

Material 3 connected button group: what the segmented button became in M3 Expressive. One choice
out of a few. A small part of e-store's `ToggleGroup`: single choice only, no tiles, no wrapping.

## API

`ToggleGroup.Root` (`<div role="group">`)

| Prop             | Type                    | Default    | What                                  |
| ---------------- | ----------------------- | ---------- | ------------------------------------- |
| `bind:value`     | `Signal<string>`        |            | The chosen item's value               |
| `value`          | `string`                | `""`       | Starting value without a bound signal |
| `onValueChange$` | `QRL<(value) => void>`  |            | Called after the choice changed       |
| `look`           | `"outlined" \| "tonal"` | `outlined` |                                       |
| `size`           | `"xs" \| "sm" \| "md"`  | `sm`       | 32, 40, 48dp                          |

`ToggleGroup.Item` (`<button>`): `value` (required), `label`, `icon`, default slot.

## ARIA and keys

`role="group"`: give the root an `aria-label`. Each item is a button with `aria-pressed`. An
icon-only item needs its own `aria-label`. Arrow keys, Home and End move between items
(`utils/roving-focus.ts`, `rovingKeys`); Enter or Space chooses. A consumer's `onKeyDown$` on
the root runs after ours (2026-11-23: it was dropped through `...rest` before).

## Styles

`toggleGroupVariants` (tv) slots: `root`, `item`; variants `look`, `size`. Chosen:
`secondary-container`. Border: `outline-variant`.

## Usage

```tsx
<ToggleGroup.Root bind:value={mode} aria-label="Colour mode">
  <ToggleGroup.Item value="dark" icon="dark_mode" aria-label="Dark" />
  <ToggleGroup.Item value="light" icon="light_mode" aria-label="Light" />
</ToggleGroup.Root>
```
