# ColorPicker

e-store's `ColorPicker` (`packages/ui/src/components/color-picker/`), **only the `Swatch` part**
so far (ported 2026-11-24 for the Maps style editor). e-store also has `Root` (shared context),
`Palette` (a grid of preset swatches), `Gradient` (HSV area, hue slider, hex field) and `Dialog`;
none is ported yet. M3 has no color-picker component (m3.material.io components list).

## ColorPicker.Swatch

A native `<input type="color">` drawn as a round preview (the theme seed picker pattern).

| Prop         | Type                  | Default        | Description                                     |
| ------------ | --------------------- | -------------- | ----------------------------------------------- |
| `value`      | `string`              | `'#6750a4'`    | Current color, `#rrggbb`; a later value is adopted |
| `bind:value` | `Signal<string>`      | -              | Two-way binding                                 |
| `onChange$`  | `QRL<(hex) => void>`  | -              | After each change (the input's `input` event)   |
| `size`       | `'sm' \| 'md'`        | `'md'`         | 32px / 48px                                     |
| `name`       | `string`              | -              | Form field name of the inner input              |
| `label`      | `string`              | `'Pick color'` | Accessible name of the input (visually hidden)  |

Every other `<label>` attribute is spread on the root (`data-*`, `id`); `class` is for placement.

## ARIA and keys

The input is the control: its name is the visually hidden `label` text inside the `<label>`.
Enter / Space opens the browser's own color chooser. It takes the M3 focus ring (`focus-ring`).

## Proof (2026-11-24)

| Piece | Status |
| --- | --- |
| Structure, props, sizes, classes (from e-store) | PROOFED: MDN `<input type="color">` (value is always `#rrggbb` lowercase; `input` fires while choosing); our `focus-ring` utility and `useBoundSignal` (3 arguments) exist; Chrome (Maps style editor) |
| Boundary: 1px `outline`, inside the circle; `CanvasText` in forced colours | PROOFED 2026-11-24: M3 has no color picker or swatch component. m3.material.io/styles/color/roles: `outline` is for "important boundaries", and a target's boundary must not be `outline-variant` (use `outline` or another 3:1 color). Width 1px and the forced-colours rule from Google's material-web catalog swatch (`catalog/src/components/theme-changer.ts`, `.input-wrapper`: `1px solid on-secondary-container`, `CanvasText` in forced colours). Second agent's recommendation, checked in Chrome light and dark |

## Where it differs from e-store

- Only `Swatch`; no context fallback (`ctx?.value`) since there is no `Root`.
- The border classes are in the `swatchLabel` slot, not a literal beside `tv()` (rule U6).
- Boundary 1px `outline`, not e-store's 2px `on-secondary-container` (FIXED 2026-11-24): with
  e-store's ring a near-black swatch (`#0c0c0c`) on a dark surface read as an empty light circle
  (seen on the site's Maps Style panel). The material-web catalog uses 1px; we take M3's role for
  a target boundary, `outline`, instead of the catalog's `on-secondary-container`.

## Usage

```tsx
<ColorPicker.Swatch size="sm" label="Water color" bind:value={water} />
```
