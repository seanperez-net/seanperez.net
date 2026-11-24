# Checkbox

Material Design 3 checkbox on a native `<input type="checkbox">`. From e-store's
`components/checkbox/checkbox.tsx` (2026-11-23).

- M3: https://m3.material.io/components/checkbox/specs
- APG: https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/ (native element preferred)
- Tokens checked: material-web `tokens/versions/v0_192/_md-comp-checkbox.scss`

## API

| Prop                        | Type                              | Default   | Description                                                       |
| --------------------------- | --------------------------------- | --------- | ----------------------------------------------------------------- |
| `checked`                   | `boolean`                         | `false`   | State; a later value from the parent replaces it                  |
| `bind:checked`              | `Signal<boolean>`                 | -         | Two-way state                                                     |
| `onChange$`                 | `QRL<(checked: boolean) => void>` | -         | When the user toggles it (and after a form reset that changed it) |
| `indeterminate`             | `boolean`                         | -         | Shows the dash and sets the input's `indeterminate` property      |
| `label`                     | `string`                          | -         | Text beside the box. Without it, pass `aria-label`                |
| `labelClass`                | `ClassList`                       | -         | Classes for the `<label>` wrapper (`class` lands on the input)    |
| `name`, `value`             | `string`                          | -, `"on"` | Form key and submitted value                                      |
| `id`                        | `string`                          | `useId()` | The input's id                                                    |
| `disabled`, `required`, ... | input attributes                  | -         | Passed to the input                                               |

## Anatomy (e-store's)

`<label>` > 40dp control box (48dp touch target, `touch-target`) > the input, drawn invisible
(`appearance: none`) as the 40dp state-layer circle that carries the focus ring
(`focus-ring`), then the 18dp box (2dp corners, 2dp outline) and the tick `<svg>`, painted from
the input's state with `peer-*`. The tick draws itself (180ms in, decelerating; 90ms out,
accelerating), off under `prefers-reduced-motion`. The indeterminate dash is the box's `::before`.

## States (M3 tokens)

| State    | Unchecked                             | Checked / indeterminate              |
| -------- | ------------------------------------- | ------------------------------------ |
| Rest     | outline `on-surface-variant`          | `primary` box, `on-primary` tick     |
| Hover    | outline `on-surface`, `on-surface` 8% | `primary` 8% state layer             |
| Focus    | outline `on-surface`, 10%, focus ring | `primary` 10%, focus ring            |
| Pressed  | `primary` 12%                         | `on-surface` 12%                     |
| Disabled | outline `on-surface` 38%              | box `on-surface` 38%, `surface` tick |

## ARIA

Native checkbox: role, state and `Space` are the browser's. No `aria-checked` (ARIA in HTML:
authors MUST NOT set it on `input type=checkbox`); the mixed state is the `indeterminate`
property, set on the client (it has no attribute). A label-less checkbox needs `aria-label`.

## Usage

```tsx
const updates = useSignal(false);
<Checkbox name="updates" label="Email me updates" bind:checked={updates} />;
```

## Where it differs from e-store

PROOFED 2026-11-23 against the token file, ARIA in HTML and Chrome.

- No `aria-checked` on the input (e-store sets it).
- The 40dp state layer and 48dp target are there with a label too, and the state layer is painted
  on the circle with the token colours (e-store: only without a label, always `on-surface`).
- Hover / focus / pressed outline `on-surface`; disabled colours per the tokens (e-store faded the
  whole box, so a disabled checked box stayed `primary`).
- Label gap 8dp (the ring reaches 5dp past the circle).

Added 2026-11-23:

| Prop                | Type                 | Default | What                                                                                                                                          |
| ------------------- | -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `accentColor`       | CSS colour           |         | The checked fill. From e-store                                                                                                                |
| `checkmarkColor`    | `auto` or CSS colour | `auto`  | `auto`: black or white by WCAG luminance of `accentColor` (`contrastingCheckmark`, exported). From e-store                                    |
| `uncheckedColor`    | CSS colour           |         | The unchecked outline. From e-store                                                                                                           |
| `uncheckedBgColor`  | CSS colour           |         | The unchecked fill. From e-store                                                                                                              |
| `touch-state-layer` | `boolean`            | `true`  | The 40dp state layer; off where a row paints one. From e-store                                                                                |
| `error`             | `boolean`            |         | M3 error: `error` outline / fill, `on-error` mark, `error` state layer, `aria-invalid` on the input (not while disabled). NEW, not in e-store |

The colours reach the box as CSS variables (`--checkbox-accent`, ...) over the M3 roles, as
e-store's. `error` PROOFED 2026-11-23 against material-web `_md-comp-checkbox.scss` `*-error-*`
tokens; the colour props have no M3 source (NOT PROOFED). Checked in Chrome: error both states,
custom colours checked and unchecked, `bind:checked` still flips.
Left out: Layout-driven density (our Layout has no compact mode), `touch-wrapper` (the 48dp
target is always there), `CheckboxUnstyled` (a headless copy, not a variant).
