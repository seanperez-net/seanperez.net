# Badge

A small dot (something new) or a count, on an icon. From e-store's `components/badge/`
(2026-11-23): Root and Badge.

- M3: https://m3.material.io/components/badges/specs and /accessibility (read in Chrome
  2026-11-23)
- Tokens: material-web `_md-comp-badge.scss` (v34.0.21)

## API

`Badge.Root` (a `<span>`): the icon, icon button or destination icon area, and its badge.

`Badge.Badge` (a `<span>`):

| Prop    | Type            | Default                                      |                                                                        |
| ------- | --------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| `value` | `number`        |                                              | A count (large badge). Without it, a small dot.                        |
| `max`   | `number`        | `999`                                        | Above it the badge shows "{max}+" (M3: at most 4 characters with "+"). |
| `size`  | `small` `large` | from `value`                                 | Override.                                                              |
| `label` | `string`        | "New notification" / "{value} notifications" | What a screen reader hears.                                            |
| `announce` | `boolean`    | `true`                                       | `false`: the host puts `badgeSpokenText(value, label)` after its own name. |

`NavigationRail.Item` takes `badge` (`number`, none at 0, or `true` for the dot) and
`badgeLabel` and renders this badge on its icon, with the spoken text after the label.

## Measurements (M3)

|                                                                          | Small               | Large                                                                |
| ------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------- |
| Size                                                                     | 6 x 6, full corners | 16 high, 16 min wide (34 with 4 characters), 4dp sides, full corners |
| Colour                                                                   | `error`             | `error` / `on-error`, label-small                                    |
| From the icon's top-trailing corner to the badge's bottom-leading corner | 6 down, 6 in        | 14 down, 12 in                                                       |

The offsets are measured from a 24dp icon CENTRED in `Badge.Root`, so the root can be the icon,
an icon button or a rail pill. Logical insets: RTL mirrors.

## Accessibility

M3: the badge "will be read after its navigation destination"; a count reads its number, a dot
"New notification". The visible text is `aria-hidden` and `label` is hidden text in the badge, so
inside a link or button it becomes part of the name. The badge sits before the label in the
DOM, so a host that names itself after the badge (the rail item) sets `announce={false}` and puts
`badgeSpokenText()` after its label: "Mail, 3 notifications" (checked in Chrome). Beside an icon
button the badge is NOT part of the button's name: put the count in the button's `label` and set
`announce={false}`. M3: hide a notification badge once the destination is selected (the
app does that). Keep the `error` colours (3:1).

## Usage

```tsx
<Badge.Root>
  <IconButton icon="notifications" label={`Notifications, ${badgeSpokenText(12)}`} />
  <Badge.Badge value={12} announce={false} />
</Badge.Root>
<NavigationRail.Item href="/mail/" icon="mail" label="Mail" badge={3} />
```

## Proof

- Sizes, colours, type, placement, max: PROOFED 2026-11-23 against the M3 spec page and tokens;
  measured in Chrome (dot 6x6 at 6/6; count 16 high at 14/12; "999+" 35 wide) on an icon and an
  icon button, and on rail destinations.
- Hidden text instead of a live region: PROOFED against the M3 accessibility page (read with the
  destination) and ARIA in HTML (`aria-label` on a `<span>` without a role is not allowed, and a
  `status` live region per badge announces every badge on load).

## Where it differs from e-store

- Placement from the icon's centre (works for an icon, an icon button, a rail pill). e-store's
  offsets assumed an icon 8dp inside a 40dp button and put the large badge's bottom 2dp too high
  and its start 2dp too far out.
- Root is a `<span>` (e-store `<div>`, not allowed inside a link or button).
- No `role="status"` / `aria-label`: hidden text read with the destination.
- Left out: `placement="inline"` (Gmail's tab counts; not an M3 placement).
