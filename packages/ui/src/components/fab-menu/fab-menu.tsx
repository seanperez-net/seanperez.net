import {
  $,
  Slot,
  component$,
  createContextId,
  useComputed$,
  useContext,
  useContextProvider,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { FABContent, fabDefaultSize, fabForm, fabVariants } from "../fab";
import type { FABSize } from "../fab";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { Menu, menuContextId } from "../menu";
import type { MenuContentProps } from "../menu";

/**
 * Material Design 3 (Expressive) FAB menu, from e-store's `components/fab-menu/fab-menu.tsx`
 * (2026-11-23): Root, Trigger, Content, Item.
 * Specs: https://m3.material.io/components/fab-menu/specs and /accessibility (read in Chrome
 * 2026-11-23); numbers from material-web `_md-comp-fab-menu*.scss` (tokens v34.0.21).
 *
 * M3 describes it twice, and both are here as `layout`:
 * - `menu` (default), M3's web form: "On web, a FAB menu is a combination of a FAB and a menu
 *   component. The FAB opens the menu", which "inherits its states and specs from the baseline
 *   menu", 4dp from the FAB. Built on our `Menu` (APG menu button: arrows, Home / End,
 *   type-ahead, Escape).
 * - `stacked`, the M3 Expressive FAB menu: the FAB turns into a 56dp round close button in the
 *   same top-trailing corner, and up to six pill items (56dp, the medium button's measurements,
 *   4dp apart) stack above it, 8dp from the close button. Focus lands on the close button, then
 *   Tab goes through the items top to bottom; Space / Enter activate (M3 accessibility page).
 *
 * Color sets (M3): primary, secondary, tertiary. The FAB is the set's container color, the
 * close button the set's color (primary, ...), the items the container color.
 *
 * The Root is a `Menu.Root` (open state, ids, refs); the Trigger is a FAB (`fabVariants`,
 * `FABContent`) on `Menu.Trigger unstyled`.
 */
export const fabMenuVariants = tv({
  slots: {
    root: "relative inline-flex flex-col items-end",
    // Stacked: the popover spans from 16dp under the window top to the FAB's top + 56dp (the
    // close button's bottom), so a long list scrolls in the room above the close button.
    content: [
      "m-0 border-0 bg-transparent p-0",
      // The UA gives a popover `height: fit-content`; `auto` lets the two insets set it.
      "h-auto",
      "overflow-visible",
      "pointer-events-none",
      "[&:popover-open]:flex",
      "flex-col items-end justify-end gap-2",
      // M3 motion: the items fade and rise in (standard-decelerate); out faster.
      "opacity-0",
      "transition-[opacity,display,overlay] duration-short-4 ease-standard-accelerate",
      "transition-discrete",
      "[&:popover-open]:opacity-100",
      "[&:popover-open]:duration-medium-1 [&:popover-open]:ease-standard-decelerate",
      "starting:[&:popover-open]:opacity-0",
      "motion-reduce:transition-none",
    ],
    list: [
      "pointer-events-auto",
      "flex min-h-0 flex-col items-end gap-1",
      // Room for the items' focus ring and shadow inside the scroller.
      "-m-2 overflow-y-auto p-2",
    ],
    item: [
      "pointer-events-auto",
      "relative inline-flex shrink-0 items-center",
      // M3: 56dp, full corners, 24dp sides, 24dp icon, 8dp icon-label space, title-medium.
      "h-14 gap-2 rounded-full px-6 text-title-medium whitespace-nowrap",
      "cursor-pointer select-none",
      "touch-target",
      // M3 tokens: level 0 at rest, 4 hovered, 3 focused and pressed.
      "shadow-0 hover:shadow-4 focus-visible:shadow-3 active:shadow-3",
      "transition-[box-shadow] duration-short-4 ease-standard",
      "motion-reduce:transition-none",
      "before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0",
      "before:pointer-events-none before:transition-opacity before:content-['']",
      "hover:before:opacity-8 focus-visible:before:opacity-10 active:before:opacity-10",
      "focus-ring",
      // No disabled state in M3's FAB menu; a disabled item is drawn as a disabled button.
      "disabled:pointer-events-none disabled:shadow-0",
      "disabled:bg-on-surface/10 disabled:text-on-surface/38",
    ],
    close: [
      "pointer-events-auto",
      "relative order-last inline-flex size-14 shrink-0 items-center justify-center",
      // M3: 56dp, full corners, level 3 (4 hovered), 20dp icon.
      "rounded-full shadow-3 hover:shadow-4 focus-visible:shadow-3 active:shadow-3",
      "cursor-pointer select-none",
      "before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0",
      "before:pointer-events-none before:transition-opacity before:content-['']",
      "hover:before:opacity-8 focus-visible:before:opacity-10 active:before:opacity-10",
      "focus-ring",
    ],
  },
  variants: {
    color: {
      primary: {
        item: [
          "bg-primary-container text-on-primary-container",
          "before:bg-on-primary-container",
        ],
        close: "bg-primary text-on-primary before:bg-on-primary",
      },
      secondary: {
        item: [
          "bg-secondary-container text-on-secondary-container",
          "before:bg-on-secondary-container",
        ],
        close: "bg-secondary text-on-secondary before:bg-on-secondary",
      },
      tertiary: {
        item: [
          "bg-tertiary-container text-on-tertiary-container",
          "before:bg-on-tertiary-container",
        ],
        close: "bg-tertiary text-on-tertiary before:bg-on-tertiary",
      },
    },
  },
  defaultVariants: { color: "primary" },
});

export type FABMenuColor = keyof typeof fabMenuVariants.variants.color;
export const fabMenuColors = Object.keys(
  fabMenuVariants.variants.color,
) as FABMenuColor[];
export type FABMenuLayout = "menu" | "stacked";
export const fabMenuLayouts: FABMenuLayout[] = ["menu", "stacked"];

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface FABMenuContextType {
  /** Reactive: the knobs change it live. */
  color: Readonly<Signal<FABMenuColor>>;
  extended: Readonly<Signal<boolean>>;
  /** Fixed at the first render: it decides which elements the parts render. */
  layout: FABMenuLayout;
  placement: "above" | "below";
}

const fabMenuContextId = createContextId<FABMenuContextType>(
  "net.seanperez.ui.fab-menu",
);

/* ------------------------------------------------------------------ */
/*  Root                                                              */
/* ------------------------------------------------------------------ */

export type FABMenuRootProps = PropsOf<"div"> & {
  /** The app's own signal for the open state. */
  open?: Signal<boolean>;
  onOpenChange$?: QRL<(open: boolean) => void>;
  /** M3 color set. Default `primary`. */
  color?: FABMenuColor;
  /** `menu` (M3 web: FAB + baseline menu, default) or `stacked` (M3 Expressive). */
  layout?: FABMenuLayout;
  /** `menu` layout: the menu above the FAB (default, a FAB at the bottom) or below it. */
  placement?: "above" | "below";
  /** The trigger is an extended FAB (its `label` shown). Default `false`. */
  extended?: boolean;
};

const Root = component$<FABMenuRootProps>(
  ({
    open,
    onOpenChange$,
    color: givenColor,
    layout = "menu",
    placement = "above",
    extended: givenExtended,
    class: className,
    ...rest
  }) => {
    const color = useComputed$<FABMenuColor>(() => givenColor ?? "primary");
    const extended = useComputed$(() => givenExtended ?? false);
    useContextProvider(fabMenuContextId, {
      color,
      extended,
      layout,
      placement,
    });
    return (
      <Menu.Root
        {...rest}
        open={open}
        onOpenChange$={onOpenChange$}
        data-qds-fab-menu=""
        class={[fabMenuVariants().root(), className]}
      >
        <Slot />
      </Menu.Root>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Trigger                                                           */
/* ------------------------------------------------------------------ */

export type FABMenuTriggerProps = Omit<
  PropsOf<"button">,
  "onClick$" | "onKeyDown$" | "children"
> & {
  /** The FAB's icon. */
  icon: IconName;
  /**
   * What the menu is for (M3: "The FAB's accessibility label should describe the menu"). Shown
   * when the Root is `extended`; otherwise the FAB's accessible name.
   */
  label: string;
  /** The FAB's size (M3: the menu opens from a FAB, medium FAB or large FAB; not a small FAB). */
  size?: Exclude<FABSize, "small">;
  onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
  onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLButtonElement) => void>;
};

const Trigger = component$<FABMenuTriggerProps>(
  ({ icon, label, size, onClick$, onKeyDown$, class: className, ...rest }) => {
    const ctx = useContext(fabMenuContextId);
    const menu = useContext(menuContextId);
    // The FAB's form, size and classes, worked out once and read in JSX (Qwik rc.5: no signal
    // reads in the component body).
    const fab = useComputed$(() => {
      const form = fabForm(label, ctx.extended.value);
      const resolved = size ?? fabDefaultSize(form);
      return {
        form,
        size: resolved,
        root: fabVariants({
          color: ctx.color.value,
          form,
          size: resolved,
        }).root(),
      };
    });

    if (ctx.layout === "menu") {
      return (
        <Menu.Trigger
          {...rest}
          unstyled
          data-qds-fab-menu-trigger=""
          onClick$={onClick$}
          onKeyDown$={onKeyDown$}
          class={[fab.value.root, className]}
        >
          <FABContent
            icon={icon}
            label={label}
            form={fab.value.form}
            size={fab.value.size}
          />
        </Menu.Trigger>
      );
    }

    // Stacked: not a menu button (M3: the items are buttons), so no `aria-haspopup`. While open
    // the close button stands in its corner and the FAB is transparent under it (it keeps
    // focusability, so focus can come back to it on close).
    return (
      <button
        {...rest}
        data-qds-fab-menu-trigger=""
        ref={menu.triggerRef}
        id={menu.triggerId}
        type="button"
        aria-expanded={menu.open.value}
        aria-controls={menu.contentId}
        popovertarget={menu.contentId}
        onClick$={onClick$}
        onKeyDown$={onKeyDown$}
        style={{ anchorName: `--menu-${menu.triggerId}` }}
        class={[
          fab.value.root,
          // Under the close button while open: unseen, and no invisible click target.
          "aria-expanded:pointer-events-none aria-expanded:opacity-0",
          className,
        ]}
      >
        <FABContent
          icon={icon}
          label={label}
          form={fab.value.form}
          size={fab.value.size}
        />
      </button>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Content                                                           */
/* ------------------------------------------------------------------ */

export type FABMenuContentProps = Omit<
  MenuContentProps,
  "side" | "align" | "floating"
> & {
  /** `stacked` layout: the close button's icon. Default `close`. */
  closeIcon?: IconName;
  /** `stacked` layout: the close button's name. Default "Toggle menu" (M3's label). */
  closeLabel?: string;
};

const Content = component$<FABMenuContentProps>(
  ({
    closeIcon = "close",
    closeLabel = "Toggle menu",
    onToggle$,
    class: className,
    style,
    ...rest
  }) => {
    const ctx = useContext(fabMenuContextId);
    const menu = useContext(menuContextId);
    // Class strings (tv's slot functions would not serialise).
    const styles = useComputed$(() => {
      const v = fabMenuVariants({ color: ctx.color.value });
      return {
        content: v.content(),
        list: v.list(),
        item: v.item(),
        close: v.close(),
      };
    });

    if (ctx.layout === "menu") {
      return (
        <Menu.Content
          {...rest}
          style={style}
          side={ctx.placement === "below" ? "bottom" : "top"}
          align="end"
          onToggle$={onToggle$}
          class={className}
        >
          <Slot />
        </Menu.Content>
      );
    }

    const handleToggle$ = $((event: ToggleEvent) => {
      const isOpen = event.newState === "open";
      menu.open.value = isOpen;
      // On open the close button takes focus by `autofocus` (HTML popover focusing steps;
      // M3: "initial focus remains on the close button, which takes the place of the FAB").
      if (isOpen) return;
      // Escape and the close button return focus to the FAB already (HTML "hide popover");
      // an item's click and a lost focus are done here. A click elsewhere keeps its focus.
      const active = document.activeElement;
      if (
        !active ||
        active === document.body ||
        menu.contentRef.value?.contains(active)
      )
        menu.triggerRef.value?.focus();
    });

    const anchor = `--menu-${menu.triggerId}`;
    return (
      <div
        {...rest}
        data-qds-fab-menu-content=""
        ref={menu.contentRef}
        id={menu.contentId}
        popover="auto"
        onToggle$={[handleToggle$, onToggle$]}
        style={{
          positionAnchor: anchor,
          position: "fixed",
          // The close button (last, 56dp) shares the FAB's top-trailing corner (M3).
          top: "16px",
          bottom: "calc(anchor(top) - 56px)",
          // Logical: `right: anchor(end)` would take the anchor's LEFT edge in RTL.
          insetInlineStart: "auto",
          insetInlineEnd: "anchor(end)",
          ...(typeof style === "object"
            ? (style as Record<string, string>)
            : {}),
        }}
        class={[styles.value.content, className]}
      >
        {/* First in the DOM, last on screen: focus starts here, then Tab goes through the items
            top to bottom (M3 accessibility, "Initial focus"). */}
        <button
          type="button"
          autofocus
          data-qds-fab-menu-close=""
          aria-label={closeLabel}
          aria-expanded="true"
          aria-controls={menu.contentId}
          popovertarget={menu.contentId}
          popovertargetaction="hide"
          class={styles.value.close}
        >
          <Icon name={closeIcon} size="sm" />
        </button>
        <div class={styles.value.list}>
          <Slot />
        </div>
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Item                                                              */
/* ------------------------------------------------------------------ */

export type FABMenuItemProps = Omit<
  PropsOf<"button">,
  "onClick$" | "onKeyDown$" | "children"
> & {
  /** The icon before the label. */
  icon?: IconName;
  /** The item's text (M3: its accessible name is its UI text). */
  label: string;
  disabled?: boolean;
  onClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
  onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLElement) => void>;
};

const Item = component$<FABMenuItemProps>(
  ({
    icon,
    label,
    disabled,
    onClick$,
    onKeyDown$,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(fabMenuContextId);
    const menu = useContext(menuContextId);
    // Class strings (tv's slot functions would not serialise).
    const styles = useComputed$(() => {
      const v = fabMenuVariants({ color: ctx.color.value });
      return {
        content: v.content(),
        list: v.list(),
        item: v.item(),
        close: v.close(),
      };
    });

    if (ctx.layout === "menu") {
      return (
        <Menu.Item
          {...(rest as PropsOf<"div">)}
          disabled={disabled}
          onClick$={onClick$}
          onKeyDown$={onKeyDown$}
          class={className}
        >
          {icon && <Icon name={icon} />}
          {label}
        </Menu.Item>
      );
    }

    const hide$ = $(() => {
      menu.contentRef.value?.hidePopover();
    });
    return (
      <button
        {...rest}
        type="button"
        data-qds-fab-menu-item=""
        disabled={disabled}
        onClick$={[hide$, onClick$]}
        onKeyDown$={onKeyDown$}
        class={[styles.value.item, className]}
      >
        {icon && <Icon name={icon} />}
        {label}
      </button>
    );
  },
);

export const FABMenu = { Root, Trigger, Content, Item };
