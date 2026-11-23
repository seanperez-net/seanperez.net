import {
  Slot,
  component$,
  useContext,
  useContextProvider,
} from "@qwik.dev/core";
import type { PropsOf, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { layoutContextId } from "./layout-context";

/**
 * The Material 3 scaffold as one grid. The page margins are grid tracks, not margin or padding:
 *
 *   row 1  app bar (full width)
 *   row 2  supporting pane, while the window is too narrow for two panes
 *   row 3  primary pane (takes the rest) | supporting pane
 *   row 4  footer (full width)
 *
 * The side columns and the footer row are "at least the page margin, otherwise as big as their
 * content": with no supporting pane or footer they ARE the margin.
 * `md:` is the Material 3 expanded window size (840px), from where two panes sit side by side.
 * https://m3.material.io/foundations/layout/applying-layout
 */
export const layoutVariants = tv({
  slots: {
    root: [
      "grid",
      "min-h-dvh",
      "grid-cols-[minmax(var(--spacing-layout-margin),auto)_minmax(0,1fr)_minmax(var(--spacing-layout-margin),auto)]",
      "grid-rows-[var(--spacing-layout-app-bar)_auto_1fr_minmax(var(--spacing-layout-margin),auto)]",
      "bg-surface-container",
      "font-plain",
      "text-body-large",
      "text-on-surface",
    ],
    skipLink: [
      "fixed",
      "top-3",
      "left-layout-margin",
      "z-10",
      "-translate-y-[200%]",
      "rounded-full",
      "bg-primary",
      "px-6",
      "py-2.5",
      "text-label-large",
      "text-on-primary",
      "shadow-3",
      "focus:translate-y-0",
    ],
    appBar: [
      "col-span-full",
      "row-start-1",
      "flex",
      "items-center",
      "gap-layout-gutter",
      "px-layout-margin",
    ],
    appBarTitle: ["min-w-0", "flex-1", "truncate", "text-title-large"],
    pane: [
      "col-start-2",
      "row-start-3",
      "min-w-0",
      "rounded-lg",
      "bg-surface",
      "p-layout-margin",
    ],
    paneHeader: ["mb-4", "flex", "min-w-0", "items-center", "gap-2"],
    paneTitle: ["min-w-0", "flex-1", "truncate", "text-title-large"],
    supportingPane: [
      "col-start-2",
      "row-start-2",
      "mb-layout-margin",
      "min-w-0",
      "rounded-lg",
      "bg-surface",
      "p-layout-margin",
      "data-[expanded=false]:hidden",
      "md:col-start-3",
      "md:row-start-3",
      "md:mx-layout-margin",
      "md:mb-0",
      "md:w-80",
    ],
    footer: [
      "col-span-full",
      "row-start-4",
      "content-center",
      "px-layout-margin",
      "text-center",
      "text-body-medium",
      // The lowest-emphasis text colour in Material 3: "outline".
      "text-outline",
    ],
  },
});

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */

export type LayoutRootProps = PropsOf<"div"> & {
  /** The id of the primary pane. Defaults to "main-content". */
  mainId?: string;
  /** Whether the supporting pane is shown. The app owns the signal; the pane reads it. */
  "bind:supportExpanded"?: Signal<boolean>;
};

/**
 * The scaffold grid, the skip link, and the layout context for every part inside.
 * One `Layout.Root` per app.
 */
const LayoutRoot = component$<LayoutRootProps>(
  ({
    mainId = "main-content",
    "bind:supportExpanded": givenSupportExpanded,
    class: className,
    ...rest
  }) => {
    const supportExpanded = useBoundSignal(givenSupportExpanded, true);
    useContextProvider(layoutContextId, { mainId, supportExpanded });
    const styles = layoutVariants();

    return (
      <div {...rest} class={[styles.root(), className]}>
        <a href={`#${mainId}`} class={styles.skipLink()}>
          Skip to main content
        </a>
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  App bar                                                            */
/* ------------------------------------------------------------------ */

export type LayoutAppBarProps = PropsOf<"header"> & {
  /** The app's title. */
  title: string;
};

/** The top app bar: the title, then the actions put inside (the default slot). */
const LayoutAppBar = component$<LayoutAppBarProps>(
  ({ title, class: className, ...rest }) => {
    const styles = layoutVariants();
    return (
      <header {...rest} class={[styles.appBar(), className]}>
        <h1 class={styles.appBarTitle()}>{title}</h1>
        <Slot />
      </header>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Panes                                                              */
/* ------------------------------------------------------------------ */

export type LayoutPaneProps = Omit<PropsOf<"main">, "role"> & {
  /** Only "primary" exists: the page's `<main>`. One per page. */
  role?: "primary";
};

/** The primary pane: the page's `<main>` and the skip link's target. */
const LayoutPane = component$<LayoutPaneProps>(
  ({ role = "primary", class: className, ...rest }) => {
    const layout = useContext(layoutContextId);
    const styles = layoutVariants();
    return (
      <main
        {...rest}
        id={layout.mainId}
        data-pane={role}
        tabIndex={-1}
        class={[styles.pane(), "outline-none", className]}
      >
        <Slot />
      </main>
    );
  },
);

export type LayoutPaneHeaderProps = PropsOf<"header"> & {
  /** The screen's title. */
  title: string;
  /** 1 when the pane title is the page's main heading; 2 (default) under an app bar title. */
  headingLevel?: 1 | 2;
};

/** A pane's own header: its title, then its actions (the default slot). */
const LayoutPaneHeader = component$<LayoutPaneHeaderProps>(
  ({ title, headingLevel = 2, class: className, ...rest }) => {
    const styles = layoutVariants();
    const Heading = headingLevel === 1 ? "h1" : "h2";
    return (
      <header {...rest} class={[styles.paneHeader(), className]}>
        <Heading class={styles.paneTitle()}>{title}</Heading>
        <Slot />
      </header>
    );
  },
);

export type LayoutSupportingPaneProps = PropsOf<"aside"> & {
  /** The pane's title. Also its name for screen readers. */
  header: string;
  /** Overrides the root's `bind:supportExpanded` signal for this pane. */
  "bind:expanded"?: Signal<boolean>;
};

/**
 * A second pane beside the primary one (a list, details, settings). Side by side from 840px;
 * above the primary pane below that. Hidden while its expanded signal is false.
 */
const LayoutSupportingPane = component$<LayoutSupportingPaneProps>(
  ({ header, "bind:expanded": givenExpanded, class: className, ...rest }) => {
    const layout = useContext(layoutContextId);
    const expanded = givenExpanded ?? layout.supportExpanded;
    const styles = layoutVariants();
    return (
      <aside
        {...rest}
        aria-label={header}
        data-expanded={expanded.value ? "true" : "false"}
        class={[styles.supportingPane(), className]}
      >
        <header class={styles.paneHeader()}>
          <h2 class={styles.paneTitle()}>{header}</h2>
        </header>
        <Slot />
      </aside>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

export type LayoutFooterProps = PropsOf<"footer">;

/** Small print. One line fits inside the bottom margin; more makes the row grow. */
const LayoutFooter = component$<LayoutFooterProps>(
  ({ class: className, ...rest }) => {
    const styles = layoutVariants();
    return (
      <footer {...rest} class={[styles.footer(), className]}>
        <Slot />
      </footer>
    );
  },
);

export const Layout = {
  Root: LayoutRoot,
  AppBar: LayoutAppBar,
  Pane: LayoutPane,
  PaneHeader: LayoutPaneHeader,
  SupportingPane: LayoutSupportingPane,
  Footer: LayoutFooter,
};
