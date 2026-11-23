# IconButton

Material 3 standard icon button: 40px round, 24px icon. https://m3.material.io/components/icon-buttons/specs

## API

| Prop       | Type                | Default  | What                                   |
| ---------- | ------------------- | -------- | -------------------------------------- |
| `icon`     | `IconName`          | required | The icon                               |
| `label`    | `string`            | required | `aria-label` and hover `title`         |
| `onClick$` | `QRL`               |          | Declared by name and forwarded by name |
| ...rest    | `PropsOf<"button">` |          | `disabled`, `popovertarget`, ...       |

## ARIA

A native `<button>` named by `label`; the icon is `aria-hidden`.

## Styles

`iconButtonVariants` (tv): base only.

## Usage

```tsx
<IconButton icon="palette" label="Theme colour" popovertarget="theme-menu" />
```
