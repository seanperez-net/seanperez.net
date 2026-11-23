# Button

Material 3 common button. https://m3.material.io/components/buttons/specs

## API

| Prop          | Type                                              | Default  | What                                                 |
| ------------- | ------------------------------------------------- | -------- | ---------------------------------------------------- |
| `label`       | `string`                                          |          | The button's text. Children go after it              |
| `look`        | `filled`, `tonal`, `elevated`, `outlined`, `text` | `filled` | The Material 3 kind                                  |
| `leadingIcon` | `IconName`                                        |          | An 18px icon before the label                        |
| `onClick$`    | `QRL`                                             |          | Declared by name and forwarded by name               |
| ...rest       | `PropsOf<"button">`                               |          | `disabled`, `type` (default `button`), `aria-*`, ... |

## ARIA

A native `<button>`: Enter and Space activate it. `disabled` removes it from the tab order.

## Styles

`buttonVariants` (tv): `look`. The state layer is the `before` pseudo-element.

## Usage

```tsx
<Button label="Save" />
<Button look="outlined" label="Cancel" onClick$={() => close()} />
```
