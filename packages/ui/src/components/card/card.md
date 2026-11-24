# Card

Content and actions about one subject. Material Design 3 elevated, filled and outlined cards.
Ported from e-store's `components/card/` on 2026-11-23, cut to what M3 has.

- M3 specs: https://m3.material.io/components/cards/specs (read 2026-11-23, token table, every state)
- M3 guidelines: https://m3.material.io/components/cards/guidelines (read 2026-11-23)
- M3 accessibility: https://m3.material.io/components/cards/accessibility (read 2026-11-23)
- material-web tokens: `tokens/versions/v0_192/_md-comp-{elevated,filled,outlined}-card.scss`

## M3 values (PROOFED 2026-11-23 against the M3 token table and material-web tokens)

| Token                      | Elevated              | Filled                    | Outlined                |
| -------------------------- | --------------------- | ------------------------- | ----------------------- |
| Container                  | surface-container-low | surface-container-highest | surface                 |
| Outline                    | none                  | none                      | 1dp outline-variant     |
| Elevation at rest          | level 1               | level 0                   | level 0                 |
| Hovered / focused / pressed| 2 / 1 / 1             | 1 / 0 / 0                 | 1 / 0 / 0               |
| Dragged                    | level 4               | level 3                   | level 3                 |
| Disabled container         | surface at 38%, level 1 | surface-variant at 38%, level 0 | (none)        |
| Disabled outline           |                       |                           | outline at 12%          |
| Focused outline            |                       |                           | on-surface              |

Shape 12dp. Side padding 16dp. Up to 8dp between cards. Text start-aligned. State layer
on-surface: hover 8%, focus 10%, pressed 10%, dragged 16%. Focus indicator: 3dp `secondary`,
2dp offset (`focus-ring`). Headline title-large; subhead and supporting text body-medium.

Hover, focus and pressed exist only on a DIRECTLY ACTIONABLE card (M3 accessibility: "Non-actionable
cards don't have a hover state"). Content of a disabled card is drawn at 38% (M3 states the
container's values only; content at 38% is e-store's and M3's general disabled rule).

## Parts

| Part               | Element                    | What                                                                    |
| ------------------ | -------------------------- | ----------------------------------------------------------------------- |
| `Card.Root`        | `div`, router `Link`, `a`  | The container. Sets `--field-bg` to its fill.                           |
| `Card.Media`       | `img`, or `div` with a slot| Edge-to-edge thumbnail, image or video (M3 anatomy).                    |
| `Card.Header`      | `header`                   | Headline and subhead, 16dp gutter.                                      |
| `Card.Title`       | `h3`                       | Headline: title-large, on-surface.                                      |
| `Card.Description` | `p`                        | Subhead / supporting text: body-medium, on-surface-variant.             |
| `Card.Content`     | `div`                      | Body. `full` is edge to edge (a list), the others 16dp.                 |
| `Card.Footer`      | `footer`                   | Actions, 8dp apart, end-aligned.                                        |
| `Card.Action`      | `button`, `Link`, `a`      | A stretched control over the card: the card with the BUTTON role.       |

## API

### `Card.Root`

| Prop               | Type                                  | Default      | Notes |
| ------------------ | ------------------------------------- | ------------ | ----- |
| `as`               | `"div" \| "link" \| "a"`              | `"div"`      | `link`: the router's `<Link>`; `a`: a full page load. |
| `variant`          | `"elevated" \| "filled" \| "outlined"`| `"elevated"` | M3 card type. |
| `rounded`          | `"md" \| "pane"`                       | `"md"`       | `pane`: the layout's pane radius (`--layout-pane-radius`: 28px, 16px compact, square below 600px; 28px outside a scaffold). e-store's `rounded="pane"` (`card.tsx` 91-96), 2026-11-23. |
| `interactive`      | `boolean`                             | `true` for `link` / `a` | State layer, hover elevation, focus ring. Set it on a card holding a `Card.Action`. |
| `disabled`         | `boolean`                             | `false`      | M3 disabled values; a link card renders no link (`role="link"` + `aria-disabled`). |
| `dragged`          | `boolean`                             | `false`      | M3 dragged state (raised, 16% layer) while the app moves the card. No drag behaviour. |
| `href`             | `string`                              |              | Through `safeHref`. |
| `target`           | `"_blank"`                            |              | `as="a"` only; adds `rel="noopener noreferrer"`. |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `id`, `style`, `data-*`, `class` | | | Forwarded. |

`--field-bg`: elevated `surface-container-low`, filled `surface-container-highest`, outlined
`surface`. A floated `TextField` / `Select` label inside a card paints this colour.

### `Card.Media`

`src`, `alt` (default `""`: decorative, as M3 asks for purely decorative images), `width`,
`height` (reserve the box and set the aspect ratio). Without `src`: a `div` around your own media.

### `Card.Header`, `Card.Content`, `Card.Footer`

`variant`: Header `default | centered`; Content `default | centered | full`; Footer
`end | centered` (M3 guidelines, adaptive design: "Cards and their elements can align left, right,
or center as the layout scales").

### `Card.Action`

| Prop            | Type                             | Default    |
| --------------- | -------------------------------- | ---------- |
| `as`            | `"button" \| "link" \| "a"`      | `"button"` |
| `onClick$`      | `QRL`                            |            |
| `href`, `target`| as Root                          |            |
| `disabled`      | `boolean`                        |            |
| `aria-label`, `aria-labelledby`, `aria-describedby`, `class` | | |

## ARIA and keyboard (PROOFED 2026-11-23: M3 accessibility page, ARIA in HTML)

- A container card (`div`) has no role and is not a tab stop; Tab goes to the controls inside it.
- A directly actionable card is ONE tab stop with the link role (`as="link"` / `"a"`) or the
  button role (`Card.Action`, since a `<button>` may hold only phrasing content). Enter (and Space
  for the button) activates it. It holds no other actions: M3 "An action shouldn't be placed on an
  actionable surface".
- Name an actionable card: `aria-labelledby` its `Card.Title`'s id (a link card's name otherwise
  is all of its text).
- Give images an `alt` unless they are decorative.

## Usage

```tsx
<Card.Root variant="outlined">
  <Card.Media src="/hike.jpg" alt="" width={320} height={180} />
  <Card.Header>
    <Card.Title>Glacier hike</Card.Title>
    <Card.Description>Saturday, 9:00</Card.Description>
  </Card.Header>
  <Card.Content>…</Card.Content>
  <Card.Footer>
    <Button look="outlined" label="Details" />
    <Button look="filled" label="Book" />
  </Card.Footer>
</Card.Root>

<Card.Root as="link" href="/trips/glacier/" aria-labelledby="t1">
  <Card.Header><Card.Title id="t1">Glacier hike</Card.Title></Card.Header>
</Card.Root>

<Card.Root interactive>
  <Card.Action aria-labelledby="t2" onClick$={open} />
  <Card.Header><Card.Title id="t2">Glacier hike</Card.Title></Card.Header>
</Card.Root>
```

## Where it differs from e-store

- Fixed: e-store's disabled elevated card dropped its shadow and filled with
  `surface-container`; M3 tokens keep level 1 and `surface` (filled: `surface-variant`).
  e-store drew the whole card at 38% (so the outlined card's 12% outline became ~5%); here the
  container takes the token values and the content 38%.
- Fixed: a disabled link card stayed a link (Enter still navigated); here it renders no `href`.
- New from M3: `dragged`; the outlined card's `on-surface` focus outline; the pressed elevation
  (back to rest); hover / focus layers on a card driven by `Card.Action`.
- `Card.Action` defaults to `as="button"` (e-store `link`) and is documented as the button-role
  card only, since M3 rejects actions on an actionable card (e-store's "multi-zone" pattern puts
  buttons over a stretched link).
- The Action's focus ring is INWARD (e-store's reason: the card clips its content). M3's focus
  indicator offset is 2dp outward: NOT PROOFED as an M3 match, kept from e-store.
- `--field-bg` is a CSS custom property set by the variant class, not an inline `style`.
- Physical `text-left` replaced by `text-start`.
- Fixed after the second agent's review (2026-11-23): the dragged state shows its 16% on-surface
  layer on every card (it was missing); a link card whose `href` is unsafe renders as a plain,
  non-interactive container (it had hover and focus with nothing to activate); `Card.Media src`
  forwards its other props to the `<img>`. Not changed: the pressed layer uses `opacity-focus`
  (10%, M3); our shared `--opacity-pressed` token is 12%, outside this port.

## Left out (e-store extras M3 does not have)

`variant="plain"`, `rounded` (11 radii; M3 is 12dp; only `pane` is ported), `motion="linear"`, `surface`
(`lowest` / `low` overrides), `stateLayer={false}`, `--card-bg`, `density="compact"`, Content
`gap`, Media `bg` / `aspect` / `align` / `rounded`, `Card.Grid`, and `SectionCard` (an admin
settings group, not an M3 card). All came from store.google.com or e-store's apps.

## Web standards

`<header>`, `<footer>`, `<h3>`; `<a>` / `<button type="button">`; `aria-disabled`;
`:focus-visible` and `:has()` (Chrome 105, Safari 15.4, Firefox 121) for the Action's focus
layer on the card.
