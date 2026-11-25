import type {
  ClassList,
  JSXOutput,
  PropsOf,
  QRL,
  Signal,
} from "@qwik.dev/core";
import {
  $,
  Slot,
  component$,
  createContextId,
  sync$,
  useComputed$,
  useContext,
  useContextProvider,
  useId,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";
import type { PrefetchStrategy } from "@qwik.dev/router";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { useBindings } from "../../utils/bindings";
import { freshJsx } from "../../utils/jsx-prop";
import { rovingKeys } from "../../utils/roving-focus";
import { safeHref } from "../../utils/safe-href";
import { UnstyledButton, relIsExternal } from "../button/unstyled-button";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { Item } from "../item";
import type { ItemProps } from "../item";
import { RippleSurface } from "../ripple";

/**
 * Material Design 3 list, from e-store's `components/list/list.tsx` (2026-11-23): Root, Item,
 * Divider, Group, GroupHeader, GroupContent.
 * Specs: https://m3.material.io/components/lists/specs
 * Patterns: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ (selection list),
 * https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ (groups)
 *
 * - Display list: `<ul>` + `<li>` (implicit list / listitem roles).
 * - Selection list (`interactive`): `role="listbox"` + `role="option"` + `aria-selected`, ONE
 *   Tab stop, arrows / Home / End move, Enter / Space choose.
 * - Navigation list (`href` rows): `<ul>` + `<li>` + `<a>`, every link its own Tab stop.
 * - `rovingFocus`: a plain list of actionable rows that is ONE Tab stop (rows may hold controls).
 *
 * Changed from e-store (see list.md "Where it differs from e-store"):
 * - `onValueChange$` runs once per choice (e-store also ran it from a `useTask$` on the value,
 *   so a click called it twice, and it ran on the server for the starting value).
 * - Focus handlers are always attached and check the list's own role: no handler swapped by a
 *   signal read in render.
 * - Selection state is read in `useComputed$` / JSX, not the component body (Qwik rc.5).
 * - A group's ids come from `useId()` (e-store built them from `value`, so two lists with a
 *   group of the same value had duplicate ids).
 * - A group's `open` registers with the root before the root's list is applied to it (e-store
 *   applied the root's empty list first, so `open` defaulting to true still started closed).
 * - No Layout-context density; `GroupHeader chevronIcon` is an `IconName` (or `null`).
 */

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface ListContextValue {
  // Signals, not plain values: `useContextProvider` captures this object once, so a plain value
  // would never reach the rows when the host changes it (e-store passes literals only).
  look: Readonly<Signal<"standard" | "segmented">>;
  shape: Readonly<Signal<"default" | "rounded">>;
  indicator: Readonly<Signal<"primary" | "secondary">>;
  interactive: Readonly<Signal<boolean>>;
  density: Readonly<Signal<"default" | "compact">>;
  /** `List.Root rovingFocus` (and not `interactive`): every row is focusable by script. */
  rovingFocus: Readonly<Signal<boolean>>;
  selectedValue: Signal<string>;
  selectItem$: QRL<(value: string) => void>;
  openGroups: Signal<string[]>;
  multipleGroups: Readonly<Signal<boolean>>;
  toggleGroup$: QRL<(value: string) => void>;
  /**
   * Set by `List.Group`. An interactive list WITH groups cannot be one listbox (a listbox owns
   * only `option` and `group`; a group header is a disclosure button), so the root stays a plain
   * list and each `List.GroupContent` is its own listbox, named by its header.
   */
  hasGroups: Signal<boolean>;
  /** The root was given `openGroups` / `bind:openGroups`: it decides which groups start open. */
  groupsGiven: boolean;
}

export const listContextId = createContextId<ListContextValue>(
  "net.seanperez.ui.list",
);

/* ------------------------------------------------------------------ */
/*  Variants                                                          */
/* ------------------------------------------------------------------ */

export const listVariants = tv({
  // `overflow-x-clip`: an end control's 48px touch target must not give a scrolling parent a
  // horizontal scrollbar. `clip` makes no scroll container.
  base: ["flex", "flex-col", "outline-none", "relative", "overflow-x-clip"],
  variants: {
    look: {
      standard: "",
      segmented: "gap-1 px-2",
    },
    // M3: 8dp above and below the rows. `none` for a list that continues another.
    padding: {
      default: "py-2",
      tight: "py-1",
      none: "",
    },
    /** `drawer`: rows 12dp from the edges, 10dp between leading control and label. */
    inset: {
      default: "",
      drawer: "[--layout-item-gap:0.625rem] [--layout-item-mx:0.75rem]",
    },
  },
  defaultVariants: {
    look: "standard",
    padding: "default",
    inset: "default",
  },
});

export type ListVariantProps = VariantProps<typeof listVariants>;

export const listItemVariants = tv({
  base: [
    "list-none",
    "outline-none",
    // `colors` is not a CSS property: e-store's `transition-[colors,border-radius]` animated only
    // the radius.
    "transition-[background-color,color,border-radius]",
    "duration-200",
    "ease-standard",
    // Selected: `data-selected` (every selected row carries it; `aria-selected` only an option
    // may carry); its colors are the `indicator` variant. Disabled: `data-disabled` (every
    // disabled row; `aria-disabled` only on an option, the one row role that supports it).
    "data-disabled:opacity-38",
    "data-disabled:pointer-events-none",
  ],
  variants: {
    look: {
      standard: "",
      segmented: [
        "bg-surface-container",
        "[--list-actions-bg:var(--color-surface-container)]",
        // M3 Expressive: 4dp inner corners, 16dp outer, 16dp all round when selected.
        "rounded-xs",
        "first:rounded-t-lg",
        "last:rounded-b-lg",
        "data-selected:rounded-lg",
      ],
    },
    shape: {
      default: "",
      rounded: [
        "mx-[var(--layout-item-mx,0.5rem)] rounded-full",
        // The inner Item paints the same backgrounds: round it too, and an href row's `<a>` (its
        // focus ring).
        "**:[.item]:rounded-full",
        "*:[a]:rounded-full",
      ],
    },
    interactive: {
      true: [
        "cursor-pointer",
        // A clickable row is a control: dragging across it selects no text.
        "select-none",
        // State layers (M3: on-surface 8% hover, 12% focus and pressed) are painted as a
        // background IMAGE over the row's own fill, so a segmented row keeps its
        // surface-container and a selected row its container color underneath. e-store set
        // `bg-on-surface/8`, which REPLACED the fill, and faded the selected color to /90.
        "hover:bg-linear-to-r hover:from-on-surface/8 hover:to-on-surface/8",
        "focus-visible:bg-linear-to-r focus-visible:from-on-surface/12 focus-visible:to-on-surface/12",
        // A control INSIDE the row with keyboard focus lights the row too.
        "has-focus-visible:bg-linear-to-r has-focus-visible:from-on-surface/12 has-focus-visible:to-on-surface/12",
        // Not while a control in the row's `actions` is pressed (`:active` reaches ancestors).
        "active:not-has-[[data-list-item-actions]_:active]:bg-linear-to-r active:not-has-[[data-list-item-actions]_:active]:from-on-surface/12 active:not-has-[[data-list-item-actions]_:active]:to-on-surface/12",
        // M3 list item: the inward focus ring (material-web md-list-item).
        "focus-ring-inward",
        // Group header disclosure
        "data-qds-list-group-header:select-none",
        "data-qds-list-group-header:[&[aria-expanded=true]_[data-list-group-chevron]]:rotate-180",
        // A disabled header stays visible (an add-only section)
        "data-qds-list-group-header:data-disabled:cursor-default",
        "data-qds-list-group-header:data-disabled:hover:bg-none",
        "data-qds-list-group-header:data-disabled:opacity-100",
        "data-qds-list-group-header:data-disabled:pointer-events-auto",
      ],
      false: "",
    },
    /** A row with `actions`: a grid holding the row and its actions (`listItemActionsVariants`). */
    actions: {
      true: "group/list-item grid grid-cols-[minmax(0,1fr)_auto] items-center",
      false: "",
    },
    /** Selected colors: `primary` (an option) or `secondary` (M3 navigation indicator). */
    indicator: {
      primary: [
        "data-selected:bg-primary-container",
        "data-selected:text-on-primary-container",
      ],
      secondary: [
        "data-selected:bg-secondary-container",
        "data-selected:text-on-secondary-container",
      ],
    },
  },
  defaultVariants: {
    look: "standard",
    shape: "default",
    interactive: false,
    actions: false,
    indicator: "primary",
  },
});

export type ListItemVariantProps = VariantProps<typeof listItemVariants>;

/**
 * `List.Item actions` (NEW 2026-11-25, owner; not in e-store): the row's own controls BESIDE its
 * link (a sibling of the `<a>`, never inside it: interactive content may not nest in an `<a>`,
 * HTML). The `<li>` becomes a two-column grid: the row (link or Item) and the actions share the
 * first row.
 *
 * - Where the pointer can hover (`@media (hover: hover)`): the row spans both columns and the
 *   actions lie over its end, shown on the row's hover or focus-within, hidden by OPACITY (never
 *   `visibility` / `display`: they stay in the tab order and the accessibility tree). Over the row
 *   they paint its surface (`--list-actions-bg`, default `surface`; the selected or segmented
 *   row's own fill) and its state layer (`background-image: inherit`), so no text shows through.
 * - Touch (`hover: none`): always shown, in their own column; the row's text ends before them.
 */
export const listItemActionsVariants = tv({
  base: [
    // 3px in from the row's end (`--outline-width-focus-ring`): the row's INWARD focus ring
    // stays visible beside the strip (measured in Chrome 2026-11-25: the strip's fill covered
    // it); the icons keep their 12dp end inset.
    "relative z-1 col-start-2 row-start-1 flex items-center gap-0",
    "me-(--outline-width-focus-ring) pe-[calc(0.75rem-var(--outline-width-focus-ring))]",
    // Clicks on the actions never reach the row's own handler (`stoppropagation:click`, set on the
    // element), and their keys are their own (`navigateListItems`: a control keeps Enter / Space).
    "[@media(hover:hover)]:opacity-0",
    "group-hover/list-item:opacity-100",
    "group-focus-within/list-item:opacity-100",
    "transition-opacity duration-150 ease-standard motion-reduce:transition-none",
    "[@media(hover:hover)]:bg-(--list-actions-bg,var(--color-surface))",
    "[@media(hover:hover)]:[background-image:inherit]",
    "group-data-selected/list-item:bg-inherit",
    // The row's corners (rounded / segmented rows).
    "rounded-e-[inherit]",
  ],
});

/** The row (link or Item) of a row with actions: the first column, both where actions overlay it. */
const ROW_WITH_ACTIONS = [
  "col-start-1 row-start-1 min-w-0",
  "[@media(hover:hover)]:col-end-3",
];

export const listDividerVariants = tv({
  base: ["border-none", "h-px", "bg-outline-variant", "my-0", "shrink-0"],
  variants: {
    // M3: an inset divider is 16dp from the start, 24dp from the end.
    inset: {
      true: "ms-4 me-6",
      false: "",
    },
  },
  defaultVariants: { inset: false },
});

/* ------------------------------------------------------------------ */
/*  Keyboard and focus (sync$: they cancel the key synchronously)     */
/* ------------------------------------------------------------------ */

/** The rows the arrows move between: options, roving rows, actionable rows. */
const ROW_ITEMS = "[data-list-item][tabindex]:not([data-disabled])";

/**
 * Enter and Space on a row. A `sync$` body ships as text: every literal is inline. From
 * e-store's `navigateListItems` (its arrows, Home and End are now `rovingKeys` on the list).
 */
export const navigateListItems = sync$((e: KeyboardEvent) => {
  const el = e.target as HTMLElement;
  const current = el.closest?.("[data-list-item]") as HTMLElement | null;
  if (!current) return;
  // Keys typed in a field inside the row are text.
  if (
    el !== current &&
    el.closest?.('input, textarea, select, [contenteditable="true"]')
  )
    return;
  // A control in the row's `actions` (a link too: Space on "Edit" must not open the row) keeps
  // its own keys. Second agent, 2026-11-25.
  if (el !== current && el.closest?.("[data-list-item-actions]")) return;
  // A modified key is the app's or the browser's.
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === "Enter" || e.key === " ") {
    // Enter on a focused link is the browser's (keeps Cmd/Ctrl/Shift for a new tab).
    if (e.key === "Enter" && el.closest?.("a[href]")) return;
    // A control inside the row keeps its own Enter and Space.
    const control = el.closest?.(
      'button, input, select, textarea, [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [contenteditable="true"]',
    );
    if (control && control !== current) return;
    e.preventDefault();
    // A row with its own link follows it (the click still bubbles to the row's handler).
    const link = current.querySelector<HTMLElement>(":scope > a[href]");
    (link ?? current).click();
  }
});

/**
 * Tab onto a listbox lands on its selected option, else its first enabled one; onto a
 * `rovingFocus` list, its first enabled row. The `<ul>` then leaves the tab order until focus
 * leaves it, so Shift+Tab from a row goes to what precedes the list. Any other list: nothing.
 */
export const focusInList = sync$((e: FocusEvent, box: HTMLElement) => {
  const listbox = box.getAttribute("role") === "listbox";
  if (!listbox && !box.hasAttribute("data-roving-focus")) return;
  box.setAttribute("tabindex", "-1");
  // `List.Item actions` (2026-11-25, second agent): only the row that holds focus keeps its
  // controls in the tab order, so Tab leaves a long list after one row's controls instead of
  // walking every row's. The others are marked `data-list-actions-off` and get `tabindex=-1`;
  // a row that takes focus gets its own back. Controls inside an open menu are left alone.
  const row = (e.target as HTMLElement).closest?.("[data-list-item]");
  box
    .querySelectorAll<HTMLElement>("[data-list-item-actions]")
    .forEach((strip) => {
      if (strip.closest("ul") !== box) return;
      const mine = strip.closest("[data-list-item]") === row;
      strip
        .querySelectorAll<HTMLElement>(
          "a[href], button, [data-list-actions-off]",
        )
        .forEach((control) => {
          if (control.closest('[role="menu"]')) return;
          if (mine) {
            if (control.hasAttribute("data-list-actions-off")) {
              control.removeAttribute("data-list-actions-off");
              control.removeAttribute("tabindex");
            }
          } else if (!control.hasAttribute("data-list-actions-off")) {
            control.setAttribute("data-list-actions-off", "");
            control.setAttribute("tabindex", "-1");
          }
        });
    });
  if (e.target !== box) return;
  const own = (selector: string) =>
    Array.from(box.querySelectorAll<HTMLElement>(selector)).find(
      (el) => el.closest("ul") === box,
    );
  const target =
    (listbox ? own('[data-list-item][aria-selected="true"]') : undefined) ??
    own("[data-list-item][tabindex]:not([data-disabled])");
  if (target) target.focus();
  else box.setAttribute("tabindex", "0");
});

/** Focus left the list: it is the Tab stop again. */
export const focusOutList = sync$((e: FocusEvent, box: HTMLElement) => {
  if (
    box.getAttribute("role") !== "listbox" &&
    !box.hasAttribute("data-roving-focus")
  )
    return;
  const next = e.relatedTarget as Node | null;
  if (!next || !box.contains(next)) box.setAttribute("tabindex", "0");
});

/* ------------------------------------------------------------------ */
/*  List.Root                                                         */
/* ------------------------------------------------------------------ */

export interface ListRootProps
  extends Omit<PropsOf<"ul">, "class">, ListVariantProps {
  class?: ClassList;
  /** A selection list: the `<ul>` is a listbox and its rows are options. */
  interactive?: boolean;
  /**
   * A plain list of actionable rows that is ONE Tab stop handing focus to its first row; arrows,
   * Home and End move; Enter / Space click. Not a listbox. Ignored with `interactive`.
   */
  rovingFocus?: boolean;
  /** `rounded`: pill rows with an inset margin. */
  shape?: "default" | "rounded";
  /** Selected colors: `primary` (default) or `secondary` (M3 navigation indicator). */
  indicator?: "primary" | "secondary";
  /** `default`: M3 heights. `compact`: 40 / 56 / 72 (not an M3 value). */
  density?: "default" | "compact";
  /** The chosen row's `value` (selection list). */
  value?: string;
  "bind:value"?: Signal<string>;
  /** Called once per choice. */
  onValueChange$?: QRL<(value: string) => void>;
  /** Several groups open at once. Default: true. */
  multipleGroups?: boolean;
  /** The open groups' `value`s. */
  openGroups?: string[];
  "bind:openGroups"?: Signal<string[]>;
  onFocusIn$?: QRL<(event: FocusEvent, element: HTMLUListElement) => void>;
  onFocusOut$?: QRL<(event: FocusEvent, element: HTMLUListElement) => void>;
}

const Root = component$<ListRootProps>((props) => {
  /* eslint-disable @typescript-eslint/no-unused-vars -- pulled out so they never reach the DOM */
  const {
    look = "standard",
    shape: _shape,
    indicator: _indicator,
    padding = "default",
    inset = "default",
    interactive: _interactive,
    density: _density,
    value: _value,
    "bind:value": _bindValue,
    onValueChange$,
    multipleGroups: _multipleGroups,
    openGroups: _openGroups,
    "bind:openGroups": _bindOpenGroups,
    rovingFocus,
    onFocusIn$,
    onFocusOut$,
    onKeyDown$,
    class: className,
    ...rest
  } = props;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // A view of the same props proxy naming only the scalars (capturing `props` would capture
  // `children`, which is not serialisable). Same object, same reactivity.
  const state: {
    look?: "standard" | "segmented";
    shape?: "default" | "rounded";
    indicator?: "primary" | "secondary";
    interactive?: boolean;
    rovingFocus?: boolean;
    multipleGroups?: boolean;
    density?: "default" | "compact";
  } = props;
  const lookSig = useComputed$(() => state.look ?? "standard");
  const shape = useComputed$(() => state.shape ?? "default");
  const indicator = useComputed$(() => state.indicator ?? "primary");
  const interactive = useComputed$(() => state.interactive ?? false);
  const roving = useComputed$(
    () => !!state.rovingFocus && !(state.interactive ?? false),
  );
  const multipleGroups = useComputed$(() => state.multipleGroups ?? true);
  const density = useComputed$(() => state.density ?? "default");

  const { valueSig: selectedValue, openGroupsSig: openGroups } = useBindings(
    props,
    { value: "", openGroups: [] as string[] },
  );
  const hasGroups = useSignal(false);

  const selectItem$ = $((value: string) => {
    if (selectedValue.value === value) return;
    selectedValue.value = value;
    onValueChange$?.(value);
  });

  const toggleGroup$ = $((groupValue: string) => {
    const current = openGroups.value;
    if (current.includes(groupValue)) {
      openGroups.value = current.filter((v) => v !== groupValue);
    } else {
      openGroups.value = multipleGroups.value
        ? [...current, groupValue]
        : [groupValue];
    }
  });

  useContextProvider(listContextId, {
    look: lookSig,
    shape,
    indicator,
    interactive,
    density,
    rovingFocus: roving,
    selectedValue,
    selectItem$,
    openGroups,
    multipleGroups,
    toggleGroup$,
    hasGroups,
    groupsGiven:
      props.openGroups !== undefined || props["bind:openGroups"] !== undefined,
  });

  // The root is the listbox only when it owns the options directly (see `hasGroups`).
  const isListbox = useComputed$(() => interactive.value && !hasGroups.value);

  return (
    <ul
      {...rest}
      data-qds-list=""
      data-roving-focus={(!isListbox.value && roving.value) || undefined}
      role={isListbox.value ? "listbox" : rest.role}
      tabIndex={isListbox.value || roving.value ? 0 : rest.tabIndex}
      // Arrows, Home and End move between the rows where the list manages focus (a listbox, a
      // `rovingFocus` list), wrapping, skipping disabled rows (`utils/roving-focus.ts`). In a
      // plain list they stay the page's (scrolling).
      data-roving={isListbox.value || roving.value ? "vertical" : undefined}
      data-roving-items={
        isListbox.value || roving.value ? ROW_ITEMS : undefined
      }
      onKeyDown$={[rovingKeys, onKeyDown$]}
      onFocusIn$={[focusInList, onFocusIn$]}
      onFocusOut$={[focusOutList, onFocusOut$]}
      class={[listVariants({ look, padding, inset }), className]}
    >
      <Slot />
    </ul>
  );
});

/* ------------------------------------------------------------------ */
/*  List.Item                                                         */
/* ------------------------------------------------------------------ */

export interface ListItemProps
  extends
    Omit<ItemProps, "class">,
    Omit<PropsOf<"li">, "class" | "onClick$" | "role" | "value"> {
  /** The row's value (selection list). */
  value?: string;
  /** Not choosable or clickable (`data-disabled`; `aria-disabled` on an option). */
  disabled?: boolean;
  /** Makes the row interactive. */
  onClick$?: QRL<() => void>;
  /** Makes the row a link (the router's `<Link>`). */
  href?: string;
  /** With `href`: a plain `<a>` (a full page load). */
  reload?: boolean;
  /**
   * With `href`: when the router's `Link` fetches the destination's bundles (default
   * `"visible"`; `"intent"` for a heavy page such as a map). NEW 2026-11-24, not in e-store.
   */
  prefetchBundles?: PrefetchStrategy;
  /**
   * With `href`: the link's `rel` (`"me"` on a profile link, `"external"`). New, not in e-store.
   * Use it with `reload` for a link off the site.
   */
  rel?: string;
  /**
   * With `href` and a `rel` containing `external`: the row ends with the `open_in_new` icon (its
   * trailing icon, M3 list), named by this text for screen readers, as Button's. An explicit
   * `end` / `endIcon` replaces it. NEW 2026-11-24, not in e-store.
   */
  externalLabel?: string;
  /** With `href`: `data-*` attributes for the `<a>` itself. */
  linkData?: { [key: `data-${string}`]: string | undefined };
  /**
   * The row's own controls (icon buttons, a `Menu`), rendered BESIDE the row's link as its
   * sibling in the `<li>`, never inside the `<a>`: M3's multi-action row (secondary actions in
   * the trailing position) with the row still a link. Shown on hover or focus-within where the
   * pointer can hover, always on touch; hidden by opacity, so always reachable. Use it in a
   * `List.Root rovingFocus` (the row one arrow stop, each control its own Tab stop). JSX (one
   * root, e.g. a fragment or a `<div>`). NEW 2026-11-25, not in e-store.
   */
  actions?: JSXOutput;
  /** Classes on the `<li>`. */
  class?: ClassList;
  /** Classes on the inner `Item`. */
  itemClass?: ClassList;
  /** Overrides the computed role (`option` in a listbox). */
  role?: string;
  /** The row's name, on its interactive element (the `<a>`, or the `<li>`). */
  "aria-label"?: string;
  /** `dragstart` on the `<li>`. */
  onDragStart$?: QRL<(event: DragEvent, element: HTMLLIElement) => void>;
}

const ListItem = component$<ListItemProps>((props) => {
  const {
    value,
    disabled = false,
    onClick$,
    href,
    reload,
    prefetchBundles,
    rel,
    externalLabel = "external link",
    linkData,
    actions,
    class: className,
    itemClass,
    role: roleProp,
    "aria-label": ariaLabel,
    tabIndex: tabIndexProp,
    onDragStart$,
    onKeyDown$,
    // Item props. `selected` is read through `state` below; pulled out so it never reaches the DOM.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    selected: _selected,
    overline,
    headline,
    defaultSlot,
    supportingText,
    trailingSupportingText,
    trailingSupportingTextProps,
    start,
    startIcon,
    startProps,
    end,
    endIcon,
    endProps,
    lines,
    align,
    headlineLines,
    supportingLines,
    container,
    containerProps,
    textProps,
    ...rest
  } = props;
  const ctx = useContext(listContextId);
  // Inside a `List.Group`, the group's content is the listbox.
  const groupCtx = useContext(listGroupContextId, null);
  const inGroup = !!groupCtx;
  const state: { selected?: boolean } = props;
  const navigate = useNavigate();

  const row = useComputed$(() => {
    const interactive = ctx.interactive.value || !!onClick$ || !!href;
    // An `option` only inside a listbox: the root without groups, else a group's content.
    const option = ctx.interactive.value && (!ctx.hasGroups.value || inGroup);
    const selected =
      state.selected ?? (value ? ctx.selectedValue.value === value : false);
    // A link row renders its `<a>` (the Tab stop), except in an option: an option's children
    // are presentational (WAI-ARIA), so a link there would be hidden; the option navigates.
    const link = !!href && !disabled && !option;
    // Option or roving row: focusable by script (the list is the Tab stop). A link row: the link
    // is the stop. Any other actionable row: its own Tab stop (e-store gave it -1 in a plain
    // list, so nothing could reach it by keyboard).
    const tabIndex = disabled
      ? tabIndexProp
      : option || ctx.rovingFocus.value
        ? -1
        : link
          ? tabIndexProp
          : interactive
            ? 0
            : tabIndexProp;
    return { interactive, option, selected, link, tabIndex };
  });

  const handleClick$ = $(async () => {
    if (disabled) return;
    if (value) ctx.selectItem$(value);
    await onClick$?.();
    // An option with `href` has no `<a>` of its own (above): go there.
    if (href && row.value.option) {
      const to = safeHref(href);
      if (!to) return;
      if (reload) window.location.assign(to);
      else await navigate(to);
    }
  });

  // With actions, the row (link or Item) takes the grid's first column (`ROW_WITH_ACTIONS`).
  const hasActions = !!actions;
  const itemContent = (
    <Item
      class={[
        itemClass,
        hasActions && !row.value.link ? ROW_WITH_ACTIONS : undefined,
      ]}
      density={ctx.density.value}
      selected={row.value.selected}
      selectedFill={false}
      indicator={ctx.indicator.value}
      overline={overline}
      headline={headline}
      defaultSlot={defaultSlot}
      supportingText={supportingText}
      trailingSupportingText={trailingSupportingText}
      trailingSupportingTextProps={trailingSupportingTextProps}
      start={start}
      startIcon={startIcon}
      startProps={startProps}
      end={
        end ??
        (href && !endIcon && relIsExternal(rel) ? (
          // Mirrored in right-to-left: Google's `open_in_new` asset is `autoMirrored`.
          <Icon
            name="open_in_new"
            label={externalLabel}
            class="rtl:-scale-x-100"
          />
        ) : undefined)
      }
      endIcon={endIcon}
      endProps={endProps}
      lines={lines}
      align={align}
      headlineLines={headlineLines}
      supportingLines={supportingLines}
      container={container}
      containerProps={containerProps}
      textProps={textProps}
    >
      <Slot />
    </Item>
  );

  return (
    <li
      {...rest}
      class={[
        listItemVariants({
          look: ctx.look.value,
          shape: ctx.shape.value,
          indicator: ctx.indicator.value,
          interactive: row.value.interactive,
          actions: hasActions,
        }),
        // No overflow clip: the ripple surface clips itself, and a clipping row cut the focus
        // ring of a control inside it.
        "relative",
        className,
      ]}
      data-list-item=""
      data-qds-list-item=""
      data-ripple={row.value.interactive ? "" : undefined}
      data-value={value}
      data-selected={row.value.selected || undefined}
      role={roleProp ?? (row.value.option ? "option" : undefined)}
      aria-label={row.value.link ? undefined : ariaLabel}
      aria-selected={row.value.option ? row.value.selected : undefined}
      aria-current={props["aria-current"]}
      aria-disabled={row.value.option && disabled ? true : undefined}
      data-disabled={disabled || undefined}
      tabIndex={row.value.tabIndex}
      onKeyDown$={[navigateListItems, onKeyDown$]}
      onClick$={handleClick$}
      onDragStart$={onDragStart$}
    >
      {row.value.interactive && <RippleSurface />}
      {row.value.link ? (
        // In a `rovingFocus` list the `<ul>` is the Tab stop and arrows rove the rows, so the
        // link leaves the tab order; in a plain navigation list each link is a Tab stop.
        <UnstyledButton
          {...linkData}
          type="link"
          href={href ?? ""}
          reload={reload}
          prefetchBundles={prefetchBundles}
          rel={rel}
          class={[
            "block text-inherit no-underline",
            hasActions ? ROW_WITH_ACTIONS : undefined,
          ]}
          tabIndex={ctx.rovingFocus.value ? -1 : undefined}
          aria-label={ariaLabel}
          // The current place, on the link itself where screen readers announce it (ARIA
          // `aria-current="page"`); e-store wrote `aria-current="true"` on the `<li>`.
          aria-current={row.value.selected ? "page" : undefined}
        >
          {itemContent}
        </UnstyledButton>
      ) : (
        itemContent
      )}
      {hasActions && (
        // A sibling of the link (never inside it). Its clicks stay its own: the row's handler
        // (selection, `onClick$`) does not run for them.
        <div
          data-list-item-actions=""
          stoppropagation:click
          class={listItemActionsVariants()}
        >
          {freshJsx(actions)}
        </div>
      )}
    </li>
  );
});

/* ------------------------------------------------------------------ */
/*  List.Divider                                                      */
/* ------------------------------------------------------------------ */

export interface ListDividerProps {
  /** 16dp from the start, 24dp from the end (M3). */
  inset?: boolean;
  class?: ClassList;
}

const Divider = component$<ListDividerProps>(
  ({ inset = false, class: className }) => (
    // Hidden, not `role="separator"` (e-store had both, which contradict; a separator is not an
    // allowed child of a list or listbox).
    <li aria-hidden="true" class="list-none">
      <hr class={[listDividerVariants({ inset }), className]} />
    </li>
  ),
);

/* ------------------------------------------------------------------ */
/*  List.Group, GroupHeader, GroupContent                             */
/* ------------------------------------------------------------------ */

interface ListGroupContextValue {
  isOpen: Signal<boolean>;
  toggle$: QRL<() => void>;
  contentId: string;
  /** Names the group's content (a listbox in an interactive list). */
  headerId: string;
}

const listGroupContextId = createContextId<ListGroupContextValue>(
  "net.seanperez.ui.list-group",
);

export interface ListGroupProps extends Omit<PropsOf<"li">, "class" | "value"> {
  class?: ClassList;
  /** The group's value in `List.Root openGroups`. Generated when absent. */
  value?: string;
  /**
   * Starts open. Default: open, unless the root was given `openGroups` (then the root's list
   * decides, as in e-store's documented example).
   */
  open?: boolean;
  "bind:open"?: Signal<boolean>;
}

/**
 * A collapsible group: an `<li>` holding a `GroupHeader` (a disclosure button) and a
 * `GroupContent` (a nested `<ul>`). M3 lists "Expand & collapse"; APG disclosure.
 */
const Group = component$<ListGroupProps>((props) => {
  /* eslint-disable @typescript-eslint/no-unused-vars -- pulled out so they never reach the DOM */
  const {
    value: valueProp,
    open: _open,
    "bind:open": _bindOpen,
    class: className,
    ...rest
  } = props;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const listCtx = useContext(listContextId);
  const localId = useId();
  const groupValue = valueProp || localId;
  const contentId = `${localId}-content`;
  const headerId = `${localId}-header`;

  const { openSig: isOpen } = useBindings(props, { open: true });

  const given: { open?: boolean; "bind:open"?: Signal<boolean> } = props;

  // Runs first: this list has groups, and a group that starts open joins the root's list.
  useTask$(() => {
    if (!listCtx.hasGroups.value) listCtx.hasGroups.value = true;
    const startsOpen =
      given.open !== undefined || given["bind:open"] !== undefined
        ? isOpen.value
        : !listCtx.groupsGiven;
    if (startsOpen && !listCtx.openGroups.value.includes(groupValue)) {
      listCtx.openGroups.value = listCtx.multipleGroups.value
        ? [...listCtx.openGroups.value, groupValue]
        : [groupValue];
    }
  });

  // The root's list decides.
  useTask$(({ track }) => {
    const open = track(() => listCtx.openGroups.value).includes(groupValue);
    if (isOpen.value !== open) isOpen.value = open;
  });

  // A bound `open` written by the host tells the root.
  useTask$(({ track }) => {
    const open = track(() => isOpen.value);
    const listed = listCtx.openGroups.value.includes(groupValue);
    if (open !== listed) listCtx.toggleGroup$(groupValue);
  });

  const toggle$ = $(() => listCtx.toggleGroup$(groupValue));

  useContextProvider(listGroupContextId, {
    isOpen,
    toggle$,
    contentId,
    headerId,
  });

  return (
    <li {...rest} data-qds-list-group="" class={["list-none", className]}>
      <Slot />
    </li>
  );
});

/** A header's keys: Enter / Space toggle; arrows, Home and End move between headers. */
const headerKeys = sync$((e: KeyboardEvent) => {
  const el = e.target as HTMLElement;
  if (!el.hasAttribute("data-qds-list-group-header")) return;
  if (el.hasAttribute("data-disabled")) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    el.click();
    return;
  }
  if (
    e.key !== "ArrowDown" &&
    e.key !== "ArrowUp" &&
    e.key !== "Home" &&
    e.key !== "End"
  )
    return;
  e.preventDefault();
  const list = el.closest("[data-qds-list]");
  if (!list) return;
  const headers = Array.from(
    list.querySelectorAll<HTMLElement>(
      "[data-qds-list-group-header][role='button']",
    ),
  );
  const index = headers.indexOf(el);
  if (index === -1) return;
  const next =
    e.key === "ArrowDown"
      ? (index + 1) % headers.length
      : e.key === "ArrowUp"
        ? (index - 1 + headers.length) % headers.length
        : e.key === "Home"
          ? 0
          : headers.length - 1;
  headers[next].focus();
});

export interface ListGroupHeaderProps extends Omit<ItemProps, "class"> {
  /** The header's text (the inner Item's `headline`). */
  label?: string;
  /** Trailing chevron, rotated while open. `null`: none. */
  chevronIcon?: IconName | null;
  /** A header with nothing to disclose (an add-only section): a label row, not a button. */
  "aria-disabled"?: boolean;
  class?: ClassList;
  itemClass?: ClassList;
}

/**
 * The group's disclosure: a `<div role="button">` holding an `Item` (the same sizes as the rows).
 * Not a `<button>`: an `end` control beside the chevron would be a button inside a button.
 */
const GroupHeader = component$<ListGroupHeaderProps>(
  ({
    label,
    headline,
    end,
    endProps,
    density,
    chevronIcon = "expand_more",
    "aria-disabled": ariaDisabled,
    itemClass,
    class: className,
    ...itemProps
  }) => {
    const groupCtx = useContext(listGroupContextId);
    const listCtx = useContext(listContextId);

    const handleClick$ = $(() => {
      if (ariaDisabled) return;
      groupCtx.toggle$();
    });

    const trailing: JSXOutput | undefined =
      end || chevronIcon ? (
        <div class="pointer-events-auto flex items-center">
          {freshJsx(end)}
          {chevronIcon && (
            <span
              data-list-group-chevron
              class="inline-flex size-8 shrink-0 items-center justify-center transition-transform duration-300 ease-standard motion-reduce:transition-none"
            >
              <Icon name={chevronIcon} />
            </span>
          )}
        </div>
      ) : undefined;

    return (
      <div
        id={groupCtx.headerId}
        role={ariaDisabled ? undefined : "button"}
        tabIndex={ariaDisabled ? undefined : 0}
        aria-expanded={ariaDisabled ? undefined : groupCtx.isOpen.value}
        aria-controls={ariaDisabled ? undefined : groupCtx.contentId}
        // Not `aria-disabled`: a disabled header has no role (a generic element may not carry
        // it); `data-disabled` styles it.
        data-disabled={ariaDisabled || undefined}
        data-qds-list-group-header=""
        data-selected={itemProps.selected || undefined}
        onClick$={handleClick$}
        onKeyDown$={headerKeys}
        class={[
          listItemVariants({
            look: listCtx.look.value,
            shape: listCtx.shape.value,
            indicator: listCtx.indicator.value,
            interactive: true,
          }),
          className,
        ]}
      >
        <Item
          {...itemProps}
          headline={headline ?? label}
          selectedFill={false}
          density={density ?? listCtx.density.value}
          end={trailing}
          endProps={endProps}
          class={["pointer-events-none rounded-[inherit]", itemClass]}
        >
          <Slot />
        </Item>
      </div>
    );
  },
);

export type ListGroupContentProps = Omit<PropsOf<"ul">, "class"> & {
  class?: ClassList;
};

/**
 * The group's rows: a nested `<ul>`, `hidden` while closed. In an `interactive` list it is the
 * listbox, named by its header, with its own single Tab stop.
 */
const GroupContent = component$<ListGroupContentProps>(
  ({ class: className, onFocusIn$, onFocusOut$, onKeyDown$, ...rest }) => {
    const groupCtx = useContext(listGroupContextId);
    const listCtx = useContext(listContextId);
    return (
      <ul
        {...rest}
        id={groupCtx.contentId}
        role={listCtx.interactive.value ? "listbox" : undefined}
        aria-labelledby={
          listCtx.interactive.value ? groupCtx.headerId : undefined
        }
        tabIndex={listCtx.interactive.value ? 0 : undefined}
        // An interactive group is its own listbox: the arrows stay in it (as on the root).
        data-roving={listCtx.interactive.value ? "vertical" : undefined}
        data-roving-items={listCtx.interactive.value ? ROW_ITEMS : undefined}
        onKeyDown$={[rovingKeys, onKeyDown$]}
        onFocusIn$={[focusInList, onFocusIn$]}
        onFocusOut$={[focusOutList, onFocusOut$]}
        hidden={!groupCtx.isOpen.value}
        data-qds-list-group-content=""
        class={["flex flex-col py-0", className]}
      >
        <Slot />
      </ul>
    );
  },
);

export const List = {
  Root,
  Item: ListItem,
  Divider,
  Group,
  GroupHeader,
  GroupContent,
};
