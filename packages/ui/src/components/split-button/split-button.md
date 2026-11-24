# Split button

A main action and a menu of related ones, side by side. M3 Expressive. From e-store's
`components/split-button/` (2026-11-23): Root, Action, Trigger, Content, Item, Separator, on our
`Menu`.

- M3: https://m3.material.io/components/split-button/specs (read in Chrome 2026-11-23)
- Tokens: material-web `_md-comp-split-button-{xsmall,small,medium,large,xlarge}.scss` (v34.0.21);
  colours, type and icons are the common buttons' (`button.tsx`), as M3 says
- APG: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/

## API

`SplitButton.Root` (`Menu.Root`, `role="group"`): `look` (`filled` `tonal` `elevated`
`outlined`, default `filled`), `size` (`xs` `sm` `md` `lg` `xl`, default `sm`), `open`
(`Signal<boolean>`), `onOpenChange$`, `<div>` props. `look` and `size` reach the parts through
context.

`SplitButton.Action`: `label`, `leadingIcon` (`IconName`), `onClick$`, `disabled`, `<button>`
props. M3: label + icon, label, or icon only (then give it `aria-label`).

`SplitButton.Trigger`: `label` (its `aria-label`, default "More options"), `icon` (default
`expand_more`), `disabled`, `onClick$`, `onKeyDown$`. It is `Menu.Trigger unstyled`.

`SplitButton.Content` is `Menu.Content` with `align` defaulting to `end` (lined up with the trigger),
`SplitButton.Item` = `Menu.Item`, `SplitButton.Separator` = `Menu.Separator`.

| size | height | leading sides | trailing width (icon) | inner corner rest / hover-focus-press | icon offset |
| ---- | ------ | ------------- | --------------------- | ------------------------------------- | ----------- |
| xs   | 32     | 12 / 10       | 48 (22)               | 4 / 8                                 | -1          |
| sm   | 40     | 16 / 12       | 48 (22)               | 4 / 12                                | -1          |
| md   | 56     | 24 / 24       | 56 (26)               | 4 / 12                                | -2          |
| lg   | 96     | 48 / 48       | 96 (38)               | 8 / 20                                | -3          |
| xl   | 136    | 64 / 64       | 136 (50)              | 12 / 20                               | -6          |

2dp between the halves; outer corners full. Open: the trigger's inner corners go full, its icon
centres and turns over; its colour does not change (M3). Label type, icon size and gap as the
common button of the same size. Outline 1 / 1 / 1 / 2 / 3dp. 48dp targets.

## ARIA and keys

The Root is a `group` (name it with `aria-label` if the action's label does not say what it
groups). The Action is a plain button. The Trigger is an APG menu button (Menu's): `aria-label`,
`aria-haspopup="menu"`, `aria-expanded`, `aria-controls`; Enter / Space / ArrowDown open on the
first item, ArrowUp on the last; Escape closes and returns focus. Each half draws its own focus
ring, raised over the other.

## Usage

```tsx
<SplitButton.Root look="tonal" size="md" aria-label="Save">
  <SplitButton.Action label="Save" leadingIcon="edit" onClick$={save} />
  <SplitButton.Trigger label="More save options" />
  <SplitButton.Content align="end">
    <SplitButton.Item onClick$={saveDraft}>Save as draft</SplitButton.Item>
    <SplitButton.Separator />
    <SplitButton.Item onClick$={saveClose}>Save and close</SplitButton.Item>
  </SplitButton.Content>
</SplitButton.Root>
```

## Proof

- Sizes, paddings, widths, corners at rest and open, icon sizes, colours, disabled, outline:
  PROOFED 2026-11-23 against M3 specs and material-web tokens. The icon offsets and the FOCUSED
  inner corner are in the M3 specs page only ("Menu icon offset when unselected"; "The inner
  corners change shape for hovered, focused, and pressed states"), not in the tokens: PROOFED
  against the page, not the tokens. All measured in
  Chrome for every look and size. Keyboard (Enter opens on the first item, Escape back to the
  trigger) run in Chrome. The hover morph uses the same rules as the focus morph (checked); a
  synthetic hover did not set `:hover` in the test window, so hover itself was not seen.
- The offset direction (towards the inner edge) is our reading of "-1dp from center", NOT
  PROOFED beyond the M3 figure. The icon turning over when open is e-store's and Compose's; M3
  says only "the icon becomes centered when selected".

## Where it differs from e-store

- Sizes fixed to the tokens: e-store's trailing button was square (32 / 40 / 56 / 96 / app-bar
  height) and its XL used the app bar's height, not 136; the trailing button's widths are
  48 / 48 / 56 / 96 / 136; md label type title-medium.
- Inner corners morph on hover, focus and press (M3); e-store's never changed except when open.
- The icon is optically offset (M3 table) and its size per the tokens.
- `look` / `size` set once on the Root (context); e-store repeats them on every part, whose own
  defaults (`filled`, `sm`) silently disagreed with the Root when not repeated.
- Label type and icon sizes are the common button's (`md` title-medium; e-store body-large).
- Logical corners (`rounded-s` / `rounded-e`), so RTL mirrors.
- Left out: the Action's default slot (props only), `Content align` is Menu's own prop.
