# Item

A Material 3 list item: one-, two- or three-line rows with leading and trailing content,
trailing supporting text and an overlay container. Used alone (a static row, or one button with
`as="button"`) and inside `List.Item`, which adds the list semantics.

From e-store's `components/item/` (2026-11-23), with the changes listed under "Where it differs
from e-store".

**M3:** https://m3.material.io/components/lists/specs (read in Chrome 2026-11-23)

## API

| Prop                                                                 | Type                                       | Default     | Description                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `headline`                                                           | `JSXOutput`                                | -           | The row's label (body-large, on-surface).                                                                                                                                                                                                                                                              |
| `supportingText`                                                     | `JSXOutput`                                | -           | Text under the headline (body-medium, on-surface-variant).                                                                                                                                                                                                                                             |
| `overline`                                                           | `JSXOutput`                                | -           | Small label above the headline (label-small).                                                                                                                                                                                                                                                          |
| `defaultSlot`                                                        | `JSXOutput`                                | -           | Inline content in the text column, beside the default `<Slot />`.                                                                                                                                                                                                                                      |
| `trailingSupportingText`                                             | `JSXOutput`                                | -           | Short metadata after the text (label-small): a time, a count.                                                                                                                                                                                                                                          |
| `startIcon` / `endIcon`                                              | `IconName`                                 | -           | Leading / trailing icon (24dp, on-surface-variant).                                                                                                                                                                                                                                                    |
| `start` / `end`                                                      | `JSXOutput`                                | -           | Leading / trailing content (avatar, image, checkbox, switch, icon button). Wins over the icon prop.                                                                                                                                                                                                    |
| `lines`                                                              | `"one-line" \| "two-line" \| "three-line"` | computed    | Counted from `overline`, `defaultSlot`, `headline`, `supportingText`: 0-1 one, 2 two, 3+ three.                                                                                                                                                                                                        |
| `density`                                                            | `"default" \| "compact"`                   | `"default"` | `default`: M3 56 / 72 / 88dp. `compact`: 40 / 56 / 72 (e-store's Gmail density, not M3).                                                                                                                                                                                                               |
| `align`                                                              | `"auto" \| "top"`                          | `"auto"`    | `auto`: start / end centred, top-aligned on three-line rows (M3). `top`: top-aligned at any line count.                                                                                                                                                                                                |
| `inset`                                                              | `"default" \| "none"`                      | `"default"` | Side padding: 16dp start, 24dp end (compact: 8dp end); `none`: no side padding.                                                                                                                                                                                                                        |
| `selected`                                                           | `boolean`                                  | `false`     | Selected look (`data-selected`).                                                                                                                                                                                                                                                                       |
| `indicator`                                                          | `"primary" \| "secondary"`                 | `"primary"` | Selected colors: primary-container, or secondary-container (M3 navigation indicator).                                                                                                                                                                                                                  |
| `selectedFill`                                                       | `boolean`                                  | `true`      | Paint the selected container. `List.Item` passes `false` (its `<li>` paints it). New, not in e-store.                                                                                                                                                                                                  |
| `supportingLines`                                                    | `"auto" \| "one"`                          | `"auto"`    | `one`: one line with an ellipsis.                                                                                                                                                                                                                                                                      |
| `headlineLines`                                                      | `"one" \| "auto"`                          | `"one"`     | `one`: one line with an ellipsis; `auto`: wraps.                                                                                                                                                                                                                                                       |
| `as`                                                                 | `"section" \| "button"`                    | `"section"` | `section` renders a `<div>` (name kept from e-store). `button`: the whole row is one `<button type="button">` (through `UnstyledButton`), parts as spans, with the list-item state layers and inward focus ring. Content from props only (no slots: Qwik cannot put its slot placeholder in a button). |
| `onClick$`, `disabled`                                               | -                                          | -           | For `as="button"`.                                                                                                                                                                                                                                                                                     |
| `container` / `containerProps`                                       | `JSXOutput` / `PropsOf<"div">`             | -           | Overlay over the whole row (`pointer-events: none`).                                                                                                                                                                                                                                                   |
| `startProps`, `endProps`, `textProps`, `trailingSupportingTextProps` | element props                              | -           | Extra props on those parts.                                                                                                                                                                                                                                                                            |
| `class`                                                              | `ClassList`                                | -           | On the root. Layout only.                                                                                                                                                                                                                                                                              |

Every other `<div>` attribute is spread onto the root. Slots: default (text column),
`start`, `end`, `container`.

Grid: four columns `auto 1fr auto auto` (start, text, trailing text, end). The text runs to the
end when nothing follows it.

## ARIA

- The root is a `<div>` (or a `<button>`): e-store's `<section>` becomes a `region` landmark as
  soon as it has an accessible name (HTML-AAM), one landmark per row; every part is a generic `div` / `span`, never
  `article` / `aside` / `header` / `footer`, so a row used as a link or option is named from all
  its content (Chrome leaves article and complementary subtrees out of a name from content;
  e-store found it 2026-11-04, accname 1.2 "name from content").
- The headline is not a heading.
- `selected` is `data-selected`, never `aria-selected` (not allowed on a section). The state
  belongs on the interactive element (`List.Item` writes it on its `option`).
- Icons are decorative (`aria-hidden`); a control in `start` / `end` needs its own name.

## Usage

```tsx
<Item headline="Inbox" startIcon="home" />
<Item start={<Avatar name="Ada Lovelace" decorative />} headline="Ada Lovelace"
      supportingText="Analyst" trailingSupportingText="9:41" />
<Item headline="Sound" startIcon="volume_up" end={<Switch aria-label="Sound" />} />
<Item as="button" aria-expanded={open.value} headline="Ada" supportingText={snippet}
      supportingLines="one" onClick$={() => (open.value = !open.value)} />
```

## Proof (2026-11-23)

| Item                                                                                                                 | Status                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heights 56 / 72 / 88                                                                                                 | PROOFED: material-web `_md-comp-list.scss` (one/two/three-line container height); measured in Chrome: 56, 72, 88                                                                                                                                                                                                                 |
| 16dp start, 24dp end padding                                                                                         | PROOFED: m3.material.io lists specs, baseline table ("Label left padding 16dp", "Trailing element right padding 24dp"). material-web uses 16 at the end; the M3 page wins                                                                                                                                                        |
| 12dp top / bottom padding                                                                                            | PROOFED: material-web `_md-comp-list-item.scss` top-space / bottom-space 12px (e-store's 16 gave 76 / 96px rows)                                                                                                                                                                                                                 |
| 16dp gap, 24dp icons, 40dp avatar, 56dp image                                                                        | PROOFED: material-web `md-list-item` `gap: 16px`, token sizes; measured in Chrome                                                                                                                                                                                                                                                |
| Typescale and colors (body-large on-surface, body-medium / label-small on-surface-variant, icons on-surface-variant) | PROOFED: material-web list tokens                                                                                                                                                                                                                                                                                                |
| Three-line: top-aligned start / end, supporting text clamped                                                         | PROOFED: M3 baseline table ("alignment when height is 88dp or taller: Top")                                                                                                                                                                                                                                                      |
| With an overline, one supporting line                                                                                | PROOFED: M3 baseline three-line (overline + label + one line); new, not in e-store                                                                                                                                                                                                                                               |
| State layers 8% hover, 12% focus / pressed, on-surface                                                               | PROOFED: material-web list tokens (md-sys-state)                                                                                                                                                                                                                                                                                 |
| Disabled, per part (2026-11-25)                                                                                      | PROOFED: material-web `md.comp.list` tokens: label on-surface 0.3, leading / trailing icons on-surface 0.38. Supporting / trailing text, avatars, images, controls 0.38: HOUSE (tokens silent; M3's general disabled 38%). Was 38% on the whole row. Chrome: headline alpha 0.3, supporting 0.38, icon 0.38, avatar opacity 0.38 |
| `compact` density 40 / 56 / 72                                                                                       | NOT PROOFED: no M3 source (e-store's own, from Gmail / Calendar)                                                                                                                                                                                                                                                                 |
| M3 Expressive measurements (10dp top / bottom, 12dp gap, 20dp leading icon)                                          | NOT APPLIED: the M3 page's Expressive diagram shows them; this Item follows the baseline table, as e-store. Owner to decide                                                                                                                                                                                                      |
| One- and two-line rows 8dp top / bottom, three-line 12dp (2026-11-25)                                                | PROOFED: m3.material.io/components/lists/specs, baseline measurement diagrams (read in Chrome 2026-11-25). Measured: one-line + checkbox 64 -> 56, two-line + 56dp image 80 -> 72, text rows unchanged (56 / 72 / 88). Second agent agreed                                                                                       |
| A two-line row whose supporting text WRAPS to two lines (`supportingLines="auto"`)                                   | Now 80 (was 88): 8 + 24 + 40 + 8. M3's two-line row has one supporting line; set `lines="three-line"` for more                                                                                                                                                                                                                   |

## Where it differs from e-store

- `py-2` (one- and two-line) and `py-3` (three-line) instead of `py-4` (heights above).
- `startIcon` / `endIcon` (`IconName`) beside `start` / `end`.
- `rounded-[inherit]` instead of `rounded-inherit`, which is not a Tailwind 4.3.5 utility and is
  defined nowhere in e-store (it generated no CSS).
- `selectedFill`: e-store's Item paints the selected container AND its `List.Item` `<li>` does,
  so the Item's opaque fill covered the `<li>`'s hover / focus layer on a selected row.
- State layers are a background IMAGE over the fill (`bg-linear-to-r from-on-surface/8 ...`),
  not `bg-on-surface/8`, which replaced the fill (a selected button row lost its color on hover).
- Three-line rows with an overline clamp the supporting text to one line.
- No Layout-context density: `Layout.Root layoutMode="compact"` exists (2026-11-23) but sets no
  item tokens (e-store's `--layout-item-*` density set is not ported, see `layout.md`); use
  `density`. The gap reads `--layout-item-gap`, which only `List.Root inset="drawer"` sets.
- `as="button"` renders through `UnstyledButton`; `onClick$` is destructured and passed by name.
- The line count is a plain value computed from props (e-store's `useComputed$` captured the
  whole props object, JSX props included, and was read in the component body anyway).
- A `<div>` root instead of `<section>` (above). No `text-ellipsis` on the grid root (no effect).

## Web standards

`<div>`, `<button type="button">`, CSS grid, `line-clamp`, `:has()`.
