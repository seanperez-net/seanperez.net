import { Slot, component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { PrefetchStrategy } from "@qwik.dev/router";
import { tv } from "tailwind-variants/lite";
import { Badge, badgeSpokenText } from "../badge";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { rovingKeys } from "../../utils/roving-focus";

/**
 * Material Design 3 navigation rail.
 * Specs: https://m3.material.io/components/navigation-rail/specs
 *
 * A narrow column on the leading edge: a header (the menu button), the destinations, and a
 * footer. Its rows come from the `layout-rail-rulers` grid, whose header row is as tall as the
 * top app bar, so the menu button sits on the bar's row. `Layout.Rail` places it in the scaffold.
 */
export const navigationRailVariants = tv({
  slots: {
    root: [
      "layout-rail-rulers",
      "w-(--layout-rail-width)",
      "justify-items-center",
      "overflow-x-hidden",
      "overflow-y-auto",
      // Our scrollbar when the rail's destinations overflow; square ends.
      "scrollbar-pane",
      "[--scrollbar-track-margin:0px]",
      "bg-surface-container",
      "text-on-surface",
    ],
    header: ["row-start-1", "grid", "place-items-center"],
    body: [
      "row-start-2",
      "flex",
      "w-full",
      "flex-col",
      "items-center",
      "gap-0",
    ],
    footer: ["row-start-3", "grid", "justify-items-center", "gap-2"],
    item: [
      "group/rail-item",
      "flex",
      "w-full",
      "flex-col",
      "items-center",
      "gap-1",
      "text-label-medium",
      "text-on-surface-variant",
      "cursor-pointer",
      "outline-none",
      "py-1.5",
      "font-medium",
      // The current destination (the page, or the section the page is in): secondary and bold,
      // as e-store's rail label.
      "data-current:text-secondary",
      "data-current:font-bold",
    ],
    // The 56 x 32 indicator pill around an item's icon, with the state layer.
    itemPill: [
      "relative",
      "grid",
      "h-8",
      "w-14",
      "place-items-center",
      "rounded-full",
      "before:absolute",
      "before:inset-0",
      "before:rounded-[inherit]",
      "before:bg-on-surface",
      "before:opacity-0",
      "before:content-['']",
      "group-hover/rail-item:before:opacity-hover",
      "group-focus-visible/rail-item:outline-2",
      "group-focus-visible/rail-item:outline-secondary",
      "group-data-current/rail-item:bg-secondary-container",
      "group-data-current/rail-item:text-on-secondary-container",
    ],
  },
});

export type NavigationRailRootProps = PropsOf<"nav">;

/**
 * The rail. Slots: `header` (a menu button), the default slot (`NavigationRail.Item`s) and
 * `footer` (a theme toggle).
 */
const NavigationRailRoot = component$<NavigationRailRootProps>(
  ({
    "aria-label": ariaLabel = "Main",
    class: className,
    onKeyDown$,
    ...rest
  }) => {
    const styles = navigationRailVariants();
    return (
      <nav
        {...rest}
        aria-label={ariaLabel}
        class={[styles.root(), className]}
        // Arrow keys move between the menu button, the destinations and the footer. A
        // consumer's own `onKeyDown$` runs after them (passed by name, not lost in `...rest`).
        data-roving=""
        onKeyDown$={[rovingKeys, onKeyDown$]}
      >
        <div class={styles.header()}>
          <Slot name="header" />
        </div>
        <div class={styles.body()}>
          <Slot />
        </div>
        <div class={styles.footer()}>
          <Slot name="footer" />
        </div>
      </nav>
    );
  },
);

export type NavigationRailItemProps = Omit<PropsOf<"a">, "children"> & {
  icon: IconName;
  label: string;
  /** Marks the destination the user is on. */
  current?: boolean | "section";
  /**
   * M3 badge on the icon: a count (large badge; none at 0, e-store's rule) or `true` for the
   * small dot. e-store's `NavButton badge` (count only); the dot is M3's small badge.
   */
  badge?: number | boolean;
  /** What a screen reader hears after the label (`Badge.Badge label`). */
  badgeLabel?: string;
  /**
   * When the router's `Link` fetches the destination's JavaScript: the router's default
   * `"visible"` (as soon as the rail shows it), or `"intent"` (hover or focus), `"commit"`,
   * `"off"`. `"intent"` for a heavy destination (a map) few visitors open. NEW 2026-11-24 (perf
   * audit), not in e-store; the router's own prop name and type.
   */
  prefetchBundles?: PrefetchStrategy;
};

/** A destination: an icon in a pill, its label under it. */
const NavigationRailItem = component$<NavigationRailItemProps>(
  ({
    icon,
    label,
    current = false,
    badge,
    badgeLabel,
    prefetchBundles,
    class: className,
    ...rest
  }) => {
    const styles = navigationRailVariants();
    // The router's `Link`, as e-store's rows (`nav-drawer-link.tsx`): a client-side navigation,
    // not a full page load, so the scaffold stays and nothing flashes or shifts.
    return (
      <Link
        {...rest}
        prefetchBundles={prefetchBundles}
        // ONE `aria-current="page"` per page: a destination that holds the page in its
        // sub-navigation is `"section"`, announced as `aria-current="true"` (WAI-ARIA: the current
        // item of a set), and drawn as current.
        aria-current={
          current === "section" ? "true" : current ? "page" : undefined
        }
        data-current={current ? "" : undefined}
        class={[styles.item(), className]}
      >
        {/* `data-rail-pill`: what `Layout.Drawer`'s floating card points its arrow at. */}
        <span class={styles.itemPill()} data-rail-pill="">
          <Icon name={icon} />
          {/* The pill centres the 24dp icon, which is what `Badge` measures from. */}
          {badge === true && <Badge.Badge announce={false} />}
          {typeof badge === "number" && badge > 0 && (
            <Badge.Badge value={badge} announce={false} />
          )}
        </span>
        {label}
        {/* After the label, so the name is read first ("Inbox, 3 notifications", M3). */}
        {(badge === true || (typeof badge === "number" && badge > 0)) && (
          <span class="sr-only">
            {", "}
            {badgeSpokenText(badge === true ? undefined : badge, badgeLabel)}
          </span>
        )}
      </Link>
    );
  },
);

export const NavigationRail = {
  Root: NavigationRailRoot,
  Item: NavigationRailItem,
};
