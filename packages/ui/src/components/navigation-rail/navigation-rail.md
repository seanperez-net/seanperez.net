# NavigationRail

Material 3 navigation rail: a narrow column of destinations on the leading edge.
https://m3.material.io/components/navigation-rail/specs

In an app, use it through `Layout.Rail`, which places it in the scaffold, hides it under 600px
and puts the menu button in its header.

## API

`NavigationRail.Root`

| Prop         | Type             | Default | What                |
| ------------ | ---------------- | ------- | ------------------- |
| `aria-label` | `string`         | `Main`  | The landmark's name |
| `onKeyDown$` | QRL              |         | Runs after the arrow-key handler (`rovingKeys`), passed by name |
| ...rest      | `PropsOf<"nav">` |         |                     |

Slots: `header` (a menu button, on the app bar's row), default (`NavigationRail.Item`s),
`footer` (a theme toggle).

`NavigationRail.Item`

| Prop         | Type                | Default  | What                                                                                                               |
| ------------ | ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `icon`       | `IconName`          | required | The 24px icon in the pill                                                                                          |
| `label`      | `string`            | required | The text under the icon                                                                                            |
| `current`    | `boolean \| "section"` | `false`  | `true`: the page (`aria-current="page"`). `"section"`: the page is in this destination's sub-navigation (`aria-current="true"`). Both drawn as current |
| `badge`      | `number \| boolean` |          | M3 badge on the icon (`Badge`): a count (none at 0) or `true` for the dot. e-store's `NavButton badge`, 2026-11-23 |
| `badgeLabel` | `string`            |          | What a screen reader hears after the label (default "{n} notifications" / "New notification")                      |
| ...rest      | `PropsOf<"a">`      |          | `href`, ...                                                                                                        |

Each item's pill carries `data-rail-pill`: `Layout.Drawer`'s floating card points its arrow at
it. `Layout.Rail` adds `onMouseEnter$` / `onFocus$` to the items (the floating drawer, e-store's
`hoveredRailHref`). No expanded rail (owner 2026-11-23).

## ARIA

A `<nav>` landmark of links. The current destination has `aria-current="page"`.

## Styles

`navigationRailVariants` (tv) slots: `root`, `header`, `body`, `footer`, `item`, `itemPill`.
The rows are the `layout-rail-rulers` grid; the width is `--layout-rail-width` (88px).

## Usage

```tsx
<NavigationRail.Root>
  <IconButton q:slot="header" icon="menu" label="Menu" />
  <NavigationRail.Item href="/" icon="home" label="Home" current />
  <ThemeToggle q:slot="footer" />
</NavigationRail.Root>
```

In an app use `Layout.Rail` with `Layout.Root` props instead (`railItems`, `themeToggle`): no
slots in pages.
