# Search

Material 3 search. Ported from e-store's `components/search/` (2026-11-23): the same parts,
prop names and context. Native `<dialog>` through our `Modal` instead of Qwik UI's HModal.

- M3: https://m3.material.io/components/search/specs , /guidelines (read in Chrome 2026-11-23)
- APG combobox: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

## Layouts (`Search.Root layout`)

| Layout                 | Below 600px                               | From 600px                                       |
| ---------------------- | ----------------------------------------- | ------------------------------------------------ |
| `fullscreen` (default) | Bar / Trigger open a full-screen dialog   | the same                                         |
| `docked`               | Bar is the input, the list drops below it | the same                                         |
| `adaptive` (new)       | the Trigger opens the full-screen view    | the Trigger expands into the docked Bar in place |

`adaptive` (owner, 2026-11-23: "the search icon button that opens to a search bar on large
screen"; M3: "Search suggestions or results should swap from full-screen in compact windows to
docked in larger breakpoints"). The app bar starts with the search ICON at every width:

- Below 600px a click opens the full-screen view (a `<dialog>`).
- From 600px a click expands the icon into the docked bar, focus in the input. Escape on the
  empty, closed field, or the input losing focus to anything outside the search while empty,
  collapses it back to the icon (Escape also returns focus to the icon). Choosing a result
  collapses it too and returns focus to the icon (2026-11-24: it fell to the body, as the
  focused input was hidden); both retry once per frame until the icon is shown again.
- State: `expanded` and `surface` in the context. Visibility is the component's own classes from
  that state (`hidden` / `max-sm:hidden` on the bar, `sm:hidden` on the expanded trigger, the
  list `max-sm:hidden`). The window width is read once, in the click handler
  (`matchMedia("(min-width: 600px)")`), never in render (L19).
- The input shows after Qwik's render, so the Trigger focuses it on the next frame, retrying up
  to 10 frames (`focusWhenShown`; our Menu also focuses on the next frame). A single
  `requestAnimationFrame` was not enough with a real click (Chrome, 2026-11-23).

e-store has no such expand. Its nearest pattern is app-level: `Layout.Root bind:searchOpen` puts
the app bar in "search mode" (back arrow, title "Search", a docked `Search.Root` in the pane,
trailing actions hidden), wired by the calendar app from an icon in its actions. Ours keeps it
inside `Search` because our `Layout` has no `searchOpen`; porting that is the alternative.

## Parts

| Part             | Element                                          | What                                  |
| ---------------- | ------------------------------------------------ | ------------------------------------- |
| `Search.Root`    | `<div role="search">`                            | State, ids, layout                    |
| `Search.Bar`     | `<button>` (fullscreen) or a `<div>` + `<input>` | The bar                               |
| `Search.View`    | `Modal` (`<dialog>`) and / or a docked `<div>`   | Holds the results (`role="listbox"`)  |
| `Search.Trigger` | `IconButton`                                     | M3's "search icon button" entry point |
| `Search.Item`    | router `<Link>` or `<div>`, `role="option"`      | One result (NEW, not in e-store)      |
| `Search.Group`   | `<div role="group">` + presentational heading    | Options under a heading (NEW)         |
| `q:slot="filters"` | projected above the listbox, in both surfaces  | A chip row (NEW)                      |

The View's children are projected into whichever surface is open; one `<Slot />` renders at a
time (Qwik keeps unprojected content: next.qwik.dev/docs/core/slots, "Unprojected content").

## API

`Search.Root`: `layout` (`fullscreen` | `docked` | `adaptive`, read once: change it with a `key`),
`bind:open`, `bind:query`, `keyboardShortcut` (`false`), `showOnEmpty` (`false`),
`...PropsOf<"div">` (give several roots an `aria-label` each: each is a `search` landmark).

- `keyboardShortcut` (from e-store, 2026-11-24): Cmd+K / Ctrl+K opens the search as its entry
  point would (docked: focus the bar; `adaptive` from 600px: expand and focus; else the
  full-screen view); pressed in the focused docked bar it selects the text. Two document
  listeners, as e-store's: a `sync$` prevents the browser's default only while a root with
  `data-keyboard-shortcut` is on the page, a `$` opens. DEFAULT `false` (e-store `true`): a page
  can hold several searches (the site's app bar and the Maps panel's), only one may answer.
- `showOnEmpty` (NEW): the view also opens with an empty query, for recent searches or
  suggestions (M3 search view: suggestions and recent searches before typing). Focusing the
  docked bar opens it at either size (otherwise `compact` opens on typing only); an empty view
  stays hidden (no option, no box).

`Search.Bar`: `placeholder` (`Search`; also the name without `aria-label`), `disabled`,
`aria-label`, `size` (`default` 56dp min 360px | `compact` 48dp), `name` (`q`), `inputId`,
`searchIcon` (`search`), `backIcon` (`arrow_back`), `backLabel` (`Close search`), `clearIcon`
(`close`), `clearLabel` (`Clear search`). Docked only: the back button shows while open at the
default size; the list opens on focus (default) or on typing (`compact`).

`Search.View`: `placeholder`, `name`, `resultsLabel` (`Results`, the listbox's name), `backIcon`,
`backLabel`, `clearIcon`, `clearLabel`, `class` (the list). Named slot `filters` (NEW,
2026-11-24): a `ChipGroup` of filter chips, rendered ABOVE the listbox in both the full-screen
dialog and the docked card, never inside it (a listbox may own only options and groups, and its
options are not focusable, so chips inside it were invalid and unreachable). It is a Tab stop
after the input (APG toolbar keys inside); a press keeps focus in the input, as on an option.
Nothing projected: no row (`not-has-[*]:hidden`).

`Search.Trigger`: `label` (`Search`; name and hover title), `searchIcon`, `onClick$`,
`...PropsOf<"button">`.

`Search.Group` (NEW): `label` (the heading; it names the group), `...PropsOf<"div">`. APG listbox
"grouped options": `role="group"` with `aria-labelledby` its heading (`role="presentation"`,
48dp, label-large, `on-surface-variant`: Dropdown's group label). Arrows run through every
group's options as one list.

`Search.Item` additions (NEW, 2026-11-24): `supportingText` (a second line: M3 two-line list
item, 72dp, body-medium `on-surface-variant`), `keepOpen` (choosing runs `onClick$` and leaves
the search open with its query: "See all"), `onRemove$` + `removeLabel` (`Remove`) +
`removeIcon` (`close`) (a trailing remove button for a recent search: not a Tab stop and
`aria-hidden`, since focus stays in the input; Delete on the highlighted row runs it, and the
option says so with `aria-keyshortcuts="Delete"`; `stoppropagation:click` keeps the press from
choosing the row), `disabled` (`aria-disabled`, not chosen: a "no results" line).

`Search.Item`: `label` (required), `href`, `icon` (`IconName`), `onClick$`. A `<div
role="option">` holding a real `<a href>` (copy, open in a new tab with a modified click). A
plain click or Enter runs `onClick$`, then navigates with the router's `useNavigate()` (a full
load for another origin), then closes the search and clears the query. It does not use the
router's `<Link>`: a Link runs `onClick$` BEFORE its own navigation handler, so closing first
unmounted the docked list and the detached link never navigated (Chrome, 2026-11-23).

## Keys and focus (focus stays in the input)

| Key            | Action                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| ArrowDown / Up | Moves the highlight (wraps); `aria-activedescendant` is the option's id  |
| Enter          | Chooses the highlighted option (and does not submit a surrounding form)  |
| Delete         | Removes the highlighted option, when it has `onRemove$`                  |
| Cmd/Ctrl+K     | Opens the search (`keyboardShortcut`); in the focused bar: selects text  |
| Escape         | Docked: closes the list, keeps focus; again: clears. Full screen: closes |
| Tab            | Docked: moving focus out of the search closes the list                   |

- Full screen: `showModal()` focuses the input (`autofocus`); every close (Back, Escape, scrim,
  choosing) returns focus to the control that opened it (HTML dialog close steps).
- One Escape closes the dialog: Chrome's first Escape in a `type="search"` field only clears it,
  so a `sync$` prevents Escape's default and the handler closes.
- Options are not focusable; the listbox's `onMouseDown$` is a `sync$` that prevents the
  default, so a press does not take focus from the input. FIXED 2026-11-24: it was a bare
  `preventdefault:mousedown` attribute, which qwikloader (rc.5) never reads unless SOME element
  on the page has a mousedown handler (it listens only to event types registered by a handler;
  defaults `click`, `input`). So a mouse press on a docked result inside a focusable ancestor
  (the supporting pane's `<aside>`) moved focus there, the Root's focus-out closed the list, the
  list unmounted before `mouseup` and the click never reached the option; Enter still worked.
  e-store's Search has no focus-out close (only the outside `pointerdown`) and no mousedown
  prevention, so a click there works but takes focus off the input. The highlighted option is `aria-selected="true"` and `data-highlighted`
  (APG list-autocomplete examples; Combobox's styling).
- The docked input's `aria-expanded` / `aria-controls` follow its list, which renders only while
  open with a query, and is hidden when it has no option.

## M3 tokens used

| Element                         | Value                                                      |
| ------------------------------- | ---------------------------------------------------------- |
| Bar                             | `surface-container-high`, full round, 56dp, 360-720px      |
| Bar padding                     | 24dp unfocused, 12dp focused                               |
| Full-screen view                | `surface-container-low`; its bar filled, 56dp              |
| Docked list                     | `surface-container-high`, min 240dp, max 2/3 of the window |
| Icons / supporting text / input | `on-surface-variant` / `on-surface-variant` / `on-surface` |
| Result row                      | M3 one-line list item, 56dp, 16dp padding                  |

## Proof (2026-11-23)

| Piece                                            | Status                                                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parts, prop names, context, keys (from e-store)  | PROOFED: APG combobox; Chrome (412px and 1280px, light and dark)                                                                                                                             |
| Adaptive layout                                  | PROOFED: m3 search guidelines, "Adaptive design"; Chrome                                                                                                                                     |
| Icon that expands into the bar (from 600px)      | Owner's requirement; NEW (e-store: app-level `searchOpen` only). Chrome at 1280px: click and Enter expand with focus in the input, docked list, choosing navigates, Escape and blur collapse |
| Item navigation (`useNavigate`)                  | PROOFED: router rc.5 `Link` source (handler order); Chrome (docked and full screen)                                                                                                          |
| Colors, 56dp bar, 360-720px, 240dp-2/3 docked    | PROOFED: m3 search specs (color roles, measurements)                                                                                                                                         |
| Bar padding 24 / 12dp                            | PROOFED: m3 search bar measurements. The focused-search table says 16dp: M3 contradicts itself                                                                                               |
| Full-screen bar inner padding (`ps-2 pe-2`)      | NOT PROOFED: 16dp to the icon glyph, read from the spec drawing, not measured                                                                                                                |
| Dialog focus and Escape                          | PROOFED: HTML dialog focusing / close steps; Chrome (one Escape closes, focus back on the icon)                                                                                              |
| `<Slot />` in one of two places                  | PROOFED: Qwik rc.5 slots doc; Chrome (results move between surfaces)                                                                                                                         |
| `useId`, `useOnDocument`, `sync$` handler arrays | PROOFED: installed `@qwik.dev/core` 2.0.0-rc.5 types                                                                                                                                         |
| `arrow_back` icon path                           | PROOFED: Google Fonts Material Symbols Outlined 24px SVG                                                                                                                                     |
| `Search.Item`                                    | NEW, not in e-store: owner to approve                                                                                                                                                        |
| `keyboardShortcut` (2026-11-24)                  | From e-store (its two-listener pattern); default off is ours. Chrome: Cmd+K from the body opens and focuses the docked bar; on /maps/ only the site's search answers                         |
| `showOnEmpty`, `filters`, `Search.Group`, Item `supportingText` / `keepOpen` / `onRemove$` / `disabled` (2026-11-24) | NEW, owner-approved (site search). PROOFED: APG listbox grouped options and combobox (focus stays in the input); M3 search view shows recent searches (m3.material.io/components/search/guidelines, from the 2026-11-23 reading; not re-read). Recent-search model from Algolia DocSearch (`stored-searches.ts`). Chrome 2026-11-24: mouse and keyboard, docked and full screen (390px), light / dark |

## Where it differs from e-store

- `layout="adaptive"` (new, owner's goal: "the search icon that turns into the search bar").
- `Search.Item` (new): e-store leaves rows to the consumer, with a private id scheme
  (`${resultsId}-item-${i}`) and no visual highlight.
- `useId()` for ids (e-store: a module counter that changes when Root re-renders).
- Highlight is state (`activeId` = the option's real id).
- Full-screen bar: M3's contained style, filled 56dp (e-store: outlined 64dp, the divided look).
- One Escape closes the full-screen view; Escape on a closed docked list clears it (APG); Tab out
  closes the docked list; Enter on a highlighted option does not submit a form; options are not
  focusable; an empty docked list is hidden.
- `Search.Trigger` takes `label` (our IconButton's), not `aria-label`; no `aria-haspopup` docked.
- Icons are `IconName` props.

- `keyboardShortcut` defaults to `false` (e-store `true`).
- NEW parts for the site search (2026-11-24): `showOnEmpty`, the `filters` slot, `Search.Group`,
  Item `supportingText`, `keepOpen`, `onRemove$`, `disabled`. e-store has none of them.

Left out (not needed yet): `look` (`elevated`, `outlined`), `fused`, size `dense`, the `leading`
and `trailing` slots, `onQueryChange$` (use `bind:query`), a docked scrim (M3 shows one), an
empty-results part (a `disabled` Item does that job).

Found 2026-11-24 (app side, Qwik rc.5): rows that the CALLER renders into the View re-render
when the caller's signal changes from a fetch, but did NOT when it changed from a row's own
remove button (they updated on the View's next render). Rendering those rows from their own
`component$` (which reads the signal) fixed it; see `apps/web/src/components/site-search.tsx`
`EmptyBox`.

Open: the docked Back button unmounts under focus, which falls to `<body>` (as e-store; M3 says
Back releases focus). An open full-screen view stays open if the window grows past 600px, and an
open docked list is hidden (not closed) below 600px; L18 closes sheets on a breakpoint change.

## Usage

The site's app bar search (`apps/web/src/components/site-search.tsx`), in short:

```tsx
<Search.Root layout="adaptive" keyboardShortcut showOnEmpty bind:query={query}>
  <Search.Trigger label="Search the site" />
  <Search.Bar size="compact" placeholder="Search the site" />
  <Search.View placeholder="Search the site">
    <ChipGroup q:slot="filters" label="Show results from">...filter chips...</ChipGroup>
    <Search.Group label="Posts">
      <Search.Item label="A post" supportingText="…snippet…" href="/feed/a/" icon="article" />
      <Search.Item label="See all 12" icon="arrow_forward" keepOpen onClick$={...} />
    </Search.Group>
  </Search.View>
</Search.Root>
```

```tsx
<Layout.AppBar>
  <Search.Root q:slot="pane" layout="adaptive" bind:query={query}>
    <Search.Trigger label="Search components" />
    <Search.Bar size="compact" placeholder="Search components" />
    <Search.View placeholder="Search components">
      {matches.map((page) => (
        <Search.Item key={page.href} label={page.label} href={page.href} />
      ))}
    </Search.View>
  </Search.Root>
</Layout.AppBar>
```
