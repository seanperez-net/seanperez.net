import { $, Slot, component$, useId } from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { useBindings } from "../../utils/bindings";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 chip, from e-store's `components/chip/chip.tsx` (2026-11-23). Four types:
 * assist (an action), filter (a toggle, `aria-pressed`), input (a piece of user input, with an
 * optional remove button) and suggestion.
 * Specs: https://m3.material.io/components/chips/specs
 * Colours and sizes: material-web tokens v0_192 (`_md-comp-{assist,filter,input,suggestion}-chip.scss`).
 *
 * Added 2026-11-23 from e-store: `size="sm"`, `appearance` (filter: outlined / tonal / text),
 * `shape="pill"`, `tone` (assist: default / primary / error). Only `md`, outlined, default shape
 * and default tone are M3; the rest are e-store's store looks (NOT PROOFED, no M3 source).
 * Left out: `ChipField` (a 600-line text field that makes chips; see chip.md).
 *
 * Changed from e-store (see chip.md "Where it differs"):
 * - The leading icon is an icon NAME (`IconName`), drawn at 18dp in M3's icon colour (primary;
 *   on-surface-variant on an unselected input chip; on-secondary-container on a selected filter
 *   chip). e-store took JSX and painted it the label colour.
 * - The elevated container is M3's `surface-container-low` (e-store: its own floating surface).
 * - Disabled styles also key on `aria-disabled`, so the input chip's `<span>` greys out.
 * - 48dp touch targets (`touch-target`) on the chip and the remove button.
 * - `{...rest}` first; `onClick$` is forwarded by name.
 */
export const chipVariants = tv({
  base: [
    "relative inline-flex shrink-0 items-center justify-center",
    "cursor-pointer select-none",
    "transition-[background-color,box-shadow] duration-short-4 ease-standard motion-reduce:transition-none",
    // M3 focus ring, outward, following the chip's shape (md-chip's md-focus-ring).
    "focus-ring",
    "touch-target",
    // State layer (::before).
    "before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0 before:content-['']",
    "before:pointer-events-none before:transition-opacity before:duration-short-2",
    "hover:before:opacity-hover focus-visible:before:opacity-focus active:before:opacity-pressed",
    // Disabled: label on-surface 38%.
    "disabled:pointer-events-none disabled:cursor-default disabled:text-on-surface/38",
    "aria-disabled:pointer-events-none aria-disabled:cursor-default aria-disabled:text-on-surface/38",
    "disabled:*:data-qds-icon:text-on-surface/38 aria-disabled:*:data-qds-icon:text-on-surface/38",
  ],
  variants: {
    /**
     * `md` (default): M3's 32dp chip. `sm`: e-store's 24dp compact chip (pill, label-small, 16dp
     * icons); NOT an M3 size, NOT PROOFED. The 48dp target stays.
     */
    size: {
      md: [
        "h-8 gap-2 px-4",
        // 8dp before a leading icon, 8dp after a trailing action (M3), found with :has().
        "has-[>[data-qds-chip-leading]]:ps-2 has-[>[data-qds-chip-trailing]]:pe-2",
      ],
      sm: [
        "h-6 gap-1 rounded-full px-2 text-label-small",
        "has-[>[data-qds-chip-leading]]:ps-1.5 has-[>[data-qds-chip-trailing]]:pe-1.5",
      ],
    },
    // Colours per type live in compoundVariants (`tone`, `appearance`): lite `tv()` does not
    // merge, so two text / border colours side by side would win by stylesheet order.
    type: {
      assist: "",
      filter: "aria-pressed:disabled:bg-on-surface/12",
      input: [
        "text-on-surface-variant before:bg-on-surface-variant",
        "*:data-qds-chip-leading:text-on-surface-variant",
      ],
      suggestion: [
        "text-on-surface-variant before:bg-on-surface-variant",
        "*:data-qds-chip-leading:text-primary",
      ],
    },
    /** Over content (an image, a map): a shadow and a filled container instead of the outline. */
    elevated: {
      true: [
        "border border-transparent bg-surface-container-low shadow-1 hover:shadow-2 active:shadow-1",
        "disabled:bg-on-surface/12 disabled:shadow-0 aria-disabled:bg-on-surface/12 aria-disabled:shadow-0",
      ],
      false: "",
    },
    /**
     * Filter chips only (e-store's). `outlined` (default): M3's. `tonal`: a surface-container-low
     * fill with a matching 2dp border; selected primary-container, 2dp primary border. `text`:
     * bare text (body-large), selected as `tonal`. tonal and text are e-store's store.google.com
     * looks, NOT in M3, NOT PROOFED.
     */
    appearance: {
      outlined: "",
      tonal: "",
      text: "",
    },
    /** `md` corners: `default` is M3's 8dp; `pill` fully round (e-store's). `sm` is always a pill. */
    shape: {
      default: "",
      pill: "rounded-full",
    },
    /**
     * Assist chips only (e-store's): label, icon and state-layer colour. `default` on-surface
     * (M3); `primary` for a chip showing a chosen value; `error` for one flagging a problem.
     * Theme roles, NOT in M3's chip tokens.
     */
    tone: {
      default: "",
      primary: "",
      error: "",
    },
  },
  compoundVariants: [
    // The 1dp outline (M3), unless elevated or a tonal / text filter chip.
    {
      type: ["assist", "input", "suggestion"],
      elevated: false,
      class:
        "border border-outline bg-transparent disabled:border-on-surface/12 aria-disabled:border-on-surface/12",
    },
    {
      type: "filter",
      appearance: "outlined",
      elevated: false,
      // A selected filter chip has no outline (M3 `flat-selected-outline-width: 0`).
      class:
        "border border-outline bg-transparent disabled:border-on-surface/12 aria-pressed:border-transparent",
    },
    { size: "md", shape: "default", class: "rounded-sm" },
    // Type scale: label-large, or body-large for a `text` filter chip.
    {
      size: "md",
      appearance: ["outlined", "tonal"],
      class: "text-label-large",
    },
    { size: "md", appearance: "text", class: "text-body-large" },
    // Input chips: 12dp leading space (M3).
    { size: "md", type: "input", class: "ps-3" },
    // Assist tones.
    {
      type: "assist",
      tone: "default",
      class:
        "text-on-surface before:bg-on-surface *:data-qds-chip-leading:text-primary",
    },
    {
      type: "assist",
      tone: "primary",
      class:
        "text-primary before:bg-primary *:data-qds-chip-leading:text-primary",
    },
    {
      type: "assist",
      tone: "error",
      class: "text-error before:bg-error *:data-qds-chip-leading:text-error",
    },
    // Filter appearances.
    {
      type: "filter",
      appearance: "outlined",
      class: [
        "text-on-surface-variant before:bg-on-surface-variant",
        "*:data-qds-chip-leading:text-primary",
        "aria-pressed:bg-secondary-container aria-pressed:text-on-secondary-container",
        "aria-pressed:before:bg-on-secondary-container",
        "aria-pressed:*:data-qds-chip-leading:text-on-secondary-container",
      ],
    },
    {
      type: "filter",
      appearance: "tonal",
      elevated: false,
      class: "border-2 border-surface-container-low bg-surface-container-low",
    },
    {
      type: "filter",
      appearance: "text",
      elevated: false,
      class: "border-2 border-transparent bg-transparent",
    },
    {
      type: "filter",
      appearance: ["tonal", "text"],
      class: [
        "text-on-surface before:bg-on-surface",
        "*:data-qds-chip-leading:text-on-surface",
        "aria-pressed:border-primary aria-pressed:bg-primary-container aria-pressed:text-on-primary-container",
        "aria-pressed:before:bg-on-primary-container",
        "aria-pressed:*:data-qds-chip-leading:text-on-primary-container",
        "disabled:border-transparent aria-pressed:disabled:border-transparent",
      ],
    },
  ],
  defaultVariants: {
    size: "md",
    type: "assist",
    elevated: false,
    appearance: "outlined",
    shape: "default",
    tone: "default",
  },
});

export type ChipProps = Omit<
  PropsOf<"button">,
  "type" | "onClick$" | "children"
> &
  Omit<VariantProps<typeof chipVariants>, "type" | "size"> & {
    /** `md` (32dp, M3, default) or `sm` (24dp, e-store's compact chip). */
    size?: "md" | "sm";
    /** Filter chips: `outlined` (M3, default), `tonal` or `text` (e-store's). */
    appearance?: "outlined" | "tonal" | "text";
    /** `md` corners: `default` (8dp, M3) or `pill`. */
    shape?: "default" | "pill";
    /** Assist chips: `default` (M3), `primary` (a chosen value) or `error` (a problem). */
    tone?: "default" | "primary" | "error";
    /** M3 chip type. */
    type?: "assist" | "filter" | "input" | "suggestion";
    /** The chip's text. A prop, so a CMS can store it. Children are used when it is absent. */
    label?: string;
    /** A shadow and a filled container instead of the outline (assist, filter, suggestion). */
    elevated?: boolean;
    /** Filter chips: the starting state when nothing is bound. */
    selected?: boolean;
    /** Filter chips: two-way state. */
    "bind:selected"?: Signal<boolean>;
    /** Filter chips: called after the selected state changes. */
    onSelectedChange$?: QRL<(selected: boolean) => void>;
    /** Input chips: shows the remove button, and is called when it is pressed. */
    onRemove$?: QRL<() => void>;
    /** Input chips: the remove button's name, read with the chip's label ("Remove Ada"). */
    removeLabel?: string;
    /** Icon name before the label (18dp). */
    leadingIcon?: IconName;
    /** Filter chips: icon shown while selected. `null` shows none. */
    selectedIcon?: IconName | null;
    /** Input chips: the remove button's icon. */
    closeIcon?: IconName;
    disabled?: boolean;
    onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
  };

export const Chip = component$<ChipProps>((props) => {
  /* eslint-disable @typescript-eslint/no-unused-vars -- pulled out so they never reach the DOM */
  const {
    type = "assist",
    size = "md",
    appearance = "outlined",
    shape = "default",
    tone = "default",
    label,
    elevated = false,
    // Pulled out so they never reach the DOM; useBindings owns the state.
    selected: _selected,
    "bind:selected": _bindSelected,
    onSelectedChange$,
    onRemove$,
    removeLabel = "Remove",
    leadingIcon,
    selectedIcon = "check",
    closeIcon = "close",
    disabled,
    onClick$,
    class: className,
    ...rest
  } = props;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  const isFilter = type === "filter";
  const localId = useId();
  const labelId = `${localId}-label`;
  const removeId = `${localId}-remove`;
  const { selectedSig } = useBindings(props, { selected: false });

  const toggle$ = $(() => {
    if (disabled) return;
    selectedSig.value = !selectedSig.value;
    onSelectedChange$?.(selectedSig.value);
  });

  const remove$ = $(() => {
    if (!disabled) onRemove$?.();
  });

  const classes = [
    chipVariants({ type, size, elevated, appearance, shape, tone }),
    className,
  ];
  const text = label ?? <Slot />;
  // 18dp in M3's chip; 16dp in e-store's `sm` chip.
  const iconSize = size === "sm" ? "xs" : "dense";
  const leading = leadingIcon ? (
    <Icon data-qds-chip-leading="" name={leadingIcon} size={iconSize} />
  ) : null;

  // Input chip with a remove button: two SIBLING buttons in a span (a button may not hold a
  // button). The primary action covers the chip, under the remove button. The span's own
  // `touch-target` ::after would paint over the primary button (positioned, later in tree
  // order), so it takes no pointer events here and the primary button carries the 48dp target.
  // `{...rest}` goes on the primary button: it is the chip's control.
  if (type === "input" && onRemove$) {
    const ariaLabel = rest["aria-label"];
    return (
      <span
        data-qds-chip=""
        aria-disabled={disabled || undefined}
        class={[...classes, "after:pointer-events-none"]}
      >
        <button
          {...rest}
          type="button"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : labelId}
          disabled={disabled}
          class="touch-target absolute inset-0 z-0 focus-ring cursor-pointer rounded-[inherit] bg-transparent"
          onClick$={onClick$}
        />
        {leading}
        <span id={labelId} class="pointer-events-none relative truncate">
          {text}
        </span>
        {/* "{removeLabel} {label}" through aria-labelledby. */}
        <span id={removeId} hidden>
          {removeLabel}
        </span>
        <button
          type="button"
          data-qds-chip-trailing=""
          aria-labelledby={`${removeId} ${labelId}`}
          disabled={disabled}
          class="touch-target relative z-1 inline-flex size-6 shrink-0 focus-ring cursor-pointer items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface disabled:text-on-surface/38"
          onClick$={remove$}
        >
          <Icon name={closeIcon} size={iconSize} />
        </button>
      </span>
    );
  }

  return (
    <button
      {...rest}
      data-qds-chip=""
      type="button"
      aria-pressed={isFilter ? selectedSig.value : undefined}
      disabled={disabled}
      class={classes}
      onClick$={isFilter ? [toggle$, onClick$] : onClick$}
    >
      {isFilter && selectedIcon && selectedSig.value ? (
        <Icon data-qds-chip-leading="" name={selectedIcon} size={iconSize} />
      ) : (
        leading
      )}
      <span class="relative truncate">{text}</span>
    </button>
  );
});
