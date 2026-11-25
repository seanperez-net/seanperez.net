import { Slot, component$ } from "@qwik.dev/core";
import type { ClassList } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";

/**
 * `TitleBar`: the title row of a surface that is neither a pane (`Layout.PaneHeader`) nor a
 * modal (`Modal.CloseTitleAction`): a floating, non-modal window such as a chat window. A
 * heading (one line, ellipsis) and the window's actions. From e-store's `TitleBar`
 * (`packages/ui/src/components/title-bar/title-bar.tsx`), same slots, variants and props.
 *
 * The heading carries `headingId`, so the window can be named by it (`aria-labelledby`).
 * Slots: `leading` (before the heading: an avatar), `trailing` (the window's actions:
 * minimize, open in full, close).
 *
 * `md` is the M3 small top app bar (https://m3.material.io/components/top-app-bar/specs: 64dp,
 * title-large). `sm` (40dp, title-small) is NOT an M3 size: it is Gmail's docked window bar, as
 * e-store measured it (`title-bar.md` "Proof").
 */
export const titleBarVariants = tv({
  slots: {
    root: "flex w-full shrink-0 items-center gap-1",
    heading: "m-0 min-w-0 flex-1 truncate text-on-surface",
    actions: "flex shrink-0 items-center gap-1",
  },
  variants: {
    /** `md`: M3 small top app bar (64dp, `title-large`). `sm`: a compact window bar (40dp,
     *  `title-small`). */
    size: {
      sm: { root: "h-10 ps-4 pe-2", heading: "text-title-small" },
      md: { root: "h-16 ps-4 pe-2", heading: "text-title-large" },
    },
    /** `surface`: on the window's own surface. `container`: `surface-container-low`, a bar that
     *  reads as the window's frame. */
    tone: {
      surface: { root: "bg-surface" },
      container: { root: "bg-surface-container-low" },
    },
  },
  defaultVariants: { size: "md", tone: "surface" },
});

export type TitleBarVariantProps = VariantProps<typeof titleBarVariants>;

export interface TitleBarProps extends TitleBarVariantProps {
  /** The heading text. */
  title: string;
  /** The heading's id, for the window's `aria-labelledby`. */
  headingId?: string;
  /** The heading element (default `2`: the page keeps its own `h1`). */
  headingLevel?: 2 | 3 | 4;
  /** Placement only (width, margins), never a restyle. */
  class?: ClassList;
}

export const TitleBar = component$<TitleBarProps>(
  ({ title, headingId, headingLevel = 2, size, tone, class: className }) => {
    const v = titleBarVariants({ size, tone });
    const Heading =
      headingLevel === 4 ? "h4" : headingLevel === 3 ? "h3" : "h2";
    return (
      <header data-title-bar="" class={[v.root(), className]}>
        <Slot name="leading" />
        <Heading id={headingId} class={v.heading()}>
          {title}
        </Heading>
        <div class={v.actions()} data-title-bar-actions="">
          <Slot name="trailing" />
        </div>
      </header>
    );
  },
);
