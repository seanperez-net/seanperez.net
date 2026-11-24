# FAB (floating action button) and extended FAB

The most important action on a screen. Icon only (FAB), or icon and label (extended FAB), which
can fold back to a FAB of its own height (`extended={false}`) with the label animating away.
From e-store's `components/fab/` (2026-11-23).

- M3: https://m3.material.io/components/floating-action-button/specs ,
  https://m3.material.io/components/extended-fab/specs (read in Chrome 2026-11-23)
- Tokens: material-web `tokens/versions/latest/sass/_md-comp-fab-*.scss`,
  `_md-comp-extended-fab-*.scss` (Material 3 tokens v34.0.21, read 2026-11-23)
- APG: https://www.w3.org/WAI/ARIA/apg/patterns/button/

## API

| Prop                                          | Type                                                                                       | Default                         |                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `icon`                                        | `IconName`                                                                                 |                                 | The icon. An icon-only FAB needs `aria-label`.                                                                                                      |
| `label`                                       | `string`                                                                                   |                                 | The extended FAB's text. Given, the FAB is extended unless `extended={false}`.                                                                      |
| `extended`                                    | `boolean`                                                                                  | `true` with a label             | `false` folds it to a FAB of the same height; the label stays (zero width) as the accessible name.                                                  |
| `color`                                       | `primary` `secondary` `tertiary` `primary-bold` `secondary-bold` `tertiary-bold` `surface` | `primary`                       | e-store's names. M3 Expressive: `primary` = "primary container", `primary-bold` = "primary", ... `surface` is M3 baseline, "no longer recommended". |
| `size`                                        | `small` `default` `medium` `large`                                                         | `default`; `small` with a label | See the table.                                                                                                                                      |
| `onClick$`                                    | QRL                                                                                        |                                 | Passed by name.                                                                                                                                     |
| `type="link"` + `href` (+ `reload`, `target`) |                                                                                            |                                 | A link drawn as a FAB (`UnstyledButton`, as `Button`).                                                                                              |
| ...rest                                       | `<button>` / `<a>` props                                                                   |                                 | No `disabled`: M3 lists no disabled FAB.                                                                                                            |

| `size`    | FAB: box / corner / icon                   | Extended FAB: height / corner / icon / sides / gap / label                                                             |
| --------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `small`   | 40 / 12 / 24 (M3: "no longer recommended") | small extended FAB: 56 / 16 / 24 / 16-16 / 8 / title-medium                                                            |
| `default` | 56 / 16 / 24                               | M3's BASELINE extended FAB: 56 / 16 / 24 / 16-20 / 12 / label-large, min width 80 ("no longer recommended, use small") |
| `medium`  | 80 / 20 / 28                               | 80 / 20 / 28 / 26-26 / 12 / title-large                                                                                |
| `large`   | 96 / 28 / 36                               | 96 / 28 / 36 / 28-28 / 16 / headline-small                                                                             |

Collapsed (`extended={false}`): the extended FAB's height and corner, square, icon centred.
States: elevation 3, 4 hovered, 3 focused and pressed; state layer in the icon colour, 8% hover,
10% focus, 10% pressed; the M3 outward focus ring (`focus-ring`). 48dp target (`touch-target`).

Exports: `FAB`, `fabVariants` (slots `root`, `label`; variants `color`, `size`, `form`),
`fabColors`, `fabSizes`, `fabForm(label, extended)`, `fabDefaultSize(form)`, `fabIconSize`,
`FABContent` (the icon and label, used by `FABMenu.Trigger`).

## ARIA

A native `<button>` (or `<a>`). Icon only: give `aria-label`. Extended or collapsed: the label is
the name. Enter / Space activate.

## Usage

```tsx
<FAB icon="edit" aria-label="Compose" />
<FAB icon="edit" label="Compose" />                 {/* small extended FAB */}
<FAB icon="edit" label="Compose" size="large" color="tertiary-bold" />
<FAB icon="edit" label="Compose" extended={scrolledToTop.value} />
<FAB type="link" href="/compose/" icon="edit" label="Compose" />
```

## Proof

- Sizes, corners, icons, paddings, gaps, type, colours, elevation: PROOFED 2026-11-23 against the
  M3 spec pages and material-web tokens, and measured in Chrome (every size and form, all seven
  colours, light and dark).
- No disabled state: PROOFED (M3 states list: enabled, hovered, focused, pressed).
- Collapse padding `(height - icon) / 2`: derived from the tokens (it equals the medium extended
  FAB's own 26dp sides); the morph timing (medium-2, emphasized) is e-store's, NOT PROOFED (M3
  shows the motion, prints no numbers).

## Where it differs from e-store

- `size` names are M3's (`small` / `default` / `medium` / `large`), not e-store's `sm` / `md` /
  `lg`: M3 Expressive's 80dp medium FAB has no place in e-store's names (its `md` is the 56dp
  FAB, its `lg` 96). e-store has no medium FAB and no small / medium / large extended FAB (its
  extended FAB is the baseline one at every size, and its large extended FAB is 56 high).
- `icon` is an `IconName` (e-store: JSX), the large FAB's icon is 36dp.
- Left out (e-store extras M3 lacks): `trailing` (an element after the label), the `icon` and
  default slots, disabled styles, the ripple.
- The label stays in the DOM when collapsed, as e-store's; here it is also the accessible name.
