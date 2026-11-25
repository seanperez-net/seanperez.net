# ThemeToggle

The light/dark switch, as e-store's. A round button with a 1px ring; inside, a track holds both
icons one above the other and slides when the `dark` class on `<html>` changes, so the icons roll
past each other (300ms; no motion with "reduce motion"). The icon shown is the mode a click
switches to. A click also fades the page's colors for 200ms (`theme-transitioning`, in
`global.css`). Inside a theme provider (`Layout.Root`, `ThemeRoot`) a click sets the context's
color mode, which the provider applies and saves; on its own the toggle applies the class and
saves the choice in `localStorage` itself. `ThemeModeScript` goes in the document
`<head>` and applies the saved choice (or the system setting) before first paint. It also
sets every `<meta name="theme-color">` (place them before it) to that mode's
`surface-container`; afterwards `applyColorMode` / `applyPaletteCss` keep them in step through
`syncThemeColorMeta` (`theme/theme-storage.ts`, ported from material-web's catalog
`applyThemeString`, 2026-11-24).

## API

| Prop        | Type                | Default               | What                            |
| ----------- | ------------------- | --------------------- | ------------------------------- |
| `label`     | `string`            | `Swap light and dark` | `aria-label` and its tooltip    |
| `lightIcon` | `IconName`          | `light_mode`          | Shown in the dark theme         |
| `darkIcon`  | `IconName`          | `dark_mode`           | Shown in the light theme        |
| `size`      | `"md" \| "sm"`      | `md`                  | 48px, or 40px for a top app bar |
| `outlined`  | `boolean`           | `true`                | The 1px ring                    |
| `look`      | `"icon" \| "full"` | `icon`                | `full`: the labelled full-width pill for a drawer footer (e-store's drawer-footer `ThemeModeToggle`, 2026-11-24) |
| `toDarkLabel`, `toLightLabel` | `string` | `Switch to dark mode`, `Switch to light mode` | The full form's visible label (its name) |
| ...rest     | `PropsOf<"button">` |                       |                                 |

`ThemeModeScript`: `nonce?: string`.

## ARIA

A native `<button type="button">` named by `label` (`aria-label`). Its hover / focus tip is the global plain tooltip (`data-tooltip`, shown by
`TooltipProvider` in `Layout.Root`; was `title` until 2026-11-23).

Playground: `/theme-toggle/`. `Layout.Root themeToggle` renders one in the rail footer (from
600px) and the app bar (below 600px, `size="sm"`).

## Styles

`themeToggleVariants` (tv) slots: `root`, `track`, `face`; variants `size`, `outlined`.

## Usage

```tsx
// root.tsx
<head><ThemeModeScript /></head>
// anywhere
<ThemeToggle />
```

## The full form (2026-11-24, from e-store)

e-store's `ThemeModeToggle` in a drawer footer (`full` / `auto` in `group/drawer-footer`): a 48dp
full-width outlined pill, icon and title-medium label centred, both states in the markup and
picked by the `dark` class. Differs from e-store: the icon is the mode a click switches TO (as
our round switch; e-store's full form shows the current mode's icon beside "Switch to dark mode"),
and it is a plain button named by its label (e-store: `role="switch"`). `Layout.Root themeToggle:
"rail"` puts it in the compact drawer's footer.
