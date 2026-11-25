import { $, component$, useContext } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { themeContextId } from "../../theme/theme-context";
import { applyColorMode } from "../../theme/theme-storage";

/**
 * The light/dark switch, as e-store's: a round button with a 1px ring. Inside it a track twice
 * the button's height holds both icons, one above the other; the `dark` class on `<html>` slides
 * the track up by one button height, so the icons roll past each other. Pure CSS, so the right
 * icon shows before any JavaScript loads. The icon shown is the mode a click switches TO.
 */
export const themeToggleVariants = tv({
  slots: {
    root: [
      "group/theme-toggle",
      "relative",
      "block",
      "shrink-0",
      "overflow-hidden",
      "rounded-full",
      "text-on-surface-variant",
      "cursor-pointer",
      "select-none",
      "transition-[background-color]",
      "duration-300",
      "ease-standard",
      // State layers
      "hover:bg-on-surface-variant/8",
      "focus-visible:bg-on-surface-variant/10",
      "active:bg-on-surface-variant/12",
      // Focus ring
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-secondary",
    ],
    track: [
      "block",
      "transition-transform",
      "duration-300",
      "ease-standard",
      "motion-reduce:transition-none",
    ],
    face: [
      "flex",
      "items-center",
      "justify-center",
      "transition-transform",
      "duration-200",
      "group-hover/theme-toggle:scale-110",
      "group-active/theme-toggle:scale-95",
    ],
  },
  variants: {
    size: {
      // 48dp: on its own, in a rail's footer.
      md: {
        root: ["size-12"],
        track: ["h-24", "dark:-translate-y-12"],
        face: ["size-12"],
      },
      // 40dp: beside icon buttons in a top app bar.
      sm: {
        root: ["size-10"],
        track: ["h-20", "dark:-translate-y-10"],
        face: ["size-10"],
      },
    },
    outlined: {
      // A ring (box-shadow), not an outline: the outline is the focus ring's.
      true: { root: ["ring-1", "ring-outline", "ring-inset"] },
      false: {},
    },
  },
  defaultVariants: { size: "md", outlined: true },
});

/**
 * The large form (`look="full"`), e-store's `ThemeModeToggle` in a drawer footer (its `full` /
 * `auto` in `group/drawer-footer`, 2026-11-23: "a full-width outlined pill with its icon and label
 * centred"): 48dp high, the drawer's title-medium, the label the mode a click switches TO. Both
 * states are in the markup and the `dark` class picks one, so the first paint is right.
 */
export const themeToggleFullVariants = tv({
  slots: {
    root: [
      "flex",
      "h-12",
      "w-full",
      "items-center",
      "justify-center",
      "gap-2",
      "rounded-full",
      "px-4",
      "ring-1",
      "ring-outline",
      "ring-inset",
      "text-on-surface-variant",
      "cursor-pointer",
      "select-none",
      "transition-[background-color]",
      "duration-300",
      "ease-standard",
      "hover:bg-on-surface-variant/8",
      "focus-visible:bg-on-surface-variant/10",
      "active:bg-on-surface-variant/12",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-secondary",
    ],
    toDark: ["contents", "dark:hidden"],
    toLight: ["hidden", "dark:contents"],
    text: ["text-title-medium"],
  },
});

export type ThemeToggleProps = Omit<PropsOf<"button">, "children"> & {
  /** Its name for screen readers and its plain tooltip. */
  label?: string;
  /** The icon shown in the dark theme (a click switches to light). */
  lightIcon?: IconName;
  /** The icon shown in the light theme (a click switches to dark). */
  darkIcon?: IconName;
  /** 48dp (`md`, the default) or 40dp (`sm`, for a top app bar). */
  size?: "md" | "sm";
  /** The 1px ring around it. Defaults to true. */
  outlined?: boolean;
  /**
   * `icon` (the round switch, default) or `full`: the labelled full-width pill for a drawer
   * footer (e-store's). The full form is named by its visible label.
   */
  look?: "icon" | "full";
  /** The full form's label in the light theme. */
  toDarkLabel?: string;
  /** The full form's label in the dark theme. */
  toLightLabel?: string;
};

/**
 * Swaps light and dark and remembers the choice. While the colors change,
 * `theme-transitioning` is on `<html>` for 200ms so they fade instead of snapping (the rule is
 * in the library's `global.css`).
 * Needs `ThemeModeScript` in the document `<head>` for the saved choice to apply on a visit.
 */
export const ThemeToggle = component$<ThemeToggleProps>(
  ({
    label = "Swap light and dark",
    lightIcon = "light_mode",
    darkIcon = "dark_mode",
    size,
    outlined,
    look = "icon",
    toDarkLabel = "Switch to dark mode",
    toLightLabel = "Switch to light mode",
    class: className,
    ...rest
  }) => {
    const theme = useContext(themeContextId, null);
    const styles = themeToggleVariants({ size, outlined });
    const swap$ = $(() => {
      const next = document.documentElement.classList.contains("dark")
        ? "light"
        : "dark";
      // Inside a theme provider (`Layout.Root`) the choice goes through the context, so
      // every theme control agrees; on its own the toggle applies and saves it itself.
      if (theme) theme.colorMode.value = next;
      else applyColorMode(next);
    });
    if (look === "full") {
      const full = themeToggleFullVariants();
      return (
        <button
          {...rest}
          type="button"
          data-qds-theme-toggle="full"
          class={[full.root(), className]}
          onClick$={swap$}
        >
          <span class={full.toDark()}>
            <Icon name={darkIcon} />
            <span class={full.text()}>{toDarkLabel}</span>
          </span>
          <span class={full.toLight()}>
            <Icon name={lightIcon} />
            <span class={full.text()}>{toLightLabel}</span>
          </span>
        </button>
      );
    }
    return (
      <button
        {...rest}
        type="button"
        aria-label={label}
        // Its plain tooltip: `TooltipProvider` (in `Layout.Root`) shows the `aria-label` on hover
        // and keyboard focus, as on `IconButton` (was `title`).
        data-tooltip=""
        class={[styles.root(), className]}
        onClick$={swap$}
      >
        <span class={styles.track()}>
          <span class={styles.face()}>
            <Icon name={darkIcon} />
          </span>
          <span class={styles.face()}>
            <Icon name={lightIcon} />
          </span>
        </span>
      </button>
    );
  },
);
