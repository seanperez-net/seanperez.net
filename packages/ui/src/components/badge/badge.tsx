import { Slot, component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";

/**
 * Material Design 3 badge, from e-store's `components/badge/badge.tsx` (2026-11-23): Root (the
 * icon and its badge) and Badge (the dot or the count).
 * Specs: https://m3.material.io/components/badges/specs and /accessibility (read in Chrome
 * 2026-11-23); material-web `_md-comp-badge.scss` (tokens v34.0.21).
 *
 * - Small: a 6dp dot, `error`. Its bottom-leading corner is 6dp down and 6dp in from the
 *   icon's top-trailing corner: the dot sits inside the icon's corner.
 * - Large: 16dp high, at least 16dp wide, 4dp sides, full corners, `error` / `on-error`,
 *   label-small; at most 4 characters with the "+" (16x34dp). Its bottom-leading corner is 14dp
 *   down and 12dp in from the icon's top-trailing corner.
 *
 * Placement is measured from a 24dp icon CENTRED in `Badge.Root`, so the root may be the icon
 * itself or anything that centres one: an icon button, a navigation rail or bar destination's
 * icon area. (e-store fixed offsets for an icon 8dp inside a 40dp icon button.)
 */
export const badgeVariants = tv({
  slots: {
    root: "relative inline-flex shrink-0 items-center justify-center",
    badge: [
      "pointer-events-none absolute z-1",
      "flex items-center justify-center",
      "rounded-full bg-error",
    ],
  },
  variants: {
    size: {
      small: {
        badge: [
          "size-1.5",
          // The icon's top edge (50% - 12px) and trailing edge (50% + 12px) less the dot.
          "inset-s-[calc(50%+6px)] top-[calc(50%-12px)]",
        ],
      },
      large: {
        badge: [
          "h-4 min-w-4 px-1",
          "text-label-small text-on-error",
          // Bottom 14dp under the icon's top (so top = 50% - 12 + 14 - 16); start 12dp in.
          "inset-s-1/2 top-[calc(50%-14px)]",
        ],
      },
    },
  },
  defaultVariants: { size: "small" },
});

export type BadgeSize = keyof typeof badgeVariants.variants.size;
export const badgeSizes = Object.keys(
  badgeVariants.variants.size,
) as BadgeSize[];

export type BadgeRootProps = PropsOf<"span">;

/**
 * The icon (or icon button, or destination icon area) and its `Badge.Badge`. A `<span>`, so it
 * may sit inside a link or button (e-store's is a `<div>`, not allowed there).
 */
const Root = component$<BadgeRootProps>(({ class: className, ...rest }) => (
  <span {...rest} data-qds-badge="" class={[badgeVariants().root(), className]}>
    <Slot />
  </span>
));

export type BadgeBadgeProps = Omit<PropsOf<"span">, "children"> & {
  /** The count. Without it, a small dot. */
  value?: number;
  /** Above this the badge shows "{max}+". Default 999 (M3: 4 characters with the "+"). */
  max?: number;
  /** Overrides the size chosen from `value` (`large` with a value, `small` without). */
  size?: BadgeSize;
  /**
   * What a screen reader hears, after the destination's own name (M3). Default "New
   * notification" for a dot, "{value} notifications" for a count (e-store's).
   */
  label?: string;
  /**
   * Render the spoken `label` inside the badge. Default `true`. Set `false` when the host puts
   * `badgeSpokenText()` after its own name, so the name is read first (M3: "Inbox, 3
   * notifications"); the badge then sits BEFORE the name in the DOM, as on a rail item.
   */
  announce?: boolean;
};

/** What a screen reader hears for a badge: `label`, else e-store's default text. */
export const badgeSpokenText = (value?: number, label?: string) =>
  label ??
  (value == null
    ? "New notification"
    : `${value} notification${value === 1 ? "" : "s"}`);

/**
 * The badge. Its text is hidden from screen readers and its `label` is given as hidden text
 * instead, so inside a link or button it is read after the destination's name ("Inbox, 3
 * notifications"). No live region (e-store: `role="status"` on every badge).
 */
const BadgeIndicator = component$<BadgeBadgeProps>(
  ({
    value,
    max = 999,
    size,
    label,
    announce = true,
    class: className,
    ...rest
  }) => {
    const resolvedSize = size ?? (value == null ? "small" : "large");
    const text =
      value == null || resolvedSize === "small"
        ? undefined
        : value > max
          ? `${max}+`
          : `${value}`;
    return (
      <span
        {...rest}
        data-qds-badge-indicator=""
        class={[badgeVariants({ size: resolvedSize }).badge(), className]}
      >
        <span aria-hidden="true">{text}</span>
        {announce && (
          <span class="sr-only">{badgeSpokenText(value, label)}</span>
        )}
      </span>
    );
  },
);

export const Badge = { Root, Badge: BadgeIndicator };
