import { $, Slot, component$, sync$, useComputed$ } from "@qwik.dev/core";
import type { JSXOutput, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName, IconSize } from "../icon";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { UnstyledButton, relIsExternal } from "./unstyled-button";
import type {
  LinkButtonProps,
  NormalButtonProps,
  UnstyledButtonProps,
} from "./unstyled-button";

/**
 * Material Design 3 (Expressive) common buttons.
 * Specs: https://m3.material.io/components/buttons/specs (read 2026-11-23), and material-web's
 * `tokens/versions/latest/sass/_md-comp-button-*.scss` (read 2026-11-23).
 *
 * Five looks, five sizes, two shapes (`shape`), the text button's `tone`, and the M3 Expressive
 * toggle button (`toggle`, `selected`). The state layer is the `before` pseudo-element: the
 * content color over the container at 8% hover, 10% focus, 10% pressed (M3).
 *
 * Shape (M3 tokens, per size): `rounded` is fully round; `squared` is 12 / 12 / 16 / 28 / 28dp.
 * Pressed, both morph to 8 / 8 / 12 / 16 / 16dp. A selected toggle swaps its resting shape:
 * round becomes square, square becomes round.
 */
export const buttonVariants = tv({
  base: [
    // Layout
    "relative",
    // 40dp high to the eye, 48dp to the pointer (M3).
    "touch-target",
    "inline-flex",
    "shrink-0",
    "items-center",
    "justify-center",
    "text-nowrap",
    "cursor-pointer",
    "select-none",
    // Motion: the corner morph uses M3's fast spatial spring (cubic-bezier approximation).
    "transition-[background-color,box-shadow,border-radius,color]",
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
    // Disabled
    "disabled:pointer-events-none",
    "disabled:text-on-surface/38",
    // A toggle's `aria-pressed` colors come later in the stylesheet than `disabled:`.
    "aria-pressed:disabled:text-on-surface/38",
    "aria-[pressed=false]:disabled:text-on-surface/38",
    // Busy (`isLoading`): still focusable, but the pointer cannot press it again (e-store's).
    "aria-disabled:pointer-events-none",
  ],
  variants: {
    look: {
      filled: [
        "bg-primary",
        "text-on-primary",
        "before:bg-on-primary",
        // Toggle (M3): unselected surface-container / on-surface-variant, selected as default.
        "aria-[pressed=false]:bg-surface-container",
        "aria-[pressed=false]:text-on-surface-variant",
        "aria-[pressed=false]:before:bg-on-surface-variant",
        "disabled:bg-on-surface/10",
        "aria-pressed:disabled:bg-on-surface/10",
        "aria-[pressed=false]:disabled:bg-on-surface/10",
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
        "aria-pressed:disabled:bg-on-surface/10",
      ],
      elevated: [
        "bg-surface-container-low",
        "text-primary",
        "shadow-1",
        "hover:shadow-2",
        "active:shadow-1",
        "before:bg-primary",
        // Toggle selected: primary / on-primary.
        "aria-pressed:bg-primary",
        "aria-pressed:text-on-primary",
        "aria-pressed:before:bg-on-primary",
        "disabled:bg-on-surface/10",
        "aria-pressed:disabled:bg-on-surface/10",
        "disabled:shadow-none",
      ],
      /*
       * The outline is an inset ring, not a border, as e-store's (its width per size is in
       * compoundVariants). M3 Expressive colors: outline-variant, on-surface-variant label;
       * the disabled outline stays outline-variant (material-web `disabled-outline-color`).
       */
      outlined: [
        "bg-transparent",
        "text-on-surface-variant",
        "inset-ring-outline-variant",
        "before:bg-on-surface-variant",
        // Toggle selected: inverse-surface / inverse-on-surface, no outline.
        "aria-pressed:bg-inverse-surface",
        "aria-pressed:text-inverse-on-surface",
        "aria-pressed:before:bg-inverse-on-surface",
        "aria-pressed:inset-ring-transparent",
        "aria-pressed:disabled:bg-on-surface/10",
      ],
      // Color from `tone` (compoundVariants). M3: "There is no toggle text button."
      text: ["bg-transparent"],
    },
    /*
     * M3 Expressive sizes, as e-store's `button.tsx` (from M3's androidx Compose
     * `Button{XSmall,Small,Medium,Large,XLarge}Tokens.kt`, read there 2026-11-15; checked here
     * against material-web `button-{xsmall..xlarge}.scss` tokens 2026-11-23):
     * height / side padding / icon / icon-label gap / label.
     *   xs 32 / 16 / 20 / 8 / label-large     sm 40 / 16 / 20 / 8 / label-large
     *   md 56 / 24 / 24 / 8 / title-medium    lg 96 / 48 / 32 / 12 / headline-small
     *   xl 136 / 64 / 40 / 16 / headline-large
     * e-store's extra non-M3 sizes (l, nav, wide, bar, inline, inherit, row, icon, cta) are left out.
     */
    size: {
      xs: ["h-8", "px-4", "gap-2", "text-label-large"],
      sm: ["h-10", "px-4", "gap-2", "text-label-large"],
      md: ["h-14", "px-6", "gap-2", "text-title-medium"],
      lg: ["h-24", "px-12", "gap-3", "text-headline-small"],
      xl: ["h-34", "px-16", "gap-4", "text-headline-large"],
    },
    /** M3 Expressive shape, e-store's names. The corners per size are in compoundVariants. */
    shape: {
      rounded: "",
      squared: "",
    },
    /**
     * The text button's color, e-store's: `default` and `primary` are M3's primary text button;
     * `muted` is on-surface-variant, for a low-emphasis action beside content. Other looks
     * ignore it.
     */
    tone: {
      default: "",
      primary: "",
      muted: "",
      // On an inverse surface (the snackbar's action): inverse-primary (M3 snackbar specs).
      inverse: "",
    },
  },
  compoundVariants: [
    // ── Text button color per tone (e-store's) ──
    {
      look: "text",
      tone: ["default", "primary"],
      class: ["text-primary", "before:bg-primary"],
    },
    {
      look: "text",
      tone: "muted",
      class: ["text-on-surface-variant", "before:bg-on-surface-variant"],
    },
    {
      look: "text",
      tone: "inverse",
      class: ["text-inverse-primary", "before:bg-inverse-primary"],
    },

    // ── M3 outline width: 1dp up to M, 2dp L, 3dp XL (material-web `outlined-outline-width`) ──
    { look: "outlined", size: ["xs", "sm", "md"], class: "inset-ring" },
    { look: "outlined", size: "lg", class: "inset-ring-2" },
    { look: "outlined", size: "xl", class: "inset-ring-3" },

    // ── Resting shape; a selected toggle takes the other one (M3 `selected-container-shape-*`) ──
    {
      shape: "rounded",
      class: "rounded-full",
    },
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

    // ── Pressed shape, the same for both shapes (M3 `pressed-container-shape`) ──
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
    look: "filled",
    size: "sm",
    shape: "rounded",
    tone: "default",
  },
});

export type ButtonLook = keyof typeof buttonVariants.variants.look;

export const buttonLooks = Object.keys(
  buttonVariants.variants.look,
) as ButtonLook[];

export type ButtonSize = keyof typeof buttonVariants.variants.size;

export const buttonSizes = Object.keys(
  buttonVariants.variants.size,
) as ButtonSize[];

export type ButtonShape = keyof typeof buttonVariants.variants.shape;

export const buttonShapes = Object.keys(
  buttonVariants.variants.shape,
) as ButtonShape[];

export type ButtonTone = keyof typeof buttonVariants.variants.tone;

export const buttonTones = Object.keys(
  buttonVariants.variants.tone,
) as ButtonTone[];

/** The leading icon's size for each button size (the table above). */
const iconSizeFor: Record<ButtonSize, IconSize> = {
  xs: "sm",
  sm: "sm",
  md: "md",
  lg: "buttonLg",
  xl: "lg",
};

/** What every button takes, whichever element it renders. */
type ButtonOwnProps = {
  /** Named, and passed on by name: a handler is never left to the `...rest` spread. */
  onClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
  /** The button's text. Children, if any, go after it. */
  label?: string;
  /** The Material 3 button kind. Defaults to "filled". */
  look?: ButtonLook;
  /** The M3 Expressive size. Defaults to "sm" (40dp). */
  size?: ButtonSize;
  /** M3 Expressive shape: "rounded" (default) or "squared" (12 / 12 / 16 / 28 / 28dp corners). */
  shape?: ButtonShape;
  /** `look="text"` only: "default" / "primary" (M3 primary) or "muted" (on-surface-variant). */
  tone?: ButtonTone;
  /**
   * An icon before the label; its size follows `size`. An `IconName`, or (e-store's type,
   * `JSXOutput`) an icon of your own such as a brand mark (`<GithubIcon aria-hidden="true" />`):
   * it is drawn in the same box, in the text color. Mark your own icon decorative, the label names
   * the button.
   */
  leadingIcon?: IconName | JSXOutput;
  /**
   * An icon after the label (M3: "a trailing icon" for an action that opens or moves, such as a
   * menu). Wins over `leadingIcon`: one icon per button, as e-store's.
   */
  trailingIcon?: IconName;
  /**
   * A link with `rel` containing `external` (a page off the site) ends with the `open_in_new`
   * icon, named by this text for screen readers ("GitHub, external link"), as the GitHub Pages
   * page's `a[rel~="external"]::after`. It is a destination mark, not the button's one action
   * icon, so it shows beside a `leadingIcon`; an explicit `trailingIcon` replaces it. Mirrored in
   * right-to-left (Google's `open_in_new` asset is `autoMirrored`). NEW 2026-11-24, not in
   * e-store (which has no external-link mark).
   */
  externalLabel?: string;
  /**
   * Working: a spinner takes the icon place, `aria-busy` and `aria-disabled` are set, and a
   * click (or a form's implicit submit) is cancelled, so an action is not sent twice. Stays
   * focusable, unlike `disabled`. `onClick$` does not run while it is set. From e-store.
   */
  isLoading?: boolean;
  /**
   * An M3 Expressive toggle button: a click flips `selected`, shown by `aria-pressed`, the
   * toggle colors and the shape swap. Not for `look="text"` (M3 has no toggle text button)
   * nor for a link. New, not in e-store's Button (the names are e-store's IconButton's).
   */
  toggle?: boolean;
  /** The toggle's state. Follows the prop when it changes. */
  selected?: boolean;
  /** Two-way binding for the toggle's state. */
  "bind:selected"?: Signal<boolean>;
  /** Called with the new state after a click flips it. */
  onSelectedChange$?: QRL<(selected: boolean) => void>;
};

/**
 * `type="link"` + `href` renders the router's `<Link>` (add `reload` for a plain `<a>`,
 * `target="_blank"` for a new tab); otherwise a `<button>`. As e-store's `Button`.
 */
export type ButtonProps = ButtonOwnProps &
  (Omit<LinkButtonProps, "onClick$"> | Omit<NormalButtonProps, "onClick$">);

/** Cancels the click synchronously (a `$()` handler runs too late), and a submit's submission. */
const cancelWhileLoading = sync$((event: Event) => {
  event.preventDefault();
});

/**
 * Given once a button that takes `isLoading` is idle again and has no `onClick$`: e-store found
 * (Qwik rc.4) that a handler is not dropped when `onClick$` goes back to `undefined`, so the
 * cancel would outlive the busy state. Replacing it works. NOT re-checked on rc.5.
 */
const idleAfterLoading = sync$(() => {});

/** The busy indicator, e-store's: a three-quarter ring in the text color. */
const ButtonSpinner = (props: { size: IconSize }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    class={[
      iconBoxFor[props.size],
      "shrink-0 animate-spin motion-reduce:animate-none",
    ]}
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      stroke-width="2.5"
      opacity="0.25"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
    />
  </svg>
);

/** The spinner's box, the same as the icon it replaces. */
const iconBoxFor: Partial<Record<IconSize, string>> = {
  sm: "size-5",
  md: "size-6",
  buttonLg: "size-8",
  lg: "size-10",
};

/** A Material 3 common button, or a link styled as one. */
export const Button = component$<ButtonProps>((props) => {
  const {
    label,
    look,
    size = "sm",
    shape,
    tone,
    leadingIcon,
    trailingIcon,
    externalLabel = "external link",
    isLoading,
    toggle,
    selected: selectedProp,
    "bind:selected": bindSelected,
    onSelectedChange$,
    class: className,
    onClick$,
    ...rest
  } = props;
  // The live props proxy, typed to the one field read (see `useBoundSignal`).
  const reactiveProps: Pick<ButtonOwnProps, "selected"> = props;
  const selected = useBoundSignal(
    bindSelected,
    selectedProp ?? false,
    useComputed$(() => reactiveProps.selected),
  );
  // M3: no toggle text button; a link cannot be pressed.
  const isToggle = !!toggle && look !== "text" && rest.type !== "link";
  const disabled = "disabled" in rest && !!rest.disabled;
  const flip$ = $(() => {
    if (disabled) return;
    selected.value = !selected.value;
    onSelectedChange$?.(selected.value);
  });
  const iconSize = iconSizeFor[size];
  const busy = !!isLoading;
  const external = rest.type === "link" && relIsExternal(rest.rel);
  const click = busy
    ? cancelWhileLoading
    : isToggle
      ? [flip$, onClick$]
      : (onClick$ ?? (isLoading === undefined ? undefined : idleAfterLoading));
  return (
    <UnstyledButton
      {...(rest as UnstyledButtonProps)}
      class={[buttonVariants({ look, size, shape, tone }), className]}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      data-loading={busy ? "" : undefined}
      // A host's own `aria-pressed` (in `rest`) is kept when this is not a toggle.
      aria-pressed={isToggle ? selected.value : rest["aria-pressed"]}
      onClick$={click as typeof onClick$}
    >
      {busy && <ButtonSpinner size={iconSize} />}
      {!busy &&
        !trailingIcon &&
        leadingIcon &&
        (typeof leadingIcon === "string" ? (
          <Icon name={leadingIcon as IconName} size={iconSize} />
        ) : (
          // Your own icon (e-store's `<span class="leading-icon icon">`): the Icon's box and
          // color, whatever size the SVG was given.
          <span
            class={[
              iconBoxFor[iconSize],
              "inline-flex shrink-0 *:size-full *:fill-current",
            ]}
          >
            {leadingIcon}
          </span>
        ))}
      {label}
      <Slot />
      {!busy && trailingIcon && <Icon name={trailingIcon} size={iconSize} />}
      {!busy && !trailingIcon && external && (
        <Icon
          name="open_in_new"
          size={iconSize}
          label={externalLabel}
          class="rtl:-scale-x-100"
        />
      )}
    </UnstyledButton>
  );
});
