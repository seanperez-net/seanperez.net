import {
  $,
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
 * Material Design 3 (Expressive) toolbars, after e-store's `Toolbar` (Root / Item / Divider).
 * Specs: https://m3.material.io/components/toolbars/specs (token sets "Toolbar - Docked",
 * "Toolbar - Floating", "Toolbar - Floating - FAB", "Toolbar - Color - Standard / Vibrant", read
 * 2026-11-23) and the guidelines page.
 *
 * - Docked: full width, 64dp, 16dp leading / trailing padding, actions 4dp to 32dp apart, square
 *   corners (M3: "Use straight corners for docked toolbars"; e-store rounded the top 16dp).
 *   Evenly spread in compact windows, centred 32dp apart from 600dp (guidelines "Resizing").
 * - Floating: fully rounded, 64dp across, 8dp leading / trailing space, 4dp between actions,
 *   horizontal or vertical (M3 Expressive configuration; e-store had horizontal only), elevated.
 *   A FAB goes in `q:slot="fab"`, 8dp from the toolbar.
 * - Standard: `surface-container`; vibrant: `primary-container`.
 * - Placement is the host's: the toolbar is in the flow, not `fixed` (e-store pins it to the
 *   window; Compose's toolbars are also placed by their parent).
 */
export const toolbarVariants = tv({
  slots: {
    // Holds the toolbar and, when floating, its FAB 8dp away.
    group: ["items-center", "gap-2"],
    root: ["flex", "items-center"],
    item: [
      "relative",
      "inline-flex",
      "size-12",
      "shrink-0",
      "items-center",
      "justify-center",
      "rounded-full",
      "cursor-pointer",
      "select-none",
      "-webkit-tap-highlight-color-transparent",
      "focus-ring",
      "transition-colors",
      "duration-short-4",
      "ease-standard",
      "motion-reduce:transition-none",
      // State layer in the icon's own color (every M3 toolbar token pairs them): 8 / 10 / 10.
      "before:pointer-events-none",
      "before:absolute",
      "before:inset-0",
      "before:rounded-[inherit]",
      "before:bg-current",
      "before:opacity-0",
      "before:transition-opacity",
      "before:content-['']",
      "hover:before:opacity-8",
      "focus-visible:before:opacity-10",
      "active:before:opacity-10",
      "disabled:pointer-events-none",
      "disabled:text-on-surface/38",
    ],
    divider: ["shrink-0", "self-stretch"],
  },
  variants: {
    variant: {
      docked: {
        group: ["flex", "w-full"],
        root: [
          "w-full",
          "h-16",
          "px-4",
          "gap-1",
          "justify-between",
          "sm:justify-center",
          "sm:gap-8",
        ],
      },
      floating: {
        group: ["inline-flex"],
        root: ["rounded-full", "shadow-2", "gap-1"],
      },
    },
    orientation: {
      horizontal: {},
      vertical: {},
    },
    colorScheme: {
      standard: {
        root: ["bg-surface-container", "text-on-surface-variant"],
        divider: ["bg-outline-variant"],
      },
      vibrant: {
        root: ["bg-primary-container", "text-on-primary-container"],
        divider: ["bg-on-primary-container/20"],
      },
    },
    itemStyle: {
      standard: {},
      filled: {},
    },
  },
  compoundVariants: [
    {
      variant: "floating",
      orientation: "horizontal",
      class: { root: ["h-16", "px-2"], divider: ["w-px", "my-2"] },
    },
    {
      variant: "floating",
      orientation: "vertical",
      class: {
        root: ["w-16", "py-2", "flex-col"],
        group: ["flex-col"],
        divider: ["h-px", "mx-2"],
      },
    },
    { variant: "docked", class: { divider: ["w-px", "my-2"] } },
    // Item colors. Standard: icon `on-surface-variant`; a selected toggle on
    // `secondary-container` / `on-secondary-container`.
    {
      colorScheme: "standard",
      itemStyle: "standard",
      class: {
        item: [
          "text-on-surface-variant",
          "aria-pressed:bg-secondary-container",
          "aria-pressed:text-on-secondary-container",
        ],
      },
    },
    // Vibrant: icon `on-primary-container`; a selected toggle on `surface-container` / `on-surface`.
    {
      colorScheme: "vibrant",
      itemStyle: "standard",
      class: {
        item: [
          "text-on-primary-container",
          "aria-pressed:bg-surface-container",
          "aria-pressed:text-on-surface",
        ],
      },
    },
    // Filled (both schemes): `primary` / `on-primary`; disabled container on-surface 10%.
    {
      itemStyle: "filled",
      class: {
        item: ["bg-primary", "text-on-primary", "disabled:bg-on-surface/10"],
      },
    },
    {
      itemStyle: "standard",
      class: { item: ["aria-pressed:disabled:bg-on-surface/10"] },
    },
  ],
  defaultVariants: {
    variant: "docked",
    orientation: "horizontal",
    colorScheme: "standard",
    itemStyle: "standard",
  },
});

export type ToolbarVariant = "docked" | "floating";
export type ToolbarColorScheme = "standard" | "vibrant";
export type ToolbarOrientation = "horizontal" | "vertical";
export type ToolbarItemStyle = "standard" | "filled";

type ToolbarContextValue = {
  variant: Readonly<Signal<ToolbarVariant>>;
  colorScheme: Readonly<Signal<ToolbarColorScheme>>;
  orientation: Readonly<Signal<ToolbarOrientation>>;
};

const toolbarContextId = createContextId<ToolbarContextValue>(
  "net.seanperez.ui.toolbar",
);

export type ToolbarRootProps = PropsOf<"div"> & {
  /** `docked` (default): full width, square. `floating`: a rounded, elevated container. */
  variant?: ToolbarVariant;
  /** `standard` (default, `surface-container`) or `vibrant` (`primary-container`). */
  colorScheme?: ToolbarColorScheme;
  /** Floating only: `horizontal` (default) or `vertical`. A docked toolbar is horizontal. */
  orientation?: ToolbarOrientation;
  /** Name of the toolbar (required: WAI-ARIA toolbar). */
  "aria-label": string;
};

/**
 * The toolbar (`role="toolbar"`) inside a group element. Slots: the default one (`Toolbar.Item`s,
 * or any button, icon button or text field) and `fab` (M3: a FAB beside a FLOATING toolbar).
 * `class` goes on the group (the outermost element), the other props on the toolbar.
 */
// Destructured in the parameter, as `ToggleGroup`: the optimizer keeps those reads reactive.
const ToolbarRoot = component$<ToolbarRootProps>(
  ({
    variant: givenVariant,
    colorScheme: givenColorScheme,
    orientation: givenOrientation,
    class: className,
    onKeyDown$,
    ...rest
  }) => {
    const variant = useComputed$<ToolbarVariant>(
      () => givenVariant ?? "docked",
    );
    const colorScheme = useComputed$<ToolbarColorScheme>(
      () => givenColorScheme ?? "standard",
    );
    // A docked toolbar is always horizontal (M3: only at the bottom of the window).
    const orientation = useComputed$<ToolbarOrientation>(() =>
      givenVariant === "floating"
        ? (givenOrientation ?? "horizontal")
        : "horizontal",
    );
    useContextProvider(toolbarContextId, { variant, colorScheme, orientation });
    return (
      <div
        class={[
          toolbarVariants({
            variant: variant.value,
            orientation: orientation.value,
          }).group(),
          className,
        ]}
        data-qds-toolbar-group=""
      >
        <div
          {...rest}
          role="toolbar"
          aria-orientation={orientation.value}
          data-qds-toolbar=""
          data-variant={variant.value}
          class={toolbarVariants({
            variant: variant.value,
            colorScheme: colorScheme.value,
            orientation: orientation.value,
          }).root()}
          // M3 toolbar accessibility: "Tab or Arrows" move between the actions.
          data-roving=""
          onKeyDown$={[rovingKeys, onKeyDown$]}
        >
          <Slot />
        </div>
        <Slot name="fab" />
      </div>
    );
  },
);

export type ToolbarItemProps = Omit<
  PropsOf<"button">,
  "children" | "onClick$" | "type"
> & {
  icon: IconName;
  /** What the action does: its accessible name and hover title. */
  label: string;
  /** `standard` (default): no fill. `filled`: `primary`, for the one emphasised action. */
  itemStyle?: ToolbarItemStyle;
  /** M3's toggle button: a click flips `selected`, shown by `aria-pressed` and a tonal fill. */
  toggle?: boolean;
  /** The toggle's state. Follows the prop when it changes. */
  selected?: boolean;
  /** Two-way binding for the toggle's state. */
  "bind:selected"?: Signal<boolean>;
  /** Called with the new state after a click flips it. */
  onSelectedChange$?: QRL<(selected: boolean) => void>;
  /** The icon while selected (a filled one), e.g. `star_filled`. */
  iconSelected?: IconName;
  onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
  /** `submit` (with the native `form` attribute) lets an action submit a form. */
  type?: "button" | "submit" | "reset";
};

/** An action: an icon button in the toolbar's colors. */
const ToolbarItem = component$<ToolbarItemProps>((props) => {
  const {
    icon,
    label,
    itemStyle = "standard",
    toggle = false,
    selected: selectedProp,
    "bind:selected": bindSelected,
    onSelectedChange$,
    iconSelected,
    onClick$,
    type = "button",
    class: className,
    ...rest
  } = props;
  const ctx = useContext(toolbarContextId);
  const reactiveProps: Pick<ToolbarItemProps, "selected"> = props;
  const selected = useBoundSignal(
    bindSelected,
    selectedProp ?? false,
    useComputed$(() => reactiveProps.selected),
  );
  const flip$ = $(() => {
    selected.value = !selected.value;
    if (onSelectedChange$) onSelectedChange$(selected.value);
  });
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      aria-pressed={toggle ? selected.value : undefined}
      class={[
        toolbarVariants({
          colorScheme: ctx.colorScheme.value,
          itemStyle,
        }).item(),
        className,
      ]}
      onClick$={toggle ? [flip$, onClick$] : onClick$}
    >
      <Icon
        name={toggle && iconSelected && selected.value ? iconSelected : icon}
      />
    </button>
  );
});

export type ToolbarDividerProps = PropsOf<"div">;

/** A separator between groups of actions (M3: on large screens, for many actions). */
const ToolbarDivider = component$<ToolbarDividerProps>(
  ({ class: className, ...rest }) => {
    const ctx = useContext(toolbarContextId);
    return (
      <div
        {...rest}
        role="separator"
        aria-orientation={
          ctx.orientation.value === "vertical" ? "horizontal" : "vertical"
        }
        class={[
          toolbarVariants({
            variant: ctx.variant.value,
            colorScheme: ctx.colorScheme.value,
            orientation: ctx.orientation.value,
          }).divider(),
          className,
        ]}
      />
    );
  },
);

export const Toolbar = {
  Root: ToolbarRoot,
  Item: ToolbarItem,
  Divider: ToolbarDivider,
};
