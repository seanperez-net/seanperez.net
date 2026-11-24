import { component$, useContext } from "@qwik.dev/core";
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

export type ThemeToggleProps = Omit<PropsOf<"button">, "children"> & {
  /** Its name for screen readers and its hover title. */
  label?: string;
  /** The icon shown in the dark theme (a click switches to light). */
  lightIcon?: IconName;
  /** The icon shown in the light theme (a click switches to dark). */
  darkIcon?: IconName;
  /** 48dp (`md`, the default) or 40dp (`sm`, for a top app bar). */
  size?: "md" | "sm";
  /** The 1px ring around it. Defaults to true. */
  outlined?: boolean;
};

/**
 * Swaps light and dark and remembers the choice. While the colours change,
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
    class: className,
    ...rest
  }) => {
    const theme = useContext(themeContextId, null);
    const styles = themeToggleVariants({ size, outlined });
    return (
      <button
        {...rest}
        type="button"
        aria-label={label}
        title={label}
        class={[styles.root(), className]}
        onClick$={() => {
          const next = document.documentElement.classList.contains("dark")
            ? "light"
            : "dark";
          // Inside a theme provider (`Layout.Root`) the choice goes through the context, so
          // every theme control agrees; on its own the toggle applies and saves it itself.
          if (theme) theme.colorMode.value = next;
          else applyColorMode(next);
        }}
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
