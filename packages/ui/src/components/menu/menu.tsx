import { Slot, component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";

/**
 * Material Design 3 menu, on the HTML Popover API.
 * Specs: https://m3.material.io/components/menus/specs
 *
 * surface-container, 4px corners, elevation level 2, 112 to 280px wide. Where the browser
 * supports CSS anchor positioning it hangs under the button that opened it (a popover's opener
 * is its anchor), its end corner under the middle of that button.
 */
export const menuVariants = tv({
  slots: {
    root: [
      "m-0",
      "max-w-70",
      "min-w-28",
      "rounded-xs",
      "bg-surface-container",
      "py-2",
      "text-on-surface",
      "shadow-2",
      "supports-[anchor-name:--a]:inset-auto",
      "supports-[anchor-name:--a]:[position-anchor:auto]",
      "supports-[anchor-name:--a]:top-[anchor(bottom)]",
      "supports-[anchor-name:--a]:right-[anchor(center)]",
    ],
    item: [
      "flex",
      "min-h-12",
      "items-center",
      "gap-3",
      "px-3",
      "py-2",
      "text-body-large",
      "cursor-pointer",
      "hover:bg-on-surface/8",
    ],
  },
});

export type MenuRootProps = Omit<PropsOf<"div">, "popover"> & {
  /** The id a button's `popovertarget` points at. */
  id: string;
};

/**
 * The menu surface. A button with `popovertarget` set to this id opens and closes it, and
 * Escape or a click outside closes it: the browser does all of it.
 */
const MenuRoot = component$<MenuRootProps>(({ class: className, ...rest }) => {
  return (
    <div
      role="group"
      {...rest}
      popover="auto"
      class={[menuVariants().root(), className]}
    >
      <Slot />
    </div>
  );
});

export type MenuItemProps = PropsOf<"div">;

/** A row of a menu: 48px high, with the hover state layer. */
const MenuItem = component$<MenuItemProps>(({ class: className, ...rest }) => {
  return (
    <div {...rest} class={[menuVariants().item(), className]}>
      <Slot />
    </div>
  );
});

export const Menu = {
  Root: MenuRoot,
  Item: MenuItem,
};
