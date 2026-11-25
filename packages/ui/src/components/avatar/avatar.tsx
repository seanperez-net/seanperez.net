import {
  $,
  Slot,
  component$,
  createContextId,
  useContext,
  useContextProvider,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { ClassList, PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName, IconSize } from "../icon";
import { IconButton } from "../icon-button";
import type { IconButtonSize } from "../icon-button";
import { avatarTone, initialsOf } from "./avatar-utils";

/**
 * Material 3 avatar, from e-store's `components/avatar/avatar.tsx` (2026-11-23), with a Base
 * UI-shaped API.
 *
 * M3 has no avatar page; its components fix the sizes (app bar 32dp, search bar 30dp, list
 * leading 40dp), the shape (full circle) and the initials colors (`on-*-container` on
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
      xs: "size-6 text-label-small",
      /** 30dp: the M3 search bar's trailing avatar. */
      search: "size-7.5 text-label-medium",
      /** 32dp: the M3 top app bar's trailing avatar. */
      appbar: "size-8 text-label-large",
      /** 40dp: the M3 list item's leading avatar. The default. */
      md: "size-10 text-title-medium",
      /** 48dp: a post row's avatar column. Opt-in; `md` is the M3 one. */
      post: "size-12 text-title-medium",
      /** 56dp: a menu or card header. */
      lg: "size-14 text-title-large",
      /** 80dp: a profile header. */
      xl: "size-20 text-headline-large",
      /** 96dp: a profile header over a banner. Opt-in; `xl` is the M3 one. */
      profile: "size-24 text-headline-large",
      /** 144dp: a hero. */
      "2xl": "size-36 text-display-large",
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
      hairline: "ring-1 ring-outline-variant",
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
    "**:data-qds-avatar:ring-2 **:data-qds-avatar:ring-surface",
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
 * Presence: a ring around the avatar plus a glyph at the bottom-trailing corner. Not color
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
          "border-2 border-outline bg-(--avatar-presence-cutout,var(--field-bg,var(--color-surface)))",
      },
    },
    size: {
      xs: { ring: "outline-1 outline-offset-1", badge: "size-2 border" },
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

/**
 * The edit badge (NEW 2026-11-24, not in e-store; Google Contacts' "Set contact photo" button,
 * measured in Chrome 2026-11-24: a 40px round button with a "+" on the bottom-end of a 162px
 * avatar, tonal in the view, filled in the edit form). Only from `lg` up: below that the button
 * would cover most of the circle. `null`: no badge at that size.
 */
const BADGE_SIZE: Record<AvatarSize, IconButtonSize | null> = {
  xs: null,
  search: null,
  appbar: null,
  md: null,
  post: null,
  lg: "xs",
  xl: "xs",
  profile: "xs",
  "2xl": "sm",
};

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

    if (!src) return null;
    return (
      <img
        {...rest}
        src={src}
        alt={alt}
        hidden={ctx.status.value === "error"}
        data-qds-avatar-image=""
        data-loading={ctx.status.value === "loading" ? "" : undefined}
        data-error={ctx.status.value === "error" ? "" : undefined}
        onLoad$={() => setStatus$("loaded")}
        onError$={() => setStatus$("error")}
        // An image that failed (or finished) before Qwik resumed fired its event into nothing:
        // read the outcome off the element once it is visible (HTMLImageElement.complete /
        // naturalWidth). On the <img> itself, so an avatar without a src registers nothing.
        // VISIBLE-TASK AUDIT 2026-11-25: DONE 2026-11-25 — useVisibleTask$ replaced by onQVisible$ on the <img> (core.mjs: a q-e:qvisible attribute only when rendered; qwikloader observes it, also after a client render)
        onQVisible$={(_, img) => {
          if (!img.complete) return;
          setStatus$(img.naturalWidth > 0 ? "loaded" : "error");
        }}
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

    return (
      <span
        {...rest}
        data-qds-avatar-fallback=""
        // The delay timer, registered only when there is a delay (none at delay 0). At qinit, not
        // on qvisible: a waiting fallback is `hidden` (display: none), which an
        // IntersectionObserver never reports as intersecting.
        // VISIBLE-TASK AUDIT 2026-11-25: DONE 2026-11-25 — useVisibleTask$ replaced by a conditional document:onQInit$ on the span (qwikloader.debug.js processReadyStateChange; core.mjs: no attribute for an undefined handler)
        document:onQInit$={
          delay > 0
            ? $(() => {
                setTimeout(() => (ready.value = true), delay);
              })
            : undefined
        }
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
  /**
   * Shows the EDIT BADGE: a round icon button on the bottom-end corner (Google Contacts' "Set
   * contact photo"). Sizes `lg` and up only. It takes the presence glyph's corner, so with
   * `editable` the glyph is not drawn (the ring stays). NEW, not in e-store.
   */
  editable?: boolean;
  /** The badge's icon (the indicator). Default `add` (Google's "+"); `photo_camera`, `edit`... */
  badgeIcon?: IconName;
  /** The badge button's name. Default "Change photo". */
  badgeLabel?: string;
  /** `tonal` (default, Google's view) or `filled` (Google's edit form). */
  badgeLook?: "tonal" | "filled";
  /** The badge was pressed (open a file picker, a photo menu...). */
  onBadgeClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
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
    editable = false,
    badgeIcon = "add",
    badgeLabel = "Change photo",
    badgeLook = "tonal",
    onBadgeClick$,
    class: className,
    ...rest
  }) => {
    const badgeSize = editable ? BADGE_SIZE[size] : null;
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
        class={p ? p.ring() : badgeSize ? undefined : className}
        data-presence={presence ?? undefined}
      >
        {/* Always mounted: when `src` goes away its task sets the status back to `idle`, so the
            fallback shows again (unmounted, it left the status `loaded` and the circle blank:
            found 2026-11-24 removing a contact photo). It renders nothing without a `src`. */}
        <Image src={src} alt={label ?? ""} />
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
    if (badgeSize) {
      // The badge is a real button: a SIBLING of the clipped root (a button inside the
      // `role="img"` fallback would be hidden by it and clipped by `overflow-hidden`). Its span
      // draws the surface cut-out ring, as the presence glyph does.
      return (
        <span
          data-qds-avatar-editable=""
          data-presence={presence ?? undefined}
          class={[
            avatarPresenceVariants({ size }).wrap(),
            className,
          ]}
        >
          {avatar}
          <span
            data-qds-avatar-badge=""
            class="absolute inset-e-0 bottom-0 rounded-full shadow-[0_0_0_2px_var(--avatar-presence-cutout,var(--field-bg,var(--color-surface)))]"
          >
            <IconButton
              icon={badgeIcon}
              label={badgeLabel}
              look={badgeLook}
              size={badgeSize}
              onClick$={onBadgeClick$}
            />
          </span>
        </span>
      );
    }
    if (!p) return avatar;
    // The glyph sits outside the root, whose overflow-hidden would clip it. `class` (layout)
    // goes on the outermost element.
    return (
      <span data-qds-avatar-presence={presence} class={[p.wrap(), className]}>
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
