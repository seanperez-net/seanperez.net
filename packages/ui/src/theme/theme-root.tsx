import { Slot, component$ } from "@qwik.dev/core";
import { useThemeProvider } from "./theme-context";
import type { ThemeProps } from "./theme-context";

/**
 * Provides the theme to a page that does not use `Layout.Root` (which has it built in).
 * Renders nothing of its own.
 */
export const ThemeRoot = component$<ThemeProps>((props) => {
  useThemeProvider(props);
  return <Slot />;
});
