# TitleBar

The title row of a surface that is neither a pane nor a modal: a floating, non-modal window
such as the Messages window (`@seanperez/chat` `MessagesWindow`). One heading (one line,
ellipsis) and the window's actions.

FROM E-STORE (`packages/ui/src/components/title-bar/`), ported 2026-11-24 as is: same slots,
variants, props and element tree. Only the data attributes are renamed (`data-title-bar`,
`data-title-bar-actions`; e-store's `data-qds-*` prefix is its headless library's). Its unit test
(`title-bar.test.tsx`, vitest) is not ported: this library has no test runner.

- M3 reference: https://m3.material.io/components/app-bars/specs (small app bar)
- Use `Layout.PaneHeader` for a pane's title row and `Modal.CloseTitleAction` inside a `Modal`;
  `TopAppBar` is the scaffold's app bar (an `h1`, the ruler grid). This is for the windows those
  do not cover.

## Props

| Prop           | Type                       | Default     | Description                                                                                                         |
| -------------- | -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `title`        | `string`                   | required    | The heading text, one line with an ellipsis                                                                         |
| `headingId`    | `string`                   |             | The heading's `id`, so the window can be named by it (`aria-labelledby`)                                            |
| `headingLevel` | `2 \| 3 \| 4`              | `2`         | The heading element; the page keeps its own `h1`                                                                    |
| `size`         | `'sm' \| 'md'`             | `'md'`      | `md`: M3 small app bar, 64dp, `title-large`. `sm`: a compact window bar, 40dp, `title-small` (HOUSE, not M3; below) |
| `tone`         | `'surface' \| 'container'` | `'surface'` | `surface`: the window's own surface. `container`: `surface-container-low`, a bar that reads as the window's frame    |
| `class`        | `ClassList`                |             | Placement only (width, margins)                                                                                     |

## Slots

| Slot       | Description                                                              |
| ---------- | ------------------------------------------------------------------------ |
| `leading`  | Before the heading (an avatar, a navigation icon)                        |
| `trailing` | The window's actions (`IconButton`s: video call, minimize, open, close) |

Put each slotted element DIRECTLY under `<TitleBar>` (a conditional `{x && <IconButton
q:slot="trailing" />}` is fine). Wrapped in a Fragment (`<>...</>`) they are not projected into
the named slot: Qwik rc.5, seen in Chrome on the playground 2026-11-24.

## TV slots

`titleBarVariants`: `root` (the `<header>`), `heading`, `actions`.

## ARIA

- A `<header>` with a real heading (`h2` by default). Name the window with
  `aria-labelledby={headingId}`.
- Icon-only actions are named by `IconButton label`. A minimize toggle is a disclosure: a stable
  name, `aria-expanded`, `aria-controls` the window's body (WAI-ARIA APG Disclosure; the
  playground shows it).

## Usage

```tsx
<section popover="manual" role="dialog" aria-labelledby={titleId}>
  <TitleBar title="Ada Lovelace" headingId={titleId} size="sm" tone="container">
    <Avatar q:slot="leading" name="Ada Lovelace" size="xs" decorative />
    <IconButton q:slot="trailing" size="xs" icon="minimize" label="Minimize" aria-expanded="true" />
    <IconButton q:slot="trailing" size="xs" icon="close" label="Close" onClick$={close$} />
  </TitleBar>
  …
</section>
```

## Web standards

A plain `<header>` and heading; no script.

## Proof (RULE 2, 2026-11-24)

- `md`: PROOFED against m3.material.io/components/app-bars/specs (read in Chrome 2026-11-24):
  the small app bar's title is "Title Large", 48dp targets around 24dp icons, 4dp edge
  padding in M3 Expressive's measurement figure. Its 64dp height is the value our `TopAppBar`
  already uses (`top-app-bar.md`); the specs page shows heights only in its collapsed token
  tables, which were not expanded this time.
- `sm` (40dp, `title-small`, 16dp start / 8dp end): NOT M3, HOUSE. e-store measured it on Gmail's
  docked compose window. The second agent pointed out M3 has no 40dp app bar; kept because the
  owner asked for Gmail / Google Chat's small window, whose bars are about that height. Its `xs`
  icon buttons are 32dp drawn and 48dp to the pointer (`touch-target`), so the M3 target size
  holds. Measured in Chrome on the playground: 40px bar, 14px / 500 heading, 32px buttons.
- Second agent (fresh, not given this conclusion): keep the composition; `TopAppBar` is the wrong
  tool (scaffold grid, `h1`); mark `sm` as house. Agreed and done.
