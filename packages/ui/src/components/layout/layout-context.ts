import { createContextId } from "@qwik.dev/core";
import type { ReadonlySignal, Signal } from "@qwik.dev/core";
import type { PrefetchStrategy } from "@qwik.dev/router";
import type { IconName } from "../icon";

/**
 * When the router's `Link` fetches the destination's JavaScript (`PrefetchStrategy`): the
 * router's default is `"visible"` (as soon as the link is on screen); `"intent"` waits for hover
 * or focus. Use `"intent"` for a destination with a heavy bundle (a map library) that most
 * visitors never open. NEW 2026-11-24 (perf audit), not in e-store.
 */
export type LayoutPrefetch = PrefetchStrategy;

/** A row in the navigation drawer. Plain data. */
export type LayoutDrawerItem = {
  /**
   * The row's destination. Optional for a GROUP (an item with `items` inside a section): it is
   * a button that opens and closes its rows, not a link (e-store's `NavItem.href?`, 2026-11-24).
   */
  href?: string;
  label: string;
  /**
   * A group inside a section (a child with its own `items`) starts open. Default: open only
   * when it holds the page (e-store's rule). NEW 2026-11-24, not in e-store.
   */
  open?: boolean;
  icon?: IconName;
  /** A link to another site: it gets `rel="external"`. */
  external?: boolean;
  /** When the row's `Link` prefetches the destination's bundles. Default: the router's (`"visible"`). */
  prefetchBundles?: LayoutPrefetch;
  /**
   * The destination's sub-navigation (e-store's `NavItem.items`): rows under it in the standard
   * and modal drawers; in the floating drawer, the card a rail destination with the same `href`
   * shows on hover or focus. A child with `items` of its own is a GROUP: a row that opens and
   * closes its rows (e-store's level-2 `DrawerButtonExpandable`, ported 2026-11-24).
   */
  items?: LayoutDrawerItem[];
};

/** A destination in the navigation rail. Plain data: a CMS can store the list. */
export type LayoutRailItem = {
  href: string;
  label: string;
  icon: IconName;
  /**
   * When the rail item's `Link` prefetches the destination's bundles (also used by the compact
   * drawer's row for it). Default: the router's (`"visible"`).
   */
  prefetchBundles?: LayoutPrefetch;
};

/**
 * e-store's `DrawerType` (`Layout.Root drawerType`):
 * - `modal` (default): the drawer is a modal sheet; the rail's menu button turns it into the
 *   standard one (e-store's `handleMenuTrigger$` sets `drawerType` to `standard`);
 * - `standard`: docked in the scaffold's nav track beside the rail, opened and closed by the
 *   rail's menu button;
 * - `floating`: a card beside the rail showing the children of the hovered or focused
 *   destination; the rail's menu button docks it.
 * Below 600px the drawer is always the modal one, opened from the app bar.
 */
/** e-store's `LayoutMode`: `compact` tightens the margins, the pane spacer and the pane corners. */
export type LayoutMode = "default" | "compact";

export type LayoutDrawerType = "modal" | "standard" | "floating";

/** A button in the companion rail, and what the supporting pane is titled while it is open. */
export type LayoutCompanion = {
  /** What `activeCompanion` holds while this one is open. */
  id: string;
  label: string;
  icon: IconName;
  /**
   * Makes this one button stand out from the other companions (NEW 2026-11-24, not in e-store,
   * whose `CompanionApp.color` is a free CSS colour for the icon only). Unset: the rail's own
   * colours. `primary`: M3's FAB colours at rest (`primary-container` / `on-primary-container`),
   * the filled toggle icon button's when open (`primary` / `on-primary`). `tonal`: the tonal icon
   * button's at rest (`secondary-container` / `on-secondary-container`), the tonal toggle's when
   * open (`secondary` / `on-secondary`). Applies to the rail and to the compact sheet's tabs.
   */
  emphasis?: "primary" | "tonal";
  /**
   * The icon while this companion's panel is open (M3: a filled icon for the active item, so the
   * open state is not shown by colour alone), e.g. `waving_hand_filled`. Unset: `icon` always.
   * Same name as `NavigationBar`'s `iconSelected`. NEW 2026-11-24 (owner asked; second agent's
   * suggestion).
   */
  iconSelected?: IconName;
};

/**
 * What the layout shows, as plain serialisable data. It is given to `Layout.Root` as props and
 * every part reads it from context, so a page (or a CMS) describes the whole scaffold in ONE
 * place. A part's own prop, when given, wins over the value here.
 */
export type LayoutConfig = {
  /** The top app bar's title. */
  title?: string;
  /** Makes the title a link (`/`). */
  titleHref?: string;
  /** The address the visitor is on: the rail and drawer item with this `href` is current. */
  activeHref?: string;
  railItems?: LayoutRailItem[];
  /** The modal drawer's heading. */
  drawerTitle?: string;
  /**
   * The drawer's destinations, for every route (the Layout picks what the page shows). None: no
   * drawer from 600px, and the rail's menu button stays but is disabled. Floating: the rail's
   * menu button works only on a page inside a section (`menuEnabled`), and a destination with
   * children floats its card on hover or focus from any page. The compact modal drawer (below 600px) lists these, or the rail items when
   * there are none (e-store's `navDrawerItems` fallback), children included.
   */
  drawerItems?: LayoutDrawerItem[];
  companions?: LayoutCompanion[];
  /** e-store's drawer type. Default `modal`. */
  drawerType?: LayoutDrawerType;
  /**
   * The app bar's menu button and the modal drawer below 600px, where there is no rail.
   * `auto` (default): shown whenever there are destinations. `off`: neither. e-store's `drawer`.
   */
  drawer?: "auto" | "off";
  /**
   * The light / dark switch (`ThemeToggle`), rendered by the layout itself: at the foot of the
   * rail from 600px, in the app bar below 600px. `"rail"`: the rail's foot from 600px and, below
   * 600px, the compact drawer's footer in the large labelled form (`ThemeToggle look="full"`),
   * never the app bar: e-store's rule (L7; e-store's apps put `ThemeModeToggle` in the rail and
   * the drawer footer by hand). NEW as a prop.
   */
  themeToggle?: boolean | "rail";
  /**
   * e-store's `layoutMode` (`data-layout-mode` on the scaffold). `default`: 24px margins and
   * pane spacer, 28px pane corners from 600px. `compact`: 16px margins and spacer, 16px corners.
   * Below 600px panes are square in both. Default `default`.
   */
  layoutMode?: LayoutMode;
};

/**
 * Layout context. Provided by `Layout.Root` and by nothing else; every `Layout.*` part reads
 * it. State goes UP: it lives in `Layout.Root` (or in the app, bound into the root with a
 * `bind:` prop) and comes down through here, so parts never keep their own copy and never need
 * props passed through each other.
 */
export type LayoutContextValue = {
  /** The id of the primary pane: what the skip link jumps to. */
  mainId: string;
  /** The id of the floating / docked drawer: what the rail's menu button controls when there are drawer items. */
  drawerId: string;
  /** The id of the navigation rail. */
  railId: string;
  /** The id of the supporting pane: what the companion rail's buttons control. */
  supportId: string;
  /** The id of the companion rail: what the "Hide side panel" button controls. */
  trailId: string;
  /** `Layout.Root`'s data props. */
  config: ReadonlySignal<LayoutConfig>;
  /** The drawer type in force (the rail's menu button turns `modal` into `standard`). */
  drawerType: Signal<LayoutDrawerType>;
  /** The standard drawer open in the nav track. `Layout.Root bind:drawerOpen`. */
  drawerOpen: Signal<boolean>;
  /** The floating drawer docked beside the rail (from 600px). `bind:drawerDocked`. */
  drawerDocked: Signal<boolean>;
  /** The rail destination hovered or focused: its children float in the drawer. */
  hoveredRailHref: Signal<string | null>;
  /**
   * Where the floating drawer goes: `y` the hovered destination's pill centre (px from the top of
   * the window, for the pointer arrow), `start` the rail's end edge (px from the inline start).
   */
  peek: Signal<{ y: number; start: number }>;
  /** There are drawer items: the drawer exists from 600px and the rail's menu button works. */
  hasDrawer: ReadonlySignal<boolean>;
  /** The drawer item with children the page is in: the docked floating drawer shows its children. */
  activeSection: ReadonlySignal<LayoutDrawerItem | undefined>;
  /**
   * The rail's menu button works on this page: standard / modal, whenever there are drawer
   * items; floating, only when the page is inside a section (`activeSection`). Otherwise it stays,
   * disabled (owner, 2026-11-24).
   */
  menuEnabled: ReadonlySignal<boolean>;
  /** The drawer takes the nav track: standard and open, or floating, docked, with a section. */
  docked: ReadonlySignal<boolean>;
  /** The drawer as a modal sheet, below 600px. Always starts closed. */
  drawerModalOpen: Signal<boolean>;
  /** Whether the supporting pane is shown. `Layout.Root bind:supportExpanded`. */
  supportExpanded: Signal<boolean>;
  /** Whether the companion rail shows. `Layout.Root bind:trailShown`. */
  trailShown: Signal<boolean>;
  /** Which companion the supporting pane shows. `Layout.Root bind:activeCompanion`. */
  activeCompanion: Signal<string | null>;
};

export const layoutContextId = createContextId<LayoutContextValue>(
  "net.seanperez.ui.layout",
);
