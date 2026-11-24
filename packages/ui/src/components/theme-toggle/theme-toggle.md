# ThemeToggle

The light/dark switch, as e-store's. A round button with a 1px ring; inside, a track holds both
icons one above the other and slides when the `dark` class on `<html>` changes, so the icons roll
past each other (300ms; no motion with "reduce motion"). The icon shown is the mode a click
switches to. A click also fades the page's colours for 200ms (`theme-transitioning`, in
`global.css`) and saves the choice in `localStorage`. `ThemeModeScript` goes in the document
`<head>` and applies the saved choice (or the system setting) before first paint.

## API

| Prop        | Type                | Default               | What                            |
| ----------- | ------------------- | --------------------- | ------------------------------- |
| `label`     | `string`            | `Swap light and dark` | `aria-label` and `title`        |
| `lightIcon` | `IconName`          | `light_mode`          | Shown in the dark theme         |
| `darkIcon`  | `IconName`          | `dark_mode`           | Shown in the light theme        |
| `size`      | `"md" \| "sm"`      | `md`                  | 48px, or 40px for a top app bar |
| `outlined`  | `boolean`           | `true`                | The 1px ring                    |
| ...rest     | `PropsOf<"button">` |                       |                                 |

`ThemeModeScript`: `nonce?: string`.

## ARIA

A native `<button>` named by `label`.

## Styles

`themeToggleVariants` (tv) slots: `root`, `track`, `face`; variants `size`, `outlined`.

## Usage

```tsx
// root.tsx
<head><ThemeModeScript /></head>
// anywhere
<ThemeToggle />
```
