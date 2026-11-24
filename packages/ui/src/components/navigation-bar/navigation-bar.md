# Navigation bar

Material Design 3 Expressive flexible navigation bar: 3 to 5 destinations at the bottom of
compact and medium windows, vertical or horizontal items. Standalone (not wired into `Layout`).
Ported 2026-11-23 from e-store's `components/navigation/nav-bar.tsx` and `nav-button.tsx`.

- **M3 spec**: https://m3.material.io/components/navigation-bar/specs (token sets "Nav bar -
  Common", "Nav bar - Item - Vertical / Horizontal", read 2026-11-23), `/guidelines`

## Parts

| Part                  | Element                    | What |
| --------------------- | -------------------------- | ---- |
| `NavigationBar.Root`  | `<nav>` > row `<div>`      | The bar, a landmark (default name "Main") |
| `NavigationBar.Item`  | router `<Link>`            | A destination; a `Badge.Badge` in `q:slot="badge"` |

## API

### `NavigationBar.Root`

| Prop         | Type                                      | Default      | What |
| ------------ | ----------------------------------------- | ------------ | ---- |
| `layout`     | `"adaptive" \| "vertical" \| "horizontal"` | `"adaptive"` | `adaptive`: vertical items below 600dp, horizontal from 600dp, in CSS (M3 "Configurations") |
| `aria-label` | `string`                                  | `"Main"`     | Landmark name |

### `NavigationBar.Item`

| Prop           | Type       | What |
| -------------- | ---------- | ---- |
| `href`         | `string`   | Destination (router `Link`, client navigation) |
| `icon`         | `IconName` | Icon |
| `iconSelected` | `IconName` | Icon while current: M3 "Use a filled icon for the active destination" (`home_filled`, ...) |
| `label`        | `string`   | Required: M3 "Don't remove the labels" |
| `current`      | `boolean`  | `aria-current="page"` |
| `onClick$`     | `QRL`      | Passed to the link by name |
| slot `badge`   | `Badge.Badge` | Over the icon's top end (the badge's own offsets for a centred 24dp icon) |

## Measurements and colours (PROOFED 2026-11-23: M3 tokens in Chrome; measured in Chrome)

| Item | M3 | Ours (measured) |
| ---- | -- | --------------- |
| Container | `surface-container`, 64dp, full width | 64 |
| Vertical item | indicator 56 x 32dp, 6dp from the top, label 4dp under it; equal widths | pill 56x32 at +6, label at +42 |
| Horizontal item | indicator 40dp high, 16dp sides, icon and label 4dp apart inside it; fixed width, extra space at the ends | pill 40 high; items equal (103 x 3), centred |
| Active | indicator `secondary-container`, icon `on-secondary-container`, label `secondary` | same |
| Inactive | icon and label `on-surface-variant` | same |
| State layer | `on-secondary-container`, 8 / 10 / 10, on the indicator | `after:` on the indicator |
| Label | label-medium; never wrapped or truncated | `text-label-medium whitespace-nowrap` |
| Selection motion | indicator expands from the centre, one axis | `scale-x` 0 to 1 |
| Focus | M3 ring | e-store's indicator ring (3dp `secondary`, 2dp out) on the pill |

NOT PROOFED: the gap between horizontal items (M3 "space between items 0dp"; ours 0, the pills of
the widest items touch); the label weight (no token printed; ours 500 for both states).

## Keyboard and ARIA

A `<nav>` of links: each destination is a Tab stop. No arrow keys (neither M3 nor e-store has
them for the bar; removed after the 2026-11-23 review). `href` goes through `safeHref`
(e-store's, for CMS-stored links). The current one has `aria-current="page"`. The
label is rendered twice (inside the indicator for horizontal items, under it for vertical ones)
and exactly one is displayed, so it is read once.

## How `Layout` would use it (owner decides; not wired)

Below 600dp `Layout.Root` would render `<NavigationBar.Root>` from its `railItems` (each
`{ href, label, icon }` plus an `iconSelected`) as the scaffold's bottom row, hidden from 600dp
where `Layout.Rail` takes over, with `layout="vertical"` (the rail covers medium windows; use
`adaptive` only if the bar should also show from 600 to 839). It replaces the app bar's menu
button and modal drawer below 600dp when there are 3 to 5 destinations (M3: fewer than three use
tabs; more than five use the modal rail). It must not show with a docked toolbar (M3). The pane
then needs 64dp of bottom clearance plus `env(safe-area-inset-bottom)`.

## Where it differs from e-store

- Standalone: no `Navigation` context, CMS `bar` config, `pwa` mode, "More" sheet, companion
  source, scroll-hide, `position: fixed`, or `barItems` planning (all e-store app machinery).
- Item is a link only (as our `NavigationRail.Item`, `current` prop); e-store's button items and
  `disabled` (M3 has no disabled destination) are left out. Badge through our `Badge` component
  instead of e-store's own count.
- Fixed against M3: horizontal items put the label INSIDE the indicator (e-store kept the 56dp
  pill around the icon only, label beside it); the indicator grows on one axis (e-store scaled
  both); labels are not truncated (M3) and not bold when current (no M3 token); the filled icon
  for the current destination (`iconSelected`; e-store used the font's fill axis).

## Usage

```tsx
<NavigationBar.Root aria-label="Main" layout="vertical">
  <NavigationBar.Item href="/" icon="home" iconSelected="home_filled" label="Home" current />
  <NavigationBar.Item href="/inbox/" icon="notifications" iconSelected="notifications_filled" label="Inbox">
    <Badge.Badge q:slot="badge" value={3} label="3 new messages" />
  </NavigationBar.Item>
</NavigationBar.Root>
```
