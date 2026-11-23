import { component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { iconButtonVariants } from "../icon-button";
import { THEME_STORAGE_KEY } from "./theme-mode";

/** Both icons are rendered; the `dark` class on `<html>` decides which one shows. */
export const themeToggleVariants = tv({
  slots: {
    lightIcon: ["dark:hidden"],
    darkIcon: ["hidden", "dark:block"],
  },
});

export type ThemeToggleProps = Omit<PropsOf<"button">, "children"> & {
  /** Its name for screen readers and its hover title. */
  label?: string;
  /** The icon shown in the light theme. */
  lightIcon?: IconName;
  /** The icon shown in the dark theme. */
  darkIcon?: IconName;
};

/**
 * Icon button that swaps light and dark: it flips the `dark` class on `<html>` and remembers
 * the choice. The icon follows the class in CSS, so it is right before any JavaScript loads.
 * Needs `ThemeModeScript` in the document `<head>` for the saved choice to apply on a visit.
 */
export const ThemeToggle = component$<ThemeToggleProps>(
  ({
    label = "Swap light and dark",
    lightIcon = "light_mode",
    darkIcon = "dark_mode",
    class: className,
    ...rest
  }) => {
    const styles = themeToggleVariants();
    return (
      <button
        {...rest}
        type="button"
        aria-label={label}
        title={label}
        class={[iconButtonVariants(), className]}
        onClick$={() => {
          const dark = document.documentElement.classList.toggle("dark");
          try {
            localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
          } catch {
            // Storage unavailable: the theme still applies for this page.
          }
        }}
      >
        <Icon name={lightIcon} class={styles.lightIcon()} />
        <Icon name={darkIcon} class={styles.darkIcon()} />
      </button>
    );
  },
);
