import {
  Slot,
  component$,
  createContextId,
  useComputed$,
  useContext,
  useContextProvider,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName, IconSize } from "../icon";
import { Menu } from "../menu";
import type { MenuContentProps } from "../menu";

/**
 * Material Design 3 (Expressive) split button, from e-store's
 * `components/split-button/split-button.tsx` (2026-11-23): Root, Action, Trigger, Content,
 * Item, Separator, on our `Menu` (APG menu button).
 * Specs: https://m3.material.io/components/split-button/specs (read in Chrome 2026-11-23);
 * numbers from material-web `_md-comp-split-button-{xsmall..xlarge}.scss` (tokens v34.0.21),
 * except the icon offsets, which only the M3 specs page prints ("Menu icon offset when
 * unselected"), and the focused inner corner, which the page names ("The inner corners change
 * shape for hovered, focused, and pressed states") and the tokens do not.
 * Colors and type are the common buttons' (M3: "Split buttons use the same colors and state
 * layers as buttons"), as in `button.tsx`.
 *
 * Per size, height / leading button sides / trailing button width (sides + icon) / inner corner
 * resting, hovered-focused-pressed / trailing icon offset:
 *   xs  32 / 12-10 / 48 (13+22+13)  / 4, 8   / -1      sm 40 / 16-12 / 48 (13+22+13) / 4, 12 / -1
 *   md  56 / 24-24 / 56 (15+26+15)  / 4, 12  / -2      lg 96 / 48-48 / 96 (29+38+29) / 8, 20 / -3
 *   xl 136 / 64-64 / 136 (43+50+43) / 12, 20 / -6
 * The two halves are 2dp apart; outer corners are full. Open (selected), the trailing button's
 * inner corners become full and its icon centres and turns over.
 */
/** What both halves share: the common button's base (state layer, motion, 48dp target). */
const halfBase = [
  "cursor-pointer select-none",
  "touch-target",
  "transition-[background-color,box-shadow,border-radius,color]",
  "duration-short-4 ease-spring-fast-spatial motion-reduce:transition-none",
  "before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0",
  "before:transition-opacity before:pointer-events-none before:content-['']",
  "hover:before:opacity-8 focus-visible:before:opacity-10 active:before:opacity-10",
];

export const splitButtonVariants = tv({
  slots: {
    root: "inline-flex items-center gap-0.5 select-none",
    // Both halves: the common button's base (state layer, focus ring, target, disabled).
    action: [
      "relative inline-flex shrink-0 items-center justify-center text-nowrap",
      ...halfBase,
      // Each half draws its own ring, raised so the other half cannot cover it (e-store's).
      "focus-ring focus-visible:z-1",
      "disabled:pointer-events-none disabled:text-on-surface/38",
    ],
    trigger: [
      "relative inline-flex shrink-0 items-center justify-center",
      ...halfBase,
      "focus-ring focus-visible:z-1",
      "disabled:pointer-events-none disabled:text-on-surface/38",
      // Open: full inner corners (M3 `trailing-button-inner-corner-selected`: 50%).
      "aria-expanded:rounded-s-full",
    ],
    // The menu icon: optically offset towards the inner edge, centred and turned when open.
    chevron: [
      "inline-flex items-center justify-center",
      "transition-transform duration-short-4 ease-standard motion-reduce:transition-none",
      "group-aria-expanded/trigger:translate-x-0 group-aria-expanded/trigger:rotate-180",
    ],
  },
  variants: {
    look: {
      filled: {
        action: "bg-primary text-on-primary before:bg-on-primary",
        trigger: "bg-primary text-on-primary before:bg-on-primary",
      },
      tonal: {
        action: [
          "bg-secondary-container text-on-secondary-container",
          "before:bg-on-secondary-container",
        ],
        trigger: [
          "bg-secondary-container text-on-secondary-container",
          "before:bg-on-secondary-container",
        ],
      },
      elevated: {
        action: [
          "bg-surface-container-low text-primary before:bg-primary",
          "shadow-1 hover:shadow-2 active:shadow-1 disabled:shadow-none",
        ],
        trigger: [
          "bg-surface-container-low text-primary before:bg-primary",
          "shadow-1 hover:shadow-2 active:shadow-1 disabled:shadow-none",
        ],
      },
      // M3 Expressive outlined: outline-variant ring (kept when disabled), on-surface-variant.
      outlined: {
        action: [
          "bg-transparent text-on-surface-variant before:bg-on-surface-variant",
          "inset-ring-outline-variant",
        ],
        trigger: [
          "bg-transparent text-on-surface-variant before:bg-on-surface-variant",
          "inset-ring-outline-variant",
        ],
      },
    },
    size: {
      xs: {
        action: "h-8 gap-2 ps-3 pe-2.5 text-label-large",
        trigger: "h-8 w-12",
        chevron: "-translate-x-px rtl:translate-x-px [&>svg]:size-5.5",
      },
      sm: {
        action: "h-10 gap-2 ps-4 pe-3 text-label-large",
        trigger: "h-10 w-12",
        chevron: "-translate-x-px rtl:translate-x-px [&>svg]:size-5.5",
      },
      md: {
        action: "h-14 gap-2 px-6 text-title-medium",
        trigger: "h-14 w-14",
        chevron: "-translate-x-0.5 rtl:translate-x-0.5 [&>svg]:size-6.5",
      },
      lg: {
        action: "h-24 gap-3 px-12 text-headline-small",
        trigger: "h-24 w-24",
        chevron: "-translate-x-0.75 rtl:translate-x-0.75 [&>svg]:size-9.5",
      },
      xl: {
        action: "h-34 gap-4 px-16 text-headline-large",
        trigger: "h-34 w-34",
        chevron: "-translate-x-1.5 rtl:translate-x-1.5 [&>svg]:size-12.5",
      },
    },
  },
  compoundVariants: [
    // Disabled container, as the common buttons (on-surface 10%); outlined keeps no fill.
    {
      look: ["filled", "tonal", "elevated"],
      class: {
        action: "disabled:bg-on-surface/10",
        trigger: "disabled:bg-on-surface/10",
      },
    },
    // Outline width, as the common buttons: 1dp to M, 2dp L, 3dp XL.
    {
      look: "outlined",
      size: ["xs", "sm", "md"],
      class: { action: "inset-ring", trigger: "inset-ring" },
    },
    {
      look: "outlined",
      size: "lg",
      class: { action: "inset-ring-2", trigger: "inset-ring-2" },
    },
    {
      look: "outlined",
      size: "xl",
      class: { action: "inset-ring-3", trigger: "inset-ring-3" },
    },
    // Corners: full outside; inside resting, then hovered / focused / pressed (M3 tokens).
    {
      size: "xs",
      class: {
        action:
          "rounded-s-full rounded-e-xs hover:rounded-e-sm focus-visible:rounded-e-sm active:rounded-e-sm",
        trigger:
          "rounded-s-xs rounded-e-full hover:rounded-s-sm focus-visible:rounded-s-sm active:rounded-s-sm",
      },
    },
    {
      size: ["sm", "md"],
      class: {
        action:
          "rounded-s-full rounded-e-xs hover:rounded-e-md focus-visible:rounded-e-md active:rounded-e-md",
        trigger:
          "rounded-s-xs rounded-e-full hover:rounded-s-md focus-visible:rounded-s-md active:rounded-s-md",
      },
    },
    {
      size: "lg",
      class: {
        action:
          "rounded-s-full rounded-e-sm hover:rounded-e-lg-increased focus-visible:rounded-e-lg-increased active:rounded-e-lg-increased",
        trigger:
          "rounded-s-sm rounded-e-full hover:rounded-s-lg-increased focus-visible:rounded-s-lg-increased active:rounded-s-lg-increased",
      },
    },
    {
      size: "xl",
      class: {
        action:
          "rounded-s-full rounded-e-md hover:rounded-e-lg-increased focus-visible:rounded-e-lg-increased active:rounded-e-lg-increased",
        trigger:
          "rounded-s-md rounded-e-full hover:rounded-s-lg-increased focus-visible:rounded-s-lg-increased active:rounded-s-lg-increased",
      },
    },
  ],
  defaultVariants: { look: "filled", size: "sm" },
});

export type SplitButtonLook = keyof typeof splitButtonVariants.variants.look;
export const splitButtonLooks = Object.keys(
  splitButtonVariants.variants.look,
) as SplitButtonLook[];
export type SplitButtonSize = keyof typeof splitButtonVariants.variants.size;
export const splitButtonSizes = Object.keys(
  splitButtonVariants.variants.size,
) as SplitButtonSize[];

/** The leading icon per size, as the common buttons: 20 / 20 / 24 / 32 / 40. */
const iconSizeFor: Record<SplitButtonSize, IconSize> = {
  xs: "sm",
  sm: "sm",
  md: "md",
  lg: "buttonLg",
  xl: "lg",
};

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const splitButtonContextId = createContextId<{
  look: Readonly<Signal<SplitButtonLook>>;
  size: Readonly<Signal<SplitButtonSize>>;
}>("net.seanperez.ui.split-button");

/* ------------------------------------------------------------------ */
/*  Root                                                              */
/* ------------------------------------------------------------------ */

export type SplitButtonRootProps = PropsOf<"div"> & {
  /** Button color style. Default `filled`. */
  look?: SplitButtonLook;
  /** M3 size. Default `sm` (40dp). */
  size?: SplitButtonSize;
  /** The app's own signal for the menu's open state. */
  open?: Signal<boolean>;
  onOpenChange$?: QRL<(open: boolean) => void>;
};

/** The pair, a `group` (e-store's). Give it an `aria-label` when the action alone does not say. */
const Root = component$<SplitButtonRootProps>(
  ({
    look: givenLook,
    size: givenSize,
    open,
    onOpenChange$,
    class: className,
    ...rest
  }) => {
    const look = useComputed$<SplitButtonLook>(() => givenLook ?? "filled");
    const size = useComputed$<SplitButtonSize>(() => givenSize ?? "sm");
    useContextProvider(splitButtonContextId, { look, size });
    return (
      <Menu.Root
        {...rest}
        open={open}
        onOpenChange$={onOpenChange$}
        role="group"
        data-qds-split-button=""
        class={[splitButtonVariants().root(), className]}
      >
        <Slot />
      </Menu.Root>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Action (leading button)                                           */
/* ------------------------------------------------------------------ */

export type SplitButtonActionProps = Omit<
  PropsOf<"button">,
  "onClick$" | "children"
> & {
  /** The icon before the label. With no label, give the button an `aria-label`. */
  leadingIcon?: IconName;
  /** The button's text. */
  label?: string;
  onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
};

const Action = component$<SplitButtonActionProps>(
  ({ leadingIcon, label, onClick$, class: className, ...rest }) => {
    const ctx = useContext(splitButtonContextId);
    const classes = useComputed$(() =>
      splitButtonVariants({
        look: ctx.look.value,
        size: ctx.size.value,
      }).action(),
    );
    return (
      <button
        {...rest}
        type="button"
        data-qds-split-button-action=""
        onClick$={onClick$}
        class={[classes.value, className]}
      >
        {leadingIcon && (
          <Icon name={leadingIcon} size={iconSizeFor[ctx.size.value]} />
        )}
        {label}
      </button>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Trigger (trailing menu button)                                    */
/* ------------------------------------------------------------------ */

export type SplitButtonTriggerProps = Omit<
  PropsOf<"button">,
  "onClick$" | "onKeyDown$" | "children"
> & {
  /** The menu button's name (its `aria-label`). Default "More options" (e-store's). */
  label?: string;
  /** The menu icon. Default `expand_more` (M3 draws a down chevron). */
  icon?: IconName;
  onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
  onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLButtonElement) => void>;
};

/** `Menu.Trigger` (popover, `aria-expanded`, `aria-haspopup`, arrow keys), drawn as the half. */
const Trigger = component$<SplitButtonTriggerProps>(
  ({
    label = "More options",
    icon = "expand_more",
    onClick$,
    onKeyDown$,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(splitButtonContextId);
    const classes = useComputed$(() => {
      const v = splitButtonVariants({
        look: ctx.look.value,
        size: ctx.size.value,
      });
      return { trigger: v.trigger(), chevron: v.chevron() };
    });
    return (
      <Menu.Trigger
        {...rest}
        unstyled
        aria-label={label}
        data-qds-split-button-trigger=""
        onClick$={onClick$}
        onKeyDown$={onKeyDown$}
        class={["group/trigger", classes.value.trigger, className]}
      >
        <span class={classes.value.chevron}>
          <Icon name={icon} />
        </span>
      </Menu.Trigger>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Content, Item, Separator: the Menu's                              */
/* ------------------------------------------------------------------ */

export type SplitButtonContentProps = MenuContentProps;

/** `Menu.Content`, lined up with the trigger's end by default (`align="end"`). */
const Content = component$<SplitButtonContentProps>(
  ({ align = "end", ...rest }) => (
    <Menu.Content {...rest} align={align}>
      <Slot />
    </Menu.Content>
  ),
);

export const SplitButton = {
  Root,
  Action,
  Trigger,
  Content,
  Item: Menu.Item,
  Separator: Menu.Separator,
};
