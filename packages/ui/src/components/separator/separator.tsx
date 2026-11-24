import { component$ } from "@qwik.dev/core";
import type { PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";

/**
 * Material Design 3 divider: a 1dp line in `outline-variant`, full width, inset or middle inset,
 * horizontal or vertical. e-store's `Separator` (name, element, `orientation`, `decorative`)
 * plus M3's inset kinds (`variant`), which e-store lacks.
 *
 * @see https://m3.material.io/components/divider/specs
 * @see https://www.w3.org/TR/wai-aria-1.2/#separator
 */
export const separatorVariants = tv({
  base: ["shrink-0", "border-0", "bg-outline-variant"],
  variants: {
    orientation: {
      horizontal: ["h-px", "self-stretch"],
      vertical: ["w-px", "self-stretch"],
    },
    /**
     * M3: full width; inset (16dp from the leading edge, 0 at the end); middle inset (16dp both
     * ends). On a vertical divider the inset is at the top (block start).
     */
    variant: {
      fullWidth: "",
      inset: "",
      middleInset: "",
    },
  },
  compoundVariants: [
    { orientation: "horizontal", variant: "inset", class: "ms-4" },
    { orientation: "horizontal", variant: "middleInset", class: "mx-4" },
    { orientation: "vertical", variant: "inset", class: "mt-4" },
    { orientation: "vertical", variant: "middleInset", class: "my-4" },
  ],
  defaultVariants: { orientation: "horizontal", variant: "fullWidth" },
});

export type SeparatorOrientation = NonNullable<
  VariantProps<typeof separatorVariants>["orientation"]
>;
export type SeparatorVariant = NonNullable<
  VariantProps<typeof separatorVariants>["variant"]
>;

export type SeparatorProps = Omit<PropsOf<"div">, "role" | "children"> & {
  /** Direction of the line. Default `horizontal`. */
  orientation?: SeparatorOrientation;
  /** M3 kind: `fullWidth` (default), `inset`, `middleInset`. */
  variant?: SeparatorVariant;
  /** Purely visual: `role="none"` instead of `role="separator"`. Default `false` (e-store's). */
  decorative?: boolean;
};

/** A Material 3 divider line. */
export const Separator = component$<SeparatorProps>(
  ({
    orientation = "horizontal",
    variant = "fullWidth",
    decorative = false,
    class: className,
    ...rest
  }) => {
    return (
      <div
        {...rest}
        role={decorative ? "none" : "separator"}
        // `separator` defaults to horizontal (WAI-ARIA), so only the vertical one says so.
        aria-orientation={
          !decorative && orientation === "vertical" ? "vertical" : undefined
        }
        data-orientation={orientation}
        class={[separatorVariants({ orientation, variant }), className]}
      />
    );
  },
);
