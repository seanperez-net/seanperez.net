# Layout

The Material 3 scaffold as compound components on one grid. One `Layout.Root` per app.
https://m3.material.io/foundations/layout/scaffold/overview

## The regions: two rails, two panes

Every part is a direct child of the scaffold grid and sits on its own named track:

```
Rail | Drawer | Pane (primary) | SupportingPane | CompanionRail
```

| Part                    | Element    | What it is                                                                                      |
| ----------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `Layout.Rail`           | `<nav>`    | The navigation rail, leading edge, full height. Its menu button controls the Drawer             |
| `Layout.Drawer`         | `<aside>`  | The rail's drawer (e-store's types: standard, floating, modal). None without `drawerItems`      |
| `Layout.Pane`           | `<main>`   | The primary (main) pane: the page                                                               |
| `Layout.SupportingPane` | `<aside>`  | The second pane, beside the primary one                                                         |
| `Layout.CompanionRail`  | `<nav>`    | The trailing rail. Its buttons control the SupportingPane                                       |
| `Layout.AppBar`         | `<header>` | The top app bar, above the panes, from the rail's end to the far edge                           |
| `Layout.Footer`         | `<footer>` | Small print, in the bottom margin                                                               |

The rails are not inside the asides: each rail is a `<nav>` and the region it controls is the
`<aside>` next to it. Every part is optional except `Root` and `Pane`; a track with nothing in it
is 0px wide (a page with only an app bar, a pane and a footer just has margins).

## By window size

| Width      | Rail   | Drawer                                                       | Supporting pane                                   | Companion rail |
| ---------- | ------ | ------------------------------------------------------------ | ------------------------------------------------- | -------------- |
| under 600  | hidden | modal sheet (app bar button), every destination              | modal side sheet (its own opener, companion tabs) | hidden         |
| 600 and up | shown  | per `drawerType` (below); none without `drawerItems`         | modal side sheet below 840, beside the pane above | shown          |

## The drawer and the rail's menu button (2026-11-23, ported from e-store)

From e-store's `nav-rail.tsx` (`handleMenuTrigger$`), `nav-root.tsx` (`drawer` mode, drawer items)
and `layout.tsx` (`LayoutDrawer`, `LayoutDrawerFloating`). Owner's rules (2026-11-23): no rail
expansion; no drawer when there are no drawer items; the rail's menu button always stays.

- No `drawerItems`: nothing is rendered from 600px, and the rail's menu button stays on show but
  is a native `disabled` button (Tab skips it, a click does nothing, no `aria-expanded`). e-store
  instead resolves its `auto` trigger to "expand the rail"; the owner rejected that here.
- `drawerType="standard"`: the rail's button opens and closes the drawer in the scaffold's nav
  track (from 600px), listing every drawer item and their children.
- `drawerType="modal"` (default, e-store's): the same, because e-store's rail button turns a
  modal drawer into the standard one (`drawerType.value = 'standard'`).
- `drawerType="floating"` (e-store's Component Gallery): a card beside the rail with the children
  of the rail destination whose `href` matches a drawer item with `items`, shown while that
  destination is hovered or focused, with e-store's chat-bubble pointer arrow at it. A
  `popover="manual"` in the top layer, opened from a `useTask$` (no eager JavaScript). It closes
  when the pointer leaves rail and card, when focus leaves both (ours; e-store only on Escape), and
  on Escape from anywhere (focus inside goes back to the destination). Tab reaches it after the
  rail's last control (it follows the rail in the page). The rail's button ("Dock drawer" /
  "Undock drawer") docks it: the current section's card then sits in the nav track.
- Below 600px, always: the app bar's menu button (e-store's `drawer="auto"`, `Layout.Root drawer`)
  opens the modal drawer (`<dialog>`, `Modal position="left"`) with `drawerItems`, or the rail
  items when there are none (e-store's `navDrawerItems` fallback), children as indented rows.
  Leaving 600px upwards closes it.
- Floating: a card on e-store's `--layout-drawer-bg` (`surface-container-low`), with the panes'
  corners (`--layout-pane-radius`, below) and `shadow-2` (e-store: an ad-hoc shadow), plus the
  pointer arrow. The colour is e-store's choice, not an M3 role for a floating card.
- Docked (and the standard drawer): NO surface, corners or shadow. The drawer sits transparent on
  the scaffold's `surface-container`, like the rail, with a 4px end margin (`me-1`), and the
  primary pane starts at the track's end (no margin track). Sources, which agree: e-store
  `packages/ui/src/components/layout/layout.tsx` ~1874-1882 (docked: `relative me-1 min-h-0
  min-w-0 overflow-hidden`; its comment: a tinted docked slab was rejected by the owner,
  2026-11-11) and the reference app on the recovered drive
  (`/Volumes/OS/Users/seanp/Desktop/work/vendure/packages/ui/src/components/layout/layout.tsx`
  1024-1036, the same classes). 2026-11-23: an earlier "coloured when docked" note here was a
  misread instruction and is withdrawn.
- M3 for reference, read 2026-11-23 at https://m3.material.io/components/navigation-drawer/specs
  (token table): modal container `surface-container-low`, elevation 1dp; standard container
  `surface`, elevation 0dp; container shape 16dp on the trailing corners, 0 elsewhere; width
  360dp. The drawer is "no longer recommended" in M3 Expressive. The floating card is not an M3
  component; the owner chose e-store's look over M3 here.

- Current item (2026-11-23, owner: "two things selected"): ONE `aria-current="page"`, on the
  drawer row of the page. A rail destination whose drawer item holds the page among its children
  is drawn as current (pill and bold label, `data-current`) but announced `aria-current="true"`
  (WAI-ARIA: the current item in a set), `NavigationRail.Item current="section"`. e-store marks
  that parent `aria-current="page"` too (its `isActive`); we do not. The floating / docked card
  has no heading: its `<nav>` is named by the section, and the rail label above it already says
  which section it is (e-store's card shows `section.label` in title-small; the owner called the
  repeat "components twice"). In the compact modal a section's name is a title-small headline
  row (e-store's `navDrawerSectionVariants.headline`), not a link, then its children.
- Reviewer fixes (2026-11-23): the card never closes under focus (rail mouse-leave and hovering
  another destination wait while focus is in it);  the `<aside>` keeps `popover="manual"` docked
  too (classes undo the popover box), so the show / hide task never waits on the attribute;
  `onMouseLeave$`, `onFocusOut$`, `onClick$`, `document:onKeyDown$` given to `Layout.Rail` /
  `Layout.Drawer` run beside ours (arrays) instead of being replaced; `drawerType` follows its
  prop; following a link in the floating card closes it; no `aria-label` on the `<aside>`s (their
  `<nav>` is the named landmark); the app bar menu button sets `aria-controls` only when a modal
  drawer exists. Left as is: keyboard reach of the floating card is DOM order (after the rail's
  footer); the disabled rail button shows no tooltip (native `disabled` gets no pointer events).

- Docked is the visitor's CHOICE (e-store `layout.tsx` 1740-1795, `isDrawerDocked`, fixed
  2026-11-23 after the owner saw a rail click turn the docked drawer back into the floating one).
  Only the rail's menu button writes it; a rail click or a page change never does. Docked on a
  page outside every section, the nav track is 0px (no `data-nav`), nothing floats on hover, and
  the button still reads "Undock drawer"; back in a section the card is docked again. Only the
  600px breakpoint changes the drawer's form (the modal below it). Not persisted across reloads
  (`bind:drawerDocked` starts `false`), as e-store's.

Not ported from e-store: the expanded rail (`railMenuTrigger="expand"`), density, icons-only
rail, the drawer resize sash, `panelContent`, sub-pane navigation inside the modal drawer, the
fade transition of the floating card.

Panes are square and edge to edge under 600px, and have 28px corners and 24px margins from 600px.
The scaffold is the height of the window and does not scroll; each pane scrolls inside itself.

## Layout mode and the pane radius (2026-11-23, ported from e-store as is)

Owner: "the drawer should match ... the same as the panes ... if its compact its tighter".

- `--layout-pane-radius` (`tokens/layout/layout.css`), from e-store
  `packages/ui/src/tokens/layout/layout.css` lines 1181-1199: `0px` below 600px, `--radius-xl`
  (28px) from 600px, `--radius-lg` (16px) in `[data-layout-mode="compact"]`. The primary pane,
  the supporting pane (from 840px), the floating drawer card and
  `Card rounded="pane"` all read it, so their corners always match. e-store's `data-pref-rounded`
  user preferences are not ported.
- `Layout.Root layoutMode="default" | "compact"` (e-store's prop, `data-layout-mode` on the
  scaffold). Compact, from e-store lines 460-467: `--layout-margin` is the compact 16px at every
  width, `--layout-pane-spacer: 16px`, `--scrollbar-track-margin: 8px`. Not ported: its
  `--layout-scaffold-bottom` override (e-store's `@theme` froze that row at 24px; ours reads
  `var(--layout-margin)` on the scaffold, so it follows) and its `--layout-item-*` density tokens
  and Item density switch (our Item does not read them).
- Measured in Chrome 2026-11-23 (playground, 1681px window, the `layoutMode` knob in the Theme
  companion): default: panes and the card 28px; compact: panes, the supporting pane and the
  card 16px, pane spacer 16px (the docked drawer to pane gap is 0 since the change below); below 600px
  (412px iframe): `--layout-pane-radius` 0px in both modes, pane square and full width.

## API

| Part                    | Props                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Layout.Root`           | `LayoutConfig` (below), `bind:drawerOpen?`, `bind:drawerDocked?` (both start `false`), `bind:supportExpanded?`, `bind:activeCompanion?`, ids           |
| `Layout.AppBar`         | `title`, `menuButton?` (default: `Layout.Root drawer`), `menuLabel?`; actions in the slot                                                                  |
| `Layout.Rail`           | `menuLabel?`, `closeMenuLabel?`, `dockLabel?`, `undockLabel?`, `menuIcon?`, `menuOpenIcon?`, `aria-label?`; slot: more `Layout.RailItem`s              |
| `Layout.RailItem`       | `icon`, `label`, `current?`, plus `<a>` props (`href`)                                                                                                     |
| `Layout.Drawer`         | `header?` (modal title), `closeLabel?`, `closeIcon?`, `panelLabel?`; rows from `drawerItems` (no slot)                                                     |
| `Layout.Pane`           | `role="primary"`; slot: a `Layout.PaneHeader` and ONE body element                                                                                         |
| `Layout.PaneHeader`     | `title`, `headingLevel?` (2); actions in the slot                                                                                                          |
| `Layout.SupportingPane` | `header`, `closeLabel?`, `closeIcon?`, `companionTabsLabel?` (`"Companion apps"`), `showLabel?` (`"Show side panel"`), `showIcon?`; slot: ONE body element |
| `Layout.CompanionRail`  | `apps: { id, label, icon }[]`, `aria-label?`                                                                                                               |
| `Layout.SupportToggle`  | `icon`, `label`, `app?`, `onToggle$?`: opens the supporting pane from anywhere                                                                             |
| `Layout.MenuButton`     | `label?`, `closeLabel?`, `icon?`, `openIcon?`: opens the modal drawer (the app bar's, below 600px)                                                         |
| `Layout.Footer`         | slot                                                                                                                                                       |

## State and context

`Layout.Root` owns all layout state and is the only provider of `layoutContextId`
(ids, `config`, `drawerType`, `drawerOpen`, `drawerDocked`, `hoveredRailHref`, `peek`, `hasDrawer`,
`activeSection`, `docked`, `drawerModalOpen`, `supportExpanded`, `trailShown`, `activeCompanion`).
State goes up: keep a signal in the app when the app needs it, bind it into the root, and every
part reads and writes it through context. No part keeps its own copy.

The root turns the state into data attributes on the scaffold (`data-nav`, `data-support`), and
CSS turns those into track sizes, so the server-rendered page is laid out before JavaScript runs.

A supporting pane that starts expanded covers a phone screen as a sheet: leave `supportExpanded`
false at the start unless the app only runs on wide windows.

## ARIA and keys

Landmarks: `<nav>` (both rails, named), `<header>`, `<main>`, `<aside>` (drawer and supporting
pane, named by their `header`), `<footer>`. A skip link to the primary pane is the first focusable
element. The menu buttons carry `aria-controls` and `aria-expanded` (the rail's: the drawer;
the app bar's: the modal drawer, `${drawerId}-modal`; none while disabled); the companion buttons carry
`aria-controls` and `aria-pressed`. Escape closes a modal sheet, and so does a click on its scrim.
The navigation drawer's modal sheet is a `<dialog>`; the supporting pane's is a `popover="auto"`
made modal by setting `inert` on the scaffold's other regions while it is open (see "Compact
screens" below). Both move focus in and give it back to the control that opened them.

## Styles

Grid placement and the inner grids are CSS utilities in `tokens/layout/layout.css`
(`layout-scaffold`, `scaffold-rail`, `scaffold-nav`, `scaffold-appbar`, `scaffold-body`,
`scaffold-support`, `scaffold-trail`, `scaffold-footer`, `layout-appbar-rulers`,
`layout-pane-rulers`, `pane-header-bleed`, `layout-rail-rulers`); sizes are tokens in
`tokens/layout/layout-tokens.css`. `layoutVariants` (tv) applies them and adds surface, shape and
type.

## Usage

Pages use props only: no `q:slot`, no classes on the parts.

```tsx
const supportExpanded = useSignal(false);
const activeCompanion = useSignal<string | null>(null);

<Layout.Root
  title="My app"
  activeHref={location.url.pathname}
  railItems={[{ href: "/", icon: "widgets", label: "Components" }]}
  // A section with children: the floating card on hover / focus of "Components".
  drawerItems={[{ href: "/", label: "Components", icon: "widgets", items: pages }]}
  drawerType="floating"
  themeToggle
  companions={[{ id: "about", label: "About", icon: "info" }]}
  bind:supportExpanded={supportExpanded}
  bind:activeCompanion={activeCompanion}
>
  <Layout.Rail />
  <Layout.Drawer />
  <Layout.AppBar />
  <Layout.Pane role="primary">
    <Layout.PaneHeader title="Page" />
    <div>...</div>
  </Layout.Pane>
  <Layout.SupportingPane header="About">
    <div>...</div>
  </Layout.SupportingPane>
  <Layout.CompanionRail />
  <Layout.Footer>...</Layout.Footer>
</Layout.Root>;
```

## Built from other components

`Layout.AppBar` is a `TopAppBar` and `Layout.Rail` is a `NavigationRail` (see their own docs):
the layout parts add only the scaffold placement and the menu button. `Layout.RailItem` is
`NavigationRail.Item`.

## Data props and context (for a CMS)

`Layout.Root` takes the scaffold's content as plain serialisable data (`LayoutConfig`) and puts
it in the layout context as `config`; every part reads it there. A part's own prop wins.

| `Layout.Root` prop | Type                 | Read by                                             |
| ------------------ | -------------------- | --------------------------------------------------- |
| `title`            | `string`             | `Layout.AppBar`                                     |
| `titleHref`        | `string`             | `Layout.AppBar`                                     |
| `activeHref`       | `string`             | `Layout.Rail`, `Layout.Drawer` (the current item)   |
| `railItems`        | `LayoutRailItem[]`   | `Layout.Rail`                                       |
| `drawerTitle`      | `string`             | `Layout.Drawer` (the modal drawer's title)          |
| `drawerItems`      | `LayoutDrawerItem[]` | `Layout.Drawer`, `Layout.Rail` (none: no drawer)    |
| `drawerType`       | `modal\|standard\|floating` | `Layout.Drawer`, `Layout.Rail` (e-store's)  |
| `drawer`           | `auto\|off`          | `Layout.AppBar`, `Layout.Drawer` (compact modal)    |
| `themeToggle`      | `boolean`            | `Layout.Rail` footer, `Layout.AppBar` below 600px   |
| `layoutMode`       | `default\|compact`   | the scaffold (`data-layout-mode`: margins, spacer, corners) |
| `companions`       | `LayoutCompanion[]`  | `Layout.CompanionRail`, `Layout.SupportingPane`     |
| `sourceColor`      | `string` (hex)       | the theme (see `theme-changer.md`)                  |
| `colorMode`        | `light\|dark\|auto`  | the theme                                           |

State props: `bind:drawerOpen`, `bind:drawerDocked`, `bind:supportExpanded`, `bind:activeCompanion`,
`bind:trailShown`, `bind:color`, `bind:mode`.

## Surfaces and elevation

| Region                                | Colour role                                    | Elevation      |
| ------------------------------------- | ---------------------------------------------- | -------------- |
| Scaffold, app bar, navigation rail    | `surface-container`                            | 0              |
| Panes (primary, supporting)           | `surface`                                      | 0              |
| Drawer card, floating (from 600px)    | `--layout-drawer-bg` (`surface-container-low`), the pane radius, e-store's | 2 (`shadow-2`) |
| Drawer, docked / standard             | none: transparent on the scaffold (e-store, reference app) | 0     |
| Drawer, modal (below 600px)           | `surface-container-low` (`Modal`)              | 1 (`shadow-1`) |
| Supporting pane as a modal side sheet | `surface-container-low`                        | 1 (`shadow-1`) |
| Companion rail                        | transparent                                    | 0              |
| "Show side panel" tab (rail hidden)   | `surface-bright`                               | 1 (`shadow-1`) |
| Menus (the account menu)              | `surface-container`                            | 2 (`shadow-2`) |

Levels are Material 3's: modal navigation drawer and modal side sheet level 1, menu level 2.

## Insets are grid tracks

No layout part has a side padding or a margin. Every inset and gap is a TRACK of a ruler grid in
`tokens/layout/layout.css`, sized by a token in `layout-tokens.css`:

| Grid                          | Tracks                                                                     |
| ----------------------------- | -------------------------------------------------------------------------- |
| `layout-appbar-rulers`        | inset, leading, 12, title, 20, pane, 8, trailing, inset (`appbar-*` place) |
| `layout-pane-rulers`          | inset, content, 8 (`action-end`, the header's close button), rest of inset |
| `layout-drawer-header-rulers` | 28, title, action, 20                                                      |
| `layout-drawer-rulers`        | 12, rows, 12                                                               |
| `layout-footer-rulers`        | margin, content, margin                                                    |
| `layout-trail-rulers`         | an 8px top row, then one row per button                                    |

A 40px icon button at a bar's edge sits in a track that reaches 8px into the margin
(`--layout-icon-button-overhang`), so its 24px icon is on the margin line. What is left as
padding is INSIDE a control (a drawer row's 16px, the skip link's pill), which is the control's
own shape, not layout. The app bar's controls never move: its end inset does not change when
the drawer, the supporting pane or the companion rail opens or closes.

## Hide / show side panel

`Layout.CompanionRail` renders ONE fixed button at the bottom end (`hideButton`, `hideLabel`,
`showLabel`): a 40dp circle while the rail shows; with the rail hidden, a tab on the viewport
edge that peeks 24px and slides out on hover or focus. Hiding the rail closes the supporting pane.

## Compact screens: the opener and the companion tabs (2026-11-23)

Ported from e-store (`layout.md` "Companion tabs in the compact sheet (owner 2026-11-20)" and
"Focus returns to the opener (2026-11-20)"; `layout.tsx` `LayoutSupportingPane`,
`companion-rail.tsx` `CompanionTabs`).

- Below 840px the supporting pane has no track. `Layout.SupportingPane` is ONE
  `<aside popover="auto">`: from 840px a pane in the support track (the browser's popover box is
  reset by classes), below 840px an M3 modal side sheet on the end edge, in the top layer, with
  `::backdrop` as the 32% scrim. Escape and a press on the scrim are the browser's (light dismiss).
  It replaced a `position: fixed` aside, a scrim `<div>` and the root's own Escape handler.
- `supportExpanded` is the one state. Below 840px a `useTask$` on it opens or closes the sheet
  (its first run is on the server, so a pane rendered expanded never pops up on load); the
  sheet's `toggle` event writes it back (Escape, scrim) and clears `activeCompanion`, as the close
  button does. Crossing 840px upwards closes the sheet and the pane stays expanded beside the
  primary pane; crossing downwards with the pane expanded collapses it.
- Modal: while the sheet is open every other child of the scaffold is `inert` (the rest of the
  page leaves the tab order and the accessibility tree; the scrim blocks the pointer). Opening
  moves focus to the sheet's first control on show (the selected tab, else the close button).
  Closing gives it back to the control that opened it, recorded by the click handlers (Safari does
  not focus a clicked button, so `document.activeElement` was `<body>` there); not when the sheet
  closed because the window grew past 840px. A press on the scrim leaves focus where the pointer
  put it.
- The pane is named by its heading (`aria-labelledby`).
- The rail's buttons and `Layout.SupportToggle` decide "open or close" from what is on show (the
  sheet below 840px, the state from 840px), so a pane rendered expanded on a narrow window opens
  on the first click instead of needing two.
- Below 600px, where the companion rail is hidden, the pane renders its own opener (driven by
  `Layout.Root companions`, no page markup): the rail's "Show side panel" tab, fixed at the bottom
  end, shown whole (`sheetTrigger`, `sm:hidden`). It opens the active companion, or the first.
  `aria-controls` = the pane, `aria-expanded` = the sheet is open.
- With two or more companions the sheet starts with a tab row (`[data-layout-companion-tabs]`,
  `sm:hidden`): `role="tablist"` named by `companionTabsLabel`, one `role="tab"` per companion
  (the rail's pill over a `label-medium` label), `aria-selected`, `aria-controls` = the panel, a
  roving tab stop (the selected tab, else the first), arrows / Home / End move focus
  (`utils/roving-focus.ts`), Enter / Space choose (manual activation). Choosing keeps the sheet
  open. The panel below is `role="tabpanel"`, `aria-labelledby` = the selected tab, only while
  the tab row is on show (the sheet open below 600px); from 600px it is a plain pane.
  With one companion there is no tab row (the playground has one: "Theme").

Where it differs from e-store:

- Side sheet at every width below 840px; e-store uses a bottom sheet below 600px. M3 allows both
  (see the proof). Owner to decide; kept the side sheet as the smaller change.
- The opener is the rail's own collapsed tab (no new look), fixed, at the bottom end; e-store's is
  an `IconButton look="elevated"` in a `popover="manual"` shown by a `useVisibleTask$` on every
  page load. Ours needs no eager JavaScript.
- The panel is a `tabpanel` labelled by its tab while the tabs show (APG requires it; e-store's
  CompanionTabs has none).
- The sheet is modal (`inert` on the rest); e-store's popover is not. The opener is recorded by
  the click handlers, and focus goes to the first control, not the bare sheet.
- One element (`<aside popover>`) instead of e-store's aside (`display: contents`) wrapping a
  popover `<div>`: we have no resize handle or toggles inside the aside to keep out of the sheet.
- No `compactSheet={false}`, no squeezed-pane sheet from 840px (`data-support-sheet`).

Proof:

- PROOFED 2026-11-23, m3.material.io/components/side-sheets/guidelines (read in Chrome): "Modal
  side sheets are preferred in compact breakpoints, like mobile"; they "must be dismissed in
  order to interact with the underlying content"; a close icon button "is highly recommended".
- PROOFED 2026-11-23, m3.material.io/components/bottom-sheets/guidelines: modal bottom sheets
  are "used in mobile apps only" and a bottom sheet "can be swapped for a side sheet" on larger
  screens, so e-store's bottom sheet is also allowed; neither page requires it.
- PROOFED 2026-11-23, m3.material.io/components/navigation-rail/guidelines: no rail in compact
  windows ("Compact windows should always use a navigation bar"), which is why the companion rail
  is hidden below 600px and the sheet needs its own way to switch apps.
- PROOFED 2026-11-23, WAI-ARIA APG tabs pattern (w3.org/WAI/ARIA/apg/patterns/tabs): roles,
  `aria-selected`, `aria-controls`, `tabpanel` + `aria-labelledby`, roving tab stop, arrow keys,
  manual activation with Enter / Space.
- PROOFED 2026-11-23, installed Qwik 2.0.0-rc.5: `popover?: 'manual' | 'auto'` on HTML attributes
  and `CorrectedToggleEvent` (`newState`) in `core-internal.d.ts`; `onToggle$` on a popover already
  used by `Menu`. Tailwind 4.3.5 `open:` is `:is([open], :popover-open, :open)` (`dist/lib.js`).
- PROOFED in Chrome 2026-11-23: `inert` on the other regions while open (12 of 12 siblings),
  removed on close; focus to the close button on open and back to the opener on Escape.
- OPEN: the sheet is announced as "complementary", not as a dialog (`<aside>` may not take
  `role="dialog"`: ARIA in HTML). A `<dialog>` cannot be both the in-grid pane and the sheet: a
  closed dialog shown from 840px is still a dialog, and a Qwik `<Slot/>` projects once, so the
  body cannot be in two elements. Not checked in a screen reader.
- OPEN: the opener tab is `position: fixed` over the bottom end of the primary pane and the footer
  (z-index under the top layer) and uses physical `right-0` / `rounded-r-none` (L10). Not checked
  at 360px.
- Run in Chrome 2026-11-23 inside same-origin iframes of 412, 700 and 1280px (the window would
  not resize): opener, Escape, close button, scrim, focus return, `inert`, rail from 600px,
  crossing 840px both ways, dark mode, the tab row with a temporary second companion, no console
  errors.
  NOT run on a phone or in Safari / Firefox.
