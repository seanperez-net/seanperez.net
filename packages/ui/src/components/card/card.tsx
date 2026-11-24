import { Slot, component$ } from "@qwik.dev/core";
import type { ClassList, PropsOf, QRL } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { safeHref } from "../../utils/safe-href";

/**
 * Material Design 3 card, from e-store's `components/card/card.tsx` (2026-11-23), cut to what M3
 * has. Specs: https://m3.material.io/components/cards/specs (read 2026-11-23, token table for
 * every state) and material-web's `tokens/versions/v0_192/_md-comp-{elevated,filled,outlined}-card.scss`.
 *
 * | Token (M3)           | Elevated              | Filled                    | Outlined               |
 * | -------------------- | --------------------- | ------------------------- | ---------------------- |
 * | container            | surface-container-low | surface-container-highest | surface                |
 * | outline              | -                     | -                         | 1dp outline-variant    |
 * | elevation rest       | 1                     | 0                         | 0                      |
 * | hover / focus / press| 2 / 1 / 1             | 1 / 0 / 0                 | 1 / 0 / 0              |
 * | dragged              | 4                     | 3                         | 3                      |
 * | disabled container   | surface, 38%, level 1 | surface-variant, 38%, 0   | outline at 12%         |
 * | focus outline        | -                     | -                         | on-surface             |
 *
 * Shape 12dp, padding 16dp. State layer on-surface: hover 8%, focus 10%, pressed 10%, dragged 16%.
 * Hover, focus and pressed exist only on a directly actionable card (M3 accessibility: "Non-
 * actionable cards don't have a hover state").
 *
 * The fill and the outline are two layers (`data-card-layer`) under and over the content, as
 * e-store's `CardInner`: M3's disabled opacity (38%) and the outlined card's disabled outline
 * (12%) apply to the CONTAINER, so they cannot be one opacity on the whole card.
 */
export const cardVariants = tv({
  base: [
    "relative",
    "isolate",
    "box-border",
    // One column that may shrink (e-store, 2026-11-17): a child wider than the card no longer
    // widens it past its container.
    "grid",
    "grid-cols-1",
    "content-start",
    "max-w-full",
    "overflow-hidden",
    "text-start",
    "text-on-surface",
    "no-underline",
    "transition-shadow",
    "duration-medium-2",
    "ease-standard",
    // Disabled: the CONTENT at 38% (the layers carry their own disabled values).
    "data-disabled:pointer-events-none",
    "data-disabled:[&>:not([data-card-layer])]:opacity-38",
    // State layer (on-surface). Shown on hover / focus / press only on an actionable card, and
    // while dragged on any card (M3: dragged 16%; reviewer 2026-11-23).
    "after:pointer-events-none after:absolute after:inset-0 after:z-2 after:rounded-[inherit]",
    "after:bg-on-surface after:opacity-0 after:transition-opacity after:duration-short-4 after:content-['']",
    "data-dragged:after:opacity-dragged",
  ],
  variants: {
    variant: {
      elevated: [
        "[--field-bg:var(--color-surface-container-low)]",
        "shadow-1",
        "data-dragged:shadow-4",
      ],
      filled: [
        "[--field-bg:var(--color-surface-container-highest)]",
        "shadow-0",
        "data-dragged:shadow-3",
      ],
      outlined: [
        "[--field-bg:var(--color-surface)]",
        "shadow-0",
        "data-dragged:shadow-3",
      ],
    },
    /**
     * The corners. `md` (default): 12dp, M3's card. `pane` (e-store's, `card.tsx` 91-96): the
     * scaffold's pane radius (`--layout-pane-radius`, `layout.css`: 28px from 600px, 16px in a
     * compact layout, square below 600px), for a card that sits in a pane as a pane of its own.
     * Outside a scaffold: 28px.
     */
    rounded: {
      md: "rounded-md",
      pane: "rounded-(--layout-pane-radius,var(--radius-xl))",
    },
    /**
     * A directly actionable card (M3): the state layer (`after`), the hover elevation and the
     * focus ring. Set automatically for `as="link"` / `as="a"`; set it yourself on a card that
     * holds a `Card.Action`.
     */
    interactive: {
      true: [
        "cursor-pointer",
        "focus-ring",
        "hover:after:opacity-hover",
        "focus-visible:after:opacity-focus",
        "active:after:opacity-focus",
        // A card driven by a stretched `Card.Action`: its focus shows on the card.
        "has-[>[data-card-action]:focus-visible]:after:opacity-focus",
      ],
      false: "",
    },
  },
  compoundVariants: [
    {
      interactive: true,
      variant: "elevated",
      class: "hover:shadow-2 active:shadow-1 data-dragged:hover:shadow-4",
    },
    {
      interactive: true,
      variant: ["filled", "outlined"],
      class: "hover:shadow-1 active:shadow-0 data-dragged:hover:shadow-3",
    },
  ],
  defaultVariants: { variant: "elevated", rounded: "md", interactive: false },
});

/** The container's fill, under the content. */
const fillVariants = tv({
  base: "pointer-events-none absolute inset-0 -z-1 rounded-[inherit]",
  variants: {
    variant: {
      elevated:
        "bg-surface-container-low group-data-disabled/card:bg-surface group-data-disabled/card:opacity-38",
      filled:
        "bg-surface-container-highest group-data-disabled/card:bg-surface-variant group-data-disabled/card:opacity-38",
      // M3 gives the outlined card no disabled container colour or opacity, only its outline.
      outlined: "bg-surface",
    },
  },
});

/** The outlined card's 1dp outline, over the content (media must not cover it). */
const outlineVariants = tv({
  base: [
    "pointer-events-none absolute inset-0 z-1 rounded-[inherit] border border-outline-variant",
    // M3: disabled outline is `outline` at 12%.
    "group-data-disabled/card:border-outline/12",
  ],
  variants: {
    focusable: {
      // M3: the outlined card's focus outline colour is on-surface.
      true: "group-focus-visible/card:border-on-surface group-has-[>[data-card-action]:focus-visible]/card:border-on-surface",
      false: "",
    },
  },
});

export type CardVariant = NonNullable<
  VariantProps<typeof cardVariants>["variant"]
>;
export const cardVariantNames = Object.keys(
  cardVariants.variants.variant,
) as CardVariant[];

export type CardProps = {
  /** Element: `div` (default, a container), `link` (router `<Link>`), `a` (full load). */
  as?: "div" | "link" | "a";
  /** M3 card type. @default "elevated" */
  variant?: CardVariant;
  /** The corners: `md` (default, M3's 12dp) or `pane` (match the layout's panes). */
  rounded?: "md" | "pane";
  /** A directly actionable card's states. @default true for `link` / `a`, else false. */
  interactive?: boolean;
  /** M3 disabled state. A disabled link card renders no link. */
  disabled?: boolean;
  /** M3 dragged state: the raised elevation and the 16% layer while the card is picked up. */
  dragged?: boolean;
  /** Link destination (`as="link"` or `as="a"`), checked by `safeHref`. */
  href?: string;
  /** Open in a new tab (`as="a"`; adds `rel="noopener noreferrer"`). */
  target?: "_blank";
  class?: ClassList;
  id?: string;
  style?: PropsOf<"div">["style"];
  "aria-label"?: string;
  /** Names the card by another element's id, e.g. its `Card.Title`'s. */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  [key: `data-${string}`]: string | boolean | number | undefined;
};

/**
 * `Card.Root`. A `div` is a container (not a tab stop, no role: M3 accessibility). `as="link"` /
 * `as="a"` makes the whole card one link (M3: "Directly actionable cards can have the button or
 * link role"); for the button role, use a `Card.Action as="button"`, since a `<button>` may only
 * hold phrasing content.
 */
const Root = component$<CardProps>((props) => {
  // Copied before destructuring (e-store's note): plain values, the component re-runs on change.
  const {
    as = "div",
    variant = "elevated",
    rounded = "md",
    interactive,
    disabled,
    dragged,
    href,
    target,
    class: className,
    ...rest
  } = { ...props };
  const safe = safeHref(href);
  const isLink = as !== "div" && !!safe && !disabled;
  // A link card with an unsafe href renders as a plain container: no hover, focus or press.
  const isInteractive = interactive ?? isLink;
  const cls = [
    "group/card",
    cardVariants({
      variant,
      rounded,
      interactive: isInteractive && !disabled,
    }),
    className,
  ];
  const state = {
    "data-card": "",
    "data-disabled": disabled ? "" : undefined,
    "data-dragged": dragged ? "" : undefined,
  };
  const layers = (
    <>
      <span data-card-layer="" class={fillVariants({ variant })} />
      <Slot />
      {variant === "outlined" && (
        <span
          data-card-layer=""
          class={outlineVariants({ focusable: isInteractive })}
        />
      )}
    </>
  );

  if (isLink && as === "a") {
    return (
      <a
        {...rest}
        {...state}
        href={safe}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        class={cls}
      >
        {layers}
      </a>
    );
  }
  if (isLink) {
    return (
      <Link {...rest} {...state} href={safe} class={cls}>
        {layers}
      </Link>
    );
  }
  return (
    <div
      {...rest}
      {...state}
      // A link card while disabled: still announced as a link, as unavailable (ARIA: `link`
      // supports `aria-disabled`; a plain `div` does not).
      role={as !== "div" && disabled ? "link" : undefined}
      aria-disabled={as !== "div" && disabled ? "true" : undefined}
      class={cls}
    >
      {layers}
    </div>
  );
});

/** Headline and subhead block: 16dp gutter (M3), 4dp between lines. */
export const cardHeaderVariants = tv({
  base: "flex flex-col gap-1 px-4 pt-4",
  variants: {
    variant: {
      default: "text-start",
      centered: "items-center text-center",
    },
  },
  defaultVariants: { variant: "default" },
});

type HeaderProps = PropsOf<"header"> &
  VariantProps<typeof cardHeaderVariants>;

const Header = component$<HeaderProps>((all) => {
  const { class: className, variant, ...rest } = { ...all };
  return (
    <header
      {...rest}
      data-card-header=""
      class={[cardHeaderVariants({ variant }), className]}
    >
      <Slot />
    </header>
  );
});

/** M3 headline: title-large, on-surface. */
const Title = component$<PropsOf<"h3">>((all) => {
  const { class: className, ...rest } = { ...all };
  return (
    <h3 {...rest} class={["text-title-large text-on-surface", className]}>
      <Slot />
    </h3>
  );
});

/** M3 subhead / supporting text: body-medium, on-surface-variant. */
const Description = component$<PropsOf<"p">>((all) => {
  const { class: className, ...rest } = { ...all };
  return (
    <p
      {...rest}
      class={["text-body-medium text-on-surface-variant", className]}
    >
      <Slot />
    </p>
  );
});

/** Body block. `full` is edge to edge (a list, media), the others have the 16dp gutter. */
export const cardContentVariants = tv({
  base: "text-body-medium flex flex-col",
  variants: {
    variant: {
      default: "gap-4 p-4",
      centered: "items-center justify-center p-4 text-center",
      full: "w-full",
    },
  },
  defaultVariants: { variant: "default" },
});

type ContentProps = PropsOf<"div"> & VariantProps<typeof cardContentVariants>;

const Content = component$<ContentProps>((all) => {
  const { class: className, variant, ...rest } = { ...all };
  return (
    <div
      {...rest}
      data-card-content=""
      class={[cardContentVariants({ variant }), className]}
    >
      <Slot />
    </div>
  );
});

/** Action row: 8dp between buttons, end-aligned (or stacked and centred). */
export const cardFooterVariants = tv({
  base: "flex w-full gap-2 px-4 pb-4",
  variants: {
    variant: {
      end: "flex-row flex-wrap justify-end",
      centered: "flex-col items-center justify-center text-center",
    },
  },
  defaultVariants: { variant: "end" },
});

type FooterProps = PropsOf<"footer"> & VariantProps<typeof cardFooterVariants>;

const Footer = component$<FooterProps>((all) => {
  const { class: className, variant, ...rest } = { ...all };
  return (
    <footer
      {...rest}
      data-card-footer=""
      class={[cardFooterVariants({ variant }), className]}
    >
      <Slot />
    </footer>
  );
});

type MediaProps = PropsOf<"div"> & {
  /** Image URL: renders a full-width `<img>`. Without it, a `<div>` around your own media. */
  src?: string;
  /** The image's text alternative. Empty (the default) marks it decorative (M3 accessibility). */
  alt?: string;
  /** Intrinsic size: reserves the image's box before it loads (and sets its aspect ratio). */
  width?: number;
  height?: number;
};

/** Edge-to-edge media (M3 anatomy: thumbnail, image, video). A direct child of `Card.Root`. */
const Media = component$<MediaProps>((all) => {
  const { class: className, src, alt = "", width, height, ...rest } = {
    ...all,
  };
  if (src) {
    return (
      <img
        {...(rest as PropsOf<"img">)}
        src={src}
        alt={alt}
        width={width}
        height={height}
        data-card-media=""
        class={["block h-auto w-full object-cover", className]}
      />
    );
  }
  return (
    <div
      {...rest}
      data-card-media=""
      class={["w-full overflow-hidden", className]}
    >
      <Slot />
    </div>
  );
});

type ActionProps = {
  /** `button` (default here: the M3 button role), `link` (router), `a` (full load). */
  as?: "button" | "link" | "a";
  href?: string;
  target?: "_blank";
  /** The button's action. Named, never spread. */
  onClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
  /** A disabled card's action: a disabled button, or no link at all. */
  disabled?: boolean;
  "aria-label"?: string;
  /** Usually the id of the card's `Card.Title`. */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  class?: ClassList;
};

/**
 * A stretched button or link over the whole card: a directly actionable card with the BUTTON
 * role, which `Card.Root` cannot be (a `<button>` holds only phrasing content). Put it first in a
 * `Card.Root interactive`, and name it (`aria-labelledby` the title). M3: an actionable card holds
 * no other actions ("An action shouldn't be placed on an actionable surface").
 */
const Action = component$<ActionProps>((all) => {
  const {
    as = "button",
    href,
    target,
    onClick$,
    disabled,
    class: className,
    ...rest
  } = { ...all };
  const cls = [
    "absolute inset-0 z-1 m-0 cursor-pointer appearance-none rounded-[inherit] border-0 bg-transparent p-0",
    // Inward: the card clips its content, an outward ring would be cut.
    "focus-ring-inward",
    className,
  ];
  const safe = safeHref(href);
  if (as === "button") {
    return (
      <button
        {...rest}
        type="button"
        data-card-action=""
        disabled={disabled}
        class={cls}
        onClick$={onClick$}
      />
    );
  }
  if (!safe || disabled) return null;
  if (as === "a") {
    return (
      <a
        {...rest}
        data-card-action=""
        href={safe}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        class={cls}
      />
    );
  }
  return <Link {...rest} data-card-action="" href={safe} class={cls} />;
});

export const Card = {
  Root,
  Header,
  Title,
  Description,
  Content,
  Footer,
  Media,
  Action,
};
