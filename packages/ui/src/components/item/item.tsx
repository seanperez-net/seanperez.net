import type { ClassList, JSXOutput, PropsOf, QRL } from "@qwik.dev/core";
import { Slot, component$ } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { freshJsx } from "../../utils/jsx-prop";
import { UnstyledButton } from "../button/unstyled-button";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 list item, from e-store's `components/item/item.tsx` (2026-11-23).
 * Specs: https://m3.material.io/components/lists/specs
 *
 * One-, two- and three-line rows on a four-column grid (`start`, text, trailing supporting text,
 * `end`). The line count is computed from the text props given, or set with `lines`.
 *
 * Changed from e-store (see item.md "Where it differs from e-store"):
 * - `py-3` (12dp) instead of `py-4`: with 16dp a two-line row measured 76px and a three-line one
 *   96px, past M3's 72 / 88 (material-web `md-list-item`: top / bottom space 12px).
 * - `startIcon` / `endIcon` (`IconName`, our `Icon` at 24dp) beside the `start` / `end` JSX props.
 * - `rounded-[inherit]` (e-store's `rounded-inherit` is not a Tailwind 4.3.5 utility and is
 *   defined nowhere in e-store: it generated no CSS).
 * - No Layout-context density (we have no compact layout mode): `density` is a plain prop.
 * - `as="button"` renders through our `UnstyledButton`.
 */
export const itemVariants = tv({
  base: [
    "item",
    "text-on-surface",
    "font-plain text-body-large",
    "relative",
    "box-border",
    "grid grid-cols-[auto_1fr_auto_auto]",
    "items-center",
    // The container clips (ripple and state layers, to the row's corners), not the row: a row that
    // clipped itself cut off the focus ring of a control inside it.
    "rounded-[inherit]",
    "outline-inherit",

    // Container overlay (pointer-events-none so clicks reach the start / end controls)
    "*:[.item-container]:**:absolute",
    "*:[.item-container]:absolute",
    "*:[.item-container]:**:inset-0",
    "*:[.item-container]:pointer-events-none",
    "*:[.item-container]:overflow-hidden",
    "*:[.item-container]:rounded-[inherit]",

    // Default slot
    "**:[.item-default-slot]:inline",
    "**:[.item-default-slot]:overflow-hidden",
    "**:[.item-default-slot]:text-ellipsis",

    // Headline (its line count: the `headlineLines` variant)
    "**:[.item-headline]:text-body-large",
    "**:[.item-headline]:text-on-surface",

    // Text column
    "*:[.item-text]:flex",
    "*:[.item-text]:flex-1",
    "*:[.item-text]:flex-col",
    "*:[.item-text]:overflow-hidden",

    // Supporting text
    "**:[.item-supporting-text]:text-body-medium",
    "**:[.item-supporting-text]:text-on-surface-variant",

    // Overline
    "**:[.item-overline]:text-label-small",
    "**:[.item-overline]:text-on-surface-variant",

    // Trailing supporting text
    "**:[.item-trailing-supporting-text]:text-label-small",
    "**:[.item-trailing-supporting-text]:text-on-surface-variant",

    // Leading / trailing content color. M3: on-surface-variant for icons.
    "*:[.item-start]:text-on-surface-variant",
    "*:[.item-end]:text-on-surface-variant",
  ],
  variants: {
    /**
     * The selected state's colors (on `data-selected`; `aria-selected` is not allowed on a
     * section). `primary`: a selected option, primary-container. `secondary`: M3's navigation
     * active indicator, secondary-container.
     */
    indicator: {
      primary: [
        "data-selected:text-on-primary-container",
        "data-selected:**:[.item-headline]:text-on-primary-container",
        "data-selected:**:[.item-supporting-text]:text-on-primary-container/70",
        "data-selected:**:[.item-overline]:text-on-primary-container/70",
        "data-selected:**:[.item-trailing-supporting-text]:text-on-primary-container/70",
        "data-selected:*:[.item-start]:text-on-primary-container",
        "data-selected:*:[.item-end]:text-on-primary-container",
      ],
      secondary: [
        "data-selected:text-on-secondary-container",
        "data-selected:**:[.item-headline]:text-on-secondary-container",
        "data-selected:**:[.item-supporting-text]:text-on-secondary-container/70",
        "data-selected:**:[.item-overline]:text-on-secondary-container/70",
        "data-selected:**:[.item-trailing-supporting-text]:text-on-secondary-container/70",
        "data-selected:*:[.item-start]:text-on-secondary-container",
        "data-selected:*:[.item-end]:text-on-secondary-container",
      ],
    },
    /**
     * Whether the row paints its selected container itself. `List.Item` passes `false`: its
     * `<li>` paints it (with the row's shape and state layers on top), and a second fill on the
     * Item covered the `<li>`'s hover and focus layers (e-store paints both).
     */
    selectedFill: {
      true: "",
      false: "",
    },
    lines: {
      "one-line": "",
      "two-line": "",
      // M3: a three-line row is top-aligned and its supporting text is at most two lines.
      "three-line": [
        "items-start",
        "*:[.item-start]:items-start",
        "*:[.item-end]:items-start",
        "**:[.item-supporting-text]:line-clamp-2",
        // With an overline the three lines are overline, headline and ONE supporting line
        // (M3 baseline three-line list; e-store let it run to four lines, 112px).
        "[&:has(.item-overline)_.item-supporting-text]:line-clamp-1",
      ],
    },
    /**
     * Where `start` and `end` sit. `auto`: M3, centred on one- and two-line rows, top-aligned on
     * three-line ones. `top`: top-aligned at any line count, without three-line's height or clamp.
     */
    align: {
      auto: "",
      top: [
        "items-start",
        "*:[.item-start]:items-start",
        "*:[.item-end]:items-start",
      ],
    },
    // The gap reads `--layout-item-gap` so `List.Root inset="drawer"` can narrow it.
    density: {
      default: "gap-[var(--layout-item-gap,1rem)] py-3",
      compact: "gap-[var(--layout-item-gap,0.5rem)] py-1",
    },
    /** Side padding. `default`: M3's 16dp start, 24dp end. `none`: none. */
    inset: {
      default: "",
      none: "px-0",
    },
    /** Supporting text lines. `auto`: wraps (three-line clamps at two). `one`: one line. */
    supportingLines: {
      auto: "",
      one: "**:[.item-supporting-text]:line-clamp-1",
    },
    /** Headline lines. `one`: one line with an ellipsis. `auto`: wraps, breaking long words. */
    headlineLines: {
      one: [
        "**:[.item-headline]:overflow-hidden",
        "**:[.item-headline]:text-ellipsis",
        "**:[.item-headline]:whitespace-nowrap",
      ],
      auto: "**:[.item-headline]:wrap-break-word",
    },
    /**
     * The row's element. `section` (default): a static row, or one a `List` makes interactive.
     * `button`: the whole row is ONE button with the M3 list-item state layer and inward ring.
     */
    as: {
      section: "",
      button: [
        "w-full cursor-pointer border-0 bg-transparent text-start",
        // State layers as a background image over the fill (a selected row keeps its color).
        "hover:bg-linear-to-r hover:from-on-surface/8 hover:to-on-surface/8",
        "focus-visible:bg-linear-to-r focus-visible:from-on-surface/12 focus-visible:to-on-surface/12",
        "active:bg-linear-to-r active:from-on-surface/12 active:to-on-surface/12",
        "focus-ring-inward",
        "disabled:cursor-default disabled:opacity-38",
      ],
    },
  },
  compoundVariants: [
    {
      selectedFill: true,
      indicator: "primary",
      class: "data-selected:bg-primary-container",
    },
    {
      selectedFill: true,
      indicator: "secondary",
      class: "data-selected:bg-secondary-container",
    },
    // Side padding only while `inset` is `default` (lite tv does not merge classes).
    { inset: "default", density: "default", class: "ps-4 pe-6" },
    { inset: "default", density: "compact", class: "ps-4 pe-2" },
    // M3 heights: 56 / 72 / 88dp.
    { lines: "one-line", density: "default", class: "min-h-14" },
    { lines: "two-line", density: "default", class: "min-h-18" },
    // A literal, never a token that happens to be 88px too (e-store's nav-rail width trap).
    { lines: "three-line", density: "default", class: "min-h-22" },
    // Compact (e-store's Gmail / Calendar density, not an M3 value): 40 / 56 / 72.
    { lines: "one-line", density: "compact", class: "min-h-10" },
    { lines: "two-line", density: "compact", class: "min-h-14" },
    { lines: "three-line", density: "compact", class: "min-h-18" },
  ],
  defaultVariants: {
    lines: "one-line",
    align: "auto",
    density: "default",
    inset: "default",
    indicator: "primary",
    supportingLines: "auto",
    headlineLines: "one",
    as: "section",
    selectedFill: true,
  },
});

export type ItemVariantProps = VariantProps<typeof itemVariants>;

/* ------------------------------------------------------------------ */
/*  ItemSide                                                          */
/* ------------------------------------------------------------------ */

type ItemSideProps = PropsOf<"div"> & {
  position: "start" | "end";
  content?: JSXOutput;
  icon?: IconName;
  /** A `<span>` (inside an `Item as="button"`). */
  inline?: boolean;
};

const ItemSide = component$<ItemSideProps>(
  ({ position, content, icon, class: className, inline, ...rest }) => {
    // Inside a button row the parts are spans: a button holds phrasing content only.
    const Tag = (inline ? "span" : "div") as "div";
    return (
      <Tag
        {...rest}
        class={[`item-${position}`, "flex items-center", className]}
      >
        {/* A copy, never the caller's node (`utils/jsx-prop.ts`). */}
        {content ? freshJsx(content) : icon && <Icon name={icon} />}
        {!inline && <Slot />}
      </Tag>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Item                                                              */
/* ------------------------------------------------------------------ */

export interface ItemTextParts {
  /** Small label above the headline (label-small). */
  overline?: JSXOutput;
  /** Inline content in the text column, beside the default `<Slot />`. */
  defaultSlot?: JSXOutput;
  /** The row's label (body-large). */
  headline?: JSXOutput;
  /** Text under the headline (body-medium). */
  supportingText?: JSXOutput;
}

export interface ItemProps extends ItemVariantProps, ItemTextParts {
  /** `default`: M3 56dp one-line. `compact`: 40dp (not an M3 value). */
  density?: "default" | "compact";
  /** Selected look (`data-selected`; colors from `indicator`). */
  selected?: boolean;
  /** Paint the selected container (default). `List.Item` sets `false`: its `<li>` paints it. */
  selectedFill?: boolean;
  /** Overlay content over the whole row (a ripple, a link overlay). */
  container?: JSXOutput;
  containerProps?: PropsOf<"div">;
  /** Leading content: an avatar, an image, a checkbox. Wins over `startIcon`. */
  start?: JSXOutput;
  /** Leading icon (24dp, on-surface-variant). */
  startIcon?: IconName;
  startProps?: PropsOf<"div">;
  textProps?: PropsOf<"div">;
  /** Short metadata after the text (label-small): a time, a count. */
  trailingSupportingText?: JSXOutput;
  trailingSupportingTextProps?: PropsOf<"span">;
  /** Trailing content: a switch, a checkbox, an icon button. Wins over `endIcon`. */
  end?: JSXOutput;
  /** Trailing icon (24dp, on-surface-variant). */
  endIcon?: IconName;
  endProps?: PropsOf<"div">;
}

export type ItemElementProps = ItemProps &
  Omit<PropsOf<"div">, "class" | "onClick$"> & {
    class?: ClassList;
    /** With `as="button"`: the button's click. */
    onClick$?: QRL<(event: MouseEvent, element: HTMLElement) => void>;
    /** With `as="button"`. */
    disabled?: boolean;
  };

export const Item = component$<ItemElementProps>(
  ({
    overline,
    defaultSlot,
    headline,
    supportingText,
    class: className,
    lines,
    align = "auto",
    density = "default",
    inset = "default",
    selected = false,
    selectedFill = true,
    indicator = "primary",
    as = "section",
    supportingLines = "auto",
    headlineLines = "one",
    container,
    containerProps,
    start,
    startIcon,
    startProps,
    textProps,
    trailingSupportingText,
    trailingSupportingTextProps,
    end,
    endIcon,
    endProps,
    onClick$,
    disabled,
    ...rest
  }) => {
    // A plain value: it depends only on props, and a prop change re-renders the component
    // (e-store's `useComputed$` captured the whole props object, JSX props included).
    const count =
      (overline ? 1 : 0) +
      (defaultSlot ? 1 : 0) +
      (headline ? 1 : 0) +
      (supportingText ? 1 : 0);
    const multiline =
      lines ??
      (count >= 3 ? "three-line" : count === 2 ? "two-line" : "one-line");

    const inline = as === "button";
    const Part = (inline ? "span" : "div") as "div";
    const hasStart = !!(start || startIcon);
    const hasEnd = !!(end || endIcon);

    const parts = (
      <>
        <Part
          {...containerProps}
          class={["item-container size-full", containerProps?.class]}
        >
          {freshJsx(container)}
          {/* No named Slot in a button row: Qwik SSR refuses its `<q:template>` in a span. */}
          {!inline && <Slot name="container" />}
        </Part>
        {hasStart &&
          (inline ? (
            <ItemSide
              {...startProps}
              inline
              position="start"
              class={["col-span-1 col-start-1", startProps?.class]}
              content={start}
              icon={startIcon}
            />
          ) : (
            <ItemSide
              {...startProps}
              position="start"
              class={["col-span-1 col-start-1", startProps?.class]}
              content={start}
              icon={startIcon}
            >
              <Slot name="start" />
            </ItemSide>
          ))}

        {/* Plain generic elements, never article / aside / header / footer: Chrome leaves article
            and complementary subtrees out of a name computed from content, so a row used as a
            link or option would be named only by what sat outside them (e-store, 2026-11-04). */}
        <Part
          {...textProps}
          class={[
            "item-text",
            !hasStart ? "col-start-1" : "col-start-2",
            // Columns: start 1, text 2, trailing text 3, end 4.
            trailingSupportingText
              ? "col-end-3"
              : !hasEnd
                ? "-col-end-1"
                : "col-end-4",
            textProps?.class,
          ]}
        >
          {overline && <Part class="item-overline">{freshJsx(overline)}</Part>}
          <span class="item-default-slot">
            {freshJsx(defaultSlot)}
            {!inline && <Slot />}
          </span>
          {/* Not a heading: a row's headline is its label. */}
          {headline && <Part class="item-headline">{freshJsx(headline)}</Part>}
          {supportingText && (
            <Part class="item-supporting-text">{freshJsx(supportingText)}</Part>
          )}
        </Part>
        {trailingSupportingText && (
          <span
            {...trailingSupportingTextProps}
            class={[
              "item-trailing-supporting-text",
              "col-start-3",
              !hasEnd ? "-col-end-1" : "col-end-4",
              trailingSupportingTextProps?.class,
            ]}
          >
            {freshJsx(trailingSupportingText)}
          </span>
        )}
        {hasEnd &&
          (inline ? (
            <ItemSide
              {...endProps}
              inline
              position="end"
              class={["col-span-1 -col-end-1", endProps?.class]}
              content={end}
              icon={endIcon}
            />
          ) : (
            <ItemSide
              {...endProps}
              position="end"
              class={["col-span-1 -col-end-1", endProps?.class]}
              content={end}
              icon={endIcon}
            >
              <Slot name="end" />
            </ItemSide>
          ))}
      </>
    );

    const attrs = {
      "data-qds-item": "",
      "data-lines":
        multiline === "three-line" ? "3" : multiline === "two-line" ? "2" : "1",
      "data-selected": selected || undefined,
    };
    const classes = [
      itemVariants({
        lines: multiline,
        align,
        density,
        inset,
        indicator,
        selectedFill,
        supportingLines,
        headlineLines,
        as,
      }),
      className,
    ];

    if (inline) {
      return (
        <UnstyledButton
          {...(rest as PropsOf<"button">)}
          {...attrs}
          type="button"
          disabled={disabled}
          onClick$={onClick$}
          class={classes}
        >
          {parts}
        </UnstyledButton>
      );
    }

    return (
      // A `<div>`, not e-store's `<section>`: a section with an accessible name (an `aria-label`
      // passed through) becomes a `region` landmark (HTML-AAM), one per row.
      <div {...rest} {...attrs} onClick$={onClick$} class={classes}>
        {parts}
      </div>
    );
  },
);
