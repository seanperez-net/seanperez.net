# Carousel

A row of mainly visual items. Material Design 3 carousel: multi-browse, uncontained, uncontained
multi-aspect ratio, hero, center-aligned hero, full-screen. Ported from e-store's
`components/carousel/` on 2026-11-23, cut to what M3 has.

- M3 specs: https://m3.material.io/components/carousel/specs (read 2026-11-23, token table expanded)
- M3 guidelines: https://m3.material.io/components/carousel/guidelines (read 2026-11-23)
- M3 accessibility: https://m3.material.io/components/carousel/accessibility (read 2026-11-23)
- material-web tokens: `tokens/versions/v0_192/_md-comp-carousel-item.scss`
- WAI-ARIA APG carousel: https://www.w3.org/WAI/ARIA/apg/patterns/carousel/

## Layouts (PROOFED 2026-11-23 against the M3 specs' measurement tables)

| `variant`             | How it moves | Padding (M3)                 | Gap | Item widths (M3)                          | Snap (M3)        |
| --------------------- | ------------ | ---------------------------- | --- | ----------------------------------------- | ---------------- |
| `multi-browse`        | contained    | 16dp sides, 8dp top / bottom | 8dp | large (dynamic or `maxItemWidth`), medium (dynamic), small 56 | one item a step |
| `hero` (default)      | contained    | 16dp sides, 8dp top / bottom | 8dp | large (dynamic), small 56                 | one item a step  |
| `center-aligned-hero` | contained    | 16dp sides, 8dp top / bottom | 8dp | small, large, small                       | one item a step  |
| `uncontained`         | native scroll| 16dp leading, 8dp top / bottom | 8dp | the caller's, all the same             | `snap` prop      |
| `uncontained-multi`   | native scroll| 16dp leading, 8dp top / bottom | 8dp | the caller's, 9:16 to 16:9             | `snap` prop      |
| `full-screen`         | vertical scroll | 0                         | 16dp| the container's                           | always           |

Items: container `surface`, shape 28dp (`rounded-xl`; full-screen square), vertically centred.
State layer on-surface: hover 8%, focus 10%, pressed 10%. Elevation level 0, hovered level 1
(material-web). Disabled: container at 38%. "With outline" token set (`outlined`): 1dp `outline`,
`on-surface` when focused, `outline` at 12% when disabled. Focus indicator 3dp `secondary`, 2dp
offset (outward on contained layouts, inward where the scroller would clip it).

Small items: M3 allows 40-56dp; e-store and this port always use 56.

### Contained layouts (from e-store)

Every visible item is wholly on screen at a large, medium or small width; the others collapse to 0
width and are `inert` (out of the tab order and the accessibility tree, their content included).
The widths are set from the track's width (ResizeObserver), the number of items (MutationObserver)
and the current item, and animate (`width`,
`margin`, `duration-medium-2`, standard easing). Images are `object-fit: cover`, so as an item
narrows its picture is masked from both sides.

- Multi-browse, no `maxItemWidth`: e-store's patterns by container width: below 600
  `[large, small]`, 600 `[large, medium, small]`, 840 `[large, medium, medium, small]`, 1200
  `[large, medium ×3, small]`. Large 5/9 of the space next to one medium, 40% next to more.
- Multi-browse with `maxItemWidth`: as many large items at that width as fit, a medium with what
  is left (when wider than a small), a small. (M3: "When the large item's max width is narrow
  enough, more items can be shown". New: e-store widened the medium past the large instead.)
- Hero with `maxItemWidth`: as many large items as fit at or under it, then a small (M3: "On
  larger screens, more large items are visible". New: e-store showed one large at any width).
- At the ends the window never runs past the last item: the pattern is reversed (large item at
  the trailing edge); a centred hero's first and last items take both small slots on the other
  side. New: e-store left an empty slot there.
- Reduced motion (M3 accessibility: "the parallax effect should be removed and carousel items
  should no longer expand ... All items are the same size"): every item gets the large width and
  the track (never the page) scrolls the current item to its start, so the next one peeks. New:
  e-store kept the size changes. NOT TESTED in Chrome (the playground cannot switch the OS
  setting).
- Fewer items than the pattern: a centred hero with one item shows it large; with two, the current
  one large and the other small.

## Parts

| Part               | Element | What |
| ------------------ | ------- | ---- |
| `Carousel.Root`    | `div role="region" aria-roledescription="carousel"` | The container, a live region, the track. Slots: default (items), `header`, `footer`. |
| `Carousel.Item`    | `div role="group" aria-roledescription="slide"` | One item, a tab stop. |
| `Carousel.Header`  | `div`   | Title (slot) and the 48dp-target arrow icon button to the page of all items. `q:slot="header"`. |
| `Carousel.ShowAll` | `div` + text `Button` | "Show all" below a carousel without a header, 4dp padding. `q:slot="footer"`. |

## API

### `Carousel.Root`

| Prop             | Type              | Default | Notes |
| ---------------- | ----------------- | ------- | ----- |
| `variant`        | `CarouselVariant` | `"hero"`| See the table. Reactive. |
| `aria-label`     | `string`          | required | The region's name; without the word "carousel" (APG). |
| `maxItemWidth`   | `number` (px)     | `0`     | Contained layouts: the large item's maximum (M3: "customizable maximum width"). |
| `snap`           | `boolean`         | `false` | Uncontained layouts: M3 snap-scrolling instead of default scrolling. |
| `onIndexChange$` | `QRL<(i) => void>`|         | The current item changed. |
| `itemLabel`      | `string`          | `"{index} of {count}"` | Each item's name and the live announcement (translatable). |
| `class`, `data-*`|                   |         | Forwarded to the region. |

### `Carousel.Item`

| Prop         | Type      | Default | Notes |
| ------------ | --------- | ------- | ----- |
| `index`      | `number`  |         | Its position from 0; its name is `itemLabel` filled in, once the count is measured. |
| `aria-label` | `string`  |         | A name of its own instead. |
| `onClick$`   | `QRL`     |         | Click, tap, Enter or Space. A click on a contained, not-current item also makes it current. A swipe that ends on the item does not call it. |
| `disabled`   | `boolean` | `false` | Content at 38% (an outlined item's outline at 12%, M3), no pointer, out of the tab order, skipped by the arrows. |
| `outlined`   | `boolean` | `false` | M3 "with outline" item. |
| `class`      |           |         | The item's size: its height (contained, multi-aspect) and width (uncontained). |

### `Carousel.Header`

`showAllHref` (a link) or `onShowAll$` (a handler); neither: no button. `showAllLabel`
(default "Show all"), `showAllIcon` (`IconName`, default `arrow_forward`, mirrored in RTL).

### `Carousel.ShowAll`

`href` or `onClick$`, `label` (default "Show all").

## Keyboard and ARIA (PROOFED 2026-11-23: M3 accessibility page, APG carousel)

| Key | Action |
| --- | ------ |
| Tab / Shift+Tab | Contained layouts: next / previous item (M3: "Tab or Arrows moves to the previous or next carousel item"; collapsed items are `inert`, so the browser cannot do it); from the last / first item it leaves the carousel natively. Scrolling layouts: the browser's own Tab order (every item is tabbable). |
| ArrowRight / ArrowLeft | Next / previous item (swapped in RTL). Disabled items are skipped. |
| ArrowDown / ArrowUp | Leave the carousel to the next / previous focusable element on the page (M3: "Use the up and down arrow keys to leave the carousel"). |
| Enter / Space | Activate the item (`onClick$`). |

- The container is a named region with `aria-roledescription="carousel"`; it is never focused
  itself (M3: "Avoid focusing on the carousel container").
- Items are `group`s with `aria-roledescription="slide"` named "N of M" (M3: "the label reads out
  the total amount of items and the current item in focus").
- A visually hidden polite live region (e-store's) speaks the position only after a swipe, a wheel
  move or a click on a peeking item; a keyboard move focuses the item, which already reads its
  "N of M" (e-store's region spoke every move a second time).
- Pointer: swipe (30px, 1.2x horizontal) and horizontal wheel move a contained carousel one item.
- A focused item partly outside a scrolling track is scrolled fully into view at once.

Open, for the owner (reviewer 2026-11-23):

- `full-screen` is vertical, but Up / Down still leave the carousel and Left / Right move between
  items, as the M3 accessibility page says for every carousel. M3 does not single out the vertical
  layout; changing it would be new behaviour.
- A clickable item is a `group` (e-store's and the APG's slide role), not a button; Enter and Space
  activate it as M3 says. A stretched button inside would change the role; not done.
- Header title is a plain `div`, not a heading (neither M3 nor e-store asks for one).

## Usage

```tsx
<Carousel.Root aria-label="Places" variant="multi-browse">
  <Carousel.Header q:slot="header" showAllHref="/places/">Places</Carousel.Header>
  {places.map((p, i) => (
    <Carousel.Item key={p.id} index={i} class="h-56" onClick$={() => open(p.id)}>
      <img src={p.image} alt={p.name} width={p.w} height={p.h} />
    </Carousel.Item>
  ))}
</Carousel.Root>

<Carousel.Root aria-label="Stories" variant="uncontained" snap>
  {stories.map((s, i) => (
    <Carousel.Item key={s.id} index={i} class="h-56 w-48">…</Carousel.Item>
  ))}
  <Carousel.ShowAll q:slot="footer" href="/stories/" />
</Carousel.Root>
```

`full-screen` needs a container with a height. On vertically scrolling pages M3 requires a way to
see every item without horizontal scrolling (not for full-screen): use the header arrow or
`ShowAll`, pointing at a page of all items.

## Where it differs from e-store

- e-store's Show all and header arrow open a built-in modal grid of the slides' images (and a
  lightbox); here they link to (or call) the caller's own page, as M3 describes ("opens a
  dedicated vertically-scrolling page").
- Tab at the first / last item is left to the browser (e-store searched the page for the next
  focusable element itself); Up / Down skip hidden and inert elements.
- `aria-label` is required (e-store defaulted to "Carousel", read as "Carousel carousel").
- Item states from M3 / material-web added: hover elevation level 1, the `outlined` item.
- Contained ends, `maxItemWidth` for multi-browse and hero, and reduced motion: see above.
- `contain: inline-size` on the root: the carousel never widens to its items (an `auto` grid
  track did).
- Logical properties throughout (e-store `pl-4`, `marginLeft`); arrows, swipe and wheel follow RTL.
- Our scrollbar shows on the scrolling layouts (e-store hid it by default).
- Fixed after the second agent's review (2026-11-23): collapsed items `inert` (e-store and our
  first draft left links inside them tabbable); a centred hero with fewer than three items; a swipe
  could stick on after the button was released outside the track, and a swipe ending on an item
  activated it; items added or removed are counted and laid out again; reduced motion and `goTo`
  scroll only the track (`scrollIntoView` moved the page too); fast arrow presses (focus moves
  first, then the layout); the current item in a scrolling layout is picked from every item's
  last visible ratio, not only the items in one callback; the outlined item's disabled outline;
  the live region; the label is a prop.

## Left out (e-store extras M3 does not have)

`single` variant; `autoPlay`, `loop` and the pause logic; indicators (`dot`, `thumbnail`,
`counter`, `scrollbar`, `arrows`) and `showArrows` / `arrowStyle` / `arrowReveal` /
`scrollbarLook` (M3: "Avoid adding UI elements, like arrows or other icons, within or beside the
carousel"); `fit`; `transition="fade"`; `scrollbar="hidden"`; `gutter` insets; video autoplay and
`VideoButton`; the lightbox; Item `variant` / `fit` / `stateLayer` / `clip` / `snap="center"`;
`--carousel-*` variables. All store.google.com or e-store app features.

e-store's `parallax` (items scaled and faded by distance from the centre, images panned) is also
left out: it is not the effect M3 shows (items masked as they change size), and M3's reduced-motion
rule removes it. Decision for the owner if he wants it back.

## Web standards

CSS scroll snap, `overscroll-behavior`, `scroll-behavior`, `contain: inline-size` (Chrome 105,
Safari 15.4, Firefox 101), ResizeObserver, IntersectionObserver, Pointer Events,
`prefers-reduced-motion`, `Element.checkVisibility()` (Chrome 105, Safari 17.4, Firefox 106),
`aria-live`.
