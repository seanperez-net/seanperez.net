import type { PropsOf } from "@qwik.dev/core";
import { Slot, component$ } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon, type IconName } from "../icon";

/**
 * Placeholder for an empty area: an empty list, no search results, nothing selected in a
 * list-detail layout. e-store's `EmptyState` (`packages/ui/src/components/empty-state/`),
 * ported 2026-11-24 for the Contacts and Messages lists: same slots, variants, props and
 * defaults. Differs: `icon` is an `IconName` (our icons are inline paths), no `iconTone` (our
 * `Icon` has no `tone`), and the actions wrapper is hidden while empty (e-store's always added
 * its 24px top margin under the text).
 *
 * M3 has no empty-state component; the icon is `xl` (48dp), as e-store's note cites.
 */
export const emptyStateVariants = tv({
  slots: {
    root: "flex flex-col items-center justify-center py-16 text-center",
    iconWrapper: "mb-4 text-on-surface-variant",
    headline: "text-title-large text-on-surface",
    description: "mt-2 max-w-md text-body-medium text-on-surface-variant",
    actions: "mt-6 flex items-center gap-3 empty:hidden",
  },
  variants: {
    size: {
      sm: { root: "py-8", headline: "text-title-medium" },
      md: {},
      lg: { root: "py-24", headline: "text-headline-small" },
    },
  },
  defaultVariants: { size: "md" },
});

export interface EmptyStateProps {
  /** Material Symbols icon name. */
  icon?: IconName;
  /** Heading text. */
  headline?: string;
  /** Description text. */
  description?: string;
  /** Padding and headline type: `sm` (inline areas, panes), `md` (default), `lg` (a whole page). */
  size?: "sm" | "md" | "lg";
  /**
   * The headline's element. Default `h2` (an empty state inside a page). The type scale stays
   * with `size`, independent of the rank.
   */
  headingLevel?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /**
   * Announce the state as a polite live region (`role="status"`). Default `true`: an empty state
   * that appears after a search or a filter is news. A state that IS the page passes `false`.
   */
  live?: boolean;
  class?: PropsOf<"div">["class"];
}

export const EmptyState = component$<EmptyStateProps>((props) => {
  const {
    icon,
    headline,
    description,
    size,
    headingLevel,
    live,
    class: className,
  } = props;
  const v = emptyStateVariants({ size });
  const Heading = headingLevel ?? "h2";

  return (
    <div
      data-qds-empty-state=""
      class={[v.root(), className]}
      role={live === false ? undefined : "status"}
    >
      {icon && (
        <div class={v.iconWrapper()}>
          <Icon name={icon} size="xl" />
        </div>
      )}
      {headline && <Heading class={v.headline()}>{headline}</Heading>}
      {description && <p class={v.description()}>{description}</p>}
      <div class={v.actions()}>
        <Slot />
      </div>
    </div>
  );
});
