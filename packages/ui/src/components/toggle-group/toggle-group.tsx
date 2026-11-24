import {
  Slot,
  component$,
  createContextId,
  useComputed$,
  useContext,
  useContextProvider,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { rovingKeys } from "../../utils/roving-focus";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 connected button group: what the segmented button became in M3 Expressive
 * (segmented buttons are deprecated). One choice out of a few; the items sit side by side, the
 * outer ends fully rounded. After e-store's `ToggleGroup`, single choice only.
 * https://m3.material.io/components/button-groups/specs
 */
export const toggleGroupVariants = tv({
  slots: {
    root: ["inline-flex", "shrink-0", "items-stretch", "rounded-full"],
    item: [
      "relative",
      "inline-flex",
      "items-center",
      "justify-center",
      "gap-2",
      // 40dp high to the eye, 48dp to the pointer (M3). It needs the item not to clip, so the
      // state layer takes the item's rounded ends itself instead of `overflow-hidden`.
      "touch-target",
      "border",
      "border-outline-variant",
      "text-on-surface",
      "cursor-pointer",
      "select-none",
      "outline-none",
      "transition-colors",
      "duration-200",
      "ease-standard",
      // Shared borders collapse; only the two ends are rounded.
      "-ml-px",
      "first-of-type:ml-0",
      "first-of-type:rounded-l-full",
      "last-of-type:rounded-r-full",
      // State layer: 8% on hover, 10% on focus and press.
      "before:pointer-events-none",
      "before:absolute",
      "before:inset-0",
      "before:rounded-[inherit]",
      "before:bg-on-surface",
      "before:opacity-0",
      "before:transition-opacity",
      "before:content-['']",
      "hover:before:opacity-8",
      "focus-visible:before:opacity-10",
      "active:before:opacity-10",
      "focus-visible:z-1",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-secondary",
      "aria-pressed:bg-secondary-container",
      "aria-pressed:text-on-secondary-container",
      "aria-pressed:before:bg-on-secondary-container",
      "disabled:pointer-events-none",
      "disabled:text-on-surface/38",
    ],
  },
  variants: {
    look: {
      outlined: { item: ["bg-transparent"] },
      tonal: { item: ["bg-surface-container-highest"] },
    },
    /** Height and type scale together (M3 Expressive: 32, 40, 48dp). */
    size: {
      xs: { item: ["h-8", "px-3", "text-label-medium"] },
      sm: { item: ["h-10", "px-4", "text-label-large"] },
      // M3 connected button group, medium: 56dp (e-store and this file had 48).
      md: { item: ["h-14", "px-6", "text-title-medium"] },
    },
  },
  defaultVariants: { look: "outlined", size: "sm" },
});

export type ToggleGroupLook = "outlined" | "tonal";
export type ToggleGroupSize = "xs" | "sm" | "md";

type ToggleGroupContextValue = {
  value: Signal<string>;
  // Signals, so items restyle when the group's `look` or `size` changes after the first render
  // (plain values were copied once). The same as `Modal`'s `position`.
  look: Readonly<Signal<ToggleGroupLook>>;
  size: Readonly<Signal<ToggleGroupSize>>;
  onValueChange$?: QRL<(value: string) => void>;
};

const toggleGroupContextId = createContextId<ToggleGroupContextValue>(
  "net.seanperez.ui.toggle-group",
);

export type ToggleGroupRootProps = PropsOf<"div"> & {
  /** The chosen item's value. */
  "bind:value"?: Signal<string>;
  /** The value to start on, without a bound signal. */
  value?: string;
  /** Called after the choice changed. */
  onValueChange$?: QRL<(value: string) => void>;
  look?: ToggleGroupLook;
  size?: ToggleGroupSize;
};

/** The group. Give it an `aria-label`. Arrow keys move between its items. */
const ToggleGroupRoot = component$<ToggleGroupRootProps>(
  ({
    "bind:value": givenValue,
    value: initialValue = "",
    onValueChange$,
    look: givenLook,
    size: givenSize,
    onKeyDown$,
    class: className,
    ...rest
  }) => {
    const value = useBoundSignal(givenValue, initialValue);
    const look = useComputed$<ToggleGroupLook>(() => givenLook ?? "outlined");
    const size = useComputed$<ToggleGroupSize>(() => givenSize ?? "sm");
    useContextProvider(toggleGroupContextId, {
      value,
      look,
      size,
      onValueChange$,
    });
    return (
      <div
        {...rest}
        role="group"
        class={[
          toggleGroupVariants({
            look: look.value,
            size: size.value,
          }).root(),
          className,
        ]}
        data-roving=""
        // A consumer's handler runs after ours (it was dropped through `...rest` before).
        onKeyDown$={[rovingKeys, onKeyDown$]}
      >
        <Slot />
      </div>
    );
  },
);

export type ToggleGroupItemProps = Omit<PropsOf<"button">, "onClick$"> & {
  /** What the group's value becomes when this item is chosen. */
  value: string;
  /** The item's text. Children, if any, go after it. */
  label?: string;
  /** An icon before the label. An icon-only item needs an `aria-label`. */
  icon?: IconName;
};

const ToggleGroupItem = component$<ToggleGroupItemProps>(
  ({ value, label, icon, class: className, ...rest }) => {
    const group = useContext(toggleGroupContextId);
    return (
      <button
        {...rest}
        type="button"
        aria-pressed={group.value.value === value}
        class={[
          toggleGroupVariants({
            look: group.look.value,
            size: group.size.value,
          }).item(),
          className,
        ]}
        onClick$={() => {
          if (group.value.value === value) return;
          group.value.value = value;
          if (group.onValueChange$) group.onValueChange$(value);
        }}
      >
        {icon && <Icon name={icon} size="dense" />}
        {label}
        <Slot />
      </button>
    );
  },
);

export const ToggleGroup = { Root: ToggleGroupRoot, Item: ToggleGroupItem };
