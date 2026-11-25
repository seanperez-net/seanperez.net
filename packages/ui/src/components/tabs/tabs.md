# Tabs

Material Design 3 tabs: primary and secondary, fixed and scrollable, with icons and badges.
Ported 2026-11-23 from e-store's `components/tabs/` (Root / List / Trigger / Content, `look`,
`scrollable`, `iconPosition`, `labelHidden`), M3 parts only.

- **M3 spec**: https://m3.material.io/components/tabs/specs (token sets "Tabs - Primary
  navigation" and "Tabs - Secondary navigation", "Expand all", read 2026-11-23), `/guidelines`,
  `/accessibility`
- **WAI-ARIA APG**: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/

## Parts

| Part           | Element                                  | What                                       |
| -------------- | ---------------------------------------- | ------------------------------------------ |
| `Tabs.Root`    | `<div>`                                  | Selection state, look; full width          |
| `Tabs.List`    | `<div>` container > `<div role=tablist>` | The row; `class` on the container          |
| `Tabs.Trigger` | `<button role="tab">`                    | A tab; a `Badge.Badge` in `q:slot="badge"` |
| `Tabs.Content` | `<div role="tabpanel">`                  | Its panel, `hidden` unless selected        |

## API

### `Tabs.Root`

| Prop            | Type                       | Default     | What                                                                                                                                                  |
| --------------- | -------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`         | `string`                   | required\*  | Selected tab's value; followed when it changes. \*`value` or `bind:value` is required (types): with nothing selected no tab would be a Tab stop (APG) |
| `bind:value`    | `Signal<string>`           |             | Two-way binding                                                                                                                                       |
| `onChange$`     | `QRL<(value) => void>`     |             | After the user selects a tab                                                                                                                          |
| `look`          | `"primary" \| "secondary"` | `"primary"` | M3 primary or secondary tabs (every part reads it)                                                                                                    |
| `selectOnFocus` | `boolean`                  | `false`     | APG automatic activation. Default manual (M3 accessibility: arrows move focus, Space / Enter select)                                                  |

### `Tabs.List`

| Prop         | Type                            | Default  | What                                                                                                                                        |
| ------------ | ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `scrollable` | `boolean`                       | `false`  | M3 scrollable tabs: each tab as wide as its label, first tab 52dp from the leading edge, the row scrolls                                    |
| `align`      | `"fill" \| "center" \| "start"` | `"fill"` | Fixed tabs: `fill` the row in equal sections, or keep every tab as wide as the widest and centre / start the group (M3 "Responsive layout") |
| `aria-label` | `string`                        |          | Name of the tab list                                                                                                                        |

### `Tabs.Trigger`

| Prop           | Type               | Default | What                                                                                |
| -------------- | ------------------ | ------- | ----------------------------------------------------------------------------------- |
| `value`        | `string`           | (req.)  | Pairs it with its `Tabs.Content`                                                    |
| `label`        | `string`           | (req.)  | The tab's text                                                                      |
| `icon`         | `IconName`         |         | Optional icon                                                                       |
| `iconPosition` | `"top" \| "start"` | `"top"` | `top`: stacked, 64dp; `start`: inline, 8dp before the label, 48dp                   |
| `labelHidden`  | `boolean`          | `false` | Icon-only tab (M3 allows "icons alone"); the label stays the accessible name        |
| slot `badge`   | `Badge.Badge`      |         | With an icon: over the icon (the badge's own offsets); without: 4dp after the label |

### `Tabs.Content`

| Prop    | Type     | What                      |
| ------- | -------- | ------------------------- |
| `value` | `string` | The trigger it belongs to |

## Measurements and colors (PROOFED 2026-11-23, M3 token tables in Chrome; measured in Chrome)

| Item                             | M3                                                                      | Ours                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Height label only / icon + label | 48 / 64dp                                                               | 48 / 64 (measured)                                                                       |
| Divider                          | 1dp `outline-variant`, inside the height                                | inset shadow on the container                                                            |
| Primary indicator                | 3dp `primary`, corners 3,3,0,0, under the content, 2dp inset, min 24dp  | `after:` on the content span, `inset-x-0.5`, content `min-w-7` (measured 3px, 2px inset) |
| Secondary indicator              | 2dp `primary`, whole tab                                                | `after:` on the tab                                                                      |
| Label                            | title-small 14/20/500                                                   | measured 500 14px/20px                                                                   |
| Active text + icon               | primary: `primary`; secondary: `on-surface`                             | same                                                                                     |
| Inactive                         | `on-surface-variant`; `on-surface` on hover / focus / press             | same                                                                                     |
| State layer                      | 8 / 10 / 10; `primary` on an active primary tab, `on-surface` otherwise | same                                                                                     |
| Focus                            | 3dp `secondary`, offset -3dp                                            | `focus-ring-inward` (measured 3px, -3px)                                                 |
| Inline icon gap                  | 8dp                                                                     | `gap-2` (e-store had 16)                                                                 |
| Scrollable first tab             | 52dp from the leading edge                                              | `ps-[52px]` (measured)                                                                   |
| Fixed, centred                   | equal widths of the widest, centred                                     | `w-fit` grid of `1fr` columns (measured 190 x 3)                                         |

NOT PROOFED: the stacked icon-to-label gap (8dp, e-store's; M3 prints no value); the badge
position on a stacked icon (relies on `Badge.Badge`'s offsets for a centred 24dp icon); the
indicator's motion (M3: it "shifts into position"; ours scales in place, e-store's way); tab
side padding 16dp (M3 prints none; e-store 16 primary, 24 secondary, ours 16 both).

## ARIA and keyboard (APG tabs; M3 accessibility page)

- `role="tablist"` (named by `aria-label`) > `role="tab"` (`aria-selected`, `aria-controls`) and
  `role="tabpanel"` (`aria-labelledby`, `tabindex="0"`, `hidden` when not selected). Ids from
  `useId` + value.
- Roving tab stop: only the selected tab has `tabindex="0"` (lowercase, as e-store; checked after
  a client re-render in Chrome).
- Left / Right: previous / next tab (mirrored in RTL), Home / End: first / last. No wrap
  (M3: "It's not recommended to loop a tab set"). Space / Enter select (native button). With
  `selectOnFocus` focus also selects. Focus scrolls a partly hidden tab into view.
- The keys are the shared `utils/roving-focus.ts` (`rovingKeys`, one `sync$`: cancels the key
  and moves focus; `data-roving="horizontal"`, `data-roving-loop="false"` on the tablist).
  Alt / Ctrl / Meta + arrow are left to the browser. A consumer's `onKeyDown$` on `Tabs.List`
  runs after ours. Tabs with `disabled` /
  `aria-disabled="true"` (passed through, not a styled M3 state) are skipped.
- `selectOnFocus` and `onChange$` are signals in the context (rc.5 `useContextProvider` stores
  its value once, at the first render), so later changes apply.
- Review (second agent, 2026-11-23): APG and e-store's `loop` option wrap; we follow M3's tabs
  accessibility page ("It's not recommended to loop a tab set", read in Chrome 2026-11-23).
  OWNER DECISION if APG should win.

## Where it differs from e-store

- Left out (not in M3): `pill`, `tonal`, `editor`, `editor-m3` looks; closable tabs, dirty and
  preview tabs, keyboard and drag reorder, `mount`, link tabs (`href`, `reload`), `fill`,
  `orientation="vertical"`, `loop`, per-tab `fullWidth` / `align`, `disabled` tabs (M3 tabs
  have no disabled state), the unstyled layer and index-based values (`value` is required).
- Fixed: inline icon gap 8dp (was 16); inactive hover / focus / press text and state layer
  `on-surface` (was `on-surface-variant`); the primary indicator follows the content width with
  2dp insets (was the whole tab less 2px); the divider is inside the 48 / 64dp (was a border
  under it); `selectOnFocus` defaults to `false` (M3 accessibility; APG allows both); RTL arrows.
- `align` on the list (M3 fixed tabs as wide as the widest, centred or leading) replaces
  e-store's per-trigger `fullWidth` / `align`.
- The scrollable row keeps our scrollbar (global rule; e-store hid it).

## Usage

```tsx
<Tabs.Root bind:value={tab}>
  <Tabs.List aria-label="Travel">
    <Tabs.Trigger value="flights" label="Flights" icon="flight" />
    <Tabs.Trigger value="trips" label="Trips" icon="luggage">
      <Badge.Badge q:slot="badge" value={3} />
    </Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="flights">…</Tabs.Content>
  <Tabs.Content value="trips">…</Tabs.Content>
</Tabs.Root>
```

Web standards: native `<button>`, `hidden`, CSS grid for equal widths, `scrollIntoView`.
