# Toolbar

Material Design 3 Expressive toolbars: docked and floating (horizontal or vertical), standard
and vibrant colors, with a FAB beside a floating one. Ported 2026-11-23 from e-store's
`components/toolbar/` (Root / Item / Divider, `variant`, `colorScheme`, `itemStyle`).

- **M3 spec**: https://m3.material.io/components/toolbars/specs (token sets "Toolbar - Docked",
  "Toolbar - Floating", "Toolbar - Floating - FAB", "Toolbar - Color - Standard / Vibrant",
  read 2026-11-23), `/guidelines`, `/accessibility`
- **WAI-ARIA**: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/

## Parts

| Part              | Element                                        | What                                                            |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `Toolbar.Root`    | `<div>` group > `<div role="toolbar">` + `fab` | The container; `class` on the group, other props on the toolbar |
| `Toolbar.Item`    | `<button>`                                     | An icon button in the toolbar's colors                          |
| `Toolbar.Divider` | `<div role="separator">`                       | Between groups of actions                                       |

Any other control (our `IconButton` with `width="wide"`, `Button`, `TextField`) may go in the
slot too (M3: "slots can be populated by buttons, icon buttons, ... text fields").

## API

### `Toolbar.Root`

| Prop          | Type                         | Default        | What                                                            |
| ------------- | ---------------------------- | -------------- | --------------------------------------------------------------- |
| `variant`     | `"docked" \| "floating"`     | `"docked"`     | Docked: full width, square corners. Floating: rounded, elevated |
| `colorScheme` | `"standard" \| "vibrant"`    | `"standard"`   | `surface-container` or `primary-container`                      |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Floating only (a docked toolbar is horizontal)                  |
| `aria-label`  | `string`                     | required       | The toolbar's name                                              |
| slot `fab`    | a `FAB`                      |                | M3 "floating toolbar with FAB": 8dp away                        |

### `Toolbar.Item`

| Prop                                  | Type                              | Default      | What                                                                                           |
| ------------------------------------- | --------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `icon`, `label`                       | `IconName`, `string`              | required     | Icon; accessible name (`aria-label`; no native `title` tooltip: M3 uses its tooltip component) |
| `itemStyle`                           | `"standard" \| "filled"`          | `"standard"` | `filled`: `primary` / `on-primary`, the one emphasised action                                  |
| `toggle`, `selected`, `bind:selected` | `boolean`, `Signal`               |              | M3's "toggle tonal button" (`aria-pressed`)                                                    |
| `onSelectedChange$`, `iconSelected`   |                                   |              | As `IconButton`                                                                                |
| `type`                                | `"button" \| "submit" \| "reset"` | `"button"`   | e-store's: submit a form with the native `form` attribute                                      |
| `onClick$`, `disabled`                |                                   |              |                                                                                                |

## Measurements and colors (PROOFED 2026-11-23: M3 tokens in Chrome, measured in Chrome)

| Item              | M3                                                                                                                  | Ours (measured)                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Height            | 64dp all                                                                                                            | 64                                                                                             |
| Docked padding    | 16dp leading / trailing; 4 to 32dp between actions; square corners                                                  | `px-4`; `justify-between gap-1` below 600, centred `gap-8` from 600 (80px item pitch measured) |
| Floating          | 8dp leading / trailing, 4dp between actions, fully rounded                                                          | 168 wide for 3 items = 8 + 3x48 + 2x4 + 8                                                      |
| Vertical floating | 64dp across                                                                                                         | 64 wide                                                                                        |
| FAB               | 56dp, 8dp from the toolbar; standard `secondary-container`, vibrant `tertiary-container`                            | `FAB color="secondary" / "tertiary"` (another agent's component), gap 8                        |
| Standard          | container `surface-container`, icon `on-surface-variant`, selected `secondary-container` / `on-secondary-container` | same                                                                                           |
| Vibrant           | container `primary-container`, icon `on-primary-container`, selected `surface-container` / `on-surface`             | same                                                                                           |
| Filled            | `primary` / `on-primary`                                                                                            | same                                                                                           |
| Disabled          | icon `on-surface` 38%                                                                                               | same                                                                                           |
| State layer       | the icon color, 8 / 10 / 10                                                                                         | `before:bg-current`                                                                            |

NOT PROOFED: item size 48dp (e-store's; the spec image is consistent: 8 + 48 + 8 = 64); floating
elevation level 2 (e-store's; the token prints no value); the vibrant divider color
(`on-primary-container` 20%, e-store's; M3 gives none); the exact docked arrangement in compact
windows ("evenly spaced": ours `justify-between`).

## Keyboard and ARIA

- `role="toolbar"`, `aria-orientation`, named by `aria-label` (M3: "On web, the toolbar container
  should have the toolbar role").
- M3 toolbar accessibility: "Tab or Arrows: navigate between interactive elements". Every action
  is a Tab stop and the arrows move between them too (our `roving-focus` utility, as the rail):
  e-store's single roving tab stop is APG's recommendation but M3 lists Tab as well, and the
  utility also covers buttons and text fields placed in the slot. Disabled actions are skipped.
- `Toolbar.Divider`: `role="separator"`, orientation opposite to the toolbar's.
- Left / Right follow the reading direction (mirrored in RTL, in the shared `roving-focus`
  utility). A consumer's `onKeyDown$` runs after ours.
- Review (second agent, 2026-11-23): APG's toolbar and e-store use ONE roving tab stop (the arrows
  move it, focus returns to the last item). We follow M3's "Tab or Arrows" (read in Chrome
  2026-11-23). OWNER DECISION: switch to APG / e-store's single tab stop if preferred.

## Where it differs from e-store

- Docked corners are square (M3 guidelines "Use straight corners"; e-store rounded the top 16dp).
- Docked spacing per M3: even below 600dp, centred 32dp apart from 600dp (e-store `gap-2`).
- In the flow, not `position: fixed` (e-store fixes it to the window bottom). Placement is the
  host's, as for Compose's toolbars; a fixed toolbar also covered the playground.
- Vertical floating orientation and the `fab` slot are NEW (M3 Expressive configurations e-store
  lacks).
- `itemStyle="tonal"` (always filled) became `toggle` + `selected`: M3 has a "toggle tonal
  button", whose fill shows the selected state. Filled has no shadow (M3 filled icon buttons have
  no elevation; e-store `shadow-1`).
- Keyboard: Tab and arrows (above) instead of a roving tab stop with `tabIndex={0}` on the first
  item by hand.
- Left out (not in M3 for this component, or optional behaviour neither has): hide on scroll,
  collapse to a FAB on scroll, removing the elevation, rounded docked toolbars on large screens,
  the overflow menu (compose our `Menu` in the slot).

## Usage

```tsx
<Toolbar.Root
  aria-label="Text formatting"
  variant="floating"
  colorScheme="vibrant"
>
  <Toolbar.Item icon="undo" label="Undo" />
  <Toolbar.Divider />
  <Toolbar.Item icon="format_bold" label="Bold" toggle bind:selected={bold} />
  <Toolbar.Item icon="link" label="Insert link" itemStyle="filled" />
  <FAB q:slot="fab" icon="add" aria-label="New" color="tertiary" />
</Toolbar.Root>
```
