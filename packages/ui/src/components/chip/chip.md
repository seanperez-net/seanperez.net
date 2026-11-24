# Chip

Material 3 chips: assist, filter, input, suggestion. From e-store's `components/chip/`
(`chip.tsx`, `chip-group.tsx`; 2026-11-23).

- M3: https://m3.material.io/components/chips/specs and /accessibility
- Tokens: material-web v0_192 `_md-comp-{assist,filter,input,suggestion}-chip.scss`
- APG toolbar (ChipGroup): https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/

## Chip API

| Prop                | Type                                              | Default      | What                                                    |
| ------------------- | ------------------------------------------------- | ------------ | ------------------------------------------------------- |
| `type`              | `"assist" \| "filter" \| "input" \| "suggestion"` | `"assist"`   | M3 chip type                                            |
| `label`             | `string`                                          |              | The text (children are used when absent)                |
| `elevated`          | `boolean`                                         | `false`      | Shadow + `surface-container-low` instead of the outline |
| `size`              | `"md" \| "sm"`                                    | `"md"`       | `sm`: 24dp pill (e-store's, not M3)                     |
| `appearance`        | `"outlined" \| "tonal" \| "text"`                 | `"outlined"` | Filter only; tonal / text e-store's (not M3)            |
| `shape`             | `"default" \| "pill"`                             | `"default"`  | `md` corners: 8dp or full                               |
| `tone`              | `"default" \| "primary" \| "error"`               | `"default"`  | Assist only: label, icon and state-layer colour         |
| `leadingIcon`       | `IconName`                                        |              | 18dp icon before the label                              |
| `selected`          | `boolean`                                         | `false`      | Filter: starting state                                  |
| `bind:selected`     | `Signal<boolean>`                                 |              | Filter: two-way state                                   |
| `onSelectedChange$` | `QRL<(selected) => void>`                         |              | Filter: after a change                                  |
| `selectedIcon`      | `IconName \| null`                                | `"check"`    | Filter: icon while selected; `null` for none            |
| `onRemove$`         | `QRL<() => void>`                                 |              | Input: shows the remove button                          |
| `removeLabel`       | `string`                                          | `"Remove"`   | Input: read as "Remove {label}"                         |
| `closeIcon`         | `IconName`                                        | `"close"`    | Input: the remove icon                                  |
| `disabled`          | `boolean`                                         |              |                                                         |
| `onClick$`          | `QRL`                                             |              | Assist / suggestion / input primary action              |

## ChipGroup API

`label` (the toolbar's name), `orientation` (`horizontal` default), `overflow` (`wrap` | `scroll`),
`onKeyDown$`, `onFocusIn$`, `...PropsOf<"div">`.

## ARIA and keys

- Assist / suggestion: a `<button>`. Filter: a `<button aria-pressed>` (a toggle button).
- Input with `onRemove$`: a `<span>` holding two SIBLING buttons (a button may not contain one):
  the primary action (named by the label) and the remove button (`aria-labelledby` = "Remove" +
  label).
- ChipGroup: `role="toolbar"`, one Tab stop (the last focused chip, and its remove button);
  Left / Right (or Up / Down when vertical; mirrored in RTL), Home, End move between chips,
  wrapping (the shared `utils/roving-focus.ts`, `rovingKeys`); Backspace / Delete removes the focused input chip and focus moves to the chip in its place.

## Sizes and colours (M3)

32dp high, 8dp corners, 16dp side padding (8dp beside a leading icon or trailing action; input
chips 12dp at the start), `label-large`, 18dp icons, 1dp `outline` border. Assist label
`on-surface`, icon `primary`. Filter label `on-surface-variant`, icon `primary`; selected
`secondary-container` / `on-secondary-container`, no outline. Input label and icons
`on-surface-variant`. Suggestion label `on-surface-variant`, icon `primary`. State layer 8 / 10 /
12%. Disabled label 38%, outline `on-surface` 12%. Every chip and remove button is 48dp to the
pointer (`touch-target`). Focus: `focus-ring`.

## Usage

```tsx
<ChipGroup label="Filter by diet">
  <Chip type="filter" label="Vegan" bind:selected={vegan} />
</ChipGroup>
<Chip type="input" label="Ada" leadingIcon="person" onRemove$={() => remove("ada")} />
```

## Where it differs from e-store

- `leadingIcon` is an icon NAME drawn at 18dp in M3's icon colour; e-store took JSX and painted it
  the label colour (M3: assist / filter / suggestion icons are `primary`).
- `label` prop added (CMS rule: text as a prop); children still work.
- Elevated container `surface-container-low` (M3); e-store used its own floating surface.
- Disabled also keys on `aria-disabled`, so the input chip's `<span>` dims (e-store's `disabled:`
  never matched the span).
- 48dp touch targets on chips and remove buttons.
- ChipGroup: no `useVisibleTask$` (e-store set the roving tabindex in an eager visible task); the
  first `focusin` sets it, in a `sync$`. The remove button of every chip but the current one
  leaves the Tab order too (e-store left them all as Tab stops, so Tab walked every remove button).
- After Backspace / Delete, focus waits for the chip to leave the DOM (`MutationObserver`, 1s cap);
  e-store used `setTimeout(0)`, which can run before Qwik re-renders.
- Arrow keys follow `orientation` and are mirrored in RTL.
- `{...rest}` first, handlers by name; the remove button needs no `stopPropagation` (siblings).
  On an input chip with a remove button, `{...rest}` and the 48dp `touch-target` go on the
  primary button, and the outer span's `::after` takes no pointer events (it painted over the
  primary button, so the chip body did nothing; found by the second agent, checked in Chrome).
- Added 2026-11-23 from e-store: `size` (`md` M3, `sm` 24dp pill, label-small, 16dp icons),
  `appearance` (filter: `outlined` M3, `tonal`, `text`), `shape` (`default` 8dp, `pill`), `tone`
  (assist: `default`, `primary`, `error`). Only md / outlined / default / default are M3; the rest
  are e-store's store looks, NOT PROOFED. Checked in Chrome: heights, radii, paddings, type
  sizes, colours of every tone and appearance both states, icon sizes.
- Left out: `ChipField` (e-store's 600-line chip-making text field; a component of its own, not a
  variant of Chip, for the owner to decide).

PROOFED 2026-11-23: material-web chip tokens (sizes, colours), APG toolbar, Qwik rc.5. Checked in
Chrome: sizes and colours measured, filter toggle (Space), arrows, Backspace removal and focus
handoff, Tab leaves the group, focus ring, elevated, disabled, dark mode.
