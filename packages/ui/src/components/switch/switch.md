# Switch

Material 3 switch. https://m3.material.io/components/switch/specs

## API

| Prop           | Type               | Default | What                                    |
| -------------- | ------------------ | ------- | --------------------------------------- |
| `label`        | `string`           |         | The text beside the switch              |
| `checked`      | `boolean`          | `false` | Starting state when nothing is bound    |
| `bind:checked` | `Signal<boolean>`  |         | Two-way state owned by the parent       |
| ...rest        | `PropsOf<"input">` |         | `disabled`, `name`, ... go on the input |

## ARIA

A native checkbox with `role="switch"` inside its `<label>`: Space toggles it, and it submits with a form under `name`.

## Styles

`switchVariants` (tv) slots: `root`, `control`, `track` (the input), `handle`.

## Usage

```tsx
const on = useSignal(true);
<Switch label="Notifications" bind:checked={on} />;
```
