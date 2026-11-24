import { createContextId } from "@qwik.dev/core";
import type { ReadonlySignal, Signal } from "@qwik.dev/core";
import type { IconName } from "../icon";

/** A row in the navigation drawer. Plain data. */
export type LayoutDrawerItem = {
  href: string;
  label: string;
  icon?: IconName;
  /** A link to another site: it gets `rel="external"`. */
  external?: boolean;
  /**
   * The destination's sub-navigation (e-store's `NavItem.items`): rows under it in the standard
   * and modal drawers; in the floating drawer, the card a rail destination with the same `href`
   * shows on hover or focus.
   */
  items?: LayoutDrawerItem[];
};

/** A destination in the navigation rail. Plain data: a CMS can store the list. */
export type LayoutRailItem = {
  href: string;
  label: string;
  icon: IconName;
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
   * The drawer's destinations. None: no drawer from 600px, and the rail's menu button stays
   * but is disabled. The compact modal drawer (below 600px) lists these, or the rail items when
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
   * rail from 600px, in the app bar below 600px. NEW (e-store's apps put `ThemeModeToggle` in
   * `Layout.Rail`'s slot by hand).
   */
  themeToggle?: boolean;
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
