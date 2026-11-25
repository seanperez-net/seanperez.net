# ToggleGroup (segmented button)

Material 3 connected button group: what the segmented button became in M3 Expressive. One choice
out of a few. A small part of e-store's `ToggleGroup`: single choice only, no tiles, no wrapping.

## API

`ToggleGroup.Root` (`<div role="group">`)

| Prop             | Type                    | Default    | What                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bind:value`     | `Signal<string>`        |            | The chosen item's value                                                                                                                                                                                                                                                                                                         |
| `value`          | `string`                | `""`       | Starting value without a bound signal                                                                                                                                                                                                                                                                                           |
| `onValueChange$` | `QRL<(value) => void>`  |            | Called after the choice changed                                                                                                                                                                                                                                                                                                 |
| `look`           | `"outlined" \| "tonal"` | `outlined` |                                                                                                                                                                                                                                                                                                                                 |
| `size`           | `"xs" \| "sm" \| "md"`  | `sm`       | 32, 40, 56dp (M3 connected group medium; e-store 48)                                                                                                                                                                                                                                                                            |
| `fullWidth`      | `boolean`               | `false`    | Fill the container, equal segments. PROOFED 2026-11-24: material-web `labs/segmentedbuttonset/internal/_shared.scss` (grid, `1fr` columns, `width: 100%`); M3 specs "Segment width: container width / total segments". New (e-store: `class="flex-1 basis-0"` on items)                                                         |
| `checkmark`      | `boolean`               | `false`    | The selected segment shows M3's check before its icon (with a label, instead of the icon). PROOFED 2026-11-24: material-web `labs/segmentedbutton/internal/segmented-button.ts` (check path, 2px stroke, default on there), `_shared.scss`; M3 segmented-buttons specs. Not animated (material-web draws it in over 150ms). New |

`ToggleGroup.Item` (`<button>`): `value` (required), `label`, `icon` (18dp, before the label), `disabled` and other `<button>` attributes, default slot.

## ARIA and keys

`role="group"`: give the root an `aria-label`. Each item is a button with `aria-pressed`. An
icon-only item needs its own `aria-label`. Arrow keys, Home and End move between items
(`utils/roving-focus.ts`, `rovingKeys`); Enter or Space chooses. A consumer's `onKeyDown$` on
the root runs after ours (2026-11-23: it was dropped through `...rest` before).

## Styles

`toggleGroupVariants` (tv) slots: `root`, `item`; variants `look`, `size`. Chosen:
`secondary-container`. Border: `outline` (M3 token `outline-color`, material-web v0_192; e-store has `outline-variant`, PROOFED 2026-11-24).

## Usage

```tsx
<ToggleGroup.Root bind:value={mode} aria-label="Color mode">
  <ToggleGroup.Item value="dark" icon="dark_mode" aria-label="Dark" />
  <ToggleGroup.Item value="light" icon="light_mode" aria-label="Light" />
</ToggleGroup.Root>
```
