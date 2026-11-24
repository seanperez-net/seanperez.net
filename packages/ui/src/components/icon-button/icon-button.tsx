import { $, component$, sync$, useComputed$ } from "@qwik.dev/core";
import type { QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName, IconSize } from "../icon";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { UnstyledButton } from "../button/unstyled-button";
import type {
  LinkButtonProps,
  NormalButtonProps,
  UnstyledButtonProps,
} from "../button/unstyled-button";

/**
 * Material Design 3 (Expressive) icon button, e-store's `IconButton`.
 * Specs: https://m3.material.io/components/icon-buttons/specs (read 2026-11-23), and material-web's
 * `tokens/versions/latest/sass/_md-comp-icon-button-*.scss` (read 2026-11-23).
 *
 * Four M3 looks (standard, filled, tonal, outlined) plus e-store's `inverse` (for an inverse
 * surface: snackbar, tooltip); five sizes; three widths; two shapes; the toggle. State layer
 * 8% hover, 10% focus, 10% pressed; disabled container on-surface 10%, icon 38% (M3 tokens).
 *
 * Size / default width / narrow / wide / icon (material-web leading + icon + trailing space):
 *   xs 32 / 32 / 28 / 40 / 20     sm 40 / 40 / 32 / 52 / 24     md 56 / 56 / 48 / 72 / 24
 *   lg 96 / 96 / 64 / 128 / 32    xl 136 / 136 / 104 / 184 / 40
 * Corners: square 12 / 12 / 16 / 28 / 28, pressed 8 / 8 / 12 / 16 / 16; a selected toggle takes
 * the other resting shape. Outline 1 / 1 / 1 / 2 / 3dp. Every size is 48dp to the pointer.
 */
export const iconButtonVariants = tv({
  base: [
    // Layout
    "relative",
    "inline-flex",
    "shrink-0",
    "items-center",
    "justify-center",
    // At least 48dp to the pointer (M3).
    "touch-target",
    "cursor-pointer",
    "select-none",
    // Motion: the corner morph uses M3's fast spatial spring (cubic-bezier approximation).
    "transition-[background-color,border-radius,color]",
    "duration-short-4",
    "ease-spring-fast-spatial",
    "motion-reduce:transition-none",
    // State layer: M3 8% hover, 10% focus, 10% pressed.
    "before:absolute",
    "before:inset-0",
    "before:rounded-[inherit]",
    "before:opacity-0",
    "before:transition-opacity",
    "before:pointer-events-none",
    "before:content-['']",
    "hover:before:opacity-8",
    "focus-visible:before:opacity-10",
    "active:before:opacity-10",
    // The M3 focus ring (`tokens/components/focus-ring.css`), e-store's.
    "focus-ring",
    // Disabled, and `softDisabled` (aria-disabled, still focusable) drawn the same (e-store's).
    "disabled:pointer-events-none",
    "aria-disabled:pointer-events-none",
    "forced-colors:disabled:text-[GrayText]",
    "forced-colors:aria-disabled:text-[GrayText]",
  ],
  variants: {
    look: {
      standard: [
        "bg-transparent",
        "text-on-surface-variant",
        "before:bg-on-surface-variant",
        // Toggle selected: primary.
        "aria-pressed:text-primary",
        "aria-pressed:before:bg-primary",
        "disabled:text-on-surface/38",
        "aria-disabled:text-on-surface/38",
        "aria-pressed:disabled:text-on-surface/38",
        "aria-pressed:aria-disabled:text-on-surface/38",
      ],
      filled: [
        "bg-primary",
        "text-on-primary",
        "before:bg-on-primary",
        // Toggle unselected: surface-container / on-surface-variant; selected as default.
        "aria-[pressed=false]:bg-surface-container",
        "aria-[pressed=false]:text-on-surface-variant",
        "aria-[pressed=false]:before:bg-on-surface-variant",
        "disabled:bg-on-surface/10",
        "aria-disabled:bg-on-surface/10",
        "aria-[pressed=false]:disabled:bg-on-surface/10",
        "aria-[pressed=false]:aria-disabled:bg-on-surface/10",
        "disabled:text-on-surface/38",
        "aria-disabled:text-on-surface/38",
        "aria-[pressed=false]:disabled:text-on-surface/38",
        "aria-[pressed=false]:aria-disabled:text-on-surface/38",
      ],
      tonal: [
        "bg-secondary-container",
        "text-on-secondary-container",
        "before:bg-on-secondary-container",
        // Toggle selected: secondary / on-secondary.
        "aria-pressed:bg-secondary",
        "aria-pressed:text-on-secondary",
        "aria-pressed:before:bg-on-secondary",
        "disabled:bg-on-surface/10",
        "aria-disabled:bg-on-surface/10",
        "aria-pressed:disabled:bg-on-surface/10",
        "aria-pressed:aria-disabled:bg-on-surface/10",
        "disabled:text-on-surface/38",
        "aria-disabled:text-on-surface/38",
        "aria-pressed:disabled:text-on-surface/38",
        "aria-pressed:aria-disabled:text-on-surface/38",
      ],
      /*
       * An inset ring (width per size in compoundVariants), in M3 Expressive's outline-variant,
       * which it keeps when disabled (material-web `disabled-outline-color`). e-store draws a
       * 1px `outline` border at every size.
       */
      outlined: [
        "bg-transparent",
        "inset-ring-outline-variant",
        "text-on-surface-variant",
        "before:bg-on-surface-variant",
        // Toggle selected: inverse-surface / inverse-on-surface, no outline.
        "aria-pressed:bg-inverse-surface",
        "aria-pressed:text-inverse-on-surface",
        "aria-pressed:before:bg-inverse-on-surface",
        "aria-pressed:inset-ring-transparent",
        "disabled:text-on-surface/38",
        "aria-disabled:text-on-surface/38",
        "aria-pressed:disabled:bg-on-surface/10",
        "aria-pressed:aria-disabled:bg-on-surface/10",
        "aria-pressed:disabled:text-on-surface/38",
        "aria-pressed:aria-disabled:text-on-surface/38",
      ],
      /*
       * e-store's: for an icon button ON `inverse-surface` (a snackbar, a tooltip). Not an M3 icon
       * button style; it uses M3's inverse roles (selected: inverse-primary).
       */
      inverse: [
        "bg-transparent",
        "text-inverse-on-surface",
        "before:bg-inverse-on-surface",
        "aria-pressed:text-inverse-primary",
        "aria-pressed:before:bg-inverse-primary",
        "disabled:text-inverse-on-surface/38",
        "aria-disabled:text-inverse-on-surface/38",
        "aria-pressed:disabled:text-inverse-on-surface/38",
        "aria-pressed:aria-disabled:text-inverse-on-surface/38",
      ],
    },
    /** M3 Expressive heights; the width is in compoundVariants (per `width`). */
    size: {
      xs: "h-8",
      sm: "h-10",
      md: "h-14",
      lg: "h-24",
      xl: "h-34",
    },
    /** M3 Expressive widths: `default` square, `narrow` portrait, `wide` landscape. */
    width: {
      default: "",
      narrow: "",
      wide: "",
    },
    shape: {
      rounded: "",
      squared: "",
    },
  },
  compoundVariants: [
    // ── Widths ──
    { size: "xs", width: "default", class: "w-8" },
    { size: "sm", width: "default", class: "w-10" },
    { size: "md", width: "default", class: "w-14" },
    { size: "lg", width: "default", class: "w-24" },
    { size: "xl", width: "default", class: "w-34" },
    { size: "xs", width: "narrow", class: "w-7" },
    { size: "sm", width: "narrow", class: "w-8" },
    { size: "md", width: "narrow", class: "w-12" },
    { size: "lg", width: "narrow", class: "w-16" },
    { size: "xl", width: "narrow", class: "w-26" },
    { size: "xs", width: "wide", class: "w-10" },
    { size: "sm", width: "wide", class: "w-13" },
    { size: "md", width: "wide", class: "w-18" },
    { size: "lg", width: "wide", class: "w-32" },
    { size: "xl", width: "wide", class: "w-46" },

    // ── Outline width ──
    { look: "outlined", size: ["xs", "sm", "md"], class: "inset-ring" },
    { look: "outlined", size: "lg", class: "inset-ring-2" },
    { look: "outlined", size: "xl", class: "inset-ring-3" },

    // ── Resting shape; a selected toggle takes the other one ──
    { shape: "rounded", class: "rounded-full" },
    {
      shape: "rounded",
      size: ["xs", "sm"],
      class: "aria-pressed:rounded-md",
    },
    { shape: "rounded", size: "md", class: "aria-pressed:rounded-lg" },
    {
      shape: "rounded",
      size: ["lg", "xl"],
      class: "aria-pressed:rounded-xl",
    },
    { shape: "squared", size: ["xs", "sm"], class: "rounded-md" },
    { shape: "squared", size: "md", class: "rounded-lg" },
    { shape: "squared", size: ["lg", "xl"], class: "rounded-xl" },
    { shape: "squared", class: "aria-pressed:rounded-full" },

    // ── Pressed shape, the same for both shapes ──
    {
      size: ["xs", "sm"],
      class: "active:rounded-sm aria-pressed:active:rounded-sm",
    },
    {
      size: "md",
      class: "active:rounded-md aria-pressed:active:rounded-md",
    },
    {
      size: ["lg", "xl"],
      class: "active:rounded-lg aria-pressed:active:rounded-lg",
    },
  ],
  defaultVariants: {
    look: "standard",
    size: "sm",
    width: "default",
    shape: "rounded",
  },
});

export type IconButtonLook = keyof typeof iconButtonVariants.variants.look;
export const iconButtonLooks = Object.keys(
  iconButtonVariants.variants.look,
) as IconButtonLook[];
export type IconButtonSize = keyof typeof iconButtonVariants.variants.size;
export const iconButtonSizes = Object.keys(
  iconButtonVariants.variants.size,
) as IconButtonSize[];
export type IconButtonWidth = keyof typeof iconButtonVariants.variants.width;
export const iconButtonWidths = Object.keys(
  iconButtonVariants.variants.width,
) as IconButtonWidth[];
export type IconButtonShape = keyof typeof iconButtonVariants.variants.shape;
export const iconButtonShapes = Object.keys(
  iconButtonVariants.variants.shape,
) as IconButtonShape[];

/** The icon's size per button size (M3 tokens): 20 / 24 / 24 / 32 / 40. */
const iconSizeFor: Record<IconButtonSize, IconSize> = {
  xs: "sm",
  sm: "md",
  md: "md",
  lg: "buttonLg",
  xl: "lg",
};

type IconButtonOwnProps = {
  /** Named, and passed on by name: a handler is never left to the `...rest` spread. */
  onClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
  icon: IconName;
  /** What the button does: its name for screen readers and its plain tooltip. */
  label: string;
  /** M3 colour style. Defaults to "standard". */
  look?: IconButtonLook;
  /** M3 Expressive size. Defaults to "sm" (40dp). */
  size?: IconButtonSize;
  /** M3 Expressive width. Defaults to "default" (square). */
  width?: IconButtonWidth;
  /** M3 Expressive shape. Defaults to "rounded". */
  shape?: IconButtonShape;
  /** A toggle: a click flips `selected`, shown by `aria-pressed`, colour and shape. */
  toggle?: boolean;
  /** The toggle's state. Follows the prop when it changes. */
  selected?: boolean;
  /** Two-way binding for the toggle's state. */
  "bind:selected"?: Signal<boolean>;
  /** Called with the new state after a click flips it. */
  onSelectedChange$?: QRL<(selected: boolean) => void>;
  /** The icon while selected (M3: a selected toggle shows the filled icon), e.g. `star_filled`. */
  iconSelected?: IconName;
  /** The name while selected (e-store's `aria-label-selected`), e.g. "Remove from favourites". */
  labelSelected?: string;
  /** Mirror the icon in right-to-left text (arrows and other directional icons). */
  flipIconInRtl?: boolean;
  /** Disabled but still focusable: `aria-disabled`, drawn as disabled, clicks do nothing. */
  softDisabled?: boolean;
};

/**
 * `type="link"` + `href` renders the router's `<Link>` (`reload`: a plain `<a>`; `target="_blank"`:
 * a new tab); otherwise a `<button>`. As e-store's `IconButton` (on `UnstyledButton`).
 */
export type IconButtonProps = IconButtonOwnProps &
  (
    | Omit<LinkButtonProps, "onClick$" | "children">
    | Omit<NormalButtonProps, "onClick$" | "children">
  );

/** A soft-disabled button's click: nothing (replaces the handlers; see Button's note). */
const ignoreClick = sync$(() => {});

/** A Material 3 icon button, or a link drawn as one. */
export const IconButton = component$<IconButtonProps>((props) => {
  const {
    icon,
    label,
    look,
    size = "sm",
    width,
    shape,
    toggle,
    selected: selectedProp,
    "bind:selected": bindSelected,
    onSelectedChange$,
    iconSelected,
    labelSelected,
    flipIconInRtl,
    softDisabled,
    class: className,
    onClick$,
    ...rest
  } = props;
  // The live props proxy, typed to the one field read (see `useBoundSignal`).
  const reactiveProps: Pick<IconButtonOwnProps, "selected"> = props;
  const selected = useBoundSignal(
    bindSelected,
    selectedProp ?? false,
    useComputed$(() => reactiveProps.selected),
  );
  const isToggle = !!toggle && rest.type !== "link";
  const disabled = "disabled" in rest && !!rest.disabled;
  const flip$ = $(() => {
    if (disabled) return;
    selected.value = !selected.value;
    onSelectedChange$?.(selected.value);
  });
  const click = softDisabled
    ? ignoreClick
    : isToggle
      ? [flip$, onClick$]
      : onClick$;
  return (
    <UnstyledButton
      {...(rest as UnstyledButtonProps)}
      aria-label={
        isToggle && labelSelected && selected.value ? labelSelected : label
      }
      // Its plain tooltip: `TooltipProvider` (in `Layout.Root`) shows the `aria-label` on hover
      // and keyboard focus. Replaces the native `title`, which cannot be styled and shows on
      // neither keyboard focus nor touch (MDN, `title` accessibility concerns).
      data-tooltip=""
      // A host's own `aria-pressed` (in `rest`) is kept when this is not a toggle (e-store's).
      aria-pressed={isToggle ? selected.value : rest["aria-pressed"]}
      aria-disabled={softDisabled || undefined}
      class={[iconButtonVariants({ look, size, width, shape }), className]}
      onClick$={click as typeof onClick$}
    >
      <Icon
        name={isToggle && iconSelected && selected.value ? iconSelected : icon}
        size={iconSizeFor[size]}
        class={flipIconInRtl ? "rtl:-scale-x-100" : undefined}
      />
    </UnstyledButton>
  );
});
