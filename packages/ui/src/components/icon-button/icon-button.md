# IconButton

Material 3 icon button. https://m3.material.io/components/icon-buttons/specs

From e-store's `IconButton` (2026-11-23, every M3 variant it has): five looks, five sizes, three
widths, two shapes, toggle. Values checked against M3 Expressive and material-web
`tokens/versions/latest/sass/_md-comp-icon-button-*.scss`.

## API

| Prop                               | Type                                                 | Default    | What                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `icon`                             | `IconName \| JSXOutput`                              | required   | The icon; JSX for an icon of your own (a brand mark, `aria-hidden`), drawn in the Icon's box and color (NEW 2026-11-24)                   |
| `label`                            | `string`                                             | required   | `aria-label`; also its plain tooltip (`data-tooltip`, shown by `TooltipProvider` in `Layout.Root` on hover and focus; no native `title`) |
| `look`                             | `standard`, `filled`, `tonal`, `outlined`, `inverse` | `standard` | M3 kind; `inverse` (e-store's) uses M3's inverse roles, for use over `inverse-surface`                                                   |
| `size`                             | `xs`, `sm`, `md`, `lg`, `xl`                         | `sm`       | 32 / 40 / 56 / 96 / 136dp; icon 20 / 24 / 24 / 32 / 40                                                                                   |
| `width`                            | `default`, `narrow`, `wide`                          | `default`  | M3 widths: xs 28/40, sm 32/52, md 48/72, lg 64/128, xl 104/184                                                                           |
| `shape`                            | `rounded`, `squared`                                 | `rounded`  | Square corners 12/12/16/28/28; pressed morph 8/8/12/16/16                                                                                |
| `toggle`                           | `boolean`                                            |            | M3 toggle icon button (`aria-pressed`)                                                                                                   |
| `selected`                         | `boolean`                                            | `false`    | Toggle: starting state                                                                                                                   |
| `bind:selected`                    | `Signal<boolean>`                                    |            | Toggle: two-way state                                                                                                                    |
| `onSelectedChange$`                | `QRL<(selected: boolean) => void>`                   |            | Toggle: after each flip                                                                                                                  |
| `iconSelected`                     | `IconName`                                           |            | Toggle: icon while selected (e.g. `star_filled`)                                                                                         |
| `labelSelected`                    | `string`                                             |            | Toggle: name while selected (e-store's `aria-label-selected`). See ARIA                                                                  |
| `flipIconInRtl`                    | `boolean`                                            |            | Mirror the icon in RTL (arrows)                                                                                                          |
| `softDisabled`                     | `boolean`                                            |            | `aria-disabled`: looks disabled, stays focusable, clicks ignored                                                                         |
| `showLabel` | `boolean` | | Shows `label` under the button in label-small (a 62px cell), as Google Contacts' quick actions (Email, Chat). The caption is `aria-hidden`; no tooltip. NEW 2026-11-24, not M3 / e-store (owner: match Google Contacts). NOT PROOFED against M3 (M3 has no captioned icon button) |
| `onClick$`                         | `QRL`                                                |            | Declared by name and forwarded by name                                                                                                   |
| `type`, `href`, `reload`, `target` |                                                      |            | As `Button`: `type="link"` + `href` renders the router's `<Link>`; `reload` a plain `<a>`; `target="_blank"` a new tab                   |
| ...rest                            | `PropsOf<"button">`                                  |            | `disabled`, `popovertarget`, ...                                                                                                         |

Toggle colors (M3): filled unselected surface-container / on-surface-variant, selected primary /
on-primary; tonal selected secondary / on-secondary; outlined selected inverse-surface /
inverse-on-surface; standard selected primary. A selected toggle swaps its resting shape.
Outlined: `outline-variant` inset ring, 1/1/1/2/3dp per size. Disabled: container on-surface 10%,
icon 38%.

## ARIA

A native `<button>` named by `label`; the icon is `aria-hidden`. A toggle has `aria-pressed`.
`labelSelected` swaps the name while selected; APG advises a toggle's name NOT change with its
state (use one or the other: a fixed name with `aria-pressed`, or a changing name). Kept for
e-store parity; prefer leaving it unset.

## Where it differs from e-store

- Squared corners 12/12/16/28/28 (M3); e-store's were 16/28/larger.
- Outlined uses `outline-variant` with M3's per-size width; e-store `border-outline` 1px.
- Disabled container 10% (M3); e-store 12%. Pressed is a corner morph, not a scale.
- `softDisabled` is a prop (e-store: `aria-disabled` by hand).
- `icon` takes an `IconName` OR JSX (e-store's is `JSXOutput` only; our Button's `leadingIcon`
  already took both). 2026-11-24, for the Contact me companion's social icon row.
- Left out: the `elevated` look (store.google.com), the `dense` / `ide` / `bar` / `slider` sizes
  (not M3), the ripple, and e-store's arrow-key `preventDefault` on toggles.

PROOFED 2026-11-23: m3.material.io icon-buttons specs, material-web `latest` tokens. Checked in
Chrome: every size and width, icon sizes, toggle colors for every look, `labelSelected`,
soft-disabled, outlined xl ring 3px, a click flips `aria-pressed` and the icon. NOT checked:
the pressed morph visually.

Review 2026-11-23 (second pass): every look x size x width x shape x toggle state x disabled /
soft-disabled measured in Chrome, light and dark (2700 cases: heights, widths, corners, colors).
Fixed: a SELECTED toggle that is `softDisabled` kept `primary` (standard) / `inverse-primary`
(inverse); it now takes the disabled 38% color like the other looks.

## Usage

```tsx
<IconButton icon="palette" label="Theme color" popovertarget="theme-menu" />
<IconButton icon="star" iconSelected="star_filled" label="Favourite" look="tonal" toggle />
{/* A brand mark, as a link to a new tab (the name says so; no per-icon external mark). */}
<IconButton
  type="link"
  href="https://github.com/seanperez-net"
  target="_blank"
  rel="me external"
  icon={<GithubIcon aria-hidden="true" />}
  label="GitHub (opens in a new tab)"
/>
```
