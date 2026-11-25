import { component$ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName, IconSize } from "../icon";
import { UnstyledButton } from "../button/unstyled-button";
import type {
  LinkButtonProps,
  NormalButtonProps,
  UnstyledButtonProps,
} from "../button/unstyled-button";

/**
 * Material Design 3 (Expressive) floating action button and extended FAB, from e-store's
 * `components/fab/fab.tsx` (2026-11-23).
 * Specs: https://m3.material.io/components/floating-action-button/specs and
 * https://m3.material.io/components/extended-fab/specs (read in Chrome 2026-11-23); numbers from
 * material-web `tokens/versions/latest/sass/_md-comp-fab-*.scss` and `_md-comp-extended-fab-*.scss`
 * (Material 3 tokens v34.0.21, read 2026-11-23).
 *
 * FAB (icon only), size / corner / icon:
 *   small 40 / 12 / 24 (M3: "no longer recommended")   default 56 / 16 / 24
 *   medium 80 / 20 / 28 (M3 Expressive; not in e-store)  large 96 / 28 / 36
 * Extended FAB (icon + label), height / corner / icon / leading-trailing / gap / label:
 *   small 56 / 16 / 24 / 16-16 / 8 / title-medium     medium 80 / 20 / 28 / 26-26 / 12 / title-large
 *   large 96 / 28 / 36 / 28-28 / 16 / headline-small
 *   default: M3's BASELINE extended FAB (56 / 16 / 24 / 16-20 / 12 / label-large, min width 80),
 *   "no longer recommended" (use small); e-store's extended FAB is this one.
 * Colors: the six M3 Expressive styles, and the baseline `surface` (no longer recommended).
 * Elevation: level 3, level 4 on hover. State layer 8% hover, 10% focus, 10% pressed, in the
 * icon color. M3 lists no disabled state for FABs, so none is drawn and `disabled` is not a prop.
 */
export const fabVariants = tv({
  slots: {
    root: [
      "relative",
      "inline-flex",
      "shrink-0",
      "items-center",
      "justify-center",
      "text-nowrap",
      "cursor-pointer",
      "select-none",
      // At least 48dp to the pointer (the small FAB draws 40).
      "touch-target",
      // M3: level 3, level 4 on hover, level 3 focused and pressed.
      "shadow-3",
      "hover:shadow-4",
      "focus-visible:shadow-3",
      "active:shadow-3",
      // The extended FAB's label opens and closes with the padding and gap (e-store's morph).
      "transition-[box-shadow,padding,gap,background-color,color]",
      "duration-medium-2",
      "ease-emphasized",
      "motion-reduce:transition-none",
      // State layer: 8% hover, 10% focus, 10% pressed, in the icon color (M3).
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
      // The M3 focus ring (`tokens/components/focus-ring.css`), outward.
      "focus-ring",
    ],
    label: [
      "overflow-hidden",
      "whitespace-nowrap",
      "transition-[max-width,opacity]",
      "duration-medium-2",
      "ease-emphasized",
      "motion-reduce:transition-none",
    ],
  },
  variants: {
    /**
     * e-store's names. M3 Expressive renamed them: e-store `primary` is M3 "primary container",
     * `primary-bold` is M3 "primary" (and so on for secondary and tertiary).
     */
    color: {
      primary: {
        root: [
          "bg-primary-container",
          "text-on-primary-container",
          "before:bg-on-primary-container",
        ],
      },
      secondary: {
        root: [
          "bg-secondary-container",
          "text-on-secondary-container",
          "before:bg-on-secondary-container",
        ],
      },
      tertiary: {
        root: [
          "bg-tertiary-container",
          "text-on-tertiary-container",
          "before:bg-on-tertiary-container",
        ],
      },
      "primary-bold": {
        root: ["bg-primary", "text-on-primary", "before:bg-on-primary"],
      },
      "secondary-bold": {
        root: ["bg-secondary", "text-on-secondary", "before:bg-on-secondary"],
      },
      "tertiary-bold": {
        root: ["bg-tertiary", "text-on-tertiary", "before:bg-on-tertiary"],
      },
      /** M3 baseline: "still available, but no longer recommended". */
      surface: {
        root: [
          "bg-surface-container-high",
          "text-primary",
          "before:bg-primary",
        ],
      },
    },
    size: {
      small: {},
      default: {},
      medium: {},
      large: {},
    },
    /**
     * `fab`: icon only. `extended`: icon and label. `collapsed`: an extended FAB folded back to a
     * FAB of its own height (the label kept, at zero width, as the accessible name).
     */
    form: {
      fab: {},
      extended: { label: "max-w-80 opacity-100" },
      collapsed: { label: "max-w-0 opacity-0" },
    },
  },
  compoundVariants: [
    // ── FAB ──
    { form: "fab", size: "small", class: { root: "size-10 rounded-md" } },
    { form: "fab", size: "default", class: { root: "size-14 rounded-lg" } },
    {
      form: "fab",
      size: "medium",
      class: { root: "size-20 rounded-lg-increased" },
    },
    { form: "fab", size: "large", class: { root: "size-24 rounded-xl" } },

    // ── Extended FAB: height, corner and type; collapsed keeps them ──
    {
      form: ["extended", "collapsed"],
      size: "small",
      class: { root: "h-14 rounded-lg px-4 text-title-medium" },
    },
    {
      form: ["extended", "collapsed"],
      size: "default",
      class: { root: "h-14 rounded-lg text-label-large" },
    },
    {
      form: ["extended", "collapsed"],
      size: "medium",
      class: { root: "h-20 rounded-lg-increased px-6.5 text-title-large" },
    },
    {
      form: ["extended", "collapsed"],
      size: "large",
      class: { root: "h-24 rounded-xl text-headline-small" },
    },
    // Extended: the icon-label gap; the baseline's own padding and 80dp minimum width.
    { form: "extended", size: "small", class: { root: "gap-2" } },
    {
      form: "extended",
      size: "default",
      class: { root: "min-w-20 gap-3 ps-4 pe-5" },
    },
    { form: "extended", size: "medium", class: { root: "gap-3" } },
    { form: "extended", size: "large", class: { root: "gap-4 px-7" } },
    // Collapsed: no gap, the icon centred in a square ((height - icon) / 2 each side).
    { form: "collapsed", class: { root: "gap-0" } },
    { form: "collapsed", size: "default", class: { root: "px-4" } },
    { form: "collapsed", size: "large", class: { root: "px-7.5" } },
  ],
  defaultVariants: { color: "primary", size: "default", form: "fab" },
});

export type FABColor = keyof typeof fabVariants.variants.color;
export const fabColors = Object.keys(fabVariants.variants.color) as FABColor[];
export type FABSize = keyof typeof fabVariants.variants.size;
export const fabSizes = Object.keys(fabVariants.variants.size) as FABSize[];
export type FABForm = keyof typeof fabVariants.variants.form;

/** The icon per FAB size (M3 tokens): 24 / 24 / 28 / 36. */
export const fabIconSize: Record<FABSize, IconSize> = {
  small: "md",
  default: "md",
  medium: "fabMd",
  large: "fabLg",
};

/**
 * Which form a FAB takes: icon only without a label; with one, extended unless `extended` is
 * `false` (e-store's rule: a label makes it extended by default).
 */
export const fabForm = (label?: string, extended?: boolean): FABForm =>
  !label ? "fab" : (extended ?? true) ? "extended" : "collapsed";

/**
 * The size when none is given: `default` for a FAB, M3's `small` extended FAB for one with a
 * label (the baseline extended FAB, `default`, is no longer recommended).
 */
export const fabDefaultSize = (form: FABForm): FABSize =>
  form === "fab" ? "default" : "small";

/**
 * A FAB's inside: the icon, then the label (always in the DOM, so collapsing and extending
 * animate). Shared with `FABMenu.Trigger`, which is a FAB on a menu button.
 */
export const FABContent = (props: {
  icon?: IconName;
  label?: string;
  size: FABSize;
  form: FABForm;
}) => {
  const { label: labelClass } = fabVariants({ form: props.form });
  return (
    <>
      {props.icon && <Icon name={props.icon} size={fabIconSize[props.size]} />}
      {props.label && <span class={labelClass()}>{props.label}</span>}
    </>
  );
};

type FABOwnProps = {
  /** Named, and passed on by name: a handler is never left to the `...rest` spread. */
  onClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
  /** The icon. An icon-only FAB needs an `aria-label`. */
  icon?: IconName;
  /** The extended FAB's text. Given, the FAB is extended unless `extended={false}`. */
  label?: string;
  /**
   * With a `label`: `false` folds it to a FAB of the same height, the label animating away and
   * staying as the accessible name (M3: an extended FAB may collapse on scroll). Default `true`.
   */
  extended?: boolean;
  /** M3 color style. Default `primary` (M3 "primary container"). */
  color?: FABColor;
  /**
   * `small` (40, not recommended) / `default` (56) / `medium` (80) / `large` (96). Extended:
   * `small` / `medium` / `large` extended FAB, `default` the baseline one. Default `default`
   * without a label, `small` with one.
   */
  size?: FABSize;
};

/** As `Button`: `type="link"` + `href` renders a link, otherwise a `<button>`. No `disabled`. */
export type FABProps = FABOwnProps &
  (
    | Omit<LinkButtonProps, "onClick$" | "children" | "color">
    | Omit<NormalButtonProps, "onClick$" | "children" | "color" | "disabled">
  );

/** A Material 3 floating action button or extended FAB, or a link drawn as one. */
export const FAB = component$<FABProps>(
  ({
    icon,
    label,
    extended,
    color,
    size,
    class: className,
    onClick$,
    ...rest
  }) => {
    const form = fabForm(label, extended);
    const resolvedSize = size ?? fabDefaultSize(form);
    const { root } = fabVariants({ color, size: resolvedSize, form });
    return (
      <UnstyledButton
        {...(rest as UnstyledButtonProps)}
        data-qds-fab=""
        class={[root(), className]}
        onClick$={onClick$}
      >
        <FABContent icon={icon} label={label} size={resolvedSize} form={form} />
      </UnstyledButton>
    );
  },
);
