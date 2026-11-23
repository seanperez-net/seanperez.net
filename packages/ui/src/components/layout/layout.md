# Layout

The Material 3 scaffold as compound components on one grid. One `Layout.Root` per app. https://m3.material.io/foundations/layout/applying-layout

## API

| Part                    | Props                                               | What                                                            |
| ----------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `Layout.Root`           | `mainId?` (`main-content`), `bind:supportExpanded?` | The grid, the skip link, the layout context                     |
| `Layout.AppBar`         | `title`                                             | Top app bar: title (`h1`), then actions in the slot             |
| `Layout.Pane`           | `role="primary"`                                    | The page's `<main>`, the skip link's target                     |
| `Layout.PaneHeader`     | `title`, `headingLevel?` (2)                        | A pane's own header; actions in the slot                        |
| `Layout.SupportingPane` | `header`, `bind:expanded?`                          | Second pane: beside the primary from 840px, above it below that |
| `Layout.Footer`         |                                                     | Small print inside the bottom margin                            |

Context (`layoutContextId`): `{ mainId, supportExpanded }`. Only `Layout.Root` provides it. State
goes up: keep the signal in the app, bind it into the root, and every part reads it from context.

## ARIA

`<header>`, `<main>`, `<aside aria-label>` and `<footer>` landmarks; a skip link to the primary pane is the first focusable element.

## Styles

`layoutVariants` (tv) slots: `root`, `skipLink`, `appBar`, `appBarTitle`, `pane`, `paneHeader`, `paneTitle`, `supportingPane`, `footer`.

## Usage

```tsx
const supportExpanded = useSignal(true);
<Layout.Root bind:supportExpanded={supportExpanded}>
  <Layout.AppBar title="My app">
    <ThemeToggle />
  </Layout.AppBar>
  <Layout.Pane role="primary">
    <Slot />
  </Layout.Pane>
  <Layout.SupportingPane header="Details">...</Layout.SupportingPane>
</Layout.Root>;
```
