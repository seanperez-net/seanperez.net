import { Slot, component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";

/**
 * Material Design 3 small top app bar.
 * Specs: https://m3.material.io/components/top-app-bar/specs
 *
 * 64dp high, four columns: leading (a menu button) | title | pane (the flexible middle: a
 * search bar) | trailing (actions, the account avatar). Nothing in the bar has a padding or a
 * margin: the side insets AND the gaps between the columns are tracks of the
 * `layout-appbar-rulers` grid (`tokens/layout/layout.css`), and each part names its column.
 * `Layout.AppBar` places the bar in the scaffold.
 */
export const topAppBarVariants = tv({
  slots: {
    root: ["layout-appbar-rulers", "bg-surface-container", "text-on-surface"],
    leading: ["appbar-leading", "flex", "items-center"],
    // Never wider than the drawer under it.
    title: [
      "appbar-title",
      "min-w-0",
      "max-w-(--layout-nav-width)",
      "truncate",
      "text-title-large",
    ],
    titleLink: [
      "rounded-xs",
      "outline-none",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-secondary",
    ],
    pane: ["appbar-pane", "flex", "min-w-0", "items-center", "justify-center"],
    trailing: ["appbar-trailing", "flex", "items-center"],
  },
});

export type TopAppBarProps = PropsOf<"header"> & {
  /** The app's title. */
  title: string;
  /** Makes the title a link (the home page, `/`). */
  titleHref?: string;
  /** 1 (default): the title is the page's main heading. */
  headingLevel?: 1 | 2;
};

/**
 * The top app bar. Slots: `leading` (a menu or back button, before the title), `pane` (the
 * middle: a search bar) and the default slot (trailing actions, after everything).
 */
export const TopAppBar = component$<TopAppBarProps>(
  ({ title, titleHref, headingLevel = 1, class: className, ...rest }) => {
    const styles = topAppBarVariants();
    const Heading = headingLevel === 1 ? "h1" : "h2";
    return (
      <header {...rest} class={[styles.root(), className]}>
        <div class={styles.leading()}>
          <Slot name="leading" />
        </div>
        <Heading class={styles.title()}>
          {titleHref ? (
            <a href={titleHref} class={styles.titleLink()}>
              {title}
            </a>
          ) : (
            title
          )}
        </Heading>
        <div class={styles.pane()}>
          <Slot name="pane" />
        </div>
        <div class={styles.trailing()}>
          <Slot />
        </div>
      </header>
    );
  },
);
