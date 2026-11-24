import {
  $,
  Slot,
  component$,
  createContextId,
  useComputed$,
  useContext,
  useContextProvider,
  useId,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { rovingKeys } from "../../utils/roving-focus";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 tabs, after e-store's `Tabs` (Root / List / Trigger / Content), M3 parts only.
 * Specs: https://m3.material.io/components/tabs/specs (tokens "Tabs - Primary navigation" and
 * "Tabs - Secondary navigation", read 2026-11-23). Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 *
 * - Container 48dp (label only) or 64dp (icon stacked over label); the 1dp `outline-variant`
 *   divider is INSIDE that height (an inset shadow, so the tabs paint over it).
 * - Primary: label `title-small`, active text and icon `primary`; a 3dp indicator under the
 *   CONTENT, inset 2dp each side, at least 24dp long, corners 3,3,0,0.
 * - Secondary: active text and icon `on-surface`; a 2dp indicator across the whole tab.
 * - Inactive: `on-surface-variant`, `on-surface` on hover / focus / press. State layers 8 / 10 / 10,
 *   `primary` on an active primary tab, `on-surface` otherwise. Focus: 3dp `secondary` ring, -3dp
 *   offset (`focus-ring-inward`).
 * - Inline icon 8dp before the label (e-store had 16).
 */
export const tabsVariants = tv({
  slots: {
    // M3: "The container should always extend the full width of the window" (of its region).
    root: ["w-full"],
    // The container: full width, the divider inside the tabs' height (M3: "The divider is
    // included in the height"), and the scroller of scrollable tabs.
    frame: ["relative", "w-full", "bg-surface"],
    list: [],
    tab: [
      "group/tab",
      "relative",
      "flex",
      "items-stretch",
      "justify-center",
      "h-12",
      "min-w-12",
      "px-4",
      "whitespace-nowrap",
      "cursor-pointer",
      "select-none",
      "-webkit-tap-highlight-color-transparent",
      "text-title-small",
      "text-on-surface-variant",
      "hover:text-on-surface",
      "focus-visible:text-on-surface",
      "active:text-on-surface",
      "hover:bg-on-surface/8",
      "focus-visible:bg-on-surface/10",
      "active:bg-on-surface/10",
      "focus-ring-inward",
      "transition-colors",
      "duration-short-4",
      "ease-standard",
      "motion-reduce:transition-none",
    ],
    content: [
      "relative",
      "inline-flex",
      "items-center",
      "justify-center",
      // 24dp indicator minimum + its 2dp insets.
      "min-w-7",
    ],
    iconWrap: ["relative", "inline-flex"],
    // A `Badge.Badge` in `q:slot="badge"`. With an icon it is placed by its own offsets from the
    // icon (the 24dp icon centred in `iconWrap`, as `Badge.Root` expects). Without one it follows
    // the label 4dp on (M3 "Padding between inline text and badge"), in the flow.
    badgeInline: [
      "ms-1",
      "inline-flex",
      "items-center",
      "empty:hidden",
      "*:static",
    ],
    panel: ["text-on-surface", "focus-ring-inward"],
  },
  variants: {
    look: {
      primary: {
        tab: [
          "aria-selected:text-primary",
          "aria-selected:hover:text-primary",
          "aria-selected:focus-visible:text-primary",
          "aria-selected:active:text-primary",
          "aria-selected:hover:bg-primary/8",
          "aria-selected:focus-visible:bg-primary/10",
          "aria-selected:active:bg-primary/10",
        ],
        content: [
          "after:absolute",
          "after:bottom-0",
          "after:inset-x-0.5",
          "after:h-0.75",
          "after:rounded-t-[3px]",
          "after:bg-primary",
          "after:content-['']",
          "after:scale-x-0",
          "group-aria-selected/tab:after:scale-x-100",
          "after:transition-transform",
          "after:duration-short-4",
          "after:ease-standard",
          "motion-reduce:after:transition-none",
        ],
      },
      secondary: {
        tab: [
          "aria-selected:text-on-surface",
          "after:absolute",
          "after:bottom-0",
          "after:inset-x-0",
          "after:h-0.5",
          "after:bg-primary",
          "after:content-['']",
          "after:scale-x-0",
          "aria-selected:after:scale-x-100",
          "after:transition-transform",
          "after:duration-short-4",
          "after:ease-standard",
          "motion-reduce:after:transition-none",
        ],
        content: [],
      },
    },
    /**
     * `fill` / `center` / `start`: M3 fixed tabs, every tab as wide as the widest one (equal
     * `1fr` columns); `fill` spans the row, `center` and `start` keep that width and align the
     * group (M3 "Responsive layout"). `scrollable`: M3 scrollable tabs, each as wide as its
     * label, the first one 52dp from the leading edge.
     */
    mode: {
      // Equal `1fr` columns. In a `w-fit` grid they size to the widest tab's content.
      fill: {
        frame: ["shadow-[inset_0_-1px_0_var(--color-outline-variant)]"],
        list: ["grid", "w-full", "grid-flow-col", "auto-cols-fr"],
      },
      center: {
        frame: ["shadow-[inset_0_-1px_0_var(--color-outline-variant)]"],
        list: ["grid", "w-fit", "mx-auto", "grid-flow-col", "auto-cols-fr"],
      },
      start: {
        frame: ["shadow-[inset_0_-1px_0_var(--color-outline-variant)]"],
        list: ["grid", "w-fit", "grid-flow-col", "auto-cols-fr"],
      },
      // The divider is on the row here, so it stays under the tabs, above our scrollbar.
      scrollable: {
        frame: ["overflow-x-auto", "overscroll-x-contain"],
        list: [
          "flex",
          "w-max",
          "min-w-full",
          "ps-[52px]",
          "*:shrink-0",
          "shadow-[inset_0_-1px_0_var(--color-outline-variant)]",
        ],
      },
    },
    /** Icon stacked over the label: 64dp. */
    stacked: {
      true: { tab: ["h-16"], content: ["flex-col", "gap-2"] },
      false: { content: ["gap-2"] },
    },
  },
  defaultVariants: { look: "primary", mode: "fill", stacked: false },
});

export type TabsLook = "primary" | "secondary";
export type TabsAlign = "fill" | "center" | "start";

type TabsContextValue = {
  value: Signal<string>;
  look: Readonly<Signal<TabsLook>>;
  selectOnFocus: Readonly<Signal<boolean>>;
  /** Prefix of the tab and panel ids. */
  id: string;
  onChange$: Readonly<Signal<QRL<(value: string) => void> | undefined>>;
};

const tabsContextId = createContextId<TabsContextValue>(
  "net.seanperez.ui.tabs",
);

/** The tab and panel ids for a value. */
const idsFor = (scope: string, value: string) => {
  const safe = value.replace(/[^\w-]/g, "_");
  return { tab: `${scope}-tab-${safe}`, panel: `${scope}-panel-${safe}` };
};

// `value` or `bind:value` is required: with nothing selected no tab would be in the Tab order
// (APG: the tablist always has one tab stop, the selected tab).
export type TabsRootProps = Omit<PropsOf<"div">, "onChange$"> &
  (
    | {
        /** The selected tab's value. Follows the prop when it changes. */
        value: string;
        "bind:value"?: Signal<string>;
      }
    | {
        value?: string;
        /** Two-way binding for the selected tab's value. */
        "bind:value": Signal<string>;
      }
  ) & {
    /** Called with the new value after the user selects a tab. */
    onChange$?: QRL<(value: string) => void>;
    /** M3 primary (default) or secondary tabs; every part picks it up. */
    look?: TabsLook;
    /**
     * Select a tab as soon as an arrow key focuses it (APG automatic activation). Default `false`:
     * M3's tabs accessibility page has arrows move focus and Space / Enter select.
     */
    selectOnFocus?: boolean;
  };

// Destructured in the parameter, as `ToggleGroup`: the optimizer keeps those reads reactive.
const TabsRoot = component$<TabsRootProps>(
  ({
    value: givenValue,
    "bind:value": bindValue,
    onChange$: givenOnChange,
    look: givenLook,
    selectOnFocus: givenSelectOnFocus,
    class: className,
    ...rest
  }) => {
    const value = useBoundSignal(
      bindValue,
      givenValue ?? "",
      useComputed$(() => givenValue),
    );
    const look = useComputed$<TabsLook>(() => givenLook ?? "primary");
    // Signals, not plain values: `useContextProvider` stores its value once, at the first render.
    const selectOnFocus = useComputed$(() => givenSelectOnFocus ?? false);
    const onChange$ = useComputed$(() => givenOnChange);
    const id = useId();
    useContextProvider(tabsContextId, {
      value,
      look,
      selectOnFocus,
      id,
      onChange$,
    });
    return (
      <div
        {...rest}
        data-look={look.value}
        class={[tabsVariants().root(), className]}
      >
        <Slot />
      </div>
    );
  },
);

export type TabsListProps = PropsOf<"div"> & {
  /** M3 scrollable tabs: the row scrolls sideways and each tab hugs its label. */
  scrollable?: boolean;
  /** Fixed tabs: fill the row (default), or keep the widest tab's width and centre / start. */
  align?: TabsAlign;
};

/**
 * The tab row: a container (`class` goes here) holding the `tablist` (the other props go there).
 * Name it with `aria-label` (or `aria-labelledby`).
 */
const TabsList = component$<TabsListProps>(
  ({
    scrollable = false,
    align = "fill",
    class: className,
    onKeyDown$,
    ...rest
  }) => {
    const ctx = useContext(tabsContextId);
    // The frame carries the container (divider, scroll); the `tablist` inside sizes the tabs.
    return (
      <div
        class={[
          tabsVariants({ mode: scrollable ? "scrollable" : align }).frame(),
          className,
        ]}
        data-qds-tabs-list=""
      >
        <div
          {...rest}
          role="tablist"
          class={tabsVariants({
            look: ctx.look.value,
            mode: scrollable ? "scrollable" : align,
          }).list()}
          // Left / Right move focus (mirrored in right-to-left text), Home / End to the ends; no
          // wrap-around (M3: "It's not recommended to loop a tab set"); focus does not select
          // (manual activation). `utils/roving-focus.ts`.
          data-roving="horizontal"
          data-roving-items='[role="tab"]'
          data-roving-loop="false"
          onKeyDown$={[rovingKeys, onKeyDown$]}
        >
          <Slot />
        </div>
      </div>
    );
  },
);

export type TabsTriggerProps = Omit<PropsOf<"button">, "value" | "type"> & {
  /** Pairs the tab with its `Tabs.Content`; what `Tabs.Root value` becomes when selected. */
  value: string;
  /** The tab's text. */
  label: string;
  /** An icon (M3: optional). */
  icon?: IconName;
  /** `top` (default): the icon over the label, 64dp. `start`: before it, 8dp apart, 48dp. */
  iconPosition?: "top" | "start";
  /** Icon-only tab: the label stays the accessible name, visually hidden. */
  labelHidden?: boolean;
};

/** A tab. A Badge goes in `q:slot="badge"`. */
const TabsTrigger = component$<TabsTriggerProps>((props) => {
  const {
    value,
    label,
    icon,
    iconPosition = "top",
    labelHidden = false,
    class: className,
    onClick$,
    onFocus$,
    ...rest
  } = props;
  const ctx = useContext(tabsContextId);
  // The live props proxy (a destructured `value` is a snapshot of the first render).
  const reactiveProps: Pick<TabsTriggerProps, "value"> = props;
  const selected = useComputed$(() => ctx.value.value === reactiveProps.value);
  const ids = idsFor(ctx.id, value);
  const stacked = !!icon && !labelHidden && iconPosition === "top";
  const select$ = $(() => {
    const next = reactiveProps.value;
    if (ctx.value.value === next) return;
    ctx.value.value = next;
    const onChange$ = ctx.onChange$.value;
    if (onChange$) onChange$(next);
  });
  const focusSelect$ = $(() => {
    if (ctx.selectOnFocus.value) return select$();
  });
  return (
    <button
      {...rest}
      type="button"
      role="tab"
      id={ids.tab}
      aria-controls={ids.panel}
      aria-selected={selected.value}
      // Roving tab stop (APG): only the selected tab is in the Tab order; arrows move focus.
      // Lowercase, as e-store's: a camelCase `tabIndex` was dropped on a client re-render there.
      {...({ tabindex: selected.value ? 0 : -1 } as object)}
      data-value={value}
      class={[tabsVariants({ look: ctx.look.value, stacked }).tab(), className]}
      onClick$={[select$, onClick$]}
      onFocus$={[focusSelect$, onFocus$]}
    >
      <span class={tabsVariants({ look: ctx.look.value, stacked }).content()}>
        {icon && (
          <span class={tabsVariants().iconWrap()}>
            <Icon name={icon} />
            <Slot name="badge" />
          </span>
        )}
        {labelHidden ? <span class="sr-only">{label}</span> : label}
        {!icon && (
          <span class={tabsVariants().badgeInline()}>
            <Slot name="badge" />
          </span>
        )}
      </span>
    </button>
  );
});

export type TabsContentProps = PropsOf<"div"> & {
  /** The `Tabs.Trigger` value this panel belongs to. */
  value: string;
};

/** A `tabpanel`, shown while its tab is selected (the others are `hidden`). */
const TabsContent = component$<TabsContentProps>(
  ({ value, class: className, ...rest }) => {
    const ctx = useContext(tabsContextId);
    const selected = useComputed$(() => ctx.value.value === value);
    const ids = idsFor(ctx.id, value);
    return (
      <div
        {...rest}
        role="tabpanel"
        id={ids.panel}
        aria-labelledby={ids.tab}
        hidden={!selected.value}
        // APG: a panel is focusable so a keyboard user can reach content with no control in it.
        {...({ tabindex: 0 } as object)}
        class={[tabsVariants().panel(), className]}
      >
        <Slot />
      </div>
    );
  },
);

export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
};
