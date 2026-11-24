import {
  $,
  Slot,
  component$,
  createContextId,
  useContext,
  useContextProvider,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";
import type { ClassList, PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName, IconSize } from "../icon";
import { avatarTone, initialsOf } from "./avatar-utils";

/**
 * Material 3 avatar, from e-store's `components/avatar/avatar.tsx` (2026-11-23), with a Base
 * UI-shaped API.
 *
 * M3 has no avatar page; its components fix the sizes (app bar 32dp, search bar 30dp, list
 * leading 40dp), the shape (full circle) and the initials colours (`on-*-container` on
 * `*-container`).
 *
 * - `Avatar.Root` / `Avatar.Image` / `Avatar.Fallback`: the compound parts. The image reports its
 *   load status into the root's context; the fallback renders while there is no image or after
 *   it failed.
 * - `Avatar` (props only: `src`, `name`, `alt`, `size`, ...): composes the parts, for every call
 *   site that has nothing custom to put inside.
 * - `Avatar.Group`: overlapping avatars with a `+N` counter.
 *
 * Changed from e-store: signals are read in JSX, never in a component body (Qwik rc.5 best
 * practice: a body read subscribes the whole component); `fallbackIcon` is an `IconName`.
 *
 * @see https://base-ui.com/react/components/avatar
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img
 */

/** One per size: the circle and the initials' type scale (about 40% of the diameter) move together. */
export const avatarVariants = tv({
  base: [
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
    "align-middle font-medium select-none",
  ],
  variants: {
    size: {
      /** 24dp: dense rows, chips. */
      xs: "text-label-small size-6",
      /** 30dp: the M3 search bar's trailing avatar. */
      search: "text-label-medium size-7.5",
      /** 32dp: the M3 top app bar's trailing avatar. */
      appbar: "text-label-large size-8",
      /** 40dp: the M3 list item's leading avatar. The default. */
      md: "text-title-medium size-10",
      /** 48dp: a post row's avatar column. Opt-in; `md` is the M3 one. */
      post: "text-title-medium size-12",
      /** 56dp: a menu or card header. */
      lg: "text-title-large size-14",
      /** 80dp: a profile header. */
      xl: "text-headline-large size-20",
      /** 96dp: a profile header over a banner. Opt-in; `xl` is the M3 one. */
      profile: "text-headline-large size-24",
      /** 144dp: a hero. */
      "2xl": "text-display-large size-36",
    },
    tone: {
      primary: "bg-primary-container text-on-primary-container",
      secondary: "bg-secondary-container text-on-secondary-container",
      tertiary: "bg-tertiary-container text-on-tertiary-container",
      neutral: "bg-surface-container-highest text-on-surface-variant",
    },
    /**
     * A thin neutral edge that separates a light image from the page. A box-shadow ring, so it
     * sits OUTSIDE the circle and is not clipped by the root's `overflow-hidden`; presence draws
     * an offset `outline`, a different property, so both show at once. `none` (default): the M3
     * avatar.
     */
    edge: {
      none: "",
      hairline: "ring-outline-variant ring-1",
    },
  },
  defaultVariants: { size: "md", edge: "none" },
});

/**
 * The overlap scales with the avatar (about a quarter of the diameter). Every avatar in the
 * group gets the negative start margin and the group pads it back, so the selector needs no
 * `:first-child` (Qwik projections may sit between the group and its avatars).
 */
export const avatarGroupVariants = tv({
  base: [
    "inline-flex items-center",
    "**:data-qds-avatar:ring-surface **:data-qds-avatar:ring-2",
  ],
  variants: {
    size: {
      xs: "ps-1.5 **:data-qds-avatar:-ms-1.5",
      search: "ps-2 **:data-qds-avatar:-ms-2",
      appbar: "ps-2 **:data-qds-avatar:-ms-2",
      md: "ps-2.5 **:data-qds-avatar:-ms-2.5",
      post: "ps-3 **:data-qds-avatar:-ms-3",
      lg: "ps-3.5 **:data-qds-avatar:-ms-3.5",
      xl: "ps-5 **:data-qds-avatar:-ms-5",
      profile: "ps-6 **:data-qds-avatar:-ms-6",
      "2xl": "ps-9 **:data-qds-avatar:-ms-9",
    },
  },
  defaultVariants: { size: "md" },
});

export type AvatarVariantProps = VariantProps<typeof avatarVariants>;
export type AvatarSize = NonNullable<AvatarVariantProps["size"]>;
export type AvatarToneVariant = NonNullable<AvatarVariantProps["tone"]>;
export type AvatarEdge = NonNullable<AvatarVariantProps["edge"]>;
export type AvatarLoadingStatus = "idle" | "loading" | "loaded" | "error";

/**
 * What OTHER people see of someone's presence. The person's own choice (automatic / busy /
 * away / appear offline) is projected onto these by the host; "appear offline" is `offline`,
 * never a state of its own.
 */
export type AvatarPresence = "online" | "away" | "busy" | "offline";

/** Default words for each presence, read after the name ("Ada Lovelace, Busy"). */
export const AVATAR_PRESENCE_LABELS: Record<AvatarPresence, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};

/**
 * Presence: a ring around the avatar plus a glyph at the bottom-trailing corner. Not colour
 * alone (WCAG 1.4.1): each state has its own shape (online a filled dot, away a crescent, busy a
 * bar, offline a hollow ring). The ring is an outline with an offset, so the gap shows whatever
 * the avatar sits on and the root's `overflow-hidden` does not clip it. The glyph's cut-out is
 * `--avatar-presence-cutout`, default `--field-bg` (declared by every `bg-surface*` utility in
 * `tokens/utilities.css`, and inherited), so it matches the surface the avatar actually sits on.
 * Tones: `positive` and `warning` (`tokens/color/status.css`, not M3 roles), `error`, `outline`.
 */
export const avatarPresenceVariants = tv({
  slots: {
    wrap: "relative inline-flex shrink-0 rounded-full align-middle",
    ring: "outline-solid",
    badge: [
      "pointer-events-none absolute inset-e-0 bottom-0 rounded-full",
      "shadow-[0_0_0_2px_var(--avatar-presence-cutout,var(--field-bg,var(--color-surface)))]",
      "bg-center bg-no-repeat",
    ],
  },
  variants: {
    presence: {
      online: { ring: "outline-positive", badge: "bg-positive" },
      away: {
        ring: "outline-warning",
        badge: [
          "bg-warning",
          "bg-[radial-gradient(circle_at_25%_25%,var(--avatar-presence-cutout,var(--field-bg,var(--color-surface)))_0_40%,transparent_42%)]",
        ],
      },
      busy: {
        ring: "outline-error",
        badge: [
          "bg-error",
          "bg-[linear-gradient(var(--avatar-presence-cutout,var(--field-bg,var(--color-surface))),var(--avatar-presence-cutout,var(--field-bg,var(--color-surface))))]",
          "bg-size-[60%_24%]",
        ],
      },
      offline: {
        ring: "outline-outline",
        badge:
          "border-outline border-2 bg-(--avatar-presence-cutout,var(--field-bg,var(--color-surface)))",
      },
    },
    size: {
      xs: { ring: "outline-1 outline-offset-1", badge: "size-2 border-1" },
      search: { ring: "outline-2 outline-offset-1", badge: "size-2.5" },
      appbar: { ring: "outline-2 outline-offset-2", badge: "size-3" },
      md: { ring: "outline-2 outline-offset-2", badge: "size-3.5" },
      post: { ring: "outline-2 outline-offset-2", badge: "size-4" },
      lg: { ring: "outline-3 outline-offset-2", badge: "size-4.5" },
      xl: { ring: "outline-3 outline-offset-3", badge: "size-6" },
      profile: { ring: "outline-3 outline-offset-3", badge: "size-7" },
      "2xl": { ring: "outline-4 outline-offset-4", badge: "size-10" },
    },
  },
  defaultVariants: { size: "md" },
});

export type AvatarPresenceGlyphProps = {
  presence: AvatarPresence;
  size?: AvatarSize;
  class?: ClassList;
};

/**
 * The presence glyph alone (decorative), for a status picker's rows. Static position: the same
 * shape as the badge on an avatar.
 */
export const AvatarPresenceGlyph = component$<AvatarPresenceGlyphProps>(
  ({ presence, size = "md", class: className }) => (
    <span
      aria-hidden="true"
      data-qds-avatar-presence-glyph={presence}
      class={[
        avatarPresenceVariants({ presence, size }).badge(),
        "static inline-block shrink-0",
        className,
      ]}
    />
  ),
);

/** The fallback icon's size per avatar size. */
const ICON_SIZE: Record<AvatarSize, IconSize> = {
  xs: "xs",
  search: "sm",
  appbar: "sm",
  md: "md",
  post: "md",
  lg: "lg",
  xl: "xl",
  profile: "xl",
  "2xl": "xl",
};

interface AvatarContext {
  status: Signal<AvatarLoadingStatus>;
}

export const avatarContextId = createContextId<AvatarContext>(
  "net.seanperez.ui.avatar",
);

/* ------------------------------------------------------------------ */
/*  Root                                                              */
/* ------------------------------------------------------------------ */

export type AvatarRootProps = Omit<PropsOf<"span">, "class"> & {
  size?: AvatarSize;
  /** Initials tone. Unset: derived from `seed` with `avatarTone()`. */
  tone?: AvatarToneVariant;
  /** What the tone is derived from when `tone` is unset (a name, an email or an id). */
  seed?: string;
  /** `hairline`: a 1px `outline-variant` ring around the circle. Default `none`. */
  edge?: AvatarEdge;
  class?: ClassList;
};

const Root = component$<AvatarRootProps>(
  ({
    size = "md",
    tone: toneProp,
    seed,
    edge = "none",
    class: className,
    ...rest
  }) => {
    const status = useSignal<AvatarLoadingStatus>("idle");
    useContextProvider(avatarContextId, { status });
    const tone = toneProp ?? avatarTone(seed);
    return (
      <span
        {...rest}
        data-qds-avatar=""
        data-size={size}
        data-tone={tone}
        data-status={status.value}
        data-edge={edge === "none" ? undefined : edge}
        class={[avatarVariants({ size, tone, edge }), className]}
      >
        <Slot />
      </span>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Image                                                             */
/* ------------------------------------------------------------------ */

export type AvatarImageProps = Omit<
  PropsOf<"img">,
  "class" | "src" | "onLoad$" | "onError$"
> & {
  src?: string | null;
  /** Required for a meaningful image; pass `""` when a visible name sits beside the avatar. */
  alt: string;
  /** Called with every status change: `loading`, `loaded`, `error` (and `idle` when `src` goes). */
  onLoadingStatusChange$?: QRL<(status: AvatarLoadingStatus) => void>;
  class?: ClassList;
};

const Image = component$<AvatarImageProps>(
  ({ src, alt, onLoadingStatusChange$, class: className, ...rest }) => {
    const ctx = useContext(avatarContextId);
    const imgRef = useSignal<HTMLImageElement>();

    const setStatus$ = $((next: AvatarLoadingStatus) => {
      if (ctx.status.value === next) return;
      ctx.status.value = next;
      if (onLoadingStatusChange$) onLoadingStatusChange$(next);
    });

    // Server and client: with a src the image is assumed to be loading, so SSR renders the <img>
    // and hides the fallback. Runs before `Avatar.Fallback` renders, which is why the image
    // comes first inside the root.
    useTask$(({ track }) => {
      const current = track(() => src);
      ctx.status.value = current ? "loading" : "idle";
    });

    // An image that failed (or finished) before Qwik resumed fired its event into nothing: read
    // the outcome off the element once it is visible (HTMLImageElement.complete / naturalWidth).
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
      const img = imgRef.value;
      if (!img || !img.complete) return;
      setStatus$(img.naturalWidth > 0 ? "loaded" : "error");
    });

    if (!src) return null;
    return (
      <img
        {...rest}
        ref={imgRef}
        src={src}
        alt={alt}
        hidden={ctx.status.value === "error"}
        data-qds-avatar-image=""
        data-loading={ctx.status.value === "loading" ? "" : undefined}
        data-error={ctx.status.value === "error" ? "" : undefined}
        onLoad$={() => setStatus$("loaded")}
        onError$={() => setStatus$("error")}
        class={["size-full object-cover", className]}
      />
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Fallback                                                          */
/* ------------------------------------------------------------------ */

export type AvatarFallbackProps = Omit<PropsOf<"span">, "class"> & {
  /** Milliseconds to wait before showing (avoids a flash on fast networks). Browser only. */
  delay?: number;
  /** The person's name, read as `role="img"`. Unset: the fallback is decorative. */
  label?: string;
  class?: ClassList;
};

const Fallback = component$<AvatarFallbackProps>(
  ({ delay = 0, label, class: className, ...rest }) => {
    const ctx = useContext(avatarContextId);
    const ready = useSignal(delay <= 0);

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ cleanup }) => {
      if (delay <= 0) return;
      const timer = setTimeout(() => (ready.value = true), delay);
      cleanup(() => clearTimeout(timer));
    });

    return (
      <span
        {...rest}
        data-qds-avatar-fallback=""
        hidden={
          !(
            ready.value &&
            (ctx.status.value === "idle" || ctx.status.value === "error")
          )
        }
        role={label ? "img" : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : "true"}
        class={[
          "flex size-full items-center justify-center [[hidden]]:hidden",
          className,
        ]}
      >
        <Slot />
      </span>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Props-only form                                                   */
/* ------------------------------------------------------------------ */

export type AvatarProps = Omit<AvatarRootProps, "children"> & {
  /** Image address. Unset, empty or failing: the initials (or the icon) show instead. */
  src?: string | null;
  /** The person or brand: the initials, the tone seed and the accessible name. */
  name?: string;
  /** The image's text (and the fallback's label). Defaults to `name`. */
  alt?: string;
  /** Material Symbol shown when there is neither an image nor initials. */
  fallbackIcon?: IconName;
  /** Fallback delay in ms (`Avatar.Fallback delay`). */
  delay?: number;
  /** The avatar repeats a name already beside it, or sits inside a named control: hide it. */
  decorative?: boolean;
  /**
   * What others see of this person's presence: a ring plus a corner glyph, and the word in the
   * accessible name ("Ada Lovelace, Busy"). Unset or `null`: no presence shown. The host passes
   * the state projected for this viewer.
   */
  presence?: AvatarPresence | null;
  /** Words for each presence (a localising host). */
  presenceLabels?: Partial<Record<AvatarPresence, string>>;
};

const AvatarBase = component$<AvatarProps>(
  ({
    src,
    name,
    alt,
    seed,
    size = "md",
    fallbackIcon = "person",
    delay,
    decorative = false,
    presence,
    presenceLabels,
    class: className,
    ...rest
  }) => {
    const initials = initialsOf(name);
    const presenceWord = presence
      ? (presenceLabels?.[presence] ?? AVATAR_PRESENCE_LABELS[presence])
      : undefined;
    const who = alt || name || undefined;
    const label = decorative
      ? undefined
      : [who, presenceWord].filter(Boolean).join(", ") || undefined;
    const p = presence ? avatarPresenceVariants({ presence, size }) : undefined;
    const avatar = (
      <Root
        {...rest}
        size={size}
        seed={seed ?? name ?? alt}
        class={p ? p.ring() : className}
        data-presence={presence ?? undefined}
      >
        {src && <Image src={src} alt={label ?? ""} />}
        <Fallback delay={delay} label={label}>
          {initials ? (
            // The initials are CSS generated content, not a text node: inside a named control
            // (the account menu trigger, "Account: Ada Lovelace, Online") a visible "AL" text node
            // would not match the control's name (WCAG 2.5.3). The fallback carries the name.
            <span
              data-qds-avatar-initials={initials}
              class="before:content-[attr(data-qds-avatar-initials)]"
            />
          ) : (
            <Icon name={fallbackIcon} size={ICON_SIZE[size]} />
          )}
        </Fallback>
      </Root>
    );
    if (!p) return avatar;
    // The glyph sits outside the root, whose overflow-hidden would clip it. `class` (layout)
    // goes on the outermost element.
    return (
      <span
        data-qds-avatar-presence={presence}
        class={[p.wrap(), className]}
      >
        {avatar}
        <span
          aria-hidden="true"
          data-qds-avatar-presence-badge=""
          class={p.badge()}
        />
      </span>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Group                                                             */
/* ------------------------------------------------------------------ */

/** One avatar of a data-driven group (serialisable). */
export interface AvatarGroupItem {
  src?: string | null;
  name?: string;
  alt?: string;
  seed?: string;
}

export type AvatarGroupProps = Omit<PropsOf<"div">, "class"> & {
  size?: AvatarSize;
  /** The avatars, as data. Slotted `<Avatar>` children render after them. */
  items?: AvatarGroupItem[];
  /** At most this many of `items` are drawn; the rest count into `+N`. */
  max?: number;
  /**
   * Everyone in the group, drawn or not. Defaults to `items.length`. With slotted children,
   * pass the number drawn as `max` and the full count here.
   */
  total?: number;
  /** Read after the count: "3 more". */
  overflowLabel?: string;
  /** Names the group (`role="group"`). */
  label?: string;
  class?: ClassList;
};

const Group = component$<AvatarGroupProps>(
  ({
    size = "md",
    items,
    max,
    total,
    overflowLabel = "more",
    label,
    class: className,
    ...rest
  }) => {
    const list = items ?? [];
    const drawn = max === undefined ? list : list.slice(0, Math.max(0, max));
    const shown = items ? drawn.length : (max ?? 0);
    const overflow = Math.max(0, (total ?? list.length) - shown);
    return (
      <div
        {...rest}
        role="group"
        aria-label={label}
        data-qds-avatar-group=""
        class={[avatarGroupVariants({ size }), className]}
      >
        {drawn.map((item, index) => (
          <AvatarBase
            key={`${item.seed ?? item.name ?? item.src ?? ""}-${index}`}
            src={item.src}
            name={item.name}
            alt={item.alt}
            seed={item.seed}
            size={size}
          />
        ))}
        <Slot />
        {overflow > 0 && (
          <span
            data-qds-avatar=""
            data-qds-avatar-overflow=""
            role="img"
            aria-label={`${overflow} ${overflowLabel}`}
            class={avatarVariants({ size, tone: "neutral" })}
          >
            <span aria-hidden="true">+{overflow}</span>
          </span>
        )}
      </div>
    );
  },
);

/**
 * `<Avatar src name size />` composes the parts; `Avatar.Root` / `.Image` / `.Fallback` /
 * `.Group` are the parts themselves.
 */
export const Avatar = Object.assign(AvatarBase, {
  Root,
  Image,
  Fallback,
  Group,
});
