import {
  $,
  Slot,
  component$,
  isServer,
  sync$,
  useComputed$,
  useContext,
  useContextProvider,
  useId,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { JSXOutput, PropsOf, QRL, Signal } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { PrefetchStrategy } from "@qwik.dev/router";
import { tv } from "tailwind-variants/lite";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { freshJsx } from "../../utils/jsx-prop";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { FullscreenButton } from "../fullscreen-button";
import { IconButton } from "../icon-button";
import { Modal } from "../modal";
import { NavigationRail } from "../navigation-rail";
import type { NavigationRailRootProps } from "../navigation-rail";
import { RippleProvider } from "../ripple/ripple";
import { Separator } from "../separator";
import { ThemeToggle } from "../theme-toggle";
import { TooltipProvider } from "../tooltip/tooltip-provider";
import { TopAppBar } from "../top-app-bar";
import type { TopAppBarProps } from "../top-app-bar";
import { rovingKeys } from "../../utils/roving-focus";
import {
  CLOSING_ATTR,
  closeAnimated,
  openPopover,
} from "../../utils/top-layer";
import { useThemeProvider } from "../../theme/theme-context";
import type { ThemeProps } from "../../theme/theme-context";
import { layoutContextId } from "./layout-context";
import type {
  LayoutCompanion,
  LayoutConfig,
  LayoutContextValue,
  LayoutDrawerItem,
  LayoutDrawerType,
} from "./layout-context";

/**
 * The Material 3 scaffold. https://m3.material.io/foundations/layout/scaffold/overview
 *
 * Two rails, two panes, all direct children of ONE grid (`layout-scaffold`, in
 * `tokens/layout/layout.css`), each on its own named track:
 *
 *   Rail | Drawer | Pane (primary) | SupportingPane | CompanionRail
 *
 *   Rail             <nav>    the navigation rail, leading edge. Its menu button opens and
 *                             closes the Drawer.
 *   Drawer           <aside>  the rail's drawer, docked beside it, under the app bar.
 *   Pane             <main>   the primary pane: the page.
 *   SupportingPane   <aside>  the second pane, beside the primary one.
 *   CompanionRail    <nav>    the trailing rail. Its buttons open and close the SupportingPane.
 *
 * The AppBar runs above the panes, from the rail's end to the far edge; the Footer sits in the
 * bottom margin. Grid placement comes from the `scaffold-*` utilities, the inner grids from the
 * `layout-*-rulers` utilities; the classes here add only surface, shape and type.
 */
export const layoutVariants = tv({
  slots: {
    root: [
      "layout-scaffold",
      "bg-surface-container",
      "font-plain",
      "text-body-large",
      "text-on-surface",
    ],
    skipLink: [
      "fixed",
      "top-3",
      "left-4",
      "z-(--z-scaffold-skip)",
      "translate-y-[-200%]",
      "rounded-full",
      "bg-primary",
      "px-6",
      "py-2.5",
      "text-label-large",
      "text-on-primary",
      "shadow-3",
      "focus:translate-y-0",
    ],
    // `TopAppBar` and `NavigationRail` bring their own styles; these only place them.
    appBar: ["scaffold-appbar", "z-(--z-scaffold-app-bar)"],
    // Below 600px only, where there is no rail: the menu button and the theme switch.
    appBarMenu: ["sm:hidden"],
    appBarTheme: ["sm:hidden"],
    rail: ["scaffold-rail", "z-(--z-scaffold-rail)", "max-sm:hidden"],
    // e-store's rail FAB box (`nav-rail.tsx` `data-qds-nav-rail-fab`: `py-3`, centred in the icon
    // column). M3: a FAB nested in the rail rests at elevation level 0 (navigation rail
    // guidelines, read 2026-11-24); level 1 on hover (ours: the FAB's own one-step rise).
    railFab: [
      "flex",
      "w-full",
      "shrink-0",
      "items-center",
      "justify-center",
      "py-3",
      "[&_[data-qds-fab]]:shadow-none",
      "[&_[data-qds-fab]]:hover:shadow-1",
      "[&_[data-qds-fab]]:focus-visible:shadow-none",
      "[&_[data-qds-fab]]:active:shadow-none",
    ],

    // e-store's floating drawer (`Layout.Drawer`, `drawerType="floating"`): the sub-navigation of
    // a rail destination with children, from 600px. Floating: a `popover="manual"` card beside the
    // rail while that destination is hovered or focused, with a pointer arrow at it. Docked (the
    // rail's menu button): the same card in the scaffold's nav track, for the current section.
    // The outer box carries no surface (it holds the card and the arrow); the browser's popover
    // box (inset, margin, border, padding, Canvas) is reset here.
    drawer: [
      "group/drawer",
      "scaffold-nav",
      "hidden",
      "m-0",
      "border-0",
      "p-0",
      "bg-transparent",
      "overflow-visible",
      "text-on-surface",
      // Docked, from 600px: a grid item in the nav track.
      // The `<aside>` keeps `popover="manual"` docked too (only its classes change): an author
      // `display` beats the browser's closed-popover `display: none`, and these undo the popover
      // box (fixed, inset 0, fit-content size).
      "sm:data-[docked=true]:flex",
      "data-[docked=true]:static",
      "data-[docked=true]:size-auto",
      "data-[docked=true]:min-h-0",
      // e-store's and the reference app's `me-1`: 4px before the primary pane.
      "data-[docked=true]:me-1",
      "data-[docked=true]:min-w-0",
      // Slide, not reflow (`layout.css` "Slide, not reflow", NEW 2026-11-24): the track clips a
      // card of the final width (the track less the 4px `me-1`), riding on the track's moving END
      // edge, so the rows slide out from behind the rail instead of re-wrapping at each width.
      "data-[docked=true]:layout-slide",
      "data-[docked=true]:justify-end",
      "data-[docked=true]:[--layout-slide-size:calc(var(--layout-drawer-panel-width)-var(--spacing))]",
      // Floating, from 600px: shown while open (a bare `flex` would show the closed popover).
      "sm:data-[docked=false]:open:flex",
      "data-[docked=false]:fixed",
      "data-[docked=false]:inset-auto",
      "data-[docked=false]:w-(--layout-drawer-panel-width)",
      "data-[docked=false]:h-[calc(100dvh-var(--layout-app-bar-height)-var(--layout-margin))]",
    ],
    // The card: e-store's `--layout-drawer-bg`, floating with a shadow (ours: level 2, as a menu).
    drawerCard: [
      "relative",
      "z-10",
      "flex",
      "min-h-0",
      "w-full",
      "flex-1",
      "flex-col",
      "overflow-hidden",
      "group-data-[docked=true]/drawer:layout-slide-content",
      // Floating only: the card, with the pane's corners (`--layout-pane-radius`, `layout.css`).
      // Docked it has NO surface, corners or shadow: it sits on the scaffold's surface beside
      // the rail, as e-store's (`layout.tsx` ~1874-1882) and the reference app's (vendure
      // `layout.tsx` 1024-1036) docked drawer (owner 2026-11-23).
      "group-data-[docked=false]/drawer:rounded-(--layout-pane-radius)",
      "group-data-[docked=false]/drawer:bg-(--layout-drawer-bg)",
      "group-data-[docked=false]/drawer:shadow-2",
    ],
    // e-store's chat-bubble pointer: a 12px square turned 45deg, half under the card's edge.
    drawerArrow: [
      "absolute",
      "-inset-s-1.5",
      "z-0",
      "size-3",
      "rotate-45",
      "bg-(--layout-drawer-bg)",
      "shadow-2",
    ],
    // The floating / docked card's list: 12dp from the card's top edge, as from its sides.
    // Under its fixed header (2026-11-25): no top inset (the 64dp header is the top inset, as a
    // pane's header is), and the scrollbar track starts AT the header's edge, as a pane's does
    // (`.scrollbar-pane:has(> .pane-header-bleed)` gives a pane the header's height; here the
    // header is outside the scroller, so the start margin is 0). The end keeps the 20dp margin
    // off the card's rounded corner.
    drawerCardBody: ["[--scrollbar-track-margin-start:0px]"],
    // The standard drawer has no header: 12dp from its top edge, as from its sides.
    drawerStandardBody: ["pt-(--layout-drawer-inset)"],
    // The drawer's HEADLINE (M3 navigation drawer anatomy "Headline", material-web v0_192
    // `headline-*` = title-small, `headline-color` = on-surface-variant, read 2026-11-24): a
    // section's name above its children in the compact modal drawer and the standard one
    // (e-store's `navDrawerSectionVariants.headline`). Not a link. The floating / docked card's
    // section name is its fixed header since 2026-11-25 (`drawerHeader`).
    // On the rows' label line: 12dp inset + 16dp row padding = M3's 28dp left padding.
    drawerSection: [
      "flex",
      "h-14",
      "items-center",
      "ps-(--layout-drawer-row-inset)",
      "text-title-small",
      "text-on-surface-variant",
    ],
    // M3 guidelines (navigation-drawer, read 2026-11-24): "Dividers can be used to separate
    // groups of destinations" (full width, `outline-variant`). Between a section and its
    // siblings and before every group but the first: spacing and dividers carry the grouping,
    // not indentation. 8dp above and below (e-store's `navDrawerSectionVariants.divider` `my-2`).
    drawerDivider: ["my-2"],
    // A group of rows inside a section (e-store's `DrawerButtonExpandable`,
    // `navigation/nav-drawer-button.tsx`): a disclosure button with the label and a chevron,
    // then its rows, opening and closing with e-store's grid-rows transition (0fr to 1fr, 200ms
    // standard easing = M3 short4; none with reduced motion).
    // Its OWN look since 2026-11-24 (owner: "there is no hierarchy on the typography"): a
    // section label, not a destination. Google Chat's measured section headers (12px / 500, a
    // disclosure arrow; e-store `findings-from-seanperez-ui-port.md` 173) = M3 `label-medium`,
    // in `on-surface-variant`, 40dp high (e-store's `sm` row density), on the rows' label line.
    // M3 has no collapsible section header; its nearest part (the drawer headline, title-small)
    // is the same 14/500 as a row (label-large), so it could not rank below the rows' type.
    drawerGroupButton: [
      "group/drawer-group",
      "flex",
      "h-10",
      "w-full",
      "cursor-pointer",
      "items-center",
      "gap-3",
      "rounded-full",
      "ps-(--layout-drawer-row-inset)",
      "pe-(--layout-drawer-row-inset)",
      "text-start",
      "text-label-medium",
      "text-on-surface-variant",
      "outline-none",
      "hover:bg-on-surface/8",
      "focus-visible:outline-2",
      "focus-visible:outline-secondary",
    ],
    drawerGroupLabel: ["min-w-0", "flex-1", "truncate"],
    drawerGroupChevron: [
      "inline-flex",
      "shrink-0",
      "transition-transform",
      "duration-short-4",
      "ease-standard",
      "group-aria-expanded/drawer-group:rotate-180",
      "motion-reduce:transition-none",
    ],
    drawerGroupContent: [
      "grid",
      "grid-rows-[0fr]",
      "transition-[grid-template-rows]",
      "duration-short-4",
      "ease-standard",
      "data-[open=true]:grid-rows-[1fr]",
      "motion-reduce:transition-none",
    ],
    // `overflow: clip`, not `hidden`: it clips the rows while the row track grows but is no
    // scroll container (MDN `overflow`), so nothing in it can scroll or show a bar (2026-11-24).
    drawerGroupInner: ["flex", "min-h-0", "flex-col", "overflow-clip"],
    // The drawer's fixed HEADER (2026-11-25, owner: "the drawer should have its header so
    // contacts stays static up there in all the drawers including the floating"): the section's
    // name as the M3 headline (title-small, on-surface-variant) on the rows' label line (28dp),
    // in a row as tall as a pane's header (`--layout-pane-header`, 64dp), so the drawer's header
    // and the primary pane's header share one row. It does not scroll; the list below it does.
    // e-store's `DrawerPanel` header (`pane-header-flex`, title-small, `shrink-0`) above its
    // scrolling `<nav>`; e-store's divider under it is left out (our pane header has none).
    drawerHeader: [
      "layout-drawer-header-rulers",
      "text-title-small",
      "text-on-surface-variant",
    ],
    drawerHeaderTitle: ["min-w-0", "truncate"],
    // The modal navigation drawer (below 600px only): a `Modal` on the start edge. Its bar's
    // inset puts the close button exactly where the app bar's menu button that opened it is.
    drawerModal: [
      "[--modal-sheet-width:min(var(--layout-drawer-width),85vw)]",
      "[--modal-bar-inset:calc(var(--layout-margin)-var(--layout-icon-button-overhang))]",
    ],
    // Under the modal's fixed header row (`Modal.CloseTitleAction`, 64dp): the scrollbar track
    // starts at that row's edge, as the card's and a pane's do (2026-11-25).
    drawerModalBody: ["[--scrollbar-track-margin-start:0px]"],
    // The compact drawer's footer (e-store's nav drawer row 3, centred, `px-3`), holding the
    // large light / dark switch with `themeToggle: "rail"`. At the drawer's END (`mt-auto`, the
    // free space above it) and as far from the bottom edge as the rail's footer is
    // (`--layout-margin`, the rail's `rail-margin` row), so it sits where the rail's switch does
    // (owner 2026-11-24).
    drawerFooter: [
      "mt-auto",
      "flex",
      "shrink-0",
      "items-center",
      "justify-center",
      "px-3",
      "pt-4",
      "pb-(--layout-margin)",
    ],
    // The scrolling part, docked and modal. e-store's drawer list is a `scrollbar-pane` with the
    // default track margins (20px at each end), so the bar never touches the header or the edge.
    // `scrollbar-gutter: stable` (NEW 2026-11-24, not in e-store): the bar's 8px are kept even
    // while the list fits, so a group opening or closing past the drawer's height does not make
    // every row jump 8px when the bar comes or goes (MDN `scrollbar-gutter`; no effect with
    // overlay scrollbars, which take no room).
    drawerBody: [
      "layout-drawer-rulers",
      "min-h-0",
      "overflow-y-auto",
      "overscroll-contain",
      "scrollbar-pane",
      "scrollbar-gutter-stable",
    ],
    drawerList: ["grid"],
    // M3 navigation drawer row: 56dp, full round, label-large; the current one is tinted.
    drawerRow: [
      "flex",
      "h-(--layout-drawer-row-height)",
      "items-center",
      "gap-3",
      "rounded-full",
      "ps-(--layout-drawer-row-inset)",
      "pe-(--layout-drawer-row-inset)",
      // A child row WITH an icon starts on its section's headline / group header line (M3:
      // section labels sit on the rows' line); its icon sets it apart. One with NO icon is
      // indented 12dp (e-store's expandable children, `nav-drawer-button.tsx`
      // `padding-inline-start: 0.75rem`), so it does not read as the headline above it. The
      // old 52dp indent lined up with a parent icon that is never drawn (2026-11-24).
      "data-nested:not-has-[[data-qds-icon]]:ps-7",
      "text-label-large",
      "text-on-surface-variant",
      "outline-none",
      "hover:bg-on-surface/8",
      "focus-visible:outline-2",
      "focus-visible:outline-secondary",
      "aria-[current=page]:bg-secondary-container",
      "aria-[current=page]:text-on-secondary-container",
      // material-web v0_192 `active-label-text-weight` = label-large-weight-prominent (bold).
      "aria-[current=page]:[font-weight:var(--text-label-large-prominent--font-weight)]",
    ],

    pane: [
      "scaffold-body",
      "layout-pane-rulers",
      "min-w-0",
      "overflow-y-auto",
      "bg-surface",
      "outline-none",
      // e-store's pane TV (`sm:rounded-xl`, compact `sm:rounded-lg`) as one variable:
      // `--layout-pane-radius` (`layout.css`), square below 600px.
      "rounded-(--layout-pane-radius)",
      // In full screen (`FullscreenButton`, `Layout.PaneHeader fullscreen`) the pane is the whole
      // screen: square corners. The UA's `:fullscreen` rule does the box (fixed, inset 0, 100%).
      "[&:fullscreen]:rounded-none",
      // Square below 600px: nothing to clear there.
      "scrollbar-pane",
      "max-sm:[--scrollbar-track-margin:0px]",
    ],
    // List-detail (NEW 2026-11-24): `Layout.ListDetail` is the container the two-pane switch
    // reads (43rem: the list's 360 + the 24 spacer + a 304 detail; the primary track at an 840px
    // window with nothing beside it measured 696px). Which pane shows in single-pane comes from
    // `data-view` (rule L19). The back arrow and the `<main>`'s surface: `layout.css`.
    listDetail: [
      "group/ld",
      "@container/list-detail",
      "relative",
      "[grid-row:title-start/body-end]",
      "flex",
      "min-h-0",
      "flex-col",
    ],
    listDetailGrid: [
      "grid",
      "min-h-0",
      "flex-1",
      "grid-cols-[minmax(0,1fr)]",
      "grid-rows-[minmax(0,1fr)]",
      "gap-x-(--layout-pane-spacer)",
      "@min-[43rem]/list-detail:grid-cols-[var(--layout-pane-fixed)_minmax(0,1fr)]",
    ],
    // The two panes: each a `surface` card with the pane radius (square below 600px), as the
    // scaffold's own panes; each scrolls itself on the pane rulers.
    listPane: [
      "layout-pane-rulers",
      "scrollbar-pane",
      "max-sm:[--scrollbar-track-margin:0px]",
      "min-h-0",
      "min-w-0",
      "overflow-y-auto",
      "bg-surface",
      "rounded-(--layout-pane-radius)",
      "@max-[43rem]/list-detail:group-data-[view=detail]/ld:hidden",
    ],
    detailPane: [
      "layout-pane-rulers",
      "scrollbar-pane",
      "max-sm:[--scrollbar-track-margin:0px]",
      "min-h-0",
      "min-w-0",
      "overflow-y-auto",
      "bg-surface",
      "rounded-(--layout-pane-radius)",
      "@max-[43rem]/list-detail:group-data-[view=list]/ld:hidden",
    ],
    // 72px up: 16px above the compact side-sheet opener at the end edge (16px inset, 40 tall);
    // 16px from the end edge (M3 FAB on compact). Below 600px, list view only.
    listDetailFab: [
      "absolute",
      "end-4",
      "bottom-18",
      "sm:hidden",
      "group-data-[view=detail]/ld:hidden",
    ],
    paneHeader: ["pane-header-bleed", "bg-surface"],
    paneHeaderRow: ["flex", "min-w-0", "items-center", "gap-2"],
    // The title truncates with an ellipsis but keeps a readable minimum (6rem, about seven
    // characters of title-large): actions that do not fit are the host's to move into an overflow
    // menu (M3 app bars), never the title's to absorb down to one letter (2026-11-25, owner).
    paneTitle: [
      "min-w-24",
      "flex-1",
      "truncate",
      "text-title-large",
      "text-on-surface",
    ],
    // `Layout.PaneHeader leading` (an avatar or image after Back; M3 app bar "image").
    // `display: contents` (second agent, 2026-11-25): the caller's element is the flex item, so
    // when the caller hides it (by a container query) no empty item leaves an extra gap.
    paneLeading: ["contents", "*:shrink-0"],
    // Title over subtitle (M3 small app bar with subtitle: still 64dp).
    paneTitleBlock: ["flex", "min-w-24", "flex-1", "flex-col"],
    paneTitleInBlock: ["truncate", "text-title-large", "text-on-surface"],
    // M3 app bar subtitle: label-medium (12/16, 500, 0.5 tracking), on-surface-variant.
    paneSubtitle: ["truncate", "text-label-medium", "text-on-surface-variant"],

    // The supporting pane is ONE `<aside popover="auto">` (e-store's sheet, `layout.tsx`
    // `[data-qds-support-sheet]`): from 840px a pane in the support track, below 840px a modal
    // side sheet in the top layer. The browser's popover box (fixed, inset 0, fit-content size,
    // margin, border, padding, Canvas) is reset here; a closed popover is `display: none`
    // unless a class below shows it.
    supportingPane: [
      "scaffold-support",
      "flex-col",
      "min-w-0",
      "overflow-hidden",
      "m-0",
      "border-0",
      "p-0",
      "text-on-surface",
      "outline-none",
      // From 840px: a pane in the support track. Slide, not reflow (`layout.css`, NEW
      // 2026-11-24): the `<aside>` only clips; its panel (below) is the 320dp surface, riding on
      // the track's moving START edge, so it slides in from behind the companion rail. It is
      // laid out at every state and HIDDEN while collapsed with `visibility`, delayed by the
      // track's 300ms: visibility interpolates as visible until the end (CSS Transitions), so
      // the pane stays on show while its track closes and turns hidden after, in every engine
      // (no `display` / `overlay` discrete transition, rule L26). Hidden, it is out of the
      // focus order and the accessibility tree.
      "md:relative",
      "md:inset-auto",
      "md:h-auto",
      "md:w-auto",
      "md:layout-slide",
      "md:[--layout-slide-size:var(--layout-support-expanded)]",
      // `--field-bg` (the floated label's patch) follows the fill. The `.bg-surface*` rules in
      // `tokens/utilities.css` match the plain class only, not `md:` / `max-md:` variants.
      "md:[--field-bg:var(--color-surface)]",
      // The popover UA style paints `Canvas` (white) on the <aside>; since the rounded surface
      // moved onto the panel, that square white box showed at the panel's corners (owner,
      // 2026-11-24: "put the corners back on the sub-rails Pane"). The <aside> paints nothing.
      "md:bg-transparent",
      "md:flex",
      "md:data-[expanded=false]:invisible",
      "md:transition-[visibility]",
      "md:duration-medium-2",
      "md:motion-reduce:transition-none",
      // Below 840px: an M3 modal side sheet on the end edge, shown while open (`open:` is
      // `:popover-open`; a bare `flex` would show the closed popover). Surface
      // `surface-container-low`, elevation level 1, 16dp inner corners, at most 400dp.
      "max-md:open:flex",
      "max-md:inset-y-0",
      "max-md:inset-s-auto",
      "max-md:inset-e-0",
      "max-md:h-dvh",
      "max-md:max-h-none",
      "max-md:w-[min(var(--layout-side-sheet-max),100vw)]",
      "max-md:max-w-none",
      "max-md:rounded-s-lg",
      "max-md:bg-surface-container-low",
      "max-md:[--field-bg:var(--color-surface-container-low)]",
      "max-md:shadow-1",
      // M3: the page behind a modal sheet is dimmed with scrim at 32%.
      "backdrop:bg-scrim/32",
      // Motion below 840px (`layout.md` "Sheet motion"), as `Modal position="right"`: in from
      // the end edge, 500ms Emphasized; out, 200ms, played while it is still open
      // (`data-closing`) and only then `hidePopover()` (`closeAnimated`), so the sheet and its
      // scrim stay in the top layer in every browser. Mirrored in right-to-left (L10).
      "max-md:transition-[translate]",
      "max-md:duration-long-2",
      "max-md:ease-emphasized",
      "max-md:translate-x-full",
      "max-md:rtl:-translate-x-full",
      "max-md:open:translate-x-0",
      "max-md:starting:open:translate-x-full",
      "max-md:rtl:starting:open:-translate-x-full",
      "max-md:open:data-closing:translate-x-full",
      "max-md:rtl:open:data-closing:-translate-x-full",
      "max-md:open:data-closing:duration-short-4",
      "backdrop:opacity-0",
      "backdrop:transition-opacity",
      "backdrop:ease-linear",
      "backdrop:duration-long-2",
      "open:backdrop:opacity-100",
      "starting:open:backdrop:opacity-0",
      "open:data-closing:backdrop:opacity-0",
      "open:data-closing:backdrop:duration-short-4",
      "motion-reduce:transition-none",
      // Tailwind sorts the breakpoint variant AFTER `motion-reduce:`, so the plain
      // `motion-reduce:transition-none` above lost to `max-md:transition-[translate]` (read in
      // the playground's stylesheet, 2026-11-24): the sheet still slid under reduced motion.
      "max-md:motion-reduce:transition-none",
      "motion-reduce:backdrop:transition-none",
    ],
    // The part that scrolls: the pane's header and its body, on the pane ruler grid.
    supportPanel: [
      "layout-pane-rulers",
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
      "overscroll-contain",
      "scrollbar-pane",
      // Below 840px only the start-side corners are round; the bar is on the square end side.
      "max-md:[--scrollbar-track-margin:0px]",
      // From 840px the panel is the pane's surface, of its final width (see `supportingPane`).
      "md:layout-slide-content",
      "md:rounded-(--layout-pane-radius)",
      "md:bg-surface",
    ],
    // The pane header takes the sheet's surface below 840px.
    supportHeader: [
      "max-md:bg-surface-container-low",
      "max-md:[--field-bg:var(--color-surface-container-low)]",
    ],
    // Below 600px, where the companion rail is hidden: the companions as a tab row at the top
    // of the sheet (e-store's `CompanionTabs`). Hidden from 600px, where the rail is shown.
    sheetTabs: [
      "flex",
      "shrink-0",
      "border-b",
      "border-outline-variant",
      "sm:hidden",
    ],
    // One tab: the rail's 48 x 32 pill over a label-medium label, in a 64px row.
    sheetTab: [
      "group/companion",
      "flex",
      "h-16",
      "min-w-0",
      "flex-1",
      "flex-col",
      "items-center",
      "justify-center",
      "gap-1",
      "text-on-surface-variant",
      "cursor-pointer",
      "outline-none",
    ],
    sheetTabLabel: [
      "max-w-full",
      "truncate",
      "text-label-medium",
      "group-aria-selected/companion:text-on-surface",
    ],

    companionRail: [
      "scaffold-trail",
      "hidden",
      "w-(--layout-trail-width)",
      "layout-trail-rulers",
      "sm:data-[shown=true]:grid",
    ],
    // The side panel's ONE toggle, fixed at the bottom end (e-store's, after Google Calendar).
    // Rail shown: a 40dp circle on the rail's column. Rail hidden: a 48 x 40 tab on the
    // viewport edge that peeks 24px and slides out on hover or focus.
    sideToggle: [
      "group/side",
      "fixed",
      "inset-e-0",
      "bottom-[calc(var(--layout-margin)+(--spacing(2)))]",
      "z-(--z-scaffold-rail)",
      "h-10",
      "w-12",
      // 48 x 40 to the eye, 48 x 48 to the pointer (M3).
      "touch-target",
      "cursor-pointer",
      "outline-none",
      "transition-transform",
      "duration-300",
      "ease-standard",
      "motion-reduce:transition-none",
    ],
    // The rail's hide / show button, from 600px: hidden, the tab peeks 24px.
    sideToggleRail: [
      "hidden",
      "sm:block",
      // Peeks from the end edge: the slide is mirrored in right-to-left (L10).
      "not-aria-expanded:translate-x-6",
      "rtl:not-aria-expanded:-translate-x-6",
      "not-aria-expanded:hover:translate-x-0",
      "not-aria-expanded:focus-visible:translate-x-0",
    ],
    // The same tab below 600px, where the rail is hidden: it opens the supporting pane's sheet
    // (e-store's sheet trigger). It peeks 24px like the rail's tab (owner 2026-11-23: "small until
    // hovered"); a tap on the peeking part opens the sheet. While the sheet is open only the sheet
    // shows: the tab is hidden (the sheet's own close button and the scrim close it).
    sheetTrigger: [
      "sm:hidden",
      "translate-x-6",
      "rtl:-translate-x-6",
      "hover:translate-x-0",
      "focus-visible:translate-x-0",
      "aria-expanded:invisible",
    ],
    // The collapsed tab: the brightest surface, raised one step (elevation level 1).
    sideToggleShape: [
      "absolute",
      "inset-y-0",
      "inset-s-0",
      "w-10",
      "rounded-full",
      "transition-[width,border-radius,background-color,box-shadow]",
      "duration-300",
      "ease-standard",
      "motion-reduce:transition-none",
      "group-focus-visible/side:outline-2",
      "group-focus-visible/side:outline-secondary",
      "group-aria-expanded/side:group-hover/side:bg-on-surface/8",
      "group-not-aria-expanded/side:w-12",
      "group-not-aria-expanded/side:rounded-e-none",
      "group-not-aria-expanded/side:bg-surface-bright",
      "group-not-aria-expanded/side:shadow-1",
      "group-not-aria-expanded/side:group-hover/side:bg-surface-container-high",
      "group-not-aria-expanded/side:group-focus-visible/side:bg-surface-container-highest",
    ],
    sideToggleIcon: [
      "absolute",
      "inset-y-0",
      "inset-s-0",
      "flex",
      "w-10",
      "items-center",
      "justify-center",
      "text-on-surface-variant",
      "transition-transform",
      "duration-300",
      "ease-standard",
      "motion-reduce:transition-none",
      "group-not-aria-expanded/side:rotate-180",
    ],
    // A 56 x 48 row holding a 48 x 32 pill. e-store's rows are 44 high; 48 meets M3's touch
    // target without rows overlapping.
    companionTab: [
      "group/companion",
      "grid",
      "h-12",
      "w-14",
      "place-items-center",
      "text-on-surface-variant",
      "cursor-pointer",
      "outline-none",
    ],
    companionPill: [
      "relative",
      "grid",
      "h-8",
      "w-12",
      "place-items-center",
      "rounded-full",
      "before:absolute",
      "before:inset-0",
      "before:rounded-[inherit]",
      "before:opacity-0",
      "before:content-['']",
      // M3 state layers (icon-button and navigation-rail specs): hover 8%, focus and press on
      // top of it. The layer's colour is the variant's (`emphasis` below).
      "group-hover/companion:before:opacity-hover",
      "group-focus-visible/companion:before:opacity-focus",
      "group-active/companion:before:opacity-pressed",
      "group-focus-visible/companion:outline-2",
      "group-focus-visible/companion:outline-secondary",
    ],
    // `LayoutCompanion.iconSelected`: both icons are rendered, CSS shows one, from the same
    // `aria-pressed` (rail) / `aria-selected` (compact sheet tabs) the pill's colours follow.
    companionIconRest: [
      "group-aria-pressed/companion:hidden",
      "group-aria-selected/companion:hidden",
    ],
    companionIconSelected: [
      "hidden",
      "group-aria-pressed/companion:block",
      "group-aria-selected/companion:block",
    ],

    footer: [
      "scaffold-footer",
      "layout-footer-rulers",
      "text-center",
      "text-body-medium",
      // `on-surface-variant`: M3's low-emphasis TEXT role. `outline` is a border role and failed
      // Lighthouse color contrast here (3.84:1 against the 4.5:1 needed).
      "text-on-surface-variant",
    ],
  },
  variants: {
    /**
     * `LayoutCompanion.emphasis` (NEW 2026-11-24, not in e-store): the companion pill's colours.
     * Selected is the rail's `aria-pressed` and the compact sheet tab's `aria-selected`.
     * PROOFED 2026-11-24 in Chrome against m3.material.io:
     * - unset: navigation-rail/specs, active indicator `secondary-container`, icon
     *   `on-secondary-container`; inactive icon `on-surface-variant` (the button's colour).
     * - `primary`: at rest floating-action-button/specs' default colours (`primary-container` /
     *   `on-primary-container`, the rail's FAB); selected icon-buttons/specs' filled toggle,
     *   selected (`primary` / `on-primary`).
     * - `tonal`: at rest icon-buttons/specs' tonal default (`secondary-container` /
     *   `on-secondary-container`); selected the tonal toggle, selected (`secondary` /
     *   `on-secondary`).
     * The state layer is the content colour (`bg-current`), as M3's state layers are.
     */
    emphasis: {
      none: {
        companionPill: [
          "before:bg-on-surface",
          "group-aria-pressed/companion:bg-secondary-container",
          "group-aria-pressed/companion:text-on-secondary-container",
          // The same pill in the compact sheet's tabs.
          "group-aria-selected/companion:bg-secondary-container",
          "group-aria-selected/companion:text-on-secondary-container",
        ],
      },
      primary: {
        companionPill: [
          "before:bg-current",
          "bg-primary-container",
          "text-on-primary-container",
          "group-aria-pressed/companion:bg-primary",
          "group-aria-pressed/companion:text-on-primary",
          "group-aria-selected/companion:bg-primary",
          "group-aria-selected/companion:text-on-primary",
        ],
      },
      tonal: {
        companionPill: [
          "before:bg-current",
          "bg-secondary-container",
          "text-on-secondary-container",
          "group-aria-pressed/companion:bg-secondary",
          "group-aria-pressed/companion:text-on-secondary",
          "group-aria-selected/companion:bg-secondary",
          "group-aria-selected/companion:text-on-secondary",
        ],
      },
    },
  },
  defaultVariants: { emphasis: "none" },
});

/** Material 3 expanded window size: from here there are two panes. */
const EXPANDED_QUERY = "(min-width: 840px)";

/** Material 3 compact window size: no rails; the app bar's menu button and the modal drawer. */
const COMPACT_QUERY = "(width < 600px)";

/**
 * The compact modal drawer's destinations: `drawerItems`, or the rail's when there are none
 * (e-store's `navDrawerItems` fallback: below 600px the menu holds every destination).
 */
const compactList = (config: LayoutConfig): LayoutDrawerItem[] =>
  config.drawerItems?.length ? config.drawerItems : (config.railItems ?? []);

const hasChildren = (item: LayoutDrawerItem) => !!item.items?.length;

/** `href` is the page, or (not for "/") a page under it. */
const isWithin = (active: string, href: string) =>
  active === href || (href !== "/" && active.startsWith(href));

/**
 * The row is the page or holds it; a group (no `href` of its own), when any row inside it does.
 * Recursive since 2026-11-24 (groups inside a section, e-store's level-2 `items`).
 */
const holds = (item: LayoutDrawerItem, active: string): boolean =>
  (!!item.href && isWithin(active, item.href)) ||
  !!item.items?.some((child) => holds(child, active));

/** The destination is the page, or one of its children (at any depth) is. */
const sectionIsActive = (item: LayoutDrawerItem, active: string) =>
  item.href === active || !!item.items?.some((child) => holds(child, active));

/** Whether focus is inside the floating drawer (its card must not close under it). */
const focusInDrawer = (drawerId: string) =>
  !!document.getElementById(drawerId)?.contains(document.activeElement);

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */

export type LayoutRootProps = PropsOf<"div"> &
  LayoutConfig &
  ThemeProps & {
    /** The id of the primary pane. Defaults to "main-content". */
    mainId?: string;
    /** The id of the floating / docked drawer. Defaults to "layout-drawer"; the modal one is `${drawerId}-modal`. */
    drawerId?: string;
    /** The id of the navigation rail. Defaults to "layout-rail". */
    railId?: string;
    /** The id of the supporting pane. Defaults to "layout-support". */
    supportId?: string;
    /** Whether the standard drawer is open in the nav track. Starts closed. e-store's name. */
    "bind:drawerOpen"?: Signal<boolean>;
    /** Whether the floating drawer is docked beside the rail. Starts floating. e-store's name. */
    "bind:drawerDocked"?: Signal<boolean>;
    /** Whether the supporting pane is shown. Starts closed. */
    "bind:supportExpanded"?: Signal<boolean>;
    /** Which companion (a `Layout.CompanionRail` app id) the supporting pane shows. */
    "bind:activeCompanion"?: Signal<string | null>;
    /** Whether the companion rail shows (its bottom button hides and shows it). Starts true. */
    "bind:trailShown"?: Signal<boolean>;
    /** The companion rail's id. */
    trailId?: string;
  };

/**
 * The scaffold grid, the skip link, and the layout and theme contexts for every part inside.
 * One `Layout.Root` per app. It owns all the layout state and takes the layout's content as
 * plain data props (`LayoutConfig`); the parts read both from context.
 */
const LayoutRoot = component$<LayoutRootProps>(
  ({
    mainId = "main-content",
    drawerId = "layout-drawer",
    railId = "layout-rail",
    supportId = "layout-support",
    "bind:drawerOpen": givenDrawerOpen,
    "bind:drawerDocked": givenDrawerDocked,
    "bind:supportExpanded": givenSupportExpanded,
    "bind:activeCompanion": givenActiveCompanion,
    "bind:trailShown": givenTrailShown,
    trailId = "layout-trail",
    // The layout's content, as data (`LayoutConfig`): parts read it from context.
    title,
    titleHref,
    activeHref,
    railItems,
    drawerTitle,
    drawerItems,
    companions,
    drawerType: givenDrawerType,
    drawer,
    themeToggle,
    layoutMode = "default",
    // The theme (`ThemeProps`): the root is also the theme provider.
    sourceColor,
    colorMode,
    "bind:color": givenColor,
    "bind:mode": givenMode,
    class: className,
    ...rest
  }) => {
    useThemeProvider({
      sourceColor,
      colorMode,
      "bind:color": givenColor,
      "bind:mode": givenMode,
    });
    const config = useComputed$<LayoutConfig>(() => ({
      title,
      titleHref,
      activeHref,
      railItems,
      drawerTitle,
      drawerItems,
      companions,
      drawerType: givenDrawerType,
      drawer,
      themeToggle,
      layoutMode,
    }));
    // Follows the `drawerType` prop (a CMS may change it); the rail's button may still switch
    // `modal` to `standard` until the prop changes (e-store's).
    const drawerType = useBoundSignal<LayoutDrawerType>(
      undefined,
      givenDrawerType ?? "modal",
      useComputed$(() => config.value.drawerType),
    );
    const drawerOpen = useBoundSignal(givenDrawerOpen, false);
    const drawerDocked = useBoundSignal(givenDrawerDocked, false);
    const hoveredRailHref = useBoundSignal<string | null>(undefined, null);
    const peek = useBoundSignal(undefined, { y: 0, start: 0 });
    const drawerModalOpen = useBoundSignal<boolean>(undefined, false);
    // No drawer items, no drawer (from 600px): the rail's menu button stays, disabled.
    const hasDrawer = useComputed$(() => !!config.value.drawerItems?.length);
    // The section the page is in: what the docked floating drawer shows.
    const activeSection = useComputed$(() =>
      (config.value.drawerItems ?? []).find(
        (item) =>
          hasChildren(item) &&
          sectionIsActive(item, config.value.activeHref ?? ""),
      ),
    );
    // The rail's menu button, per page (owner, 2026-11-24): floating, it docks the CURRENT
    // section, so it works only on a page inside one; elsewhere it stays, disabled, and hover
    // floats any section's card. NEW: e-store keeps it enabled on every page (its
    // `hasDrawerChildren` looks at all drawer items) and, docked outside a section, floats nothing.
    const menuEnabled = useComputed$(() =>
      drawerType.value === "floating" ? !!activeSection.value : hasDrawer.value,
    );
    const docked = useComputed$(() =>
      !hasDrawer.value
        ? false
        : drawerType.value === "floating"
          ? drawerDocked.value && !!activeSection.value
          : drawerType.value === "standard" && drawerOpen.value,
    );
    const supportExpanded = useBoundSignal(givenSupportExpanded, false);
    const activeCompanion = useBoundSignal<string | null>(
      givenActiveCompanion,
      null,
    );
    const trailShown = useBoundSignal(givenTrailShown, true);
    useContextProvider(layoutContextId, {
      trailId,
      trailShown,
      mainId,
      drawerId,
      railId,
      supportId,
      config,
      drawerType,
      drawerOpen,
      drawerDocked,
      hoveredRailHref,
      peek,
      hasDrawer,
      activeSection,
      menuEnabled,
      docked,
      drawerModalOpen,
      supportExpanded,
      activeCompanion,
    });
    const styles = layoutVariants();

    // e-store's `Layout.Root` wraps its scaffold in `RippleProvider`: one set of document
    // listeners draws the ripple of every `data-ripple` host (List rows, Carousel items).
    return (
      <RippleProvider>
        <div
          {...rest}
          class={[styles.root(), className]}
          data-nav={docked.value ? "" : undefined}
          data-layout-mode={layoutMode}
          data-support={supportExpanded.value ? "expanded" : "collapsed"}
          data-trail={trailShown.value ? undefined : "hidden"}
          // The compact modal drawer left open while the window grows past 600px would keep the page
          // inert behind a rail that is now on show.
          window:onResize$={() => {
            if (drawerModalOpen.value && !matchMedia(COMPACT_QUERY).matches) {
              drawerModalOpen.value = false;
            }
          }}
        >
          <a href={`#${mainId}`} class={styles.skipLink()}>
            Skip to main content
          </a>
          <Slot />
          {/* The plain tooltip of every `data-tooltip` control (e.g. IconButton). */}
          <TooltipProvider />
        </div>
      </RippleProvider>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Menu button                                                        */
/* ------------------------------------------------------------------ */

export type LayoutMenuButtonProps = Omit<
  PropsOf<"button">,
  "children" | "onClick$"
> & {
  /** Its name while the drawer is closed. */
  label?: string;
  /** Its name while the drawer is open. */
  closeLabel?: string;
  /** The icon while the drawer is closed. */
  icon?: IconName;
  /** The icon while the drawer is open. */
  openIcon?: IconName;
};

/**
 * The compact menu button (e-store's app bar hamburger, `drawer="auto"`): opens and closes the
 * MODAL drawer, which lists every destination. `Layout.AppBar` shows it below 600px, where there
 * is no rail; the rail's own button is `Layout.Rail`'s.
 */
const LayoutMenuButton = component$<LayoutMenuButtonProps>(
  ({
    label = "Open menu",
    closeLabel = "Close menu",
    icon = "menu",
    openIcon = "menu_open",
    ...rest
  }) => {
    const layout = useContext(layoutContextId);
    const { drawerModalOpen } = layout;
    // Forced on with no modal drawer (`drawer="off"`, no destinations): nothing to point at.
    const controls = useComputed$(() => hasModalDrawer(layout.config.value));
    return (
      <IconButton
        {...rest}
        icon={drawerModalOpen.value ? openIcon : icon}
        label={drawerModalOpen.value ? closeLabel : label}
        aria-controls={controls.value ? `${layout.drawerId}-modal` : undefined}
        aria-expanded={controls.value ? drawerModalOpen.value : undefined}
        onClick$={() => {
          drawerModalOpen.value = !drawerModalOpen.value;
        }}
      />
    );
  },
);

/** e-store's `drawer="auto"`: a modal drawer (and its button) whenever there are destinations. */
const hasModalDrawer = (config: LayoutConfig) =>
  config.drawer !== "off" && compactList(config).length > 0;

/* ------------------------------------------------------------------ */
/*  App bar                                                            */
/* ------------------------------------------------------------------ */

export type LayoutAppBarProps = Omit<TopAppBarProps, "title"> & {
  /** The title. Defaults to `Layout.Root title`. */
  title?: string;
  /**
   * The menu button below 600px (it opens the modal drawer). Defaults to `Layout.Root drawer`:
   * shown whenever there are destinations (e-store's `drawer="auto"`).
   */
  menuButton?: boolean;
  /** The menu button's name. */
  menuLabel?: string;
};

/**
 * The top app bar in the scaffold: a `TopAppBar` above the panes, from the rail's end to the
 * far edge. Below 600px it holds the menu button and, with `Layout.Root themeToggle`, the theme
 * switch (the rail's controls, which is hidden there). The default slot takes trailing actions.
 */
const LayoutAppBar = component$<LayoutAppBarProps>(
  ({
    menuButton,
    menuLabel = "Open menu",
    title,
    titleHref,
    class: className,
    ...rest
  }) => {
    const layout = useContext(layoutContextId);
    const styles = layoutVariants();
    return (
      <TopAppBar
        {...rest}
        title={title ?? layout.config.value.title ?? ""}
        titleHref={titleHref ?? layout.config.value.titleHref}
        class={[styles.appBar(), className]}
      >
        {(menuButton ?? hasModalDrawer(layout.config.value)) && (
          <LayoutMenuButton
            q:slot="leading"
            label={menuLabel}
            class={styles.appBarMenu()}
          />
        )}
        <Slot name="pane" q:slot="pane" />
        {layout.config.value.themeToggle === true && (
          <ThemeToggle size="sm" class={styles.appBarTheme()} />
        )}
        <Slot />
      </TopAppBar>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Navigation rail and its drawer                                     */
/* ------------------------------------------------------------------ */

export type LayoutRailProps = NavigationRailRootProps & {
  /** The menu button's name while the drawer is closed. e-store's text. */
  menuLabel?: string;
  /** Its name while the drawer is open. */
  closeMenuLabel?: string;
  /** Its name while the floating drawer floats (`drawerType="floating"`). e-store's text. */
  dockLabel?: string;
  /** Its name while the floating drawer is docked. */
  undockLabel?: string;
  /** Its icon while the drawer is closed / floating. */
  menuIcon?: IconName;
  /** Its icon while the drawer is open / docked. */
  menuOpenIcon?: IconName;
  /**
   * The app's key action: a FAB at the top of the rail, above the destinations (e-store's
   * `Layout.Rail fab`, `navigation/nav-rail.tsx` ~360-375). M3 navigation rail guidelines, read
   * 2026-11-24: "The menu icon and FAB should always be top-aligned"; a FAB nested in the rail
   * rests at elevation level 0. A standard (56dp) or small FAB fits the collapsed rail. Rendered
   * through `freshJsx` (e-store's Qwik rc workaround for JSX props). From 600px, as the rail.
   */
  fab?: JSXOutput;
};

/**
 * The navigation rail in the scaffold: a `NavigationRail` on the leading edge from 600px.
 * Destinations are `Layout.Root railItems`; the default slot takes more `Layout.RailItem`s.
 * Its menu button is e-store's (`nav-rail.tsx` `handleMenuTrigger$`): with `drawerType`
 * `floating` it docks and undocks the floating drawer, otherwise it opens and closes the standard
 * drawer in the nav track. With no `drawerItems` there is no drawer: the button stays, disabled;
 * floating, it is disabled too on a page outside every section (`menuEnabled`).
 * `Layout.Root themeToggle` puts the theme switch at its foot.
 */
const LayoutRail = component$<LayoutRailProps>(
  ({
    menuLabel = "Open menu",
    closeMenuLabel = "Close menu",
    dockLabel = "Dock drawer",
    undockLabel = "Undock drawer",
    menuIcon = "menu",
    menuOpenIcon = "menu_open",
    fab,
    class: className,
    onMouseLeave$,
    onFocusOut$,
    ...rest
  }) => {
    const layout = useContext(layoutContextId);
    const {
      drawerType,
      drawerOpen,
      drawerDocked,
      hoveredRailHref,
      peek,
      menuEnabled,
      docked,
    } = layout;
    const styles = layoutVariants();
    const floating = useComputed$(() => drawerType.value === "floating");
    // What the button shows as open: the docked floating drawer, or the open standard one.
    // e-store's: floating, the button shows the visitor's dock CHOICE (`drawerDocked`), which
    // persists across pages. On a page outside every section the docked track is just empty.
    // The button does nothing on this page (no drawer items, or floating outside every section):
    // never "open", whatever dock choice a page with a section left behind (2026-11-24).
    const menuOpen = useComputed$(() =>
      !menuEnabled.value
        ? false
        : floating.value
          ? drawerDocked.value
          : drawerType.value === "standard" && drawerOpen.value,
    );
    // Disabled: the plain menu name, not "Dock drawer" (a disabled button names nothing to dock).
    const menuName = useComputed$(() =>
      !menuEnabled.value
        ? menuLabel
        : floating.value
          ? menuOpen.value
            ? undockLabel
            : dockLabel
          : menuOpen.value
            ? closeMenuLabel
            : menuLabel,
    );
    // The drawer item a rail destination opens in the floating drawer, by `href`.
    // A destination with a sub-navigation (a drawer item of the same `href` with children) is
    // the page's SECTION when the page is one of its children: `"section"`, never a second
    // `aria-current="page"` beside the drawer's row.
    const currentOf = (href: string) => {
      const active = layout.config.value.activeHref ?? "";
      const section = (layout.config.value.drawerItems ?? []).find(
        (item) => item.href === href && hasChildren(item),
      );
      if (section) return sectionIsActive(section, active) ? "section" : false;
      return href === active;
    };

    // A destination hovered or focused: its children float in the drawer, the arrow at its pill
    // (e-store's `hoveredRailHref`; the arrow is measured here instead of e-store's per-density
    // item pitch).
    const peekAt$ = $((href: string, element: HTMLElement) => {
      // Docked IN THE NAV TRACK (the choice on a page inside a section): hover never floats a
      // card (e-store's, owner 2026-11-10). On a page outside every section the choice cannot
      // dock anything, so hover floats any section's card (owner 2026-11-24; e-store floats
      // nothing there while the choice is docked).
      if (docked.value) return;
      // Focus in the card: the pointer passing over the rail must not swap it from under focus.
      if (focusInDrawer(layout.drawerId)) return;
      hoveredRailHref.value = href;
      const pill = element.querySelector("[data-rail-pill]") ?? element;
      const box = pill.getBoundingClientRect();
      const rail = (element.closest("nav") ?? element).getBoundingClientRect();
      const rtl = getComputedStyle(element).direction === "rtl";
      peek.value = {
        y: box.top + box.height / 2,
        start: rtl ? window.innerWidth - rail.left : rail.right,
      };
    });

    return (
      <NavigationRail.Root
        {...rest}
        id={layout.railId}
        data-layout-rail=""
        class={[styles.rail(), className]}
        // e-store's: leaving the rail closes the floating drawer, unless the pointer went into it.
        // Ours: not while focus is in the card (closing it would drop focus to the page).
        onMouseLeave$={[
          $((event: MouseEvent) => {
            const to = event.relatedTarget as Element | null;
            if (to?.closest?.(`#${layout.drawerId}`)) return;
            if (focusInDrawer(layout.drawerId)) return;
            hoveredRailHref.value = null;
          }),
          onMouseLeave$,
        ]}
        // So does focus leaving both (ours: e-store clears it only on Escape).
        onFocusOut$={[
          $((event: FocusEvent) => {
            const to = event.relatedTarget as Element | null;
            if (to?.closest?.(`#${layout.drawerId}, #${layout.railId}`)) return;
            hoveredRailHref.value = null;
          }),
          onFocusOut$,
        ]}
      >
        <IconButton
          q:slot="header"
          icon={menuOpen.value ? menuOpenIcon : menuIcon}
          label={menuName.value}
          // Nothing to open or dock on this page (`menuEnabled`): the button stays (owner
          // 2026-11-23), native `disabled`, so Tab skips it and a click does nothing.
          disabled={!menuEnabled.value}
          aria-controls={menuEnabled.value ? layout.drawerId : undefined}
          aria-expanded={menuEnabled.value ? menuOpen.value : undefined}
          onClick$={() => {
            if (!menuEnabled.value) return;
            if (drawerType.value === "floating") {
              drawerDocked.value = !drawerDocked.value;
              hoveredRailHref.value = null;
            } else {
              // e-store's: the rail's button turns a modal drawer into the standard one.
              drawerType.value = "standard";
              drawerOpen.value = !drawerOpen.value;
            }
          }}
        />
        {fab && (
          <div data-layout-rail-fab="" class={styles.railFab()}>
            {freshJsx(fab)}
          </div>
        )}
        {layout.config.value.railItems?.map((item) => (
          <NavigationRail.Item
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            prefetchBundles={item.prefetchBundles}
            current={currentOf(item.href)}
            onMouseEnter$={(_, element) => peekAt$(item.href, element)}
            onFocus$={(_, element) => {
              // Focus given back by the drawer's Escape: do not reopen it.
              if (element.hasAttribute("data-no-peek")) {
                element.removeAttribute("data-no-peek");
                return;
              }
              return peekAt$(item.href, element);
            }}
          />
        ))}
        <Slot />
        {layout.config.value.themeToggle && <ThemeToggle q:slot="footer" />}
      </NavigationRail.Root>
    );
  },
);

export type LayoutDrawerItemProps = PropsOf<"a"> & {
  /** Marks the row the visitor is on. */
  current?: boolean;
  /** When the row's `Link` prefetches the destination's bundles (the router's prop). */
  prefetchBundles?: PrefetchStrategy;
  /** A child row (a destination's sub-navigation): starts on its parent's label line. */
  nested?: boolean;
};

/** A row of the navigation drawer, for rows the host renders itself. */
const LayoutDrawerItemRow = component$<LayoutDrawerItemProps>(
  ({ current = false, nested = false, class: className, ...rest }) => {
    // The router's `Link` (e-store's `nav-drawer-link.tsx`): no full page load.
    return (
      <Link
        {...rest}
        aria-current={current ? "page" : undefined}
        data-nested={nested ? "" : undefined}
        class={[layoutVariants().drawerRow(), className]}
      >
        <Slot />
      </Link>
    );
  },
);

const drawerRel = (item: LayoutDrawerItem) =>
  item.external ? "external" : undefined;

/**
 * A group of drawer rows that opens and closes (e-store's `DrawerButtonExpandable`,
 * `navigation/nav-drawer-button.tsx`, ported 2026-11-24 for the Messages app's sections): a
 * `<button aria-expanded aria-controls>` row with the label and an `expand_more` chevron that
 * turns, then the rows, revealed by a grid-rows transition. Its own component so its open state
 * is a stable hook (e-store's reason). Differs from e-store: starts open when `item.open` (NEW;
 * e-store opens only a group holding the page, which we also do), and the closed rows are
 * `inert` (e-store leaves them in the Tab order while collapsed to 0px).
 */
const LayoutDrawerGroup = component$<{
  item: LayoutDrawerItem;
  nested: boolean;
  activeHref: string;
}>(({ item, nested, activeHref }) => {
  const styles = layoutVariants();
  const open = useSignal(!!item.open || holds(item, activeHref));
  // `useId`: the docked and the compact modal drawer both render the same groups.
  const uid = useId();
  const contentId = `${uid}-rows`;
  return (
    <div data-layout-drawer-group="">
      <button
        type="button"
        aria-expanded={open.value}
        aria-controls={contentId}
        data-nested={nested ? "" : undefined}
        class={styles.drawerGroupButton()}
        onClick$={() => {
          open.value = !open.value;
        }}
      >
        <span class={styles.drawerGroupLabel()}>{item.label}</span>
        <span aria-hidden="true" class={styles.drawerGroupChevron()}>
          {/* e-store's `expandIcon` at `size="sm"` (20dp). */}
          <Icon name="expand_more" size="sm" />
        </span>
      </button>
      <div
        id={contentId}
        data-open={open.value ? "true" : "false"}
        class={styles.drawerGroupContent()}
        inert={!open.value}
      >
        <div class={styles.drawerGroupInner()}>
          {(item.items ?? []).map((child) => (
            <LayoutDrawerItemRow
              key={`child:${child.href ?? child.label}`}
              href={child.href}
              rel={drawerRel(child)}
              prefetchBundles={child.prefetchBundles}
              nested
              current={!!child.href && child.href === activeHref}
            >
              {/* A child's own icon is drawn (2026-11-24): with the header text-only, the
                  rows' icons are what sets them apart from it (M3 rows: optional icon). */}
              {child.icon && <Icon name={child.icon} />}
              {child.label}
            </LayoutDrawerItemRow>
          ))}
        </div>
      </div>
    </div>
  );
});

export type LayoutDrawerProps = Omit<PropsOf<"aside">, "popover"> & {
  /** The modal drawer's title and name. Defaults to `Layout.Root drawerTitle`, else "Menu". */
  header?: string;
  /** The modal drawer's close button name. */
  closeLabel?: string;
  /** The modal drawer's close icon: it sits where the menu button that opened it is. */
  closeIcon?: IconName;
  /** The standard drawer's name, and the floating one's when no section is on show. */
  panelLabel?: string;
};

/**
 * The navigation drawer, e-store's types (`Layout.Root drawerType`):
 *
 * - `standard` (or `modal` once the rail's menu button is used): from 600px, every drawer item
 *   in the nav track beside the rail, opened and closed by the rail's menu button.
 * - `floating`: from 600px, a card beside the rail with the children of the hovered or focused
 *   destination (a `popover="manual"` with a pointer arrow), or, docked by the rail's menu
 *   button, the current section's children in the nav track.
 * - Below 600px, always: the modal drawer opened by the app bar's menu button, with every
 *   destination (`drawerItems`, else `railItems`) and their children (e-store's `drawer="auto"`).
 *
 * With no `drawerItems` nothing is rendered from 600px.
 */
const LayoutDrawer = component$<LayoutDrawerProps>(
  ({
    header,
    closeLabel = "Close menu",
    closeIcon = "menu_open",
    panelLabel = "Navigation menu",
    class: className,
    onMouseLeave$,
    onFocusOut$,
    onClick$,
    "document:onKeyDown$": onDocumentKeyDown$,
    ...rest
  }) => {
    const layout = useContext(layoutContextId);
    const {
      drawerType,
      drawerModalOpen,
      hoveredRailHref,
      peek,
      hasDrawer,
      activeSection,
      docked,
      drawerId,
      railId,
    } = layout;
    const styles = layoutVariants();
    const panelRef = useSignal<HTMLElement>();
    const floating = useComputed$(() => drawerType.value === "floating");
    // Whether the drawer is laid out in the nav track: `docked`, but it stays true while the
    // track closes, so the drawer slides out behind the rail instead of vanishing first
    // (owner 2026-11-24; NEW, not in e-store, whose docked drawer also disappears at once). The
    // scaffold's track (`data-nav`) still follows `docked` at once. Its section is kept too, as
    // the page may have left the section that was docked.
    const inTrack = useSignal(false);
    const trackSection = useSignal<LayoutDrawerItem>();
    useTask$(({ track, cleanup }) => {
      const isDocked = track(() => docked.value);
      const section = track(() => activeSection.value);
      if (isDocked || isServer || !inTrack.value) {
        inTrack.value = isDocked;
        trackSection.value = isDocked ? section : undefined;
        return;
      }
      // Undocked: the exit. Not awaited (a task holds the render until it resolves).
      let current = true;
      cleanup(() => {
        current = false;
      });
      afterTrackTransition(document.getElementById(drawerId), () => {
        if (!current) return;
        inTrack.value = false;
        trackSection.value = undefined;
      });
    });
    // Floating and not docked: the hovered or focused destination's section, if it has children.
    const peekSection = useComputed$(() =>
      // Not while the section is docked in the nav track (nor while it slides out). Outside every
      // section the dock choice docks nothing, so the card floats on hover (owner 2026-11-24;
      // e-store floats nothing there while docked).
      !floating.value || docked.value || inTrack.value
        ? undefined
        : (layout.config.value.drawerItems ?? []).find(
            (item) => hasChildren(item) && item.href === hoveredRailHref.value,
          ),
    );
    // What the floating card shows: the docked section, else the peeked one.
    const shownSection = useComputed$(() =>
      inTrack.value ? trackSection.value : peekSection.value,
    );
    const modalTitle = useComputed$(
      () => header ?? layout.config.value.drawerTitle ?? "Menu",
    );

    // The floating card is a `popover="manual"` in the top layer (e-store's), shown while a
    // destination with children is hovered or focused. A `useTask$`: its first run is on the
    // server, after that it runs only when the state changes, so no eager JavaScript.
    useTask$(({ track }) => {
      const open = !!track(() => peekSection.value);
      track(() => docked.value);
      if (isServer) return;
      const panel = panelRef.value;
      if (!panel) return;
      const showing = panel.matches(":popover-open");
      if (open && !showing) openPopover(panel);
      else if (!open && showing) panel.hidePopover();
    });

    // A row, or a group of rows when the item has its own `items` (e-store's level-2 children).
    // A divider before every group but the first (M3: dividers separate groups).
    const rows = (items: LayoutDrawerItem[], nested: boolean) =>
      items.flatMap((item, index) =>
        hasChildren(item) ? (
          [
            index > 0 && (
              <Separator
                key={`group-divider:${index}`}
                decorative
                class={styles.drawerDivider()}
              />
            ),
            <LayoutDrawerGroup
              // The index too: two groups may share a label.
              key={`group:${index}:${item.label}`}
              item={item}
              nested={nested}
              activeHref={layout.config.value.activeHref ?? ""}
            />,
          ]
        ) : (
          <LayoutDrawerItemRow
            key={`${nested ? "child:" : ""}${item.href ?? item.label}`}
            href={item.href}
            rel={drawerRel(item)}
            prefetchBundles={item.prefetchBundles}
            nested={nested}
            current={item.href === layout.config.value.activeHref}
          >
            {item.icon && <Icon name={item.icon} />}
            {item.label}
          </LayoutDrawerItemRow>
        ),
      );
    // Every destination; one with children is a section: its name as a headline (not a link to
    // the same page as its first child), then its children.
    // A section is set off from its neighbours by a divider on each side (M3 guidelines: a
    // divider, then the section label; e-store's `navDrawerSectionVariants`).
    const allRows = (items: LayoutDrawerItem[]) =>
      items.flatMap((item, index) =>
        hasChildren(item)
          ? [
              index > 0 && (
                <Separator
                  key={`section-divider:${index}`}
                  decorative
                  class={styles.drawerDivider()}
                />
              ),
              <div
                key={`section:${item.href ?? item.label}`}
                class={styles.drawerSection()}
              >
                {item.label}
              </div>,
              ...rows(item.items ?? [], true),
              index < items.length - 1 && (
                <Separator
                  key={`section-end:${index}`}
                  decorative
                  class={styles.drawerDivider()}
                />
              ),
            ]
          : rows([item], false),
      );

    return (
      <>
        {hasDrawer.value && floating.value && (
          <aside
            {...rest}
            ref={panelRef}
            id={drawerId}
            // Always a popover (docking changes only its classes), so the task above never waits
            // on the attribute.
            popover="manual"
            data-layout-drawer=""
            data-docked={inTrack.value ? "true" : "false"}
            // Sliding out of the track (`inTrack`): its rows are going, so out of reach.
            data-closing={inTrack.value && !docked.value ? "" : undefined}
            inert={inTrack.value && !docked.value}
            class={[styles.drawer(), className]}
            style={
              inTrack.value
                ? undefined
                : {
                    top: "var(--layout-app-bar-height)",
                    insetInlineStart: `${peek.value.start}px`,
                  }
            }
            // e-store's: leaving the card closes it (ours: not while focus is in it).
            onMouseLeave$={[
              $((event: MouseEvent, element: HTMLElement) => {
                if (docked.value) return;
                const to = event.relatedTarget as Element | null;
                if (to?.closest?.(`#${railId}`)) return;
                if (element.contains(document.activeElement)) return;
                hoveredRailHref.value = null;
              }),
              onMouseLeave$,
            ]}
            onFocusOut$={[
              $((event: FocusEvent) => {
                if (docked.value) return;
                const to = event.relatedTarget as Element | null;
                if (to?.closest?.(`#${drawerId}, #${railId}`)) return;
                hoveredRailHref.value = null;
              }),
              onFocusOut$,
            ]}
            // Following a link closes the floating card (as the modal drawer does).
            onClick$={[
              $((event: PointerEvent) => {
                if (docked.value) return;
                if ((event.target as Element).closest("a")) {
                  hoveredRailHref.value = null;
                }
              }),
              onClick$,
            ]}
            // e-store's: Escape closes the floating card from anywhere (it opens on hover or
            // focus, so focus is often outside it). Ours: focus inside it goes back to its
            // destination on the rail.
            document:onKeyDown$={[
              $((event: KeyboardEvent) => {
                if (event.key !== "Escape" || !peekSection.value) return;
                const href = hoveredRailHref.value;
                const inside = !!panelRef.value?.contains(
                  document.activeElement,
                );
                hoveredRailHref.value = null;
                const destination = href
                  ? document.querySelector<HTMLElement>(
                      `#${railId} a[href="${CSS.escape(href)}"]`,
                    )
                  : null;
                if (inside && destination) {
                  destination.setAttribute("data-no-peek", "");
                  destination.focus();
                }
              }),
              onDocumentKeyDown$,
            ]}
          >
            {!inTrack.value && peekSection.value && (
              <span
                aria-hidden="true"
                class={styles.drawerArrow()}
                style={{
                  top: `calc(${peek.value.y}px - var(--layout-app-bar-height) - 6px)`,
                }}
              />
            )}
            <div class={styles.drawerCard()}>
              {shownSection.value && (
                <>
                  {/* e-store's `DrawerPanel` header: the section's name as the drawer's
                      headline, FIXED above the scrolling list (2026-11-25). The visible title
                      names the `<nav>` (`aria-labelledby`, reviewer 2026-11-25). */}
                  <div class={styles.drawerHeader()} data-qds-drawer-header="">
                    <span
                      id={`${drawerId}-title`}
                      class={styles.drawerHeaderTitle()}
                    >
                      {shownSection.value.label}
                    </span>
                  </div>
                  <div
                    class={[styles.drawerBody(), styles.drawerCardBody()]}
                    data-roving="vertical"
                    onKeyDown$={[rovingKeys]}
                  >
                    <nav
                      class={styles.drawerList()}
                      aria-labelledby={`${drawerId}-title`}
                    >
                      {rows(shownSection.value.items ?? [], false)}
                    </nav>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
        {/* Standard: every drawer item in the nav track (e-store's `drawerType="standard"`). */}
        {hasDrawer.value && !floating.value && (
          <aside
            {...rest}
            id={drawerId}
            data-layout-drawer=""
            data-docked={inTrack.value ? "true" : "false"}
            // Sliding out of the track (`inTrack`): its rows are going, so out of reach.
            data-closing={inTrack.value && !docked.value ? "" : undefined}
            inert={inTrack.value && !docked.value}
            class={[styles.drawer(), className]}
          >
            <div class={styles.drawerCard()}>
              <div
                class={[styles.drawerBody(), styles.drawerStandardBody()]}
                data-roving="vertical"
                onKeyDown$={[rovingKeys]}
              >
                <nav class={styles.drawerList()} aria-label={panelLabel}>
                  {allRows(layout.config.value.drawerItems ?? [])}
                </nav>
              </div>
            </div>
          </aside>
        )}
        {/* Modal, below 600px: e-store's `Modal position="left"`, every destination. */}
        {hasModalDrawer(layout.config.value) && (
          <Modal.Root bind:open={drawerModalOpen} position="left">
            <Modal.Content
              id={`${drawerId}-modal`}
              class={styles.drawerModal()}
            >
              <Modal.CloseTitleAction
                title={modalTitle.value}
                closeIcon={closeIcon}
                closeLabel={closeLabel}
                namesDialog
              />
              <div
                class={[styles.drawerBody(), styles.drawerModalBody()]}
                data-roving="vertical"
                onKeyDown$={[rovingKeys]}
                // Following a link closes the drawer.
                onClick$={(event) => {
                  if ((event.target as Element).closest("a")) {
                    drawerModalOpen.value = false;
                  }
                }}
              >
                {/* The dialog is already named by its title. */}
                <nav class={styles.drawerList()}>
                  {allRows(compactList(layout.config.value))}
                </nav>
              </div>
              {/* e-store's rule (owner 2026-11-24): light / dark in the rail, and in the drawer's
                  footer where there is no rail, in its large labelled form. */}
              {layout.config.value.themeToggle === "rail" && (
                <div
                  class={styles.drawerFooter()}
                  data-qds-nav-drawer-footer=""
                >
                  <ThemeToggle look="full" />
                </div>
              )}
            </Modal.Content>
          </Modal.Root>
        )}
      </>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Panes                                                              */
/* ------------------------------------------------------------------ */

export type LayoutPaneProps = Omit<PropsOf<"main">, "role"> & {
  /** Only "primary" exists: the page's `<main>`. One per page. */
  role?: "primary";
  /**
   * Full-bleed content, from e-store's `Layout.Pane bleed` (2026-11-19, ported 2026-11-23): the
   * content fills the whole pane box, for a map or a canvas that owns its own gestures. No
   * insets, no scroll: the pane clips (its rounding clips the content too) and stops scroll
   * chaining. A `Layout.PaneHeader` stacks above the content. Pass ONE root element. Sets
   * `data-qds-pane-bleed` (rules in `layout.css`).
   */
  bleed?: boolean;
};

/**
 * The primary pane: the page's `<main>` and the skip link's target. It scrolls; the scaffold
 * does not. Give it a `Layout.PaneHeader` and ONE other element (the body).
 */
const LayoutPane = component$<LayoutPaneProps>(
  ({ role = "primary", bleed = false, class: className, ...rest }) => {
    const layout = useContext(layoutContextId);
    const styles = layoutVariants();
    return (
      <main
        {...rest}
        id={layout.mainId}
        data-pane={role}
        data-qds-pane-bleed={bleed ? "" : undefined}
        tabIndex={-1}
        class={[styles.pane(), className]}
      >
        <Slot />
      </main>
    );
  },
);

export type LayoutPaneHeaderProps = PropsOf<"header"> & {
  /** The screen's title. */
  title: string;
  /** 1 when the pane title is the page's main heading; 2 (default) under an app bar title. */
  headingLevel?: 1 | 2;
  /**
   * The heading's `id`, for a region named by the title (`aria-labelledby`). Not `id`: that is
   * the `<header>`'s, which also holds the actions, so a name taken from it read "Contacts (1)
   * Full screen". NEW 2026-11-24, not in e-store.
   */
  titleId?: string;
  /**
   * A full-screen toggle for the primary pane, after the slot's actions (`FullscreenButton` on
   * the pane's `<main>`). Shown only where the browser can put an element in full screen. NEW
   * 2026-11-24, not in e-store (whose layout has no pane full screen; the button is its).
   */
  fullscreen?: boolean;
  /** That button's name. */
  fullscreenLabel?: string;
  /**
   * Where the back arrow goes (a detail page's list); no arrow without it. e-store's
   * `PaneHeader backHref` / `backLabel` / `backIcon` (ported 2026-11-24): an `IconButton` link
   * before the title, flipped in RTL, marked `data-pane-header-back`. Inside `Layout.ListDetail`
   * it shows in single-pane only (M3 list-detail: "Back button: Appears in detail view only for
   * single-pane layouts"), by CSS (`layout.css`).
   */
  backHref?: string;
  /** The back arrow's accessible name (e-store's default). */
  backLabel?: string;
  /** The back arrow's icon. */
  backIcon?: IconName;
  /**
   * Keep the title for screen readers but do not draw it: the page shows the name in its body, as
   * Google Contacts' person page (back arrow, then only the actions). The row keeps its layout.
   * NEW 2026-11-24 (owner: match Google Contacts).
   */
  hideTitle?: boolean;
  /**
   * A line under the title (M3 app bar SUBTITLE: label-medium, on-surface-variant; the small app
   * bar keeps its 64dp height). Read with `hideTitle` too (sr-only). NEW 2026-11-25, not in
   * e-store; PROOFED m3.material.io/components/app-bars/specs (read in Chrome 2026-11-25: anatomy
   * "Subtitle", token `md.comp.app-bar.small.subtitle.font` 12/16 weight 500, color roles).
   */
  subtitle?: string;
  /**
   * Content between Back and the title: an avatar or a logo (M3 app bar: "An image or logo" may
   * be added). JSX, decorative or labelled by the caller. NEW 2026-11-25, not in e-store.
   */
  leading?: JSXOutput;
};

/** A pane's own header: its title, then its actions (the default slot). Sticks while the pane scrolls. */
const LayoutPaneHeader = component$<LayoutPaneHeaderProps>(
  ({
    title,
    headingLevel = 2,
    titleId,
    fullscreen = false,
    fullscreenLabel = "Full screen",
    backHref,
    backLabel = "Back",
    backIcon = "arrow_back",
    hideTitle = false,
    subtitle,
    leading,
    class: className,
    ...rest
  }) => {
    const layout = useContext(layoutContextId);
    const styles = layoutVariants();
    const Heading = headingLevel === 1 ? "h1" : "h2";
    return (
      <header {...rest} class={[styles.paneHeader(), className]}>
        <div class={styles.paneHeaderRow()}>
          {backHref && (
            <IconButton
              type="link"
              href={backHref}
              icon={backIcon}
              label={backLabel}
              flipIconInRtl
              data-pane-header-back=""
            />
          )}
          {leading && (
            <div data-pane-header-leading="" class={styles.paneLeading()}>
              {freshJsx(leading)}
            </div>
          )}
          {subtitle ? (
            <div class={hideTitle ? "sr-only" : styles.paneTitleBlock()}>
              <Heading id={titleId} class={styles.paneTitleInBlock()}>
                {title}
              </Heading>
              <p class={styles.paneSubtitle()}>{subtitle}</p>
            </div>
          ) : (
            <Heading
              id={titleId}
              class={hideTitle ? "sr-only" : styles.paneTitle()}
            >
              {title}
            </Heading>
          )}
          {/* The hidden title's place: the actions stay at the end. */}
          {hideTitle && <span class="flex-1" />}
          <Slot />
          {fullscreen && (
            <FullscreenButton
              targetId={layout.mainId}
              label={fullscreenLabel}
            />
          )}
        </div>
      </header>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  List-detail (two panes inside the primary track)                   */
/* ------------------------------------------------------------------ */

export type LayoutListDetailProps = PropsOf<"div"> & {
  /**
   * Which pane shows while there is room for one only: `list` or `detail`. Give it from the URL
   * (rule L19: never from the window width in render). Default `list`.
   */
  view?: "list" | "detail";
  /**
   * `two` (default): M3's two panes from a 43rem container width. `one` (NEW 2026-11-25, owner:
   * "our contacts still looks different then the official one we have an extra pane"): ONE pane at
   * every width, as Google Contacts (measured 2026-11-25: the list is its own page; opening a
   * person replaces it, with a back arrow). `view` picks the pane, the back arrow always shows.
   */
  panes?: "one" | "two";
  /**
   * The app's key action as a FAB (JSX, e.g. an M3 `FAB`), at the lower end corner of the list
   * pane below 600px, on the list view only (M3: the FAB sits at the lower end corner on compact;
   * from 600px it belongs in the rail, `Layout.Rail fab`). Placed above the compact side-sheet
   * opener. Placement only: the FAB is the caller's.
   */
  fab?: JSXOutput;
};

/**
 * M3's LIST-DETAIL canonical layout as TWO PANES in the primary track (NEW 2026-11-24).
 * m3.material.io/foundations/layout/canonical-layouts/list-detail (read 2026-11-24): "A
 * list-detail layout uses two panes"; one pane on compact, two from expanded; the back button in
 * single-pane only; selection in two-pane only. /breakpoints/expanded: the fixed pane is 360dp,
 * "The spacer between panes is 24dp".
 *
 * Sources: e-store's pane roles (`Layout.Pane role="secondary"` = its fixed `layout-pane-fixed`
 * pane beside the flexible primary one, `packages/ui/PLAN.md` "List-detail — use Layout.Panes +
 * role=secondary", its gallery's `gap-(--layout-pane-spacer) md:grid-cols-[360px_1fr]` demo).
 * e-store's own apps instead split ONE pane with a border (`chat-workspace.tsx`), which is not
 * M3's two panes; ours was a copy of that until 2026-11-24 (owner: "i dont think your using the
 * correct css etc and panes"). The structure here is NEW; second agent reviewed.
 *
 * Put it as the ONE root of `Layout.Pane role="primary" bleed`: the `<main>` then paints no
 * surface (`layout.css`), and the two parts below are the panes. Two panes from a 43rem CONTAINER
 * width (the primary track, not the window: the drawer and the supporting pane take room from
 * it); one below, chosen by `view`. Below 600px the panes are square and edge to edge (the pane
 * radius is 0 there).
 */
const LayoutListDetail = component$<LayoutListDetailProps>(
  ({ view = "list", panes = "two", fab, class: className, ...rest }) => {
    const styles = layoutVariants();
    return (
      <div
        {...rest}
        data-qds-list-detail=""
        data-view={view}
        data-panes={panes}
        class={[styles.listDetail(), className]}
      >
        <div class={styles.listDetailGrid()}>
          <Slot />
        </div>
        {fab && (
          <div data-qds-list-detail-fab="" class={styles.listDetailFab()}>
            {freshJsx(fab)}
          </div>
        )}
      </div>
    );
  },
);

export type LayoutListPaneProps = PropsOf<"section">;

/**
 * The list pane: the fixed 360dp pane (e-store's `secondary` sizing). A `<section>`: name it
 * (`aria-labelledby` its `Layout.PaneHeader titleId`). Give it a `Layout.PaneHeader` and ONE body
 * element; it scrolls itself on the pane rulers, like `Layout.Pane`.
 */
const LayoutListPane = component$<LayoutListPaneProps>(
  ({ class: className, ...rest }) => {
    const styles = layoutVariants();
    return (
      <section
        {...rest}
        data-qds-list-pane=""
        class={[styles.listPane(), className]}
      >
        <Slot />
      </section>
    );
  },
);

export type LayoutDetailPaneProps = PropsOf<"div"> & {
  /**
   * The content fills the pane and scrolls itself (a conversation with its composer pinned at the
   * bottom): no rulers, no scroll here. Default: the pane scrolls, on the pane rulers, and takes a
   * `Layout.PaneHeader` and ONE body element (as `Layout.Pane`).
   */
  bleed?: boolean;
};

/** The detail pane: the flexible pane beside the list (e-store's `primary` sizing). */
const LayoutDetailPane = component$<LayoutDetailPaneProps>(
  ({ bleed = false, class: className, ...rest }) => {
    const styles = layoutVariants();
    return (
      <div
        {...rest}
        data-qds-detail-pane=""
        data-qds-pane-bleed={bleed ? "" : undefined}
        class={[styles.detailPane(), className]}
      >
        <Slot />
      </div>
    );
  },
);

export type LayoutSupportingPaneProps = Omit<
  PropsOf<"aside">,
  "popover" | "onToggle$"
> & {
  /** The pane's title and name. Defaults to the open companion's label. */
  header?: string;
  /** The close button's name. */
  closeLabel?: string;
  /** The close button's icon. */
  closeIcon?: IconName;
  /**
   * The name of the companion tab row at the top of the compact sheet (below 600px, with two
   * or more companions). e-store's `companionTabsLabel`.
   */
  companionTabsLabel?: string;
  /** The name of the button that opens the sheet below 600px, where the companion rail is hidden. */
  showLabel?: string;
  /** That button's icon, drawn turned 180 degrees (pointing at the panel's edge). */
  showIcon?: IconName;
};

/** Below 840px (not the expanded window size) the supporting pane is a modal side sheet. */
const isSheetWidth = () => !matchMedia(EXPANDED_QUERY).matches;

/**
 * Calls `done` once the scaffold's track transition (`grid-template-columns`, 300ms, `layout.css`)
 * started by the change just made has ended (NEW 2026-11-24, not in e-store): what a region that
 * closes by its track waits for before it hides its content, so the content slides out with the
 * track instead of vanishing first. Two frames first: a `useTask$` runs before Qwik patches the
 * DOM, so the transition does not exist yet. `getAnimations()` brings the style up to date; with
 * reduced motion (no transition) or a cancelled one it settles at once, and a timeout ends the
 * wait if a transition never finishes (as `closeAnimated`).
 */
const afterTrackTransition = (from: Element | null, done: () => void) => {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const scaffold = from?.closest(".layout-scaffold");
      const running = (scaffold?.getAnimations() ?? []).filter(
        (animation) =>
          animation instanceof CSSTransition &&
          animation.transitionProperty === "grid-template-columns" &&
          animation.playState === "running",
      );
      if (running.length === 0) {
        done();
        return;
      }
      void Promise.race([
        Promise.all(
          running.map((animation) => animation.finished.catch(() => {})),
        ),
        new Promise((resolve) => setTimeout(resolve, 450)),
      ]).then(done);
    }),
  );
};

/**
 * The control that opened each sheet. Recorded by the click handlers (their element), not read
 * from `document.activeElement`: Safari does not focus a clicked button, so that was `<body>`.
 */
const sheetOpeners = new WeakMap<HTMLElement, HTMLElement>();

/** Notes which control is opening the supporting pane's sheet, for focus to return to it. */
function rememberSheetOpener(supportId: string, opener: HTMLElement) {
  const sheet = document.getElementById(supportId);
  if (sheet && !sheet.contains(opener)) sheetOpeners.set(sheet, opener);
}

/**
 * Where focus goes when the sheet opens: a control the open panel marks `data-autofocus` (a form
 * opens on its first field; NEW 2026-11-24, owner), else the first control on show: the selected
 * tab, else the close button. `data-autofocus`, not `autofocus`: the native attribute would also
 * take focus on page load wherever the pane is server-rendered beside the page (HTML autofocus).
 */
const firstSheetControl = (sheet: HTMLElement) => {
  const shown = (element: HTMLElement) => element.getClientRects().length > 0;
  const marked = Array.from(
    sheet.querySelectorAll<HTMLElement>("[data-autofocus]:not(:disabled)"),
  ).find(shown);
  return (
    marked ??
    Array.from(
      sheet.querySelectorAll<HTMLElement>(
        '[role="tab"][tabindex="0"], button, a[href], input, select, textarea',
      ),
    ).find(shown)
  );
};

/**
 * Opens the sheet (below 840px) and makes it modal: every other region of the scaffold is
 * `inert` while it is open (a popover alone neither traps focus nor hides the page), focus moves
 * to its first control, and on close it goes back to the control that opened it. A popover
 * opened from script has no invoker, so the browser would leave focus on `<body>`. After
 * e-store's `openSupportSheet`; the `inert` and the recorded opener are ours.
 */
function openSupportSheet(sheet: HTMLElement) {
  if (!sheet.isConnected || !isSheetWidth()) return;
  // Opened again while its exit plays: it never left the top layer; the exit is dropped and the
  // enter transition runs back from where it is.
  sheet.removeAttribute(CLOSING_ATTR);
  if (!sheet.matches(":popover-open")) {
    const doc = sheet.ownerDocument;
    const opener =
      sheetOpeners.get(sheet) ??
      (doc.activeElement !== doc.body
        ? (doc.activeElement as HTMLElement | null)
        : null);
    sheetOpeners.delete(sheet);
    const others = Array.from(sheet.parentElement?.children ?? []).filter(
      (element) => element !== sheet && !element.hasAttribute("inert"),
    );
    const restore = (event: Event) => {
      if ((event as ToggleEvent).newState !== "closed") return;
      sheet.removeEventListener("toggle", restore);
      for (const element of others) element.removeAttribute("inert");
      // Closed because the window grew past 840px: the pane is on show beside the primary
      // one, and focus stays where it is.
      if (!isSheetWidth()) return;
      const focus = doc.activeElement;
      if (
        opener?.isConnected &&
        (!focus || focus === doc.body || sheet.contains(focus))
      ) {
        opener.focus();
      }
    };
    sheet.addEventListener("toggle", restore);
    // `inert` only when the sheet did open, or the page would be left inert behind nothing.
    if (openPopover(sheet)) {
      for (const element of others) element.setAttribute("inert", "");
    } else {
      sheet.removeEventListener("toggle", restore);
    }
  }
  (firstSheetControl(sheet) ?? sheet).focus();
}

/**
 * Opens the supporting pane on a companion, at any width: below 840px that is the sheet. When
 * `supportExpanded` is already true but the sheet is closed (a pane rendered expanded on a
 * narrow window), the state does not change, so the sheet is opened here directly.
 */
function showSupport(
  layout: { supportId: string; supportExpanded: Signal<boolean> },
  opener: HTMLElement,
) {
  rememberSheetOpener(layout.supportId, opener);
  if (layout.supportExpanded.value && isSheetWidth()) {
    const sheet = document.getElementById(layout.supportId);
    if (sheet) openSupportSheet(sheet);
  }
  layout.supportExpanded.value = true;
}

/**
 * Opens the supporting pane on companion `id`, from a page's own control (a list row, a card),
 * the way the companion rail's buttons do: it notes `opener` so focus goes back to it when the
 * sheet (below 840px) closes, and opens the sheet even when `supportExpanded` is already true.
 * Setting `activeCompanion` / `supportExpanded` by hand does neither. Call it from an event
 * handler (browser only); read `layout` with `useContext(layoutContextId)`. NEW 2026-11-24, not
 * in e-store (its companion panels open only from its companion rail).
 */
export function openCompanion(
  layout: Pick<
    LayoutContextValue,
    "supportId" | "supportExpanded" | "activeCompanion"
  >,
  id: string,
  opener?: HTMLElement | null,
) {
  layout.activeCompanion.value = id;
  const pane = {
    supportId: layout.supportId,
    supportExpanded: layout.supportExpanded,
  };
  if (opener) showSupport(pane, opener);
  else layout.supportExpanded.value = true;
}

/**
 * Whether the supporting pane is on show to the visitor: from 840px the expanded state, below
 * that the sheet being open (the two can disagree after a server render; see `showSupport`).
 */
function supportShown(layout: {
  supportId: string;
  supportExpanded: Signal<boolean>;
}) {
  if (!isSheetWidth()) return layout.supportExpanded.value;
  return !!document.getElementById(layout.supportId)?.matches(":popover-open");
}

/**
 * Notes on the sheet, at once (a `sync$`: a lazy handler runs after the browser has acted), that
 * it was asked to close: Escape with no menu or other popup open inside it (that Escape is the
 * popup's), or a press that began AND ended on its scrim (outside it; a drag out of the sheet
 * is not a dismissal). Listens on the document for presses. Serialized as text: everything it uses is inline.
 */
const markSheetDismiss = sync$((event: Event, sheet: HTMLElement) => {
  if (event.type === "keydown") {
    const key = (event as KeyboardEvent).key;
    if (key !== "Escape") return;
    const inner = Array.from(
      sheet.querySelectorAll(":popover-open, dialog[open]"),
    );
    if (inner.length === 0) sheet.setAttribute("data-dismiss", "");
    return;
  }
  if (!sheet.matches(":popover-open")) return;
  const pointer = event as PointerEvent;
  const target = pointer.target as Element | null;
  const box = sheet.getBoundingClientRect();
  // On the sheet itself (a browser that hit-tests its `::backdrop` to it): outside its box.
  // Elsewhere: not in it, and not in another top-layer popup (a snackbar, a tooltip).
  const outside =
    target === sheet
      ? !(
          pointer.clientX >= box.left &&
          pointer.clientX <= box.right &&
          pointer.clientY >= box.top &&
          pointer.clientY <= box.bottom
        )
      : !!target && !target.closest(":popover-open, dialog[open]");
  if (event.type === "pointerdown") {
    sheet.toggleAttribute("data-scrim-down", outside);
    return;
  }
  const began = sheet.hasAttribute("data-scrim-down");
  sheet.removeAttribute("data-scrim-down");
  if (began && outside) sheet.setAttribute("data-dismiss", "");
});

/**
 * The supporting pane: the second pane, opened and closed from `Layout.CompanionRail` (or a
 * `Layout.SupportToggle`). Beside the primary pane from 840px; a modal side sheet below that
 * (a `popover="auto"`: top layer, `::backdrop`, Escape and light dismiss are the browser's).
 * Below 600px, where the companion rail is hidden, it renders its own opener at the bottom end,
 * and with two or more companions the sheet starts with a tab row, one tab per companion.
 * Give it ONE element as its body.
 */
const LayoutSupportingPane = component$<LayoutSupportingPaneProps>(
  ({
    header,
    closeLabel = "Close side panel",
    closeIcon = "close",
    companionTabsLabel = "Companion apps",
    showLabel = "Show side panel",
    showIcon = "chevron_right",
    class: className,
    ...rest
  }) => {
    const layout = useContext(layoutContextId);
    const { supportExpanded, activeCompanion, supportId } = layout;
    const styles = layoutVariants();
    const sheetRef = useSignal<HTMLElement>();
    // Whether the sheet is open (below 840px): the opener's `aria-expanded`.
    const sheetOpen = useSignal(false);
    // Whether the tab row is on show (the sheet open below 600px): only then is the panel a
    // `tabpanel` (ARIA, not visible layout, so a client value is fine here: rule L19).
    const tabsShown = useSignal(false);
    const companions = useComputed$(() => layout.config.value.companions ?? []);
    // The open companion, when it is one of the list.
    const activeApp = useComputed$(() =>
      companions.value.find(
        (companion) => companion.id === activeCompanion.value,
      ),
    );
    const heading = useComputed$(
      () => header ?? activeApp.value?.label ?? "Side panel",
    );
    const panelId = `${layout.supportId}-panel`;
    const titleId = `${layout.supportId}-title`;
    const tabId = (id: string) => `${layout.supportId}-tab-${id}`;

    // Below 840px the expanded state is the sheet: follow it. A `useTask$` re-runs on the client
    // only when `supportExpanded` changes; its first run is on the server, where it does nothing,
    // so a pane rendered expanded never pops up as a modal on load (e-store's).
    useTask$(({ track }) => {
      const expanded = track(() => supportExpanded.value);
      if (isServer) return;
      const sheet = sheetRef.value;
      if (!sheet || !isSheetWidth()) return;
      if (expanded) openSupportSheet(sheet);
      else if (sheet.matches(":popover-open")) {
        // The exit plays, then `hidePopover()`; not awaited (the task must not hold the render).
        void closeAnimated(sheet, () => {
          if (sheet.matches(":popover-open")) sheet.hidePopover();
        });
      }
    });

    // Escape, a press on the scrim or `hidePopover()`: a sheet that closes collapses the pane,
    // as the close button does. Not when it closed because the window grew past 840px, where
    // the pane stays expanded beside the primary one.
    const onSheetToggle$ = $((event: ToggleEvent) => {
      const open = event.newState === "open";
      sheetOpen.value = open;
      tabsShown.value = open && matchMedia(COMPACT_QUERY).matches;
      if (open || !isSheetWidth()) return;
      supportExpanded.value = false;
      activeCompanion.value = null;
    });

    // The companion (and so the page's panel content) is cleared only once the pane is gone, so
    // the content slides out with it (2026-11-24): below 840px by the sheet's `toggle` after its
    // exit (`onSheetToggle$`), from 840px when the support track has closed.
    const close$ = $(() => {
      supportExpanded.value = false;
      if (isSheetWidth()) return;
      afterTrackTransition(sheetRef.value ?? null, () => {
        if (!supportExpanded.value) activeCompanion.value = null;
      });
    });

    // The sheet is `popover="manual"`: a `popover="auto"` closes itself on Escape and on a press
    // outside, at once and uncancellably (HTML spec: light dismiss), which skipped the exit. So
    // those two are ours: both noted at once by `markSheetDismiss`, acted on here.
    const dismiss$ = $((_: Event, sheet: HTMLElement) => {
      const asked = sheet.hasAttribute("data-dismiss");
      sheet.removeAttribute("data-dismiss");
      if (asked && isSheetWidth() && sheet.matches(":popover-open")) close$();
    });

    return (
      <>
        <aside
          {...rest}
          ref={sheetRef}
          id={layout.supportId}
          popover="manual"
          tabIndex={-1}
          aria-labelledby={titleId}
          data-expanded={supportExpanded.value ? "true" : "false"}
          class={[styles.supportingPane(), className]}
          onToggle$={onSheetToggle$}
          onKeyDown$={[markSheetDismiss, dismiss$]}
          // On the document: a press on a popover's `::backdrop` is not hit-tested to the
          // popover (Chrome, 2026-11-24: it lands on the scaffold), unlike a dialog's.
          document:onPointerDown$={markSheetDismiss}
          document:onPointerUp$={[markSheetDismiss, dismiss$]}
          // Crossing 840px: a sheet left open turns back into the pane (it stays expanded); a
          // pane left expanded when the window narrows collapses instead of popping up as a modal.
          // Crossing 600px with the sheet open shows or hides the tab row.
          window:onResize$={() => {
            const sheet = sheetRef.value;
            if (!sheet) return;
            const open = sheet.matches(":popover-open");
            tabsShown.value = open && matchMedia(COMPACT_QUERY).matches;
            if (!isSheetWidth()) {
              sheet.removeAttribute(CLOSING_ATTR);
              if (open) sheet.hidePopover();
            } else if (supportExpanded.value && !open) {
              supportExpanded.value = false;
              activeCompanion.value = null;
            }
          }}
        >
          {/* Below 600px, two or more companions: WAI-ARIA tabs, manual activation (arrows move
              focus, Enter / Space choose), one tab stop. Choosing a tab keeps the sheet open. */}
          {companions.value.length > 1 && (
            <div
              role="tablist"
              aria-label={companionTabsLabel}
              data-layout-companion-tabs=""
              class={styles.sheetTabs()}
              // As `Tabs`: Left / Right, stopping at the ends.
              data-roving="horizontal"
              data-roving-loop="false"
              onKeyDown$={[rovingKeys]}
            >
              {companions.value.map((app, index) => {
                const selected = activeApp.value?.id === app.id;
                return (
                  <button
                    key={app.id}
                    id={tabId(app.id)}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={
                      selected || (index === 0 && !activeApp.value) ? 0 : -1
                    }
                    class={styles.sheetTab()}
                    onClick$={() => (activeCompanion.value = app.id)}
                  >
                    <span
                      class={styles.companionPill({ emphasis: app.emphasis })}
                    >
                      <Icon
                        name={app.icon}
                        class={
                          app.iconSelected
                            ? styles.companionIconRest()
                            : undefined
                        }
                      />
                      {app.iconSelected && (
                        <Icon
                          name={app.iconSelected}
                          class={styles.companionIconSelected()}
                        />
                      )}
                    </span>
                    <span class={styles.sheetTabLabel()}>{app.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div
            id={panelId}
            role={
              tabsShown.value && companions.value.length > 1 && activeApp.value
                ? "tabpanel"
                : undefined
            }
            aria-labelledby={
              tabsShown.value && companions.value.length > 1 && activeApp.value
                ? tabId(activeApp.value.id)
                : undefined
            }
            class={styles.supportPanel()}
          >
            <header class={[styles.paneHeader(), styles.supportHeader()]}>
              <div class={styles.paneHeaderRow()}>
                <h2 id={titleId} class={styles.paneTitle()}>
                  {heading.value}
                </h2>
                {/* The open companion's own actions (a "more" menu), before Close. FROM E-STORE
                    (`Layout.SupportingPane` `header-actions` slot, 2026-11-25): projected
                    children, never a JSX prop. */}
                <Slot name="header-actions" />
                <IconButton
                  icon={closeIcon}
                  label={closeLabel}
                  onClick$={close$}
                />
              </div>
            </header>
            <Slot />
          </div>
        </aside>
        {/* Below 600px the companion rail is hidden: this opens the sheet on the open companion,
            or the first. The rail's own hide / show tab, at the same place. */}
        {companions.value.length > 0 && (
          <button
            type="button"
            aria-label={showLabel}
            data-tooltip=""
            aria-controls={layout.supportId}
            aria-expanded={sheetOpen.value}
            class={[styles.sideToggle(), styles.sheetTrigger()]}
            onClick$={(_, element) => {
              if (!activeApp.value) {
                activeCompanion.value = companions.value[0].id;
              }
              showSupport({ supportId, supportExpanded }, element);
            }}
          >
            <span class={styles.sideToggleShape()} />
            <span class={styles.sideToggleIcon()}>
              <Icon name={showIcon} size="sm" />
            </span>
          </button>
        )}
      </>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Companion rail                                                     */
/* ------------------------------------------------------------------ */

export type LayoutCompanionRailProps = Omit<PropsOf<"nav">, "children"> & {
  /** One button per companion. Defaults to `Layout.Root companions`. */
  apps?: LayoutCompanion[];
  /** Show the bottom button that hides and shows this rail. Defaults to true. */
  hideButton?: boolean;
  /** That button's name while the rail shows. */
  hideLabel?: string;
  /** That button's name while the rail is hidden. */
  showLabel?: string;
};

/**
 * The trailing rail, from 600px: one button per companion. A button opens the supporting pane
 * on its companion; the open companion's button closes the pane.
 */
const LayoutCompanionRail = component$<LayoutCompanionRailProps>(
  ({
    apps,
    hideButton = true,
    hideLabel = "Hide side panel",
    showLabel = "Show side panel",
    "aria-label": ariaLabel = "Side panel",
    class: className,
    ...rest
  }) => {
    const layout = useContext(layoutContextId);
    const { supportExpanded, activeCompanion, trailShown } = layout;
    const styles = layoutVariants();
    return (
      <>
        <nav
          {...rest}
          id={layout.trailId}
          aria-label={ariaLabel}
          data-layout-trail=""
          data-shown={trailShown.value ? "true" : "false"}
          class={[styles.companionRail(), className]}
          data-roving=""
          onKeyDown$={[rovingKeys]}
        >
          {(apps ?? layout.config.value.companions ?? []).map((app) => (
            <button
              key={app.id}
              type="button"
              aria-label={app.label}
              data-tooltip=""
              aria-controls={layout.supportId}
              aria-pressed={
                supportExpanded.value && activeCompanion.value === app.id
              }
              class={styles.companionTab()}
              onClick$={(_, element) => {
                const pane = { supportId: layout.supportId, supportExpanded };
                // What the visitor sees, not only the state: below 840px a pane rendered
                // expanded on the server has no sheet open yet (see `showSupport`).
                const isOpen =
                  supportShown(pane) && activeCompanion.value === app.id;
                activeCompanion.value = isOpen ? null : app.id;
                if (isOpen) supportExpanded.value = false;
                else showSupport(pane, element);
              }}
            >
              <span class={styles.companionPill({ emphasis: app.emphasis })}>
                <Icon
                  name={app.icon}
                  class={
                    app.iconSelected ? styles.companionIconRest() : undefined
                  }
                />
                {app.iconSelected && (
                  <Icon
                    name={app.iconSelected}
                    class={styles.companionIconSelected()}
                  />
                )}
              </span>
            </button>
          ))}
        </nav>
        {hideButton && (
          <button
            type="button"
            aria-label={trailShown.value ? hideLabel : showLabel}
            data-tooltip=""
            aria-expanded={trailShown.value}
            aria-controls={layout.trailId}
            class={[styles.sideToggle(), styles.sideToggleRail()]}
            onClick$={() => {
              // Hiding the rail also closes the pane it controls.
              if (trailShown.value) {
                activeCompanion.value = null;
                supportExpanded.value = false;
              }
              trailShown.value = !trailShown.value;
            }}
          >
            <span class={styles.sideToggleShape()} />
            <span class={styles.sideToggleIcon()}>
              <Icon name="chevron_right" size="sm" />
            </span>
          </button>
        )}
      </>
    );
  },
);

export type LayoutSupportToggleProps = Omit<
  PropsOf<"button">,
  "children" | "onClick$"
> & {
  icon: IconName;
  /** Its name for screen readers and its hover title. */
  label: string;
  /** The companion to open. Without it the pane keeps the one it had. */
  app?: string;
  /** Called after the pane opened or closed. */
  onToggle$?: QRL<(expanded: boolean) => void>;
};

/**
 * An icon button that opens and closes the supporting pane from anywhere (the app bar, on a
 * phone, where the companion rail is not shown).
 */
const LayoutSupportToggle = component$<LayoutSupportToggleProps>(
  ({ icon, label, app, onToggle$, ...rest }) => {
    const layout = useContext(layoutContextId);
    const { supportExpanded, activeCompanion } = layout;
    return (
      <IconButton
        {...rest}
        icon={icon}
        label={label}
        aria-controls={layout.supportId}
        aria-expanded={supportExpanded.value}
        onClick$={(_, element) => {
          const pane = { supportId: layout.supportId, supportExpanded };
          const expanded = !supportShown(pane);
          if (expanded && app) activeCompanion.value = app;
          if (expanded) showSupport(pane, element as HTMLElement);
          else supportExpanded.value = false;
          return onToggle$?.(expanded);
        }}
      />
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

export type LayoutFooterProps = PropsOf<"footer">;

/** Small print. One line fits inside the bottom margin; more makes the row grow. */
const LayoutFooter = component$<LayoutFooterProps>(
  ({ class: className, ...rest }) => {
    const styles = layoutVariants();
    return (
      <footer
        {...rest}
        data-layout-footer=""
        class={[styles.footer(), className]}
      >
        <Slot />
      </footer>
    );
  },
);

export const Layout = {
  Root: LayoutRoot,
  AppBar: LayoutAppBar,
  MenuButton: LayoutMenuButton,
  Rail: LayoutRail,
  RailItem: NavigationRail.Item,
  Drawer: LayoutDrawer,
  DrawerItem: LayoutDrawerItemRow,
  Pane: LayoutPane,
  PaneHeader: LayoutPaneHeader,
  ListDetail: LayoutListDetail,
  ListPane: LayoutListPane,
  DetailPane: LayoutDetailPane,
  SupportingPane: LayoutSupportingPane,
  CompanionRail: LayoutCompanionRail,
  SupportToggle: LayoutSupportToggle,
  Footer: LayoutFooter,
};
