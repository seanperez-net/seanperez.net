# Layout

The Material 3 scaffold as compound components on one grid. One `Layout.Root` per app.
https://m3.material.io/foundations/layout/scaffold/overview

## The regions: two rails, two panes

Every part is a direct child of the scaffold grid and sits on its own named track:

```
Rail | Drawer | Pane (primary) | SupportingPane | CompanionRail
```

| Part                    | Element    | What it is                                                                                 |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `Layout.Rail`           | `<nav>`    | The navigation rail, leading edge, full height. Its menu button controls the Drawer        |
| `Layout.Drawer`         | `<aside>`  | The rail's drawer (e-store's types: standard, floating, modal). None without `drawerItems` |
| `Layout.Pane`           | `<main>`   | The primary (main) pane: the page                                                          |
| `Layout.SupportingPane` | `<aside>`  | The second pane, beside the primary one                                                    |
| `Layout.CompanionRail`  | `<nav>`    | The trailing rail. Its buttons control the SupportingPane                                  |
| `Layout.AppBar`         | `<header>` | The top app bar, above the panes, from the rail's end to the far edge                      |
| `Layout.Footer`         | `<footer>` | Small print, in the bottom margin                                                          |

The rails are not inside the asides: each rail is a `<nav>` and the region it controls is the
`<aside>` next to it. Every part is optional except `Root` and `Pane`; a track with nothing in it
is 0px wide (a page with only an app bar, a pane and a footer just has margins).

## By window size

| Width      | Rail   | Drawer                                               | Supporting pane                                   | Companion rail |
| ---------- | ------ | ---------------------------------------------------- | ------------------------------------------------- | -------------- |
| under 600  | hidden | modal sheet (app bar button), every destination      | modal side sheet (its own opener, companion tabs) | hidden         |
| 600 and up | shown  | per `drawerType` (below); none without `drawerItems` | modal side sheet below 840, beside the pane above | shown          |

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
  pointer arrow. The color is e-store's choice, not an M3 role for a floating card.
- Docked (and the standard drawer): NO surface, corners or shadow. The drawer sits transparent on
  the scaffold's `surface-container`, like the rail, with a 4px end margin (`me-1`), and the
  primary pane starts at the track's end (no margin track). Sources, which agree: e-store
  `packages/ui/src/components/layout/layout.tsx` ~1874-1882 (docked: `relative me-1 min-h-0
min-w-0 overflow-hidden`; its comment: a tinted docked slab was rejected by the owner,
  2026-11-11) and the reference app on the recovered drive
  (`/Volumes/OS/Users/seanp/Desktop/work/vendure/packages/ui/src/components/layout/layout.tsx`
  1024-1036, the same classes). 2026-11-23: an earlier "colored when docked" note here was a
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
  shows the section's name as its FIXED header (see "The drawer's header" below; hidden from AT,
  its `<nav>` is named by the section). In the compact modal a section's name is a title-small headline
  row (e-store's `navDrawerSectionVariants.headline`), not a link, then its children.
- Reviewer fixes (2026-11-23): the card never closes under focus (rail mouse-leave and hovering
  another destination wait while focus is in it); the `<aside>` keeps `popover="manual"` docked
  too (classes undo the popover box), so the show / hide task never waits on the attribute;
  `onMouseLeave$`, `onFocusOut$`, `onClick$`, `document:onKeyDown$` given to `Layout.Rail` /
  `Layout.Drawer` run beside ours (arrays) instead of being replaced; `drawerType` follows its
  prop; following a link in the floating card closes it; no `aria-label` on the `<aside>`s (their
  `<nav>` is the named landmark); the app bar menu button sets `aria-controls` only when a modal
  drawer exists. Left as is: keyboard reach of the floating card is DOM order (after the rail's
  footer); the disabled rail button shows no tooltip (native `disabled` gets no pointer events). Opening the compact sheet focuses a control the open panel marks `data-autofocus` (a form's first field), else the selected tab, else the close button (2026-11-24, NEW). The icon-only companion rail buttons, its hide / show tab and the compact sheet opener use the M3 plain tooltip (`data-tooltip`, the `TooltipProvider` in Root), not a native `title` (2026-11-24); the compact sheet's tabs show their labels, so they have none.

- Docked is the visitor's CHOICE (e-store `layout.tsx` 1740-1795, `isDrawerDocked`, fixed
  2026-11-23 after the owner saw a rail click turn the docked drawer back into the floating one).
  Only the rail's menu button writes it; a rail click or a page change never does. Docked on a
  page outside every section, the nav track is 0px (no `data-nav`), nothing floats on hover, and
  the button still reads "Undock drawer"; back in a section the card is docked again. Only the
  600px breakpoint changes the drawer's form (the modal below it). Not persisted across reloads
  (`bind:drawerDocked` starts `false`), as e-store's.

- Groups inside a section (2026-11-24, ported from e-store's `DrawerButtonExpandable`,
  `navigation/nav-drawer-button.tsx`, for the Messages app's Google Chat sections): a child item
  with its own `items` is a GROUP, a row-sized `<button aria-expanded aria-controls>` with the
  label and an `expand_more` chevron that turns, then its rows, opening and closing with e-store's
  grid-rows transition (0fr to 1fr, 200ms standard easing, none under reduced motion). Rendered
  wherever a section's children are: the floating / docked card, the standard drawer and the
  compact modal. A group needs no `href` (`LayoutDrawerItem.href` is optional since then, as
  e-store's `NavItem.href?`). Current marking is recursive (`holds`): a page inside a group makes
  its section active (rail `current="section"`, the docked card). Differs from e-store: NEW
  `open` (start open; e-store opens only a group holding the page, which we also do); the closed
  rows are `inert` (e-store's stay in the Tab order at 0px); ids from `useId` (the docked and the
  modal drawer render the same groups); in the compact modal the group is inline, where e-store's
  modal drawer opens a level-1 item's children as a sub-pane with a back button (not ported). Not
  ported: e-store's per-row `badge` (unread counts would need the app's read state above
  `Layout.Root`).
- Type hierarchy (2026-11-24, owner: "there is no hierarchy on the typography"). Sources:
  m3.material.io/components/navigation-drawer/specs and /guidelines (read in Chrome 2026-11-24:
  rows 56dp, 28dp start padding, 12dp indicator inset; "Section label (optional)", "Dividers can
  be used to separate groups of destinations"); material-web v0_192 `_md-comp-navigation-drawer.scss`
  (headline = title-small on-surface-variant; label = label-large on-surface-variant; ACTIVE label
  weight = `label-large-weight-prominent`); Google Chat measured 2026-11-24 (e-store
  `.claude/reference/findings-from-seanperez-ui-port.md` 173: section headers 12px / 500 with a
  disclosure arrow, rows 28px). Title-small and label-large are both 14 / 20 / 500, so type size
  alone cannot rank a header above a row. What the drawer does:

  | Part                                                                                    | Role                                                             | Colour                                            | Height                             | Start                                                                           | Source                                                                                       |
  | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
  | Headline (section name; the floating / docked card's FIXED header, 64 since 2026-11-25) | `title-small`                                                    | `on-surface-variant`                              | 56 inline, 64 as the card's header | 28dp (label line)                                                               | M3 headline; e-store `navDrawerSectionVariants.headline`, `DrawerPanel` header (PORTED)      |
  | Group header (collapsible)                                                              | `label-medium` (12 / 16 / 500)                                   | `on-surface-variant`                              | 40                                 | 28dp                                                                            | Google Chat's 12px / 500; e-store `sm` density 40 (NEW for us: M3 has no collapsible header) |
  | Row                                                                                     | `label-large`                                                    | `on-surface-variant`                              | 56 (`--layout-drawer-row-height`)  | 28dp with its icon; 40dp without one in a section (e-store's 12px child indent) | M3 / material-web                                                                            |
  | Current row                                                                             | `label-large` bold (`--text-label-large-prominent--font-weight`) | `on-secondary-container` on `secondary-container` | 56                                 | as a row                                                                        | material-web `active-*`                                                                      |
  | Divider                                                                                 | `Separator` (`outline-variant`), 8dp above and below             |                                                   |                                    | full row width                                                                  | M3 guidelines; e-store `my-2`                                                                |

  Dividers: before a section and after it when more items follow (compact modal, standard
  drawer), and before every group but the first. A child row draws its own `icon` (since
  2026-11-24; Messages gives Shortcuts their icons and conversations `person` / `groups` /
  `smart_toy`). The old `data-nested:ps-13` (52dp, lined up with a parent icon that is never
  drawn) is gone. Row height stays M3's 56; Google Chat's 28 / e-store's 48 is an OWNER DECISION
  (a density option would be a `LayoutConfig` field). Checked in Chrome 2026-11-24 (apps/web
  1568px docked, 700 docked, 390 modal, light and dark; ui playground 390 modal).

- With no drawer items the rail's menu button is never shown open and is named `menuLabel`
  ("Open menu"), whatever dock choice a route with a drawer left behind (2026-11-24, second
  agent's finding: a site whose `drawerType` is `floating` read "Undock drawer" on a disabled
  button).
- ~~Drawer items PER ROUTE~~ (2026-11-24, withdrawn the same day): the site gave `drawerItems`
  only on `/messages/` routes, so hovering Messages floated nothing from Home, Contacts or Maps
  (owner: "it also stops the hover from working").
- The menu button follows the CURRENT page; hover follows the HOVERED destination (2026-11-24,
  owner: "only when your on a route or rail item that has a drawer items does the hamburger
  colapse become active and the hover / drawer works"). Give `drawerItems` the SAME full list on
  every route (e-store's model, rule L24); the Layout decides the rest:
  - `menuEnabled` (Root, context): floating, `!!activeSection` (the page is inside a destination
    with children); standard / modal, `hasDrawer` (that drawer lists everything on every page).
    Disabled, the button is the plain `menuLabel`, never shown open, native `disabled`.
  - `docked` (unchanged): `drawerDocked && activeSection`. The dock CHOICE (`drawerDocked`)
    persists across pages but docks only inside a section.
  - Hover / focus (`peekAt$`, `peekSection`) is blocked only while a section is actually DOCKED
    (`docked`), not by the choice. So on a page outside every section any destination with
    children floats its card, whatever the choice; inside a section with it docked, nothing floats
    (e-store's: hover never swaps the docked panel).
  - Differs from e-store (NEW, owner's request): e-store's button is enabled on every page
    (`nav-rail.tsx` 188-191 `hasDrawerChildren` looks at ALL drawer items) and reads Dock /
    Undock there; and with the choice docked on a page outside every section, e-store floats
    nothing on hover (`layout.tsx` 1697-1700 returns while `isDrawerDocked`). Ours: disabled
    there, and hover floats.
  - A click on a row in the floating card from another page navigates; on arrival the section
    docks if the choice is docked (the card hides and the same `<aside>` takes the nav track).
    Focus then falls to the body (the popover hid under it); not handled.
  - App side: `apps/web/src/routes/layout.tsx` `DRAWER_GROUPS` (rail `href` -> groups); /admin
    passes none. Checked in Chrome 2026-11-24 (site at 1000 / 700 / 390 in iframes, light and
    dark; playground Overview disabled, categories enabled).

## The drawer's header (2026-11-25, from e-store's `DrawerPanel`)

Owner, 2026-11-25: "the drawer should have its header so contacts stays static up there in all
the drawers including the floating there should be a pane header or drawer header make sure they
are similar and match the spec ... just needs to be added with the correct margin for the
scrollbars". Until then the section's name was the first row of the scrolling list.

- Floating and docked card: the section's name in a header row OUTSIDE the scroller
  (`drawerHeader`, `data-qds-drawer-header`), then the scrolling list. e-store's `DrawerPanel`
  (`layout.tsx` 1552-1592): a `pane-header-flex` header with the label in title-small
  on-surface-variant, then the scrolling `<nav class="scrollbar-pane flex-1 overflow-y-auto">`.
  Differs: no `Separator` under it (our pane header has none, and the two are to match); the
  header is on `layout-drawer-header-rulers` (title on the rows' 28dp label line, M3 drawer).
- Matches the pane header: the same height (`--layout-pane-header`, 64dp) and the same top, so
  the drawer's title and the primary pane's title share one centre line (measured in Chrome
  2026-11-25 at 1697px on /contacts/: both headers 64-128px, both titles centred at 96px). The
  TYPE differs on purpose: the drawer's headline is M3's title-small (navigation drawer specs,
  material-web `headline-*`), the pane's title is title-large (M3 pane header). Owner may want one
  role for both: ask.
- Scrollbar: the list's track starts AT the header's edge (`--scrollbar-track-margin-start: 0`)
  and keeps 20dp at the end (the card's rounded corner), as a pane's track starts below its
  sticky header (`.scrollbar-pane:has(> .pane-header-bleed)`). No top inset: the 64dp header is
  the inset (the old 12dp `pt` is gone). The compact modal's list does the same under its own
  fixed bar (`Modal.CloseTitleAction`, 64dp, "Menu" + the close button), which it already had.
- Not changed: the compact modal and the standard drawer list EVERY destination, so their
  section names stay inline headlines between dividers (they scroll); only the modal's bar is
  fixed. Sticky section headlines there are an owner question (PLAN.md).
- Checked in Chrome 2026-11-25: docked Contacts (1697px) scrolled 40px, the header stayed, rows
  clipped at its edge, thumb starting at it; floating Contacts card hovered from Home; docked
  Messages in a 1000px iframe; compact modal in a 390px iframe (bar 0-64, list from 64, track
  margin 0). Light theme not checked (no colour changed).

## The rail's FAB (2026-11-24, ported from e-store)

`Layout.Rail fab` (JSX): e-store's `Layout.Rail fab` / `NavRail fab` (`layout.tsx` ~1030-1075,
`navigation/nav-rail.tsx` ~360-375; used by e-store `apps/master` for "New project"). A box above
the destinations (`py-3`, centred in the icon column, `data-layout-rail-fab`), the JSX rendered
through `freshJsx` as e-store does (the Qwik rc JSX-prop bug, `utils/jsx-prop.ts`). M3, read
2026-11-24 at m3.material.io/components/navigation-rail/guidelines: "The menu icon and FAB should
always be top-aligned"; a FAB nested in the rail rests at elevation level 0 (the box sets the FAB's
shadow to none, level 1 on hover: ours). FAB guidelines (same date): lower end corner in compact
and medium windows, the rail in expanded ones. The rail is hidden below 600px, so the page puts its
own FAB in its pane there (the site: `components/app-action.tsx`). Not ported: e-store's extended
FAB in the expanded rail (no expanded rail here).

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

| Part                    | Props                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Layout.Root`           | `LayoutConfig` (below), `bind:drawerOpen?`, `bind:drawerDocked?` (both start `false`), `bind:supportExpanded?`, `bind:activeCompanion?`, `bind:trailShown?`, ids (`mainId`, `drawerId`, `railId`, `supportId`, `trailId`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Layout.AppBar`         | `title`, `menuButton?` (default: `Layout.Root drawer`), `menuLabel?`; actions in the slot                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `Layout.Rail`           | `menuLabel?`, `closeMenuLabel?`, `dockLabel?`, `undockLabel?`, `menuIcon?`, `menuOpenIcon?`, `fab?` (JSX), `aria-label?`; slot: more `Layout.RailItem`s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `Layout.RailItem`       | `icon`, `label`, `current?`, plus `<a>` props (`href`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Layout.Drawer`         | `header?` (modal title), `closeLabel?`, `closeIcon?`, `panelLabel?`; rows from `drawerItems` (no slot)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Layout.Pane`           | `role="primary"`, `bleed?` (full-bleed content such as a map: no insets, no scroll; e-store's, ported 2026-11-23); slot: a `Layout.PaneHeader` and ONE body element                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Layout.PaneHeader`     | `title`, `headingLevel?` (2), `titleId?` (the heading's `id`, for `aria-labelledby` on the region it titles; `id` is the `<header>`'s, which holds the actions too, NEW 2026-11-24), `fullscreen?` / `fullscreenLabel?` (a `FullscreenButton` on the pane's `<main>` after the actions, NEW 2026-11-24, see below), `backHref?` / `backLabel?` ("Back") / `backIcon?` ("arrow_back"): a link `IconButton` before the title, marked `data-pane-header-back` (FROM E-STORE `pane-header.tsx`, 2026-11-24); `hideTitle?` (false): the heading stays for screen readers only and a spacer keeps the actions at the end, as Google Contacts' person page (NEW 2026-11-24, owner); `subtitle?` (a line under the title, M3 app bar subtitle: label-medium, on-surface-variant, the bar stays 64dp) and `leading?` (JSX between Back and the title: an avatar or logo), both NEW 2026-11-25, see "Pane header: subtitle, leading, title width"; actions in the slot |
| `Layout.SupportingPane` | `header`, `closeLabel?`, `closeIcon?`, `companionTabsLabel?` (`"Companion apps"`), `showLabel?` (`"Show side panel"`), `showIcon?`; slot: ONE body element; named slot `header-actions` (FROM E-STORE, 2026-11-25): the open companion's actions in the title row, before Close (the site's Contact me "More" menu)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Layout.CompanionRail`  | `apps?: { id, label, icon, emphasis? }[]` (default `Layout.Root companions`; `emphasis`: see "An emphasized companion"), `hideButton?` (true), `hideLabel?`, `showLabel?`, `aria-label?`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Layout.SupportToggle`  | `icon`, `label`, `app?`, `onToggle$?`: opens the supporting pane from anywhere                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Layout.DrawerItem`     | `current?`, `nested?`, plus `<a>` props: a drawer row (router `Link`) for rows a host renders itself                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `Layout.MenuButton`     | `label?`, `closeLabel?`, `icon?`, `openIcon?`: opens the modal drawer (the app bar's, below 600px)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Layout.Footer`         | slot. Optional: the site does not render it (owner 2026-11-24: an app layout has no site footer in M3); without it the bottom row is only the margin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## List-detail: `Layout.ListDetail` (NEW 2026-11-24, not in e-store as a part)

M3's list-detail canonical layout as TWO PANES
(m3.material.io/foundations/layout/canonical-layouts/list-detail and /breakpoints/expanded, read
2026-11-24: "A list-detail layout uses two panes", a 360dp fixed pane, "The spacer between panes
is 24dp"; one pane on compact, the back button only in single-pane detail view, a selection state
only in two-pane, a placeholder in the detail pane until something is chosen).

```tsx
<Layout.Pane role="primary" bleed aria-label="Contacts">
  <Layout.ListDetail view={id ? "detail" : "list"} fab={<AppFab />}>
    <Layout.ListPane aria-labelledby="t">
      <Layout.PaneHeader title="Contacts (2)" titleId="t" />
      <div>{/* ONE body: a List.Root rovingFocus, or an EmptyState */}</div>
    </Layout.ListPane>
    <Layout.DetailPane bleed?>
      <Layout.PaneHeader title="Name" backHref="/contacts/" />  {/* + ONE body */}
    </Layout.DetailPane>
  </Layout.ListDetail>
</Layout.Pane>
```

- The part is the bleed primary pane's one root; the primary pane turns transparent
  (`[data-pane="primary"]:has(> [data-qds-list-detail])`, `layout.css`), so the two panes are two
  `surface` cards with `--layout-pane-radius` on the scaffold, `--layout-pane-spacer` between.
- Two panes from a 43rem CONTAINER width (`@container/list-detail`), list fixed at
  `--layout-pane-fixed` (360px, e-store's token name). Below it, `view` (from the URL, rule L19)
  picks the one pane shown. The container is the primary pane, so a docked drawer and an open
  supporting pane push two-pane mode to a wider window (Contacts with both open: about 1430px).
- `[data-pane-header-back]` (the PaneHeader back link, or any element carrying the attribute)
  is hidden in two-pane mode by the container query.
- `fab`: the compact FAB, at the list pane's lower end corner, below 600px and in list view only
  (from 600px it is the rail's).
- Each pane is a `layout-pane-rulers` scroller (`scrollbar-pane`); `DetailPane bleed` for a
  detail that scrolls itself (a chat transcript with a pinned composer).
- `panes="one"` (NEW 2026-11-25, owner: Contacts had "an extra pane" next to Google's): ONE pane
  at every width, the one `view` names, the back arrow always shown (`layout.css`). Google Contacts
  measured 2026-11-25: the list is its own page, a person replaces it with a back arrow. Contacts
  uses it; Messages keeps the default `two`.
- Playground: `/list-detail/`. Used by Contacts and Messages in `apps/web`.
- e-store's apps (chat, contacts) split ONE pane with a border; its gallery shows two surfaces
  with `gap-(--layout-pane-spacer)`. We took the two surfaces (M3's text). NOT PROOFED by the owner.

An app's drawer sections (Contacts' Frequent, Trash, labels) are plain `LayoutDrawerItem` data in
the app's `DRAWER_GROUPS` entry (`apps/web/src/routes/layout.tsx`); each is a route. A dialog
reached from the drawer is a route too (rows are links): `/contacts/import/`.

## Pane full screen (NEW 2026-11-24, not in e-store)

`Layout.PaneHeader fullscreen` ends the header with a `FullscreenButton` (e-store's, cut to any
element; `fullscreen-button.md`) whose target is the primary pane's `<main>`. Opt-in per page: the
site uses it on Contacts. e-store's layout has no pane maximise or full screen (checked
2026-11-24), so this is new; the button is e-store's.

- The pane in full screen: the UA box (fixed, inset 0, 100%), `bg-surface`, square corners
  (`[&:fullscreen]:rounded-none` in `pane`).
- No button where the browser cannot (iPhone, a refusing iframe). No button on the supporting
  pane: below 840px it is a showing popover, which the Fullscreen spec's ready check refuses, and
  a second agent advised against a desktop-only one (2026-11-24). Panes without a header (Home,
  Maps) have none; the map has MapLibre's own control instead (one button per action).
- Overlays: see `fullscreen-button.md`.

## Opening a companion from the page: `openCompanion` (NEW 2026-11-24, not in e-store)

`openCompanion(layout, id, opener?)`, exported beside `layoutContextId`: from a page's own
control (a list row), open the supporting pane on companion `id` the way the companion rail's
buttons do. It notes `opener` for focus to return to when the sheet (below 840px) closes, and
opens the sheet even when `supportExpanded` is already true (setting the signals by hand does
neither). Browser only, in an event handler: `const layout = useContext(layoutContextId)`, then
`openCompanion(layout, "contact", element)`. Used by `/contacts/` on the site.

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
The navigation drawer's modal sheet is a `<dialog>`; the supporting pane's is a `popover="manual"`
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
  drawerItems={[
    { href: "/", label: "Components", icon: "widgets", items: pages },
  ]}
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

| `Layout.Root` prop | Type                        | Read by                                                                                                                                                                                                   |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`            | `string`                    | `Layout.AppBar`                                                                                                                                                                                           |
| `titleHref`        | `string`                    | `Layout.AppBar`                                                                                                                                                                                           |
| `activeHref`       | `string`                    | `Layout.Rail`, `Layout.Drawer` (the current item)                                                                                                                                                         |
| `railItems`        | `LayoutRailItem[]`          | `Layout.Rail` (each item's optional `prefetchBundles`, NEW 2026-11-24, goes to its `Link` and to the compact drawer's row for it)                                                                         |
| `drawerTitle`      | `string`                    | `Layout.Drawer` (the modal drawer's title)                                                                                                                                                                |
| `drawerItems`      | `LayoutDrawerItem[]`        | `Layout.Drawer`, `Layout.Rail` (none: no drawer)                                                                                                                                                          |
| `drawerType`       | `modal\|standard\|floating` | `Layout.Drawer`, `Layout.Rail` (e-store's)                                                                                                                                                                |
| `drawer`           | `auto\|off`                 | `Layout.AppBar`, `Layout.Drawer` (compact modal)                                                                                                                                                          |
| `themeToggle`      | `boolean \| "rail"`         | `Layout.Rail` footer, `Layout.AppBar` below 600px; `"rail"`: the rail footer, and below 600px the compact drawer's footer (`ThemeToggle look="full"`), never the app bar (e-store's L7, owner 2026-11-24) |
| `layoutMode`       | `default\|compact`          | the scaffold (`data-layout-mode`: margins, spacer, corners)                                                                                                                                               |
| `companions`       | `LayoutCompanion[]`         | `Layout.CompanionRail`, `Layout.SupportingPane`                                                                                                                                                           |
| `sourceColor`      | `string` (hex)              | the theme (see `theme-changer.md`)                                                                                                                                                                        |
| `colorMode`        | `light\|dark\|auto`         | the theme                                                                                                                                                                                                 |

State props: `bind:drawerOpen`, `bind:drawerDocked`, `bind:supportExpanded`, `bind:activeCompanion`,
`bind:trailShown`, `bind:color`, `bind:mode`.

## Motion: slide, not reflow (2026-11-24, NEW, not in e-store)

Owner, 2026-11-24: scrollbars appeared and vanished while the drawer, panes and groups animated,
and the drawer's text re-wrapped as it grew; "it looks nicer also if the text looks like its
sliding out of the drawer not apearing in the drawer as it grows".

M3 (read in Chrome 2026-11-24): transition patterns, "Beyond screen bounds" (navigation drawer,
sheets): components "slide on and off screen without changing shape"; "Coplanar sheets shrink the
available area for content" (so the primary pane reflowing as its track narrows is expected);
"A nav drawer enters from the left helping users understand where it's located when it's off
screen". Navigation drawer guidelines: "Don't wrap label text", and "When a navigation drawer
animates on screen, it uses an enter and exit transition pattern". Durations and easing are
unchanged: the scaffold's tracks 300ms (`medium-2`) Standard, groups 200ms (`short-4`) Standard.

e-store (read 2026-11-24): its docked drawer animates its own `width` (300ms) with
`overflow-hidden`; its panels are `absolute inset-0`, so they reflow too; no `scrollbar-gutter`,
no fixed-width content, and its docked drawer also disappears at once on close. Nothing to port.

How (`layout.css` "Slide, not reflow"):

- `layout-slide` on the region in the track (the docked / standard drawer, the supporting pane
  from 840px): `overflow: clip`. It clips like `hidden` but is not a scroll container (MDN
  `overflow`; Chrome 90, Firefox 81, Safari 16), so no scrollbar and nothing a focused row can
  scroll sideways.
- `layout-slide-content` on its one content box (the drawer card, the supporting pane's panel):
  `inline-size` = `min-` = `max-inline-size` = `--layout-slide-size`, the region's final width
  (drawer: `--layout-drawer-panel-width` less the 4px `me-1`; pane: `--layout-support-expanded`).
  The scroller inside never narrows: no horizontal bar, no reflow.
- It rides on the moving edge: the drawer's card on the track's END (`justify-end`), so it slides
  out from behind the rail; the supporting pane's panel on its START, so it slides in from beside
  the companion rail. Logical alignment, so right-to-left mirrors (checked in Chrome).
- From 840px the panel, not the `<aside>`, is the pane's `surface` with the pane radius, so the
  rounded surface slides in whole.
- Exits keep the content while the track closes:
  - Drawer: `LayoutDrawer`'s `inTrack` stays true (with the docked section in `trackSection`)
    until the scaffold's `grid-template-columns` transition ends (`afterTrackTransition`:
    `getAnimations()` after two frames, a 450ms timeout, at once when nothing runs, e.g. reduced
    motion). The scaffold's `data-nav` follows `docked` at once. Meanwhile the `<aside>` is
    `data-closing` and `inert`. Re-docking mid-exit cancels it (task `cleanup`). Leaving the
    docked section by a link plays the same exit with that section's rows.
  - Supporting pane from 840px: always laid out (`md:flex`), hidden while collapsed with
    `visibility`, transitioned over the track's 300ms. Visibility interpolates as visible until
    the end (CSS Transitions), in every engine, so no `display` / `overlay` discrete transition
    (rule L26; Firefox cannot transition `display`, MDN BCD). Hidden, it leaves the focus order
    and the accessibility tree.
  - `close$` clears `activeCompanion` (which the app's slot content follows) only after the exit:
    from 840px after the track transition, below 840px by the sheet's `toggle` after
    `closeAnimated` (before, the sheet slid out empty).
- Groups: the row wrapper is `overflow: clip` (no scroll container), and the drawer's scroll body
  (`drawerBody`, also the floating card and the compact modal) has `scrollbar-gutter: stable`
  (Tailwind `scrollbar-gutter-stable`; MDN: Chrome 94, Firefox 97, Safari 18.2; no effect with
  overlay scrollbars), so a group opening past the drawer's height no longer makes every row jump
  8px when the bar comes. Cost: with a classic bar the rows' end inset is 20px, not 12px, even
  while the list fits (owner to decide, see PLAN.md).
- Reduced motion: no transition anywhere (the scaffold's guard, `md:motion-reduce:` and
  `max-md:motion-reduce:` variants, the latter added because Tailwind sorts a breakpoint variant
  after `motion-reduce:`, so the compact sheet still slid).

Measured in Chrome (rAF samples, 1000px window, before -> after): docking the Messages drawer, a
horizontal bar on the drawer's list for 5 frames and a row 161 -> 204px wide -> no bar, the row
204px every frame and moving 42 -> 100px from behind the rail; undocking, gone in one frame ->
slides out over 300ms; opening the supporting pane, a horizontal bar for 4 frames and its content
33 -> 264px wide -> no bar, content and title constant (320 / 224px); collapsing a group, the bar
toggling mid-animation and rows 212 <-> 204px -> rows 204px throughout. Modal drawer and sheet
(390px): already slid at a fixed width; the drawer's bar now there from the first frame.
NOT PROOFED: Safari / iOS and Firefox (the owner's devices), reduced motion run live (rule order
read from the stylesheet).

## Surfaces and elevation

| Region                                | Color role                                                                 | Elevation      |
| ------------------------------------- | -------------------------------------------------------------------------- | -------------- |
| Scaffold, app bar, navigation rail    | `surface-container`                                                        | 0              |
| Panes (primary, supporting)           | `surface`                                                                  | 0              |
| Drawer card, floating (from 600px)    | `--layout-drawer-bg` (`surface-container-low`), the pane radius, e-store's | 2 (`shadow-2`) |
| Drawer, docked / standard             | none: transparent on the scaffold (e-store, reference app)                 | 0              |
| Drawer, modal (below 600px)           | `surface-container-low` (`Modal`)                                          | 1 (`shadow-1`) |
| Supporting pane as a modal side sheet | `surface-container-low`                                                    | 1 (`shadow-1`) |
| Companion rail                        | transparent                                                                | 0              |
| "Show side panel" tab (rail hidden)   | `surface-bright`                                                           | 1 (`shadow-1`) |
| Menus (the account menu)              | `surface-container`                                                        | 2 (`shadow-2`) |

Levels are Material 3's: modal navigation drawer and modal side sheet level 1, menu level 2.

`--field-bg` (the patch an outlined field's floated label paints over its outline) follows each
fill: the `bg-surface*` utilities in `tokens/utilities.css` set it, and a part whose fill comes
from a responsive variant sets it beside the fill (the supporting pane: `md:[--field-bg:...]`
with `md:bg-surface`, `max-md:` on the sheet and its header). Rule: any container with its own
fill sets `--field-bg` to that fill (see `text-field.md`).

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

## An emphasized companion: `LayoutCompanion.emphasis` (NEW 2026-11-24, not in e-store)

Owner, 2026-11-24: the site's "Contact me" must stand out from the other companions. One
companion can carry `emphasis: "primary" | "tonal"`; unset keeps the rail's own colours. It is
data on the companion (serialisable, a CMS can store it), drawn by the `emphasis` variant of the
`companionPill` slot, in the rail AND in the compact sheet's tab row (the pane header shows only
the title, the compact opener only its own `showIcon`, so neither needs it).

| `emphasis` | Resting pill / icon                              | Selected (`aria-pressed` / `aria-selected`)      |
| ---------- | ------------------------------------------------ | ------------------------------------------------ |
| unset      | none / `on-surface-variant`                      | `secondary-container` / `on-secondary-container` |
| `primary`  | `primary-container` / `on-primary-container`     | `primary` / `on-primary`                         |
| `tonal`    | `secondary-container` / `on-secondary-container` | `secondary` / `on-secondary`                     |

PROOFED 2026-11-24, read in Chrome: m3.material.io/components/navigation-rail/specs (active
indicator `secondary-container`, icon `on-secondary-container`, inactive `on-surface-variant`);
/components/floating-action-button/specs (default FAB colours `primary-container` /
`on-primary-container`: the rail's FAB, so `primary` at rest reads as the rail's one emphasized
action); /components/icon-buttons/specs (filled toggle selected `primary` / `on-primary`; tonal
default `secondary-container` / `on-secondary-container`, tonal toggle selected `secondary` /
`on-secondary`; state layers hover 8%, focus 10%, pressed 10%). The state layer of an
emphasized pill is its content colour (`before:bg-current`). All pills now also show focus and
pressed layers (`opacity-focus`, `opacity-pressed`); the 2px `secondary` focus outline stays.

`tonal` at rest is the same colour as an unset companion's SELECTED pill: prefer `primary`.
Measured in Chrome 2026-11-24 (`primary`, default source colour): icon on pill, light 13.28:1
resting / 6.42:1 selected, dark 7.22:1 / 7.7:1 (M3 asks 3:1). The resting pill against the
rail's `surface-container` is only 1.11:1 in light (1.76:1 dark): the icon carries the contrast,
the pill is a tint. Name and tooltip are the companion's `label`, unchanged.

## Hide / show side panel

`Layout.CompanionRail` renders ONE fixed button at the bottom end (`hideButton`, `hideLabel`,
`showLabel`): a 40dp circle while the rail shows; with the rail hidden, a tab on the viewport
edge that peeks 24px and slides out on hover or focus. Hiding the rail closes the supporting pane.

## Compact screens: the opener and the companion tabs (2026-11-23)

Ported from e-store (`layout.md` "Companion tabs in the compact sheet (owner 2026-11-20)" and
"Focus returns to the opener (2026-11-20)"; `layout.tsx` `LayoutSupportingPane`,
`companion-rail.tsx` `CompanionTabs`).

- Below 840px the supporting pane has no track. `Layout.SupportingPane` is ONE
  `<aside popover="manual">` (`"auto"` until 2026-11-24): from 840px a pane in the support track
  (the browser's popover box is reset by classes), below 840px an M3 modal side sheet on the end
  edge, in the top layer, with `::backdrop` as the 32% scrim. Escape and a press on the scrim are
  ours since 2026-11-24 (`markSheetDismiss`, a `sync$`, then `dismiss$`): a `popover="auto"`
  closes itself on them at once and uncancellably (HTML light dismiss), which skipped the exit
  animation. Escape is left to a menu or dialog open inside the sheet. The press is read on the
  document: a press on a popover's `::backdrop` is NOT hit-tested to the popover (Chrome
  2026-11-24: it landed on the scaffold), unlike a dialog's. It replaced a `position: fixed`
  aside, a scrim `<div>` and the root's own Escape handler.
- Sheet motion (2026-11-24, as `Modal position="right"`, see `modal.md` "Motion"): in from the
  end edge, 500ms Emphasized; out, 200ms Emphasized, played with `data-closing` while it is
  still open and only then `hidePopover()` (`closeAnimated`); scrim linear, same durations;
  mirrored in right-to-left; none under reduced motion. Crossing 840px with the sheet open
  hides it at once. PROOFED in Chrome (rAF samples): out by Escape and by a scrim press at 700px,
  200ms, in the top layer to the last frame, `inert` cleared and focus back on the opener. NOT
  PROOFED: Safari / iOS, right-to-left, reduced motion live.
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
  end, peeking 24px until hovered or focused like the rail's tab and hidden while the sheet is
  open (`sheetTrigger`, owner 2026-11-23). It opens the active companion, or the first.
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

## Each app's side panel: the supporting pane follows the route (2026-11-24)

Owner (2026-11-24): the rail holds the site's apps and each app brings its own side panel. No
library change: the app's ONE `Layout.Root` (rule L2) passes `companions` for the current route
and renders the pane's content by `activeCompanion` (`apps/web/src/routes/layout.tsx`).

- Mechanism, from e-store's UI gallery (`packages/ui/src/routes/layout.tsx`: one `Layout.Root`,
  the supporting pane's content chosen from `useLocation().url.pathname`, its `/bleed/` demo).
  e-store's backend instead gives every app its own `Layout.Root`
  (`apps/backend/src/routes/apps/(apps)/<app>/layout.tsx`); not taken (contradicts L2, and the
  rail would remount on every app switch). A route rendering its own `Layout.SupportingPane`
  was also rejected (review agent): the sheet's `inert` on the other regions would outlive an
  `<aside>` unmounted while open, and `supportId` would remount per navigation.
- Client navigation with the pane open switches it to the new route's panel (a `useTask$` on
  the route's panel id); a closed pane stays closed. A panel outside the route's list (the
  account menu's "Theme colors..." on `/maps/`) can still be opened: pass `header` yourself,
  since the pane's default title is the open companion's label FROM THE LIST.
- PROOFED 2026-11-24, read in Chrome: m3.material.io/foundations/layout/canonical-layouts/supporting-pane
  ("Use the supporting pane layout when the secondary content is only meaningful in relation to
  the primary content"; beside the focus pane from Expanded, fixed 360dp; below it in compact /
  medium, where "a bottom sheet can be useful"); m3.material.io/components/side-sheets/guidelines
  (standard side sheets hold "a list of actions that affect the screen's primary content, such as
  filters"; modal side sheets "preferred in compact breakpoints"). The Map panel (map style) fits
  both. Home has NO panel (2026-11-24): its Theme panel moved to the account menu's theme dropdown
  (`AccountMenu themeColors`; owner: "if its in the menu it should be a menu not go into the
  pane"), and site-wide theme controls are not "about" Home's content anyway. A route with no
  panel passes `companions={[]}`, renders no `Layout.CompanionRail`, and an open pane closes on
  the way there (the pane stays mounted, so its sheet takes `inert` off on close).
  m3.material.io/foundations/layout/canonical-layouts/list-detail read the same day: not
  applicable (no parent-child content).
- Contact (owner, 2026-11-24): its OWN companion on every route, after the route's own panels
  ("you can add more rail items to change the sub pane"), so the companion rail now shows on
  every route. When a route change drops the open companion (the Map panels leaving /maps/), the
  pane switches to the new route's first one; Contact stays open across routes. The pane has no
  `header`: it titles itself with the open companion's label.
- NOT PROOFED: M3 puts the compact / medium supporting pane BELOW the focus pane; ours stays a
  modal side sheet below 840px (see "Compact screens").

### Overlay app bar: NOT ported (2026-11-24)

e-store's `Layout.AppBar look="overlay"` (its `layout.css` "Overlay app bar", used by
`packages/maps`) was studied for `/maps/` and left out: its selectors assume a wrapper around
the bar (ours is the grid item itself), its bar carries a floating search pill with its own
surface (ours is a bare title and an avatar, unreadable over tiles without one), the map's
top-end controls would sit under the avatar, and no M3 page describes a transparent top app bar
(floating over content is M3's search bar). Revisit if Maps gets a search pill.

## Pane header: subtitle, leading, title width (NEW 2026-11-25, not in e-store)

Owner's decision 2026-11-25: the M3 app bar's subtitle and an avatar on `Layout.PaneHeader`, so
Messages' conversation header (Back, avatar, name, "Space · 3 members", actions) is the library's
header and not hand-built (rule H5 in `.claude/rules/m3-hierarchy.md`).

```tsx
<Layout.PaneHeader
  title="Site updates"
  titleId="t"
  subtitle="Space · 3 members"
  leading={<ChatAvatar person={p} />}
  backHref="/messages/"
>
  <IconButton icon="info" label="Conversation details" />
</Layout.PaneHeader>
```

- Order: Back, `leading`, then the title block (title over subtitle), then the slot's actions,
  then `fullscreen`.
- PROOFED 2026-11-25, m3.material.io/components/app-bars/specs read in Chrome: anatomy lists
  container, leading button, trailing elements, headline, SUBTITLE; "App bars can be customized to
  include: An image or logo, A subtitle, A filled icon button"; token set "App bar - Size - Small":
  container 64dp, `md.comp.app-bar.small.title.font` 22/28 weight 400 (title-large),
  `md.comp.app-bar.small.subtitle.font` 12/16 weight 500 tracking 0.5 (label-medium); colour roles
  headline on-surface, subtitle on-surface-variant; "Small with subtitle" keeps the small bar.
  `leading` as an AVATAR after Back is Google Chat's (HOUSE); M3 names an image or logo.
- Title width: the title (`paneTitle`, and the title block) truncates with an ellipsis and keeps a
  minimum of 6rem (`min-w-24`, about seven title-large characters). Before 2026-11-25 it was
  `min-w-0` and collapsed to one letter at about 1000px with the drawer docked and the side panel
  open (the pane was 272px). Actions that do not fit are the HOST's to move into an overflow
  menu (M3 app bars: trailing actions that do not fit go into an overflow menu); the library does
  not hide them. Messages does it by the pane's container width (`messages-thread.tsx`).
- `hideTitle` with `subtitle`: both are screen-reader only.
