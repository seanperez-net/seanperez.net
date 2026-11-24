import {
  $,
  Slot,
  component$,
  isServer,
  useComputed$,
  useContext,
  useContextProvider,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { tv } from "tailwind-variants/lite";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { IconButton } from "../icon-button";
import { Modal } from "../modal";
import { NavigationRail } from "../navigation-rail";
import type { NavigationRailRootProps } from "../navigation-rail";
import { ThemeToggle } from "../theme-toggle";
import { TooltipProvider } from "../tooltip/tooltip-provider";
import { TopAppBar } from "../top-app-bar";
import type { TopAppBarProps } from "../top-app-bar";
import { rovingKeys } from "../../utils/roving-focus";
import { openPopover } from "../../utils/top-layer";
import { useThemeProvider } from "../../theme/theme-context";
import type { ThemeProps } from "../../theme/theme-context";
import { layoutContextId } from "./layout-context";
import type {
  LayoutCompanion,
  LayoutConfig,
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
    // The section's title in the card, over a divider (e-store's `DrawerPanel`).
    // The floating / docked card's list: 12dp from the card's top edge, as from its sides.
    drawerCardBody: ["pt-(--layout-drawer-inset)"],
    // A section's name above its children in the compact modal drawer (M3 drawer headline,
    // e-store's `navDrawerSectionVariants.headline`): title-small, not a link.
    drawerSection: [
      "flex",
      "h-14",
      "items-center",
      "ps-(--layout-drawer-row-inset)",
      "text-title-small",
      "text-on-surface-variant",
    ],
    drawerHeader: ["layout-drawer-header-rulers"],
    // The modal navigation drawer (below 600px only): a `Modal` on the start edge. Its bar's
    // inset puts the close button exactly where the app bar's menu button that opened it is.
    drawerModal: [
      "[--modal-sheet-width:min(var(--layout-drawer-width),85vw)]",
      "[--modal-bar-inset:calc(var(--layout-margin)-var(--layout-icon-button-overhang))]",
    ],
    drawerModalBody: [],
    // The scrolling part, docked and modal. e-store's drawer list is a `scrollbar-pane` with the
    // default track margins (20px at each end), so the bar never touches the header or the edge.
    drawerBody: [
      "layout-drawer-rulers",
      "min-h-0",
      "overflow-y-auto",
      "overscroll-contain",
      "scrollbar-pane",
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
      // A child row (a destination's sub-navigation) starts on its parent's label line:
      // 16 inset + 24 icon + 12 gap.
      "data-nested:ps-13",
      "text-label-large",
      "text-on-surface-variant",
      "outline-none",
      "hover:bg-on-surface/8",
      "focus-visible:outline-2",
      "focus-visible:outline-secondary",
      "aria-[current=page]:bg-secondary-container",
      "aria-[current=page]:text-on-secondary-container",
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
      // Square below 600px: nothing to clear there.
      "scrollbar-pane",
      "max-sm:[--scrollbar-track-margin:0px]",
    ],
    paneHeader: ["pane-header-bleed", "bg-surface"],
    paneHeaderRow: ["flex", "min-w-0", "items-center", "gap-2"],
    paneTitle: ["min-w-0", "flex-1", "truncate", "text-title-large"],

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
      // From 840px: a pane in the support track, shown while expanded.
      "md:relative",
      "md:inset-auto",
      "md:h-auto",
      "md:w-auto",
      "md:rounded-(--layout-pane-radius)",
      "md:bg-surface",
      // `--field-bg` (the floated label's patch) follows the fill. The `.bg-surface*` rules in
      // `tokens/utilities.css` match the plain class only, not `md:` / `max-md:` variants.
      "md:[--field-bg:var(--color-surface)]",
      "md:data-[expanded=true]:flex",
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
    // (e-store's sheet trigger). Shown whole: a phone has no hover to slide it out.
    sheetTrigger: ["sm:hidden"],
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
      "before:bg-on-surface",
      "before:opacity-0",
      "before:content-['']",
      "group-hover/companion:before:opacity-hover",
      "group-focus-visible/companion:outline-2",
      "group-focus-visible/companion:outline-secondary",
      "group-aria-pressed/companion:bg-secondary-container",
      "group-aria-pressed/companion:text-on-secondary-container",
      // The same pill in the compact sheet's tabs.
      "group-aria-selected/companion:bg-secondary-container",
      "group-aria-selected/companion:text-on-secondary-container",
    ],

    footer: [
      "scaffold-footer",
      "layout-footer-rulers",
      "text-center",
      "text-body-medium",
      // `on-surface-variant`: M3's low-emphasis TEXT role. `outline` is a border role and failed
      // Lighthouse colour contrast here (3.84:1 against the 4.5:1 needed).
      "text-on-surface-variant",
    ],
  },
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

/** The destination is the page, or one of its children is. */
const sectionIsActive = (item: LayoutDrawerItem, active: string) =>
  item.href === active ||
  !!item.items?.some((child) => isWithin(active, child.href));

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
      docked,
      drawerModalOpen,
      supportExpanded,
      activeCompanion,
    });
    const styles = layoutVariants();

    return (
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
        {layout.config.value.themeToggle && (
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
};

/**
 * The navigation rail in the scaffold: a `NavigationRail` on the leading edge from 600px.
 * Destinations are `Layout.Root railItems`; the default slot takes more `Layout.RailItem`s.
 * Its menu button is e-store's (`nav-rail.tsx` `handleMenuTrigger$`): with `drawerType`
 * `floating` it docks and undocks the floating drawer, otherwise it opens and closes the standard
 * drawer in the nav track. With no `drawerItems` there is no drawer: the button stays, disabled.
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
      hasDrawer,
    } = layout;
    const styles = layoutVariants();
    const floating = useComputed$(() => drawerType.value === "floating");
    // What the button shows as open: the docked floating drawer, or the open standard one.
    // e-store's: floating, the button shows the visitor's dock CHOICE (`drawerDocked`), which
    // persists across pages. On a page outside every section the docked track is just empty.
    const menuOpen = useComputed$(() =>
      floating.value
        ? drawerDocked.value
        : drawerType.value === "standard" && drawerOpen.value,
    );
    const menuName = useComputed$(() =>
      floating.value
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
      // Docked (the choice, e-store's `isDrawerDocked`): hover never floats a card, even on a
      // page whose section has no panel.
      if (drawerType.value === "floating" && drawerDocked.value) return;
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
          // No drawer items: no drawer to open. The button stays (owner 2026-11-23), native
          // `disabled`, so Tab skips it and a click does nothing.
          disabled={!hasDrawer.value}
          aria-controls={hasDrawer.value ? layout.drawerId : undefined}
          aria-expanded={hasDrawer.value ? menuOpen.value : undefined}
          onClick$={() => {
            if (!hasDrawer.value) return;
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
        {layout.config.value.railItems?.map((item) => (
          <NavigationRail.Item
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
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
    // Floating and not docked: the hovered or focused destination's section, if it has children.
    const peekSection = useComputed$(() =>
      // e-store's: the floating card is only for the undocked choice. Docked with no section
      // on this page, the track is empty (0px) and nothing floats.
      !floating.value || layout.drawerDocked.value
        ? undefined
        : (layout.config.value.drawerItems ?? []).find(
            (item) => hasChildren(item) && item.href === hoveredRailHref.value,
          ),
    );
    // What the floating card shows: the docked section, else the peeked one.
    const shownSection = useComputed$(() =>
      docked.value ? activeSection.value : peekSection.value,
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

    const rows = (items: LayoutDrawerItem[], nested: boolean) =>
      items.map((item) => (
        <LayoutDrawerItemRow
          key={`${nested ? "child:" : ""}${item.href}`}
          href={item.href}
          rel={drawerRel(item)}
          nested={nested}
          current={item.href === layout.config.value.activeHref}
        >
          {!nested && item.icon && <Icon name={item.icon} />}
          {item.label}
        </LayoutDrawerItemRow>
      ));
    // Every destination; one with children is a section: its name as a headline (not a link to
    // the same page as its first child), then its children.
    const allRows = (items: LayoutDrawerItem[]) =>
      items.flatMap((item) =>
        hasChildren(item)
          ? [
              <div key={`section:${item.href}`} class={styles.drawerSection()}>
                {item.label}
              </div>,
              ...rows(item.items ?? [], true),
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
            data-docked={docked.value ? "true" : "false"}
            class={[styles.drawer(), className]}
            style={
              docked.value
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
              const inside = !!panelRef.value?.contains(document.activeElement);
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
            {!docked.value && peekSection.value && (
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
                  <div
                    class={[styles.drawerBody(), styles.drawerCardBody()]}
                    data-roving="vertical"
                    onKeyDown$={[rovingKeys]}
                  >
                    <nav
                      class={styles.drawerList()}
                      aria-label={shownSection.value?.label}
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
            data-docked={docked.value ? "true" : "false"}
            class={[styles.drawer(), className]}
          >
            <div class={styles.drawerCard()}>
              <div
                class={[styles.drawerBody(), styles.drawerCardBody()]}
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
};

/**
 * The primary pane: the page's `<main>` and the skip link's target. It scrolls; the scaffold
 * does not. Give it a `Layout.PaneHeader` and ONE other element (the body).
 */
const LayoutPane = component$<LayoutPaneProps>(
  ({ role = "primary", class: className, ...rest }) => {
    const layout = useContext(layoutContextId);
    const styles = layoutVariants();
    return (
      <main
        {...rest}
        id={layout.mainId}
        data-pane={role}
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
};

/** A pane's own header: its title, then its actions (the default slot). Sticks while the pane scrolls. */
const LayoutPaneHeader = component$<LayoutPaneHeaderProps>(
  ({ title, headingLevel = 2, class: className, ...rest }) => {
    const styles = layoutVariants();
    const Heading = headingLevel === 1 ? "h1" : "h2";
    return (
      <header {...rest} class={[styles.paneHeader(), className]}>
        <div class={styles.paneHeaderRow()}>
          <Heading class={styles.paneTitle()}>{title}</Heading>
          <Slot />
        </div>
      </header>
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
 * The control that opened each sheet. Recorded by the click handlers (their element), not read
 * from `document.activeElement`: Safari does not focus a clicked button, so that was `<body>`.
 */
const sheetOpeners = new WeakMap<HTMLElement, HTMLElement>();

/** Notes which control is opening the supporting pane's sheet, for focus to return to it. */
function rememberSheetOpener(supportId: string, opener: HTMLElement) {
  const sheet = document.getElementById(supportId);
  if (sheet && !sheet.contains(opener)) sheetOpeners.set(sheet, opener);
}

/** The first control in the sheet that is on show: the selected tab, else the close button. */
const firstSheetControl = (sheet: HTMLElement) =>
  Array.from(
    sheet.querySelectorAll<HTMLElement>(
      '[role="tab"][tabindex="0"], button, a[href], input, select, textarea',
    ),
  ).find((element) => element.getClientRects().length > 0);

/**
 * Opens the sheet (below 840px) and makes it modal: every other region of the scaffold is
 * `inert` while it is open (a popover alone neither traps focus nor hides the page), focus moves
 * to its first control, and on close it goes back to the control that opened it. A popover
 * opened from script has no invoker, so the browser would leave focus on `<body>`. After
 * e-store's `openSupportSheet`; the `inert` and the recorded opener are ours.
 */
function openSupportSheet(sheet: HTMLElement) {
  if (!sheet.isConnected || !isSheetWidth()) return;
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
      else if (sheet.matches(":popover-open")) sheet.hidePopover();
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

    const close$ = $(() => {
      supportExpanded.value = false;
      activeCompanion.value = null;
    });

    return (
      <>
        <aside
          {...rest}
          ref={sheetRef}
          id={layout.supportId}
          popover="auto"
          tabIndex={-1}
          aria-labelledby={titleId}
          data-expanded={supportExpanded.value ? "true" : "false"}
          class={[styles.supportingPane(), className]}
          onToggle$={onSheetToggle$}
          // Crossing 840px: a sheet left open turns back into the pane (it stays expanded); a
          // pane left expanded when the window narrows collapses instead of popping up as a modal.
          // Crossing 600px with the sheet open shows or hides the tab row.
          window:onResize$={() => {
            const sheet = sheetRef.value;
            if (!sheet) return;
            const open = sheet.matches(":popover-open");
            tabsShown.value = open && matchMedia(COMPACT_QUERY).matches;
            if (!isSheetWidth()) {
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
                    <span class={styles.companionPill()}>
                      <Icon name={app.icon} />
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
            title={showLabel}
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
              title={app.label}
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
              <span class={styles.companionPill()}>
                <Icon name={app.icon} />
              </span>
            </button>
          ))}
        </nav>
        {hideButton && (
          <button
            type="button"
            aria-label={trailShown.value ? hideLabel : showLabel}
            title={trailShown.value ? hideLabel : showLabel}
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
  SupportingPane: LayoutSupportingPane,
  CompanionRail: LayoutCompanionRail,
  SupportToggle: LayoutSupportToggle,
  Footer: LayoutFooter,
};
