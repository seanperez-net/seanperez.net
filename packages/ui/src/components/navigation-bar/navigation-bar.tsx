import {
  Slot,
  component$,
  createContextId,
  useComputed$,
  useContext,
  useContextProvider,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { tv } from "tailwind-variants/lite";
import { safeHref } from "../../utils/safe-href";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 (Expressive) flexible navigation bar, after e-store's `Navigation.Bar` and
 * `Navigation.Button` (`components/navigation/nav-bar.tsx`, `nav-button.tsx`), standalone.
 * Specs: https://m3.material.io/components/navigation-bar/specs (token sets "Nav bar - Common",
 * "Nav bar - Item - Vertical / Horizontal", read 2026-11-23) and the guidelines page.
 *
 * - Container `surface-container`, 64dp, full width; 3 to 5 destinations.
 * - Vertical items (compact windows): equal widths, 6dp from the top, a 56 x 32dp indicator around
 *   the icon, the label 4dp under it.
 * - Horizontal items (medium windows): icon and label side by side, 4dp apart, inside a 40dp
 *   indicator with 16dp sides; items as wide as the widest, centred, the extra space at the ends.
 * - Active: indicator `secondary-container`, icon `on-secondary-container` (filled: `iconSelected`),
 *   label `secondary`. Inactive: icon and label `on-surface-variant`. State layer
 *   `on-secondary-container` 8 / 10 / 10 on the indicator. The indicator grows from the centre on
 *   one axis.
 * - Label `label-medium`, never truncated (M3 "Don't wrap or truncate text").
 */
export const navigationBarVariants = tv({
  slots: {
    root: [
      "flex",
      "justify-center",
      "w-full",
      "h-16",
      "bg-surface-container",
      "text-on-surface-variant",
    ],
    // The items. Horizontal: a `w-fit` grid of equal `1fr` columns, so every item is as wide as
    // the widest and the extra space goes to the ends (M3).
    row: ["h-full"],
    item: [
      "group/nb",
      "relative",
      "flex",
      "min-w-12",
      "items-center",
      "cursor-pointer",
      "select-none",
      "outline-none",
      "-webkit-tap-highlight-color-transparent",
      "text-label-medium",
      "whitespace-nowrap",
      "text-on-surface-variant",
      "aria-[current=page]:text-secondary",
    ],
    // The active indicator; the state layer and the focus ring are drawn on it.
    indicator: [
      "relative",
      "inline-flex",
      "items-center",
      "justify-center",
      "rounded-full",
      "before:absolute",
      "before:inset-0",
      "before:rounded-[inherit]",
      "before:bg-secondary-container",
      "before:content-['']",
      "before:scale-x-0",
      "group-aria-[current=page]/nb:before:scale-x-100",
      "before:transition-transform",
      "before:duration-short-4",
      "before:ease-standard",
      "motion-reduce:before:transition-none",
      "after:absolute",
      "after:inset-0",
      "after:rounded-[inherit]",
      "after:bg-on-secondary-container",
      "after:opacity-0",
      "after:content-['']",
      "group-hover/nb:after:opacity-8",
      "group-focus-visible/nb:after:opacity-10",
      "group-active/nb:after:opacity-10",
      // The M3 focus ring (`focus-ring`) on the indicator, spelled for the link's focus (e-store's
      // NAV_INDICATOR_FOCUS_RING).
      "outline-0",
      "outline-solid",
      "outline-secondary",
      "outline-offset-2",
      "group-focus-visible/nb:outline-3",
      "group-focus-visible/nb:animate-[focus-ring-outward-grow_calc(var(--transition-duration-focus-ring)*0.25)_var(--ease-emphasized),focus-ring-outward-shrink_calc(var(--transition-duration-focus-ring)*0.75)_var(--ease-emphasized)_calc(var(--transition-duration-focus-ring)*0.25)]",
      "motion-reduce:group-focus-visible/nb:animate-none",
    ],
    icon: [
      "relative",
      "z-1",
      "inline-flex",
      "text-on-surface-variant",
      "group-aria-[current=page]/nb:text-on-secondary-container",
    ],
    // The label inside the indicator (horizontal items) and under it (vertical items): ONE of them
    // is displayed, so it is read once.
    innerLabel: ["relative", "z-1"],
    outerLabel: [],
  },
  variants: {
    /**
     * `adaptive` (default): vertical items below 600dp, horizontal from 600dp (M3: vertical in
     * compact, horizontal in medium windows). `vertical` / `horizontal`: always that layout.
     */
    layout: {
      vertical: {
        row: ["flex", "w-full"],
        item: ["flex-1", "flex-col", "pt-1.5", "gap-1"],
        indicator: ["h-8", "w-14"],
        innerLabel: ["hidden"],
      },
      horizontal: {
        row: ["grid", "w-fit", "grid-flow-col", "auto-cols-fr"],
        item: ["justify-center"],
        indicator: ["h-10", "px-4", "gap-1"],
        outerLabel: ["hidden"],
      },
      adaptive: {
        row: [
          "flex",
          "w-full",
          "sm:grid",
          "sm:w-fit",
          "sm:grid-flow-col",
          "sm:auto-cols-fr",
        ],
        item: [
          "flex-1",
          "flex-col",
          "pt-1.5",
          "gap-1",
          "sm:flex-row",
          "sm:justify-center",
          "sm:pt-0",
          "sm:gap-0",
        ],
        indicator: [
          "h-8",
          "w-14",
          "sm:h-10",
          "sm:w-auto",
          "sm:px-4",
          "sm:gap-1",
        ],
        innerLabel: ["hidden", "sm:inline"],
        outerLabel: ["sm:hidden"],
      },
    },
  },
  defaultVariants: { layout: "adaptive" },
});

export type NavigationBarLayout = "adaptive" | "vertical" | "horizontal";

type NavigationBarContextValue = {
  layout: Readonly<Signal<NavigationBarLayout>>;
};

const navigationBarContextId = createContextId<NavigationBarContextValue>(
  "net.seanperez.ui.navigation-bar",
);

export type NavigationBarRootProps = PropsOf<"nav"> & {
  /** Item layout. Default `adaptive`: vertical below 600dp, horizontal from 600dp. */
  layout?: NavigationBarLayout;
};

/** The bar: a `<nav>` landmark (default name "Main") of links, each a Tab stop. */
// Destructured in the parameter, as `ToggleGroup`: the optimizer keeps those reads reactive.
const NavigationBarRoot = component$<NavigationBarRootProps>(
  ({
    layout: givenLayout,
    "aria-label": ariaLabel = "Main",
    class: className,
    ...rest
  }) => {
    const layout = useComputed$<NavigationBarLayout>(
      () => givenLayout ?? "adaptive",
    );
    useContextProvider(navigationBarContextId, { layout });
    return (
      <nav
        {...rest}
        aria-label={ariaLabel}
        data-qds-nav-bar=""
        class={[
          navigationBarVariants({ layout: layout.value }).root(),
          className,
        ]}
      >
        <div class={navigationBarVariants({ layout: layout.value }).row()}>
          <Slot />
        </div>
      </nav>
    );
  },
);

export type NavigationBarItemProps = Omit<PropsOf<"a">, "onClick$"> & {
  onClick$?: QRL<(event: PointerEvent, element: HTMLAnchorElement) => void>;
  icon: IconName;
  /** The icon while current (M3: a filled icon for the active destination), e.g. `home_filled`. */
  iconSelected?: IconName;
  /** The destination's name (M3: every item has a label). */
  label: string;
  /** Marks the destination the user is on (`aria-current="page"`). */
  current?: boolean;
};

/** A destination: a router `<Link>`. A Badge goes in `q:slot="badge"`. */
const NavigationBarItem = component$<NavigationBarItemProps>(
  ({
    icon,
    iconSelected,
    label,
    current = false,
    class: className,
    onClick$,
    href,
    ...rest
  }) => {
    const ctx = useContext(navigationBarContextId);
    return (
      <Link
        {...rest}
        href={safeHref(href)}
        aria-current={current ? "page" : undefined}
        class={[
          navigationBarVariants({ layout: ctx.layout.value }).item(),
          className,
        ]}
        onClick$={onClick$}
      >
        <span
          class={navigationBarVariants({
            layout: ctx.layout.value,
          }).indicator()}
        >
          <span class={navigationBarVariants().icon()}>
            <Icon name={current && iconSelected ? iconSelected : icon} />
            {/* A `Badge.Badge`: its offsets are from this centred 24dp icon (as `Badge.Root`). */}
            <Slot name="badge" />
          </span>
          <span
            class={navigationBarVariants({
              layout: ctx.layout.value,
            }).innerLabel()}
          >
            {label}
          </span>
        </span>
        <span
          class={navigationBarVariants({
            layout: ctx.layout.value,
          }).outerLabel()}
        >
          {label}
        </span>
      </Link>
    );
  },
);

export const NavigationBar = {
  Root: NavigationBarRoot,
  Item: NavigationBarItem,
};
