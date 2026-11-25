import { component$, useComputed$ } from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { useBoundSignal } from "../../utils/use-bound-signal";

/**
 * e-store's `ColorPicker`, ONLY its `Swatch` part so far (ported 2026-11-24 from
 * `packages/ui/src/components/color-picker/color-picker.tsx` ~1271-1340 and its `swatchLabel` /
 * `swatchInput` slots ~293). `Root`, `Palette`, `Gradient` and `Dialog` are not ported (nothing
 * here needs them yet). See `color-picker.md`.
 */
export const colorPickerVariants = tv({
  slots: {
    // No `overflow-hidden`: it cut the input's focus ring. The native color input IS the round
    // preview (its swatch filling it), so its own ring is the one the keyboard sees (e-store).
    // The boundary: 1px `outline`, inside the 32 / 48px circle (`border-box`). M3 color roles
    // (m3.material.io/styles/color/roles, read 2026-11-24): a target's visual boundary takes
    // `outline` (3:1 on surfaces), never `outline-variant`. 1px as Google's material-web catalog
    // swatch (`catalog/src/components/theme-changer.ts`, `.input-wrapper`, which uses
    // `on-secondary-container`). Was e-store's 2px `on-secondary-container`: on a dark surface a
    // near-black colour read as an empty light ring. `CanvasText` in forced colours (catalog).
    swatchLabel: [
      "relative shrink-0 cursor-pointer rounded-full",
      "border border-outline forced-colors:border-[CanvasText]",
    ],
    swatchInput: [
      "focus-ring absolute inset-0 size-full cursor-pointer appearance-none rounded-full border-none bg-transparent p-0",
      "[&::-webkit-color-swatch-wrapper]:p-0",
      "[&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none",
      "[&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none",
    ],
  },
  variants: {
    size: {
      sm: { swatchLabel: "size-8" },
      md: { swatchLabel: "size-12" },
    },
  },
  defaultVariants: { size: "md" },
});

export type ColorPickerSwatchProps = Omit<PropsOf<"label">, "onChange$"> & {
  /** Current color, `#rrggbb` (the native input's only format). */
  value?: string;
  /** Two-way binding for the color. */
  "bind:value"?: Signal<string>;
  /** After each change, with the new `#rrggbb`. */
  onChange$?: QRL<(hex: string) => void>;
  /** `sm` 32px, `md` 48px (e-store's). */
  size?: "sm" | "md";
  /** Form field name of the inner `<input type="color">`. */
  name?: string;
  /** Accessible name of the color input (visually hidden). */
  label?: string;
};

/** A round preview over a native `<input type="color">` (e-store's `ColorPicker.Swatch`). */
export const ColorPickerSwatch = component$<ColorPickerSwatchProps>((props) => {
  const {
    value: valueProp,
    "bind:value": bindValue,
    onChange$,
    size = "md",
    name,
    label = "Pick color",
    class: className,
    ...rest
  } = props;
  // e-store's: the third argument is the prop-sync channel (without it `value` is write-once);
  // `state` is a narrowed view of the same props proxy, so `children` is not captured.
  const state: { value?: string } = props;
  const color = useBoundSignal(
    bindValue,
    valueProp ?? "#6750a4",
    useComputed$(() => state.value),
  );
  const v = colorPickerVariants({ size });

  return (
    <label
      {...rest}
      class={[v.swatchLabel(), className]}
      style={{ backgroundColor: color.value }}
      data-qds-color-picker-swatch=""
    >
      <span class="sr-only">{label}</span>
      <input
        type="color"
        name={name}
        value={color.value}
        onInput$={(_, el) => {
          color.value = el.value;
          onChange$?.(el.value);
        }}
        class={v.swatchInput()}
      />
    </label>
  );
});

export const ColorPicker = {
  Swatch: ColorPickerSwatch,
};
