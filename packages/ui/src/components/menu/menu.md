# Menu

Material 3 menu on the HTML Popover API: no JavaScript opens or closes it. https://m3.material.io/components/menus/specs

## API

`Menu.Root`

| Prop    | Type             | Default  | What                                      |
| ------- | ---------------- | -------- | ----------------------------------------- |
| `id`    | `string`         | required | What a button's `popovertarget` points at |
| ...rest | `PropsOf<"div">` |          | `aria-label`, ...                         |

`Menu.Item`: `PropsOf<"div">`. A 48px row.

## ARIA

`role="group"` by default; give it an `aria-label`. Escape and a click outside close it (browser behaviour).

## Styles

`menuVariants` (tv) slots: `root`, `item`. Browser support: Popover API in all current browsers; CSS anchor positioning where supported, otherwise the browser's default popover position.

## Usage

```tsx
<IconButton icon="palette" label="Options" popovertarget="options" />
<Menu.Root id="options" aria-label="Options">
  <Menu.Item>Row 1</Menu.Item>
</Menu.Root>
```
