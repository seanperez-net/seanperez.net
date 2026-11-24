# Icon

Material Symbols (outlined, Apache License 2.0) as inline SVG paths, painted in the current text colour. Add a symbol by adding its path to `paths` in `icon.tsx`.

M3: https://m3.material.io/styles/icons/applying-icons

The API is e-store's `Icon` (`size` names and pixel values, `label`, `data-qds-icon`); the drawing is ours (inline SVG, so the site loads no icon font).

## API

| Prop    | Type             | Default  | What                                                         |
| ------- | ---------------- | -------- | ------------------------------------------------------------ |
| `name`  | `IconName`       | required | one of `iconNames`                                           |
| `size`  | `IconSize`       | `md`     | `xs` 16, `dense` 18, `sm` 20, `md` 24, `lg` 40, `xl` 48 (px) |
| `label` | `string`         |          | accessible name; makes the icon `role="img"`                 |
| `class` | `ClassList`      |          | added after the variant classes (a colour token, placement)  |
| ...rest | `PropsOf<"svg">` |          | spread on the `<svg>` (`data-*` included)                    |

`sm` (20dp) is for dense places (menus, dense lists, chips); `md` (24dp) is the standard. `dense` (18dp) is e-store's extra step, not an M3 optical size.

## ARIA

Decorative by default: `aria-hidden="true"`, and the control around it carries the name. With `label` it is `role="img"` with `aria-label`.

## Styles

`iconVariants` (tv): `size`. The root carries `data-qds-icon`.

## Where it differs from e-store

- Inline SVG paths, not the Material Symbols variable font: no `filled`, `weight`, `grade`, `opticalSize` (font axes), and `name` is the `IconName` union, not any string.
- Sizes are `size-*` classes on the `<svg>`; e-store sets `font-size` from `--text-icon-*` tokens, which lets a wrapper (`.icon` in its Button) size the glyph. Not ported.
- No `tone` prop (colour comes from `class` or the parent) and no `StaticIcon`.
- `...rest` takes every `<svg>` prop; e-store forwards `data-*` only.

## Usage

```tsx
<Icon name="palette" />
<Icon name="info" size="sm" label="Information" />
```
