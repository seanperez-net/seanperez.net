# Button

Material 3 common button. https://m3.material.io/components/buttons/specs

From e-store's `Button` (sizes, and the element chosen by `UnstyledButton`). 2026-11-23: every
M3 variant e-store has (`shape`, the text look's `tone`), plus M3's toggle button, the pressed
corner morph and M3 Expressive outline / disabled colours.

Left out from e-store, and why: `feel` and `finish` (store.google.com looks, not M3);
`stateLayer` (always on, M3); the non-M3 looks `outlined-strong`, `outlined-primary`, `neutral`,
`inverse`, `on-media-*`, `ghost`, `link`, `link-primary`, `alert`, `destructive`, `icon`; the
non-M3 sizes `l`, `nav`, `wide`, `bar`, `inline`, `inherit`, `row`, `icon`, `cta`; `min-w-16`;
the ripple and the scale on press (M3 Expressive presses by morphing the corners).

## API

| Prop                | Type                                              | Default   | What                                                                                                                                                         |
| ------------------- | ------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `label`             | `string`                                          |           | The button's text. Children go after it                                                                                                                      |
| `look`              | `filled`, `tonal`, `elevated`, `outlined`, `text` | `filled`  | The Material 3 kind                                                                                                                                          |
| `size`              | `xs`, `sm`, `md`, `lg`, `xl`                      | `sm`      | M3 Expressive size (table below)                                                                                                                             |
| `shape`             | `rounded`, `squared`                              | `rounded` | M3 Expressive shape: full, or square corners 12/12/16/28/28 per size. Pressed morphs to 8/8/12/16/16. From e-store                                           |
| `tone`              | `default`, `primary`, `muted`                     | `default` | Text look only: label in `primary` (default and `primary`) or `on-surface-variant` (`muted`). From e-store                                                   |
| `toggle`            | `boolean`                                         |           | M3 toggle button (`aria-pressed`); not with `look="text"` or a link (M3 has no toggle text button). NEW, not in e-store's Button (names from its IconButton) |
| `selected`          | `boolean`                                         | `false`   | Toggle: the starting state; a later value from the parent is adopted                                                                                         |
| `bind:selected`     | `Signal<boolean>`                                 |           | Toggle: two-way state                                                                                                                                        |
| `onSelectedChange$` | `QRL<(selected: boolean) => void>`                |           | Toggle: after each flip                                                                                                                                      |
| `leadingIcon`       | `IconName`                                        |           | An icon before the label; its size follows `size`                                                                                                            |
| `trailingIcon`      | `IconName`                                        |           | An icon after the label (a menu, a "next"); wins over `leadingIcon` (one icon per button, e-store's)                                                         |
| `isLoading`         | `boolean`                                         |           | A spinner in the icon place, `aria-busy` + `aria-disabled`, the click cancelled (`sync$`); stays focusable. From e-store                                     |
| `type`              | `button`, `submit`, `reset`, `link`               | `button`  | `link` (with `href`) renders a link instead of a `<button>`                                                                                                  |
| `href`              | `string`                                          |           | With `type="link"`. Checked by `safeHref` (no `javascript:`)                                                                                                 |
| `reload`            | `boolean`                                         |           | With `type="link"`: a plain `<a>` (full page load)                                                                                                           |
| `target`            | `_blank`                                          |           | With `type="link"`: a plain `<a>` in a new tab, `rel=noopener`                                                                                               |
| `onClick$`          | `QRL`                                             |           | Declared by name and forwarded by name                                                                                                                       |
| ...rest             | `<button>` or `<a>` attributes                    |           | `disabled`, `aria-*`, ...                                                                                                                                    |

### What it renders

| Props                             | Element                                         |
| --------------------------------- | ----------------------------------------------- |
| (default), `submit`, `reset`      | `<button>`                                      |
| `type="link"` + `href`            | the router's `<Link>`: no page load             |
| `type="link"` + `reload`          | `<a>`: a full page load                         |
| `type="link"` + `target="_blank"` | `<a target="_blank" rel="noopener noreferrer">` |

### Sizes (M3 Expressive, e-store's table, checked against material-web `button-*` tokens)

| Size | Height | Side padding | Icon | Icon-label gap | Label          |
| ---- | ------ | ------------ | ---- | -------------- | -------------- |
| `xs` | 32     | 16           | 20   | 8              | label-large    |
| `sm` | 40     | 16           | 20   | 8              | label-large    |
| `md` | 56     | 24           | 24   | 8              | title-medium   |
| `lg` | 96     | 48           | 32   | 12             | headline-small |
| `xl` | 136    | 64           | 40   | 16             | headline-large |

Measured in Chrome 2026-11-23: exactly these heights, icons, paddings and gaps. Every size is at
least 48dp to the pointer (`touch-target`).

### Toggle colours (M3 spec, material-web `tokens/versions/latest/sass/_md-comp-button-*.scss`)

| Look       | Unselected                                   | Selected                             |
| ---------- | -------------------------------------------- | ------------------------------------ |
| `filled`   | surface-container / on-surface-variant       | primary / on-primary                 |
| `tonal`    | secondary-container / on-secondary-container | secondary / on-secondary             |
| `elevated` | surface-container-low / primary              | primary / on-primary                 |
| `outlined` | outline-variant ring / on-surface-variant    | inverse-surface / inverse-on-surface |

A selected toggle swaps its resting shape (round becomes square, square becomes round).
Outlined: `outline-variant`, width 1/1/1/2/3dp per size (inset ring). Disabled: container
on-surface 10%, label 38%. State layer 8% hover, 10% focus, 10% pressed.

PROOFED 2026-11-23: m3.material.io buttons specs (read in Chrome) and material-web `latest`
token files. Checked in Chrome: every size, shape and look; corners, toggle colours both states,
disabled, outlined ring widths, muted tone; a click flips `aria-pressed`.
NOT checked: the pressed morph visually (the `active:` rules are in the CSS), dark mode for the
toggle colours.

## ARIA

A native `<button>`: Enter and Space activate it. `disabled` removes it from the tab order. As a
link it is a native `<a>`: Enter follows it. Use a link for navigation, a button for an action.

## Usage

```tsx
<Button label="Save" />
<Button look="outlined" size="md" leadingIcon="add" label="New" />
<Button type="link" href="/about/" label="About" />
<Button type="link" href="https://github.com/" target="_blank" label="GitHub" />
<Button look="outlined" shape="squared" toggle bind:selected={bold} label="Bold" />
```
