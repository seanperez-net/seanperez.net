import { component$ } from "@qwik.dev/core";
import type { PropsOf, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { useBoundSignal } from "../../utils/use-bound-signal";

/**
 * Material Design 3 switch.
 * Specs: https://m3.material.io/components/switch/specs
 *
 * Track 52 x 32px with a 2px outline. Off: 16px handle in "outline". On: primary track, 24px
 * handle in on-primary. The handle grows to 28px while pressed. The native checkbox IS the
 * track (role="switch"); the handle is its next sibling and follows it through `peer-*`.
 */
export const switchVariants = tv({
  slots: {
    root: [
      "inline-flex",
      "items-center",
      "gap-3",
      "text-body-large",
      "cursor-pointer",
      "has-disabled:cursor-default",
    ],
    control: ["relative", "inline-flex", "h-8", "w-13", "shrink-0"],
    track: [
      "peer",
      "absolute",
      "inset-0",
      "size-full",
      "appearance-none",
      "rounded-full",
      "border-2",
      "border-outline",
      "bg-surface-container-highest",
      "cursor-pointer",
      "transition-colors",
      "duration-short-4",
      "ease-standard",
      "checked:border-primary",
      "checked:bg-primary",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-secondary",
      "disabled:cursor-default",
      "disabled:border-on-surface/12",
      "disabled:bg-surface-container-highest/12",
      "disabled:checked:border-transparent",
      "disabled:checked:bg-on-surface/12",
    ],
    handle: [
      "absolute",
      "top-1/2",
      "left-2",
      "size-4",
      "-translate-y-1/2",
      "rounded-full",
      "bg-outline",
      "pointer-events-none",
      "transition-all",
      "duration-short-4",
      "ease-standard",
      "peer-hover:bg-on-surface-variant",
      "peer-active:left-0.5",
      "peer-active:size-7",
      "peer-checked:left-6",
      "peer-checked:size-6",
      "peer-checked:bg-on-primary",
      "peer-checked:peer-hover:bg-primary-container",
      "peer-checked:peer-active:left-5.5",
      "peer-checked:peer-active:size-7",
      "peer-disabled:bg-on-surface/38",
      "peer-disabled:peer-checked:bg-surface",
    ],
  },
});

export type SwitchProps = Omit<
  PropsOf<"input">,
  "type" | "role" | "checked" | "bind:checked" | "children"
> & {
  /** The text beside the switch. */
  label?: string;
  /** The starting state when no signal is bound. */
  checked?: boolean;
  /** Two-way state: the parent's signal is read and written. */
  "bind:checked"?: Signal<boolean>;
};

/** A Material 3 switch: a checkbox with the switch role, and its label. */
export const Switch = component$<SwitchProps>(
  ({
    label,
    checked = false,
    "bind:checked": givenChecked,
    class: className,
    ...rest
  }) => {
    const checkedSig = useBoundSignal(givenChecked, checked);
    const styles = switchVariants();
    return (
      <label class={[styles.root(), className]}>
        <span class={styles.control()}>
          <input
            {...rest}
            type="checkbox"
            role="switch"
            bind:checked={checkedSig}
            class={styles.track()}
          />
          <span class={styles.handle()} />
        </span>
        {label}
      </label>
    );
  },
);
