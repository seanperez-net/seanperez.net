import {
  $,
  Slot,
  component$,
  createContextId,
  sync$,
  useContext,
  useContextProvider,
  useId,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { chooseMenuItem, navigateMenuItems } from "../../utils/menu-keys";
import { openPopover } from "../../utils/top-layer";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { safeHref } from "../../utils/safe-href";
import { useBoundSignal } from "../../utils/use-bound-signal";

/**
 * Material Design 3 menu on the Popover API, from e-store's `components/menu/menu.tsx`
 * (2026-11-23): Root, Trigger, Content, Item, RadioGroup, RadioItem, Separator.
 * Specs: https://m3.material.io/components/menus/specs
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
 *
 * Submenus (`Sub`, `SubTrigger`, `SubContent`) ported 2026-11-24 from e-store (2026-11-11), with
 * the fixes listed in menu.md "Submenus".
 *
 * Left out (not needed yet): CheckboxItem, ItemIndicator, Group, GroupLabel, Shortcut,
 * `Item`'s submit mode, the trigger looks other than outlined / plain / bare, and
 * e-store's anchor-positioning polyfill (a dynamic `import()`, which our rules forbid; CSS anchor
 * positioning is in every current browser).
 *
 * Changed from e-store (proofed 2026-11-23, see menu.md "Where it differs"):
 * - On close, focus goes back to the trigger only when it was inside the menu (or lost). e-store
 *   refocused the trigger on every close, so a click on another control took its focus away
 *   (HTML spec: light dismiss does not restore focus; Escape and `hidePopover()` do).
 * - Tab closes the menu and moves on (APG menu pattern); e-store left it open.
 * - Signals are read in JSX, not the component body (Qwik rc.5 best practice).
 * - The trigger has a 48dp touch target (`touch-target`, M3).
 */

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface MenuContextType {
  open: Signal<boolean>;
  triggerId: string;
  contentId: string;
  triggerRef: Signal<HTMLButtonElement | undefined>;
  contentRef: Signal<HTMLElement | undefined>;
  /** The outermost menu's content: choosing an item in a submenu closes the whole stack. */
  rootContentRef: Signal<HTMLElement | undefined>;
  /** This menu is a submenu (`Menu.Sub`). */
  sub?: boolean;
}

export const menuContextId = createContextId<MenuContextType>(
  "net.seanperez.ui.menu",
);

interface RadioGroupContextType {
  value: Signal<string>;
  onValueChange$?: QRL<(value: string) => void>;
}

const radioGroupContextId = createContextId<RadioGroupContextType>(
  "net.seanperez.ui.menu-radio-group",
);

/** Every kind of menu row the keyboard moves between. */
const ITEM_SELECTOR =
  '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

/* ------------------------------------------------------------------ */
/*  Variants                                                          */
/* ------------------------------------------------------------------ */

export const menuItemVariants = tv({
  base: [
    "text-body-large text-on-surface",
    "hover:bg-on-surface/8 focus-visible:bg-on-surface/12 active:bg-on-surface/12",
    "relative flex w-full cursor-pointer items-center gap-3 px-3 transition-colors duration-short-4 ease-standard select-none",
    // M3 menu items draw the focus ring INWARD (material-web md-menu-item, `inward` md-focus-ring).
    "focus-ring-inward",
    "aria-disabled:pointer-events-none aria-disabled:opacity-38",
    "*:data-qds-icon:shrink-0 *:data-qds-icon:text-on-surface-variant",
    // M3 baseline selected state: a surface-container-highest fill.
    "aria-checked:rounded-xs aria-checked:bg-surface-container-highest",
    // The same fill on a SUBMENU row whose submenu holds the current choice (`SubTrigger
    // checked`, 2026-11-24): a `menuitem` with `aria-haspopup` cannot be `aria-checked`.
    "data-checked:rounded-xs data-checked:bg-surface-container-highest",
  ],
  variants: {
    // A minimum height, not a fixed one: a label that wraps grows its row (M3 list items: 48dp
    // minimum, 8dp block padding) instead of overlapping the next one.
    size: {
      default: "min-h-12 py-2",
      dense: "min-h-8 gap-2 py-1 text-body-medium",
    },
    /** `false`: no fill on a checked row (the row's own icon shows the choice). */
    checkedHighlight: {
      true: "",
      false: "aria-checked:bg-transparent data-checked:bg-transparent",
    },
  },
  defaultVariants: { size: "default", checkedHighlight: true },
});

export const menuTriggerVariants = tv({
  base: [
    "group/button relative inline-flex cursor-pointer items-center justify-center",
    "hover:bg-on-surface/8 active:bg-on-surface/10",
    // The M3 focus ring (tokens/components/focus-ring.css).
    "focus-ring",
    // 48dp to the pointer however small it draws (M3; `tokens/utilities.css`).
    "touch-target",
    "disabled:pointer-events-none disabled:opacity-38",
  ],
  variants: {
    look: {
      outlined:
        "gap-2 rounded-full border border-outline-variant px-4 text-label-large text-on-surface-variant",
      plain:
        "gap-2 rounded-full border-none px-2 text-label-large text-on-surface-variant",
      /** No padding or border: the trigger is its content (an avatar), centred in the target. */
      bare: "gap-2 rounded-full border-none p-0 text-label-large text-on-surface-variant",
    },
    /** As IconButton: `xs` 32dp, `sm` 40dp. */
    size: {
      xs: "h-8 min-w-8",
      sm: "h-10 min-w-10",
    },
  },
  defaultVariants: { look: "outlined", size: "sm" },
});

export const menuContentVariants = tv({
  base: [
    "z-50 max-w-70 min-w-28 rounded-xs bg-surface-container py-2 shadow-2",
    // At most the window (less 2rem); a menu taller than the room on either side of its trigger
    // takes the last position fallback and scrolls (`tokens/components/menu.css`).
    "max-h-[calc(100dvh-2rem)] overflow-y-auto",
    // Our scrollbar; 4dp corners need no track margin.
    "scrollbar-pane [--scrollbar-track-margin:0px]",
    // M3 menu motion. Enter: standard-decelerate, medium-1, scale Y from 0.6 and fade in.
    // Exit: standard-accelerate, short-4, fade only.
    "opacity-0",
    "transition-[opacity,display,overlay] duration-short-4 ease-standard-accelerate",
    "transition-discrete",
    "[&:popover-open]:scale-100 [&:popover-open]:opacity-100",
    "[&:popover-open]:duration-medium-1 [&:popover-open]:ease-standard-decelerate",
    "[&:popover-open]:transition-[opacity,transform,display,overlay]",
    "starting:[&:popover-open]:scale-x-100 starting:[&:popover-open]:scale-y-[0.6] starting:[&:popover-open]:opacity-0",
    "motion-reduce:transition-none",
  ],
  variants: {
    side: {
      bottom: "origin-top",
      top: "origin-bottom",
    },
  },
  defaultVariants: { side: "bottom" },
});

/* ------------------------------------------------------------------ */
/*  Root                                                              */
/* ------------------------------------------------------------------ */

export type MenuRootProps = PropsOf<"div"> & {
  /** The app's own signal for the open state. */
  open?: Signal<boolean>;
  onOpenChange$?: QRL<(open: boolean) => void>;
};

const Root = component$<MenuRootProps>(
  ({ open: givenOpen, onOpenChange$, class: className, ...rest }) => {
    const open = useBoundSignal(givenOpen, false);
    const triggerId = useId();
    const contentId = useId();
    const triggerRef = useSignal<HTMLButtonElement | undefined>();
    const contentRef = useSignal<HTMLElement | undefined>();

    useTask$(({ track }) => {
      const value = track(() => open.value);
      onOpenChange$?.(value);
    });

    useContextProvider(menuContextId, {
      open,
      triggerId,
      contentId,
      triggerRef,
      contentRef,
      rootContentRef: contentRef,
    });

    // `inline-flex`, not `inline-block`: as a block box the wrapper made a line box and the
    // trigger sat on the text baseline, one phantom pixel taller (e-store's note).
    return (
      <div
        {...rest}
        data-qds-menu=""
        class={["relative inline-flex", className]}
      >
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Trigger                                                           */
/* ------------------------------------------------------------------ */

export type MenuTriggerProps = Omit<
  PropsOf<"button">,
  "onClick$" | "onKeyDown$"
> &
  VariantProps<typeof menuTriggerVariants> & {
    onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
    onKeyDown$?: QRL<
      (event: KeyboardEvent, element: HTMLButtonElement) => void
    >;
    /**
     * Skip the trigger's own look: the host styles it (SplitButton's trailing button, the FAB
     * menu's FAB). e-store's `Dropdown.Trigger unstyled`, ported 2026-11-23.
     */
    unstyled?: boolean;
  };

/**
 * APG menu button: ArrowDown opens the menu on its first item, ArrowUp on its last. All of it
 * synchronous, in a `sync$`: the page must not scroll, and the choice of item is written on the
 * menu (`data-qds-menu-focus`) BEFORE it opens, so `Content`'s open handler, the one place that
 * moves focus on open, reads it. (e-store opened from an async handler and raced the open
 * handler's own "focus the first item": ArrowUp could land on the first item.) Enter and Space
 * are the button's own click (`popovertarget`), which opens on the first item.
 */
const openWithArrow = sync$((event: KeyboardEvent, trigger: HTMLElement) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const id = trigger.getAttribute("aria-controls");
  const content = id ? document.getElementById(id) : null;
  if (!content) return;
  content.setAttribute(
    "data-qds-menu-focus",
    event.key === "ArrowUp" ? "last" : "first",
  );
  // `openPopover`'s guard (utils/top-layer.ts), inline: a `sync$` cannot import it.
  if (content.isConnected && !content.matches(":popover-open"))
    content.showPopover();
  else content.removeAttribute("data-qds-menu-focus");
});

const Trigger = component$<MenuTriggerProps>(
  ({
    look,
    size,
    unstyled,
    onClick$,
    onKeyDown$,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(menuContextId);

    return (
      <button
        {...rest}
        data-qds-menu-trigger=""
        ref={ctx.triggerRef}
        id={ctx.triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={ctx.open.value}
        aria-controls={ctx.contentId}
        popovertarget={ctx.contentId}
        onClick$={onClick$}
        onKeyDown$={[openWithArrow, onKeyDown$]}
        style={{ anchorName: `--menu-${ctx.triggerId}` }}
        class={[
          unstyled ? undefined : menuTriggerVariants({ look, size }),
          className,
        ]}
      >
        <Slot />
      </button>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Content (the popover)                                             */
/* ------------------------------------------------------------------ */

export type MenuContentProps = Omit<
  PropsOf<"div">,
  "onToggle$" | "onPointerOver$"
> & {
  /** Skip the default anchored position (the host places it). */
  floating?: boolean;
  /** Inline alignment against the trigger. Default `start`; the app bar's end wants `end`. */
  align?: "start" | "end";
  /**
   * `bottom` (default, under the trigger), `top` (above it, for a trigger near the bottom of
   * its frame) or `end` (beside the trigger's inline-end edge, the first item level with it: a
   * submenu, its default) or `start` (NEW 2026-11-25: beside the trigger's inline-start edge,
   * for a submenu of a submenu that already opened towards the start, so it cascades the same
   * way instead of covering the menu it came from). Each flips when it would leave the window.
   */
  side?: "bottom" | "top" | "end" | "start";
  onToggle$?: QRL<(event: ToggleEvent, element: HTMLDivElement) => void>;
  onPointerOver$?: QRL<(event: PointerEvent, element: HTMLDivElement) => void>;
};

/** Closes the open submenus of `menu` other than `keep`'s (the pointer moved to a sibling row). */
const closeOtherSubs = (menu: Element, keep: Element | null) => {
  for (const sub of Array.from(
    menu.querySelectorAll<HTMLElement>("[data-qds-menu-content][popover]"),
  )) {
    if (sub === menu || sub.parentElement?.closest('[role="menu"]') !== menu)
      continue;
    if (keep && sub.id === keep.getAttribute("aria-controls")) continue;
    if (sub.matches(":popover-open")) sub.hidePopover();
  }
};

const Content = component$<MenuContentProps>(
  ({
    floating,
    align = "start",
    side,
    onToggle$,
    onPointerOver$,
    style,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(menuContextId);
    const placement = side ?? (ctx.sub ? "end" : "bottom");

    const handleToggle$ = $((event: ToggleEvent) => {
      const isOpen = event.newState === "open";
      ctx.open.value = isOpen;
      const content = ctx.contentRef.value;
      if (isOpen) {
        // The first item takes focus on open (APG menu button); the last after the trigger's
        // ArrowUp, which marked the menu `data-qds-menu-focus="last"` before opening it.
        // A submenu opened by the pointer is marked "none": hovering must not move focus
        // (e-store's moved it into the submenu on hover).
        if (content) {
          const mark = content.getAttribute("data-qds-menu-focus");
          content.removeAttribute("data-qds-menu-focus");
          if (mark === "none") return;
          requestAnimationFrame(() => {
            // This menu's own rows: a submenu's rows sit inside its parent's DOM.
            const items = Array.from(
              content.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
            ).filter((item) => item.closest('[role="menu"]') === content);
            if (items.length > 0)
              items[mark === "last" ? items.length - 1 : 0].focus();
          });
        }
        return;
      }
      // Escape and `hidePopover()` already return focus to the trigger (HTML spec, "hide
      // popover" with focusPreviousElement). Do it here only when focus is still in the menu or
      // was lost; a click on another control (light dismiss) keeps its focus.
      const active = document.activeElement;
      if (!active || active === document.body || content?.contains(active))
        ctx.triggerRef.value?.focus();
    });

    const anchor = `--menu-${ctx.triggerId}`;
    const end = align === "end";
    // Plain strings: anchor positioning is newer than the CSS types Qwik ships.
    const position: Record<string, string> = floating
      ? {}
      : placement === "start"
        ? {
            positionAnchor: anchor,
            top: "calc(anchor(top) - 8px)",
            bottom: "auto",
            // Logical insets, so RTL mirrors it (reviewer 2026-11-25).
            insetInlineStart: "auto",
            insetInlineEnd: "anchor(start)",
            position: "absolute",
            margin: "unset",
            // As `end`, mirrored: flips to the end side where the start has no room.
            positionTry:
              "flip-inline, flip-block, flip-block flip-inline, --qds-menu-scroll-below-end",
          }
      : placement === "end"
        ? {
            positionAnchor: anchor,
            // `py-2` (8px) above the first item: level with the trigger's top (e-store's).
            top: "calc(anchor(top) - 8px)",
            bottom: "auto",
            // Logical insets (were `left` / `right`), so RTL mirrors it (reviewer 2026-11-25).
            insetInlineStart: "anchor(end)",
            insetInlineEnd: "auto",
            position: "absolute",
            margin: "unset",
            // e-store's flips; then, where neither side has room (a phone: the account menu at
            // the window's end leaves under 112px beside it), below the trigger row, end edges
            // lined up, scrolling in the room left (ours; e-store had no last fallback).
            positionTry:
              "flip-inline, flip-block, flip-block flip-inline, --qds-menu-scroll-below-end",
          }
        : placement === "top"
          ? {
              positionAnchor: anchor,
              top: "auto",
              bottom: "calc(anchor(top) + 4px)",
              // Logical (were `left` / `right`): `anchor(start)` resolves against the containing
              // block's direction, so in right-to-left `left: anchor(start)` was the trigger's
              // RIGHT edge and the menu opened beside it (measured 2026-11-25, L10).
              insetInlineStart: end ? "auto" : "anchor(start)",
              insetInlineEnd: end ? "anchor(end)" : "auto",
              position: "absolute",
              margin: "unset",
              positionTry: end
                ? "normal flip-block, flip-inline, flip-block flip-inline, --qds-menu-scroll-above-end"
                : "normal flip-block, flip-inline, flip-block flip-inline, --qds-menu-scroll-above",
            }
          : {
              positionAnchor: anchor,
              // 4px under the trigger.
              top: "calc(anchor(bottom) + 4px)",
              bottom: "auto",
              // Logical, as `top` above.
              insetInlineStart: end ? "auto" : "anchor(start)",
              insetInlineEnd: end ? "anchor(end)" : "auto",
              position: "absolute",
              margin: "unset",
              // Flip below / above and start / end; last, a menu that fits neither side stays
              // below and scrolls in the room left (`tokens/components/menu.css`).
              positionTry: end
                ? "normal flip-block, flip-inline, flip-block flip-inline, --qds-menu-scroll-below-end"
                : "normal flip-block, flip-inline, flip-block flip-inline, --qds-menu-scroll-below",
            };

    return (
      <div
        {...rest}
        data-qds-menu-content=""
        ref={ctx.contentRef}
        id={ctx.contentId}
        role="menu"
        aria-labelledby={ctx.triggerId}
        popover="auto"
        onToggle$={[handleToggle$, onToggle$]}
        // Moving to another row of THIS menu closes a sibling's open submenu (e-store's; VS
        // Code, macOS).
        onPointerOver$={[
          $((event: PointerEvent, element: HTMLDivElement) => {
            const item = (event.target as HTMLElement).closest?.(
              '[role^="menuitem"]',
            );
            if (!item || item.closest('[role="menu"]') !== element) return;
            closeOtherSubs(
              element,
              item.hasAttribute("data-qds-menu-sub-trigger") ? item : null,
            );
          }),
          onPointerOver$,
        ]}
        style={{
          ...position,
          ...(typeof style === "object"
            ? (style as Record<string, string>)
            : {}),
        }}
        class={[
          menuContentVariants({ side: placement === "top" ? "top" : "bottom" }),
          className,
        ]}
      >
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Item                                                              */
/* ------------------------------------------------------------------ */

export type MenuItemProps = Omit<PropsOf<"div">, "onClick$" | "onKeyDown$"> &
  VariantProps<typeof menuItemVariants> & {
    disabled?: boolean;
    /** Close the menu once chosen. Default `true`. */
    closeOnSelect?: boolean;
    /**
     * Renders a real `<a role="menuitem">` (middle-click, open in a new tab, copy link). Same
     * keyboard model. A disabled link drops its `href`.
     */
    href?: string;
    /** `_blank` opens a new tab; `rel="noopener noreferrer"` is added. */
    target?: string;
    onClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
    onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLElement) => void>;
  };

const Item = component$<MenuItemProps>(
  ({
    size,
    checkedHighlight,
    disabled,
    closeOnSelect = true,
    href,
    target,
    onClick$,
    onKeyDown$,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(menuContextId);

    const handleClick$ = $(() => {
      if (disabled) return;
      // The outermost menu: hiding it hides every open submenu above it (popover stack).
      if (closeOnSelect)
        (ctx.rootContentRef.value ?? ctx.contentRef.value)?.hidePopover();
    });

    const classes = [menuItemVariants({ size, checkedHighlight }), className];

    if (href) {
      return (
        <a
          {...(rest as PropsOf<"a">)}
          data-qds-menu-item=""
          role="menuitem"
          tabIndex={disabled ? undefined : -1}
          aria-disabled={disabled || undefined}
          // An anchor has no `disabled`: dropping the href is what disables it.
          href={disabled ? undefined : safeHref(href)}
          target={target}
          rel={target === "_blank" ? "noopener noreferrer" : undefined}
          onClick$={[handleClick$, onClick$]}
          onKeyDown$={[navigateMenuItems, chooseMenuItem, onKeyDown$]}
          class={classes}
        >
          <Slot />
        </a>
      );
    }

    return (
      <div
        {...rest}
        data-qds-menu-item=""
        role="menuitem"
        tabIndex={disabled ? undefined : -1}
        aria-disabled={disabled || undefined}
        onClick$={[handleClick$, onClick$]}
        onKeyDown$={[navigateMenuItems, chooseMenuItem, onKeyDown$]}
        class={classes}
      >
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  RadioGroup                                                        */
/* ------------------------------------------------------------------ */

export type MenuRadioGroupProps = PropsOf<"div"> & {
  /** The app's own signal for the chosen value. */
  value?: Signal<string>;
  onValueChange$?: QRL<(value: string) => void>;
};

const RadioGroup = component$<MenuRadioGroupProps>(
  ({ value: valueSignal, onValueChange$, ...rest }) => {
    const value = useBoundSignal(valueSignal, "");
    useContextProvider(radioGroupContextId, { value, onValueChange$ });
    return (
      <div {...rest} role="group">
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  RadioItem                                                         */
/* ------------------------------------------------------------------ */

export type MenuRadioItemProps = Omit<
  PropsOf<"div">,
  "onClick$" | "onKeyDown$"
> &
  VariantProps<typeof menuItemVariants> & {
    value: string;
    disabled?: boolean;
    /** Close the menu once chosen. Default `true`. */
    closeOnSelect?: boolean;
    /**
     * Renders a real `<button type="submit" name={name} value={value}>`, a submit of the
     * `<form>` around it, so a choice the SERVER makes works without JavaScript.
     */
    name?: string;
    onClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
    onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLElement) => void>;
  };

const RadioItem = component$<MenuRadioItemProps>(
  ({
    size,
    checkedHighlight,
    value,
    disabled,
    closeOnSelect = true,
    name,
    onClick$,
    onKeyDown$,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(menuContextId);
    const radio = useContext(radioGroupContextId);

    const handleClick$ = $(() => {
      if (disabled) return;
      radio.value.value = value;
      radio.onValueChange$?.(value);
      if (closeOnSelect)
        (ctx.rootContentRef.value ?? ctx.contentRef.value)?.hidePopover();
    });

    const classes = [
      "group/radio",
      menuItemVariants({ size, checkedHighlight }),
      className,
    ];

    if (name !== undefined) {
      return (
        <button
          {...(rest as PropsOf<"button">)}
          type="submit"
          name={name}
          value={value}
          disabled={disabled}
          data-qds-menu-submit=""
          role="menuitemradio"
          aria-checked={radio.value.value === value}
          tabIndex={disabled ? undefined : -1}
          aria-disabled={disabled || undefined}
          onClick$={[handleClick$, onClick$]}
          onKeyDown$={[navigateMenuItems, chooseMenuItem, onKeyDown$]}
          class={classes}
        >
          <Slot />
        </button>
      );
    }

    return (
      <div
        {...rest}
        role="menuitemradio"
        aria-checked={radio.value.value === value}
        tabIndex={disabled ? undefined : -1}
        aria-disabled={disabled || undefined}
        onClick$={[handleClick$, onClick$]}
        onKeyDown$={[navigateMenuItems, chooseMenuItem, onKeyDown$]}
        class={classes}
      >
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Separator                                                         */
/* ------------------------------------------------------------------ */

/** A line between groups of rows. An `<hr>` is a separator already. */
const Separator = component$<PropsOf<"hr">>(({ class: className, ...rest }) => {
  return (
    <hr
      {...rest}
      class={["my-2 h-px border-none bg-outline-variant", className]}
    />
  );
});

/* ------------------------------------------------------------------ */
/*  Submenu (e-store's, 2026-11-11; ported 2026-11-24)                 */
/* ------------------------------------------------------------------ */

export type MenuSubProps = PropsOf<"div">;

/**
 * A submenu: one `Menu.SubTrigger` (a row of the parent menu) and one `Menu.SubContent` (a
 * nested `popover="auto"` in the parent's DOM, so opening it keeps the parent open and hiding
 * the root hides it). Its wrapper is `role="none"`, so the trigger stays a row of the parent.
 */
const Sub = component$<MenuSubProps>((props) => {
  const parent = useContext(menuContextId);
  const open = useSignal(false);
  const triggerId = useId();
  const contentId = useId();
  const triggerRef = useSignal<HTMLButtonElement | undefined>();
  const contentRef = useSignal<HTMLElement | undefined>();
  useContextProvider(menuContextId, {
    open,
    triggerId,
    contentId,
    triggerRef,
    contentRef,
    rootContentRef: parent.rootContentRef,
    sub: true,
  });
  return (
    <div {...props} role="none" data-qds-menu-sub="">
      <Slot />
    </div>
  );
});

export type MenuSubTriggerProps = Omit<
  PropsOf<"div">,
  "onClick$" | "onKeyDown$" | "onPointerEnter$" | "onPointerLeave$"
> &
  VariantProps<typeof menuItemVariants> & {
    disabled?: boolean;
    /**
     * The submenu holds the current choice (NEW 2026-11-24, the account menu's Busy row): the
     * checked fill, as `data-checked`. Not `aria-checked` (not allowed on a `menuitem`): say the
     * state in the row's own text.
     */
    checked?: boolean;
    /** The trailing icon marking the submenu. */
    submenuIcon?: IconName;
    /**
     * Hover delay before it opens, in ms (default 0). VS Code waits 250 so a diagonal move
     * towards an open submenu does not open a sibling's on the way. Click and keys open at once.
     */
    openDelay?: number;
    onClick$?: QRL<(event: PointerEvent, element: HTMLDivElement) => void>;
    onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLDivElement) => void>;
    onPointerEnter$?: QRL<
      (event: PointerEvent, element: HTMLDivElement) => void
    >;
    onPointerLeave$?: QRL<
      (event: PointerEvent, element: HTMLDivElement) => void
    >;
  };

type TimedTrigger = HTMLElement & {
  __qdsSubTimer?: ReturnType<typeof setTimeout>;
};

/**
 * Opens the submenu. `focusFirst` (the keys): its first row takes focus; the pointer leaves
 * focus where it is (`data-qds-menu-focus="none"`, read by `Content`'s open handler).
 */
const openSub = (ctx: MenuContextType, focusFirst: boolean) => {
  const content = ctx.contentRef.value;
  const trigger = ctx.triggerRef.value as HTMLElement | undefined;
  if (!content) return;
  if (content.matches(":popover-open")) {
    if (focusFirst)
      Array.from(content.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
        .find(
          (item) =>
            item.closest('[role="menu"]') === content &&
            item.getAttribute("aria-disabled") !== "true",
        )
        ?.focus();
    return;
  }
  const menu = trigger?.closest('[role="menu"]');
  if (menu) closeOtherSubs(menu, trigger ?? null);
  content.setAttribute("data-qds-menu-focus", focusFirst ? "first" : "none");
  if (!openPopover(content)) content.removeAttribute("data-qds-menu-focus");
};

/** ArrowRight / Enter / Space open the submenu: claimed synchronously (scroll, activation). */
const claimSubKeys = sync$((event: KeyboardEvent) => {
  if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ")
    event.preventDefault();
});

/**
 * The parent menu's row that opens the submenu: `aria-haspopup="menu"`, `aria-expanded`,
 * `aria-controls`, a trailing chevron. Hover or click opens it; ArrowRight, Enter or Space open
 * it with its first row focused (APG).
 */
const SubTrigger = component$<MenuSubTriggerProps>(
  ({
    size,
    checkedHighlight,
    disabled,
    checked,
    submenuIcon = "chevron_right",
    openDelay = 0,
    onClick$,
    onKeyDown$,
    onPointerEnter$,
    onPointerLeave$,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(menuContextId);
    return (
      <div
        {...rest}
        ref={ctx.triggerRef as unknown as Signal<HTMLDivElement | undefined>}
        id={ctx.triggerId}
        role="menuitem"
        tabIndex={disabled ? undefined : -1}
        aria-haspopup="menu"
        aria-expanded={ctx.open.value}
        aria-controls={ctx.contentId}
        aria-disabled={disabled || undefined}
        data-qds-menu-item=""
        data-qds-menu-sub-trigger=""
        data-checked={checked ? "" : undefined}
        style={{ anchorName: `--menu-${ctx.triggerId}` }}
        class={[menuItemVariants({ size, checkedHighlight }), className]}
        onPointerEnter$={[
          $((_: PointerEvent, element: HTMLDivElement) => {
            if (disabled) return;
            if (openDelay <= 0) return openSub(ctx, false);
            const timed = element as TimedTrigger;
            clearTimeout(timed.__qdsSubTimer);
            timed.__qdsSubTimer = setTimeout(() => {
              if (timed.matches(":hover")) openSub(ctx, false);
            }, openDelay);
          }),
          onPointerEnter$,
        ]}
        onPointerLeave$={[
          $((_: PointerEvent, element: HTMLDivElement) =>
            clearTimeout((element as TimedTrigger).__qdsSubTimer),
          ),
          onPointerLeave$,
        ]}
        onClick$={[
          $((event: PointerEvent) => {
            // A click from Enter / Space (`detail` 0) is handled by the keys below.
            if (!disabled && event.detail !== 0) openSub(ctx, false);
          }),
          onClick$,
        ]}
        onKeyDown$={[
          navigateMenuItems,
          claimSubKeys,
          $((event: KeyboardEvent) => {
            if (disabled) return;
            if (
              event.key === "ArrowRight" ||
              event.key === "Enter" ||
              event.key === " "
            )
              openSub(ctx, true);
          }),
          onKeyDown$,
        ]}
      >
        <Slot />
        <Icon name={submenuIcon} size="sm" class="ms-auto" />
      </div>
    );
  },
);

/** ArrowLeft closes the submenu (focus back on its trigger): claimed synchronously. */
const claimArrowLeft = sync$((event: KeyboardEvent) => {
  if (event.key === "ArrowLeft") event.preventDefault();
});

export type MenuSubContentProps = Omit<MenuContentProps, "onKeyDown$"> & {
  onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLDivElement) => void>;
};

/** The submenu's popover: `Menu.Content` beside the trigger's end (`side="end"`). */
const SubContent = component$<MenuSubContentProps>(
  ({ onKeyDown$, ...rest }) => {
    const ctx = useContext(menuContextId);
    return (
      <Content
        side="end"
        {...rest}
        onKeyDown$={[
          claimArrowLeft,
          $((event: KeyboardEvent) => {
            if (event.key !== "ArrowLeft") return;
            const menu = (event.target as HTMLElement).closest?.(
              '[role="menu"]',
            );
            if (menu !== ctx.contentRef.value) return;
            ctx.contentRef.value?.hidePopover();
            ctx.triggerRef.value?.focus();
          }),
          onKeyDown$,
        ]}
      >
        <Slot />
      </Content>
    );
  },
);

export const Menu = {
  Root,
  Trigger,
  Content,
  Item,
  RadioGroup,
  RadioItem,
  Separator,
  Sub,
  SubTrigger,
  SubContent,
};
