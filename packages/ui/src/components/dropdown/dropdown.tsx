import {
  $,
  Slot,
  component$,
  createContextId,
  useContext,
  useContextProvider,
  useId,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { useBindings } from "../../utils/bindings";
import { chooseMenuItem, navigateMenuItems } from "../../utils/menu-keys";
import { Menu, menuContextId, menuItemVariants } from "../menu";

/**
 * Dropdown: a menu button (APG menu button + menu), from e-store's
 * `components/dropdown/dropdown.tsx` (2026-11-23).
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
 * M3: https://m3.material.io/components/menus/specs
 *
 * e-store's Dropdown is an older, smaller copy of its own Menu (same context, same item
 * variants, same keys). Here the shared parts ARE `Menu`'s: Root, Trigger, Content / Popover,
 * Item, RadioGroup, RadioItem, Separator. This file adds only what Menu does not have yet:
 * CheckboxItem, ItemIndicator, Group, GroupLabel.
 *
 * NOT a Select: a Select is a form control with a value (`role="combobox"` + `listbox`, posts
 * under a `name`); a Dropdown runs commands (`role="menu"`, no value of its own).
 *
 * Left out: e-store's `filled` / `tonal` trigger looks and the trigger's `unstyled` flag (its
 * SplitButton's), and the `floating` / `flip` / `gutter` Popover props (`floating` and `align`
 * exist on Menu.Content).
 *
 * Changed from e-store: see dropdown.md "Where it differs".
 */

/* ------------------------------------------------------------------ */
/*  CheckboxItem                                                      */
/* ------------------------------------------------------------------ */

export type DropdownCheckboxItemProps = Omit<
  PropsOf<"div">,
  "onClick$" | "onKeyDown$"
> &
  VariantProps<typeof menuItemVariants> & {
    /** Starting state when nothing is bound. */
    checked?: boolean;
    /** Two-way state. */
    "bind:checked"?: Signal<boolean>;
    /** Called after the state changes. */
    onCheckedChange$?: QRL<(checked: boolean) => void>;
    disabled?: boolean;
    /** Close the menu once toggled. Default `false` (several may be toggled in a row). */
    closeOnSelect?: boolean;
    onClick$?: QRL<(event: PointerEvent, element: HTMLDivElement) => void>;
    onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLDivElement) => void>;
  };

const CheckboxItem = component$<DropdownCheckboxItemProps>((props) => {
  /* eslint-disable @typescript-eslint/no-unused-vars -- pulled out so they never reach the DOM */
  const {
    size,
    checkedHighlight,
    checked: _checked,
    "bind:checked": _bindChecked,
    onCheckedChange$,
    disabled,
    closeOnSelect = false,
    onClick$,
    onKeyDown$,
    class: className,
    ...rest
  } = props;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const menu = useContext(menuContextId);
  const { checkedSig } = useBindings(props, { checked: false });

  const toggle$ = $(() => {
    if (disabled) return;
    checkedSig.value = !checkedSig.value;
    onCheckedChange$?.(checkedSig.value);
    if (closeOnSelect) menu.contentRef.value?.hidePopover();
  });

  return (
    <div
      {...rest}
      data-qds-dropdown-checkbox-item=""
      role="menuitemcheckbox"
      aria-checked={checkedSig.value}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? undefined : -1}
      onClick$={[toggle$, onClick$]}
      onKeyDown$={[navigateMenuItems, chooseMenuItem, onKeyDown$]}
      class={[menuItemVariants({ size, checkedHighlight }), className]}
    >
      <Slot />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  ItemIndicator                                                     */
/* ------------------------------------------------------------------ */

/** Styles of the parts Menu does not have. */
export const dropdownVariants = tv({
  slots: {
    indicator: "ms-auto inline-flex ps-2 text-on-surface-variant",
    group: "py-1",
    groupLabel:
      "flex h-12 items-center px-3 text-label-large text-on-surface-variant",
  },
});

/** Trailing slot of a row (a check, a shortcut), pushed to the end. */
const ItemIndicator = component$<PropsOf<"span">>(
  ({ class: className, ...rest }) => (
    <span {...rest} class={[dropdownVariants().indicator(), className]}>
      <Slot />
    </span>
  ),
);

/* ------------------------------------------------------------------ */
/*  Group, GroupLabel                                                 */
/* ------------------------------------------------------------------ */

const groupContextId = createContextId<{ labelId: string }>(
  "net.seanperez.ui.dropdown-group",
);

/** Rows that belong together, named by their `GroupLabel`. */
const Group = component$<PropsOf<"div">>(({ class: className, ...rest }) => {
  const groupId = useId();
  const labelId = `${groupId}-label`;
  useContextProvider(groupContextId, { labelId });
  return (
    <div
      {...rest}
      role="group"
      aria-labelledby={labelId}
      class={[dropdownVariants().group(), className]}
    >
      <Slot />
    </div>
  );
});

const GroupLabel = component$<PropsOf<"div">>(
  ({ class: className, ...rest }) => {
    const group = useContext(groupContextId, null);
    return (
      <div
        {...rest}
        id={rest.id ?? group?.labelId}
        role="presentation"
        class={[dropdownVariants().groupLabel(), className]}
      >
        <Slot />
      </div>
    );
  },
);

export const Dropdown = {
  Root: Menu.Root,
  Trigger: Menu.Trigger,
  Content: Menu.Content,
  /** e-store's name for Content. */
  Popover: Menu.Content,
  Item: Menu.Item,
  RadioGroup: Menu.RadioGroup,
  RadioItem: Menu.RadioItem,
  Separator: Menu.Separator,
  CheckboxItem,
  ItemIndicator,
  Group,
  GroupLabel,
};
