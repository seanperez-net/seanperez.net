# FAB menu

A FAB that opens a few related actions. From e-store's `components/fab-menu/` (2026-11-23):
Root, Trigger, Content, Item.

- M3: https://m3.material.io/components/fab-menu/specs and /accessibility (read in Chrome
  2026-11-23)
- Tokens: material-web `_md-comp-fab-menu.scss`, `_md-comp-fab-menu-*-close-button.scss`,
  `_md-comp-fab-menu-*-container.scss` (v34.0.21)
- APG: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ (menu layout)

## Two layouts (both M3)

| `layout`         | What M3 says                                                                                                                                                                                                                                                                                                                                       | Built on                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `menu` (default) | "On web, a FAB menu is a combination of a FAB and a menu component. The FAB opens the menu", which "inherits its states and specs from the baseline menu"; 4dp gap recommended.                                                                                                                                                                    | `Menu.Root` / `Menu.Trigger unstyled` / `Menu.Content side align="end"` / `Menu.Item` |
| `stacked`        | The M3 Expressive FAB menu: the FAB becomes a 56dp round close button in its top-trailing corner; up to six 56dp pill items (the medium button's measurements, 24dp sides, 24dp icon, 8dp gap, title-medium) stack above it 4dp apart, 8dp over the close button; close button 20dp icon, level 3; items level 0 (4 hovered, 3 focused / pressed). | a `popover="auto"` `<div>` anchored to the FAB                                        |

Color sets (M3: primary, secondary, tertiary): the FAB is the set's container color, the
close button the set's color, the items the container color.

## API

`FABMenu.Root` (`Menu.Root`, a `<div>`)

| Prop            | Type                             | Default   |                                                           |
| --------------- | -------------------------------- | --------- | --------------------------------------------------------- |
| `layout`        | `menu` `stacked`                 | `menu`    | Fixed at the first render (re-key the Root to change it). |
| `color`         | `primary` `secondary` `tertiary` | `primary` |                                                           |
| `extended`      | `boolean`                        | `false`   | The trigger is an extended FAB showing its `label`.       |
| `placement`     | `above` `below`                  | `above`   | `menu` layout; it flips when there is no room.            |
| `open`          | `Signal<boolean>`                |           | Bound open state.                                         |
| `onOpenChange$` | QRL                              |           |                                                           |

`FABMenu.Trigger`: `icon` (`IconName`, required), `label` (required: the FAB's name, shown when
extended; M3: it "should describe the menu"), `size` (`default` `medium` `large`; M3 opens the menu from a FAB, medium or large FAB, never a small one), `onClick$`, `onKeyDown$`,
`<button>` props.

`FABMenu.Content`: `closeIcon` (`IconName`, `close`) and `closeLabel` (`string`, "Toggle menu",
the M3 accessibility page's name for it), both `stacked` only; `onToggle$`, `<div>` props.

`FABMenu.Item`: `label` (required), `icon`, `disabled`, `onClick$`, `onKeyDown$`. A click runs
`onClick$` and closes the menu.

## ARIA and keys

- `menu`: APG menu button (Menu's): `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`;
  Enter / Space / ArrowDown open on the first item, ArrowUp on the last; arrows, Home / End,
  type-ahead, Tab closes, Escape closes and returns focus. Items `role="menuitem"`.
- `stacked` (M3 accessibility page): the trigger is a disclosure button (`aria-expanded`,
  `aria-controls`, no `aria-haspopup`); on open, focus goes to the close button by `autofocus` (HTML
  popover focusing steps; named by `closeLabel`, `aria-expanded="true"`). While open the FAB under
  it is transparent and takes no pointer events, then Tab goes through the items top to bottom (the close
  button is first in the DOM and drawn last, `order-last`); items are plain buttons named by
  their text; Space / Enter activate; Escape or the close button close and focus the FAB. A list
  longer than the room scrolls above the close button, which stays clear (M3 "Do").

## Usage

```tsx
<FABMenu.Root layout="stacked" color="tertiary">
  <FABMenu.Trigger icon="edit" label="Create" size="large" />
  <FABMenu.Content>
    <FABMenu.Item icon="mail" label="New message" onClick$={...} />
    <FABMenu.Item icon="notifications" label="New reminder" onClick$={...} />
  </FABMenu.Content>
</FABMenu.Root>
```

## Proof

- Both layouts, measurements, colors, focus order: PROOFED 2026-11-23 against the M3 specs and
  accessibility pages and the material-web tokens; run in Chrome (menu: flip, 4dp gap, end
  alignment, ArrowUp to the last enabled item, Escape back to the FAB; stacked: close button on
  the FAB's corner, focus on it, Tab order, an item closes and refocuses the FAB, a short window
  scrolls the list). No console errors.
- Re-run after the review (2026-11-23): `autofocus` puts focus on the close button, the
  close button returns it to the FAB, the hidden FAB has `pointer-events: none`, and with
  `dir="rtl"` the close button covers the FAB's corner on the left (the inset is logical,
  `inset-inline-end: anchor(end)`; a physical `right: anchor(end)` took the wrong edge).
- The close button shares the FAB's TOP-trailing corner: PROOFED against the M3 specs page text
  ("share the top trailing corner as an anchor"; "placed higher to align with the top of the
  medium FAB"). A reviewer cited Compose pinning it to the bottom end; we follow the M3 page.
- Items' disabled look in `stacked`: M3's FAB menu has NO disabled state; a disabled item is
  drawn as a disabled button (on-surface 10% / 38%). NOT PROOFED (no M3 source).
- The stacked enter motion (fade, medium-1, standard-decelerate) is NOT PROOFED: M3 shows the
  motion, prints no numbers.

## Where it differs from e-store

- e-store has one layout: a tinted panel (`primary-container`, 16dp corners) of items over a FAB
  that swaps its icon for `close`. It is neither of M3's: the web form uses the baseline menu
  (surface container), the Expressive form separate pill items and a separate close button.
- The trigger is a real FAB (`fabVariants`, any FAB `size`, extended); e-store's is a 56dp copy.
- Color sets are M3's three; e-store's `surface` and `surface-lowest` (Google Calendar's, not
  M3) are left out, as are `extended="nav"`, the Trigger's `trailing` and `closeIconName` (the
  close icon is `Content closeIcon`), JSX icons, the ripple and the anchor polyfill.
- The menu layout's keyboard is Menu's (type-ahead, Tab closes, focus returns only when it was
  inside), not e-store's own copy.
