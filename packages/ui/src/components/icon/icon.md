# Icon

Material Symbols (outlined, Apache License 2.0) as inline SVG paths, painted in the current text colour. Add a symbol by adding its path to `paths` in `icon.tsx`.

## API

| Prop    | Type                     | Default  | What                                 |
| ------- | ------------------------ | -------- | ------------------------------------ |
| `name`  | `IconName`               | required | `palette`, `light_mode`, `dark_mode` |
| `size`  | `sm` (18px), `md` (24px) | `md`     |                                      |
| ...rest | `PropsOf<"svg">`         |          |                                      |

## ARIA

Decorative: always `aria-hidden`. The control around it carries the name.

## Styles

`iconVariants` (tv): `size`.

## Usage

```tsx
<Icon name="palette" />
```
