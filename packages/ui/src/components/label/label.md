# Label

A native `<label>` that does not select its own text on a double-click. From e-store's
`components/label/` (2026-11-23).

- MDN: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label

## API

| Prop           | Type               | Default | What                                      |
| -------------- | ------------------ | ------- | ----------------------------------------- |
| `for`          | `string`           |         | `id` of the control it names              |
| `onMouseDown$` | `QRL`              |         | Runs after the label's own (sync) handler |
| ...rest        | `PropsOf<"label">` |         | On the `<label>`                          |

Children: the label text, and optionally the control itself (an implicit label).

## ARIA

None of its own: a `<label>` names a labelable element (input, button, select, textarea, ...)
through `for` or by wrapping it, and a click on it activates that control (HTML spec). It can
NOT name a `div` with a role: use `aria-labelledby` there.

## Behaviour

`mousedown` with `detail >= 2` on the label text is `preventDefault()`ed in a `sync$` (a `$()`
runs too late), so a quick double-click on a checkbox's label toggles it twice without
highlighting the words. A mousedown on a `button`, `input`, `select` or `textarea` inside the
label is left alone, so a word in a wrapped text field can still be double-click selected.

## Usage

```tsx
<Label for="email">Email address</Label>
<input id="email" type="email" />
```

## Where it differs from e-store

- Plain `<label>`; e-store renders through `Render` (polymorphic), not ported here.
- e-store's control check ran in an async `$()` that returned in both branches (dead code), so its
  `sync$` also blocked selection inside a wrapped input. Ours checks in the `sync$`.

Proof: NOT PROOFED in a test runner; checked in Chrome (see the playground notes in
`component-map.md`).
