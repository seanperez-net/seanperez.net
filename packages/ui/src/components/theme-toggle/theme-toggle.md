# ThemeToggle

Icon button that swaps light and dark. It flips the `dark` class on `<html>` and saves the choice in `localStorage`. `ThemeModeScript` goes in the document `<head>` and applies the saved choice (or the system setting) before first paint.

## API

| Prop        | Type                | Default               | What                     |
| ----------- | ------------------- | --------------------- | ------------------------ |
| `label`     | `string`            | `Swap light and dark` | `aria-label` and `title` |
| `lightIcon` | `IconName`          | `light_mode`          | Shown in the light theme |
| `darkIcon`  | `IconName`          | `dark_mode`           | Shown in the dark theme  |
| ...rest     | `PropsOf<"button">` |                       |                          |

`ThemeModeScript`: `nonce?: string`.

## ARIA

A native `<button>` named by `label`.

## Styles

`themeToggleVariants` (tv) slots: `lightIcon`, `darkIcon`. Uses `iconButtonVariants` for the button.

## Usage

```tsx
// root.tsx
<head><ThemeModeScript /></head>
// anywhere
<ThemeToggle />
```
