# TopAppBar

Material 3 small top app bar: leading control, title, a flexible middle, trailing actions.
https://m3.material.io/components/top-app-bar/specs

In an app, use it through `Layout.AppBar`, which places it in the scaffold and adds the menu
button.

## Sizes

| What                 | Value                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Height               | 64px (`--layout-app-bar-height`)                                                                                                                            |
| Side insets          | `--layout-margin`: 16px, 24px from 600px. 0 at the start beside a rail, 16px at the end beside a companion rail                                             |
| Columns              | leading (auto), title (auto, at most 256px), pane (1fr), trailing (auto)                                                                                    |
| Title                | `text-title-large`, one line; the gaps around it are grid tracks (`--layout-app-bar-title-inset` before, title inset + `--layout-app-bar-pane-inset` after) |
| Leading and trailing | 40px buttons hung 8px into the inset, so a 24px icon is on the margin                                                                                       |

The bar has no padding of its own: the insets are grid tracks (`layout-appbar-rulers`).

## API

| Prop           | Type                | Default  | What                                       |
| -------------- | ------------------- | -------- | ------------------------------------------ |
| `title`        | `string`            | required | The app's title, one line with an ellipsis |
| `titleHref`    | `string`            |          | Makes the title a link (`/`)               |
| `headingLevel` | `1 \| 2`            | `1`      | `h1` or `h2`                               |
| ...rest        | `PropsOf<"header">` |          |                                            |

Slots: `leading` (a menu or back button), `pane` (the middle: a `Search`), default (trailing
actions: icon buttons, an `AccountMenu`).

## ARIA

A `<header>` with the title as a heading (a link inside it with `titleHref`). Its buttons name
themselves.

## Styles

`topAppBarVariants` (tv) slots: `root`, `leading`, `title`, `titleLink`, `pane`, `trailing`.

## Usage

```tsx
<TopAppBar title="My app" titleHref="/">
  <IconButton q:slot="leading" icon="menu" label="Menu" />
  <Search.Root q:slot="pane" layout="adaptive">
    <Search.Trigger />
    <Search.Bar size="compact" />
    <Search.View>...</Search.View>
  </Search.Root>
  <AccountMenu user={user} />
</TopAppBar>
```
