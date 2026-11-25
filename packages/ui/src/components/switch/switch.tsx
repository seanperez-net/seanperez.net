import { component$, useId } from "@qwik.dev/core";
import type { PropsOf, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { useBindings } from "../../utils/bindings";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 switch.
 * Specs: https://m3.material.io/components/switch/specs
 * Tokens: material-web v0_192 `_md-comp-switch.scss`.
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/switch/
 *
 * OURS, kept over e-store's nine-part compound (compared 2026-11-23, see switch.md): the native
 * checkbox with `role="switch"` IS the track and the control, so Space, form submission,
 * `disabled`, `required` and the label association are the browser's. Taken from e-store: the
 * `icons` / `showOnlySelectedIcon` options, the `focus-ring` utility and the focus colors.
 *
 * Track 52 x 32 with a 2dp outline. Off: 16dp handle in `outline`. On: `primary` track, 24dp
 * handle in `on-primary`. With icons the handle is 24dp in both states. Pressed: 28dp.
 *
 * Added 2026-11-23 from e-store: `size="sm"` (e-store's 0.75 scale: track 39 x 24, handle 12 /
 * 18 / pressed 21, icons 12; NOT an M3 size, M3 has one switch, so NOT PROOFED), and its
 * Description and Error parts as `description` / `error` props (our switch is one component):
 * both are referenced by the input's `aria-describedby`; `error` also sets `aria-invalid`.
 */
export const switchVariants = tv({
  slots: {
    root: [
      // The whole row is the switch's label: 32dp high to the eye, 48dp to the pointer (M3).
      "group/switch touch-target relative inline-flex items-start gap-3",
      "cursor-pointer text-body-large text-on-surface",
      "has-disabled:cursor-default has-disabled:text-on-surface/38",
    ],
    control: ["relative inline-flex shrink-0"],
    /** The label, the description and the error, stacked beside the switch. */
    text: ["grid min-h-full self-center"],
    description: [
      "text-body-small text-on-surface-variant group-has-disabled/switch:text-on-surface/38",
    ],
    error: [
      "text-body-small text-error group-has-disabled/switch:text-on-surface/38",
    ],
    track: [
      "peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full",
      "border-2 border-outline bg-surface-container-highest",
      "transition-colors duration-short-4 ease-standard motion-reduce:transition-none",
      "checked:border-primary checked:bg-primary",
      // M3 focus ring, outward around the track (md-switch's md-focus-ring).
      "focus-ring",
      // Disabled: the whole track at 12% (M3 `disabled-track-opacity`).
      "disabled:cursor-default disabled:border-on-surface/12 disabled:bg-surface-container-highest/12",
      "disabled:checked:border-transparent disabled:checked:bg-on-surface/12",
    ],
    handle: [
      "pointer-events-none absolute top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full",
      "bg-outline",
      "transition-all duration-short-4 ease-standard motion-reduce:transition-none",
      // M3 state layer: a 40dp circle around the handle, on-surface off, primary on.
      // Physical `left-1/2` on purpose (L10 exception): centring is the same in both directions;
      // `inset-s-1/2` with `-translate-1/2` would sit off-centre in right-to-left.
      "before:absolute before:top-1/2 before:left-1/2 before:size-10 before:-translate-1/2 before:rounded-full",
      "before:bg-on-surface before:opacity-0 before:transition-opacity before:content-['']",
      "peer-checked:before:bg-primary",
      "peer-hover:before:opacity-hover peer-focus-visible:before:opacity-focus peer-active:before:opacity-pressed",
      "peer-disabled:before:hidden",
      // Hover, focus and pressed handle colors (M3: the same for all three).
      "peer-hover:bg-on-surface-variant peer-focus-visible:bg-on-surface-variant peer-active:bg-on-surface-variant",
      "peer-checked:bg-on-primary",
      "peer-checked:peer-hover:bg-primary-container peer-checked:peer-focus-visible:bg-primary-container peer-checked:peer-active:bg-primary-container",
      // Disabled: off on-surface 38%, on surface 100% (M3).
      "peer-disabled:bg-on-surface/38 peer-disabled:peer-checked:bg-surface",
    ],
    /** The check, while on: on-primary-container (M3 `selected-icon-color`). */
    onIcon: [
      "hidden group-has-checked/switch:block",
      "text-on-primary-container group-has-disabled/switch:text-on-surface/38",
    ],
    /** The cross, while off: surface-container-highest (M3 `unselected-icon-color`). */
    offIcon: [
      "block group-has-checked/switch:hidden",
      "text-surface-container-highest group-has-disabled/switch:text-surface-container-highest/38",
    ],
  },
  variants: {
    /** `both`: check and cross, the handle always 24dp. `selected`: the check only, when on. */
    // The unchecked size lives here, not in the base: two `size-*` classes on one element win by
    // stylesheet order (no tailwind-merge), not by intent.
    icons: {
      none: {},
      selected: {},
      both: {},
    },
    /**
     * `md` (default): M3's switch. `sm`: e-store's 0.75 scale. Checked and pressed handles here;
     * the unchecked handle per `icons` in compoundVariants (two `size-*` would race).
     */
    size: {
      md: {
        control: "h-8 w-13",
        handle: [
          "peer-checked:inset-s-6 peer-checked:size-6",
          // Pressed: 28dp, centred where the handle was.
          "peer-active:inset-s-0.5 peer-active:size-7",
          "peer-checked:peer-active:inset-s-5.5 peer-checked:peer-active:size-7",
          "peer-disabled:peer-checked:peer-active:inset-s-6 peer-disabled:peer-checked:peer-active:size-6",
        ],
      },
      sm: {
        control: "h-6 w-9.75",
        handle: [
          "peer-checked:inset-s-4.5 peer-checked:size-4.5",
          // Pressed: 21dp.
          "peer-active:inset-s-[1.5px] peer-active:size-5.25",
          "peer-checked:peer-active:inset-s-[16.5px] peer-checked:peer-active:size-5.25",
          "peer-disabled:peer-checked:peer-active:inset-s-4.5 peer-disabled:peer-checked:peer-active:size-4.5",
          // 12dp icons (e-store's).
          "[&_svg]:size-3",
        ],
      },
    },
  },
  compoundVariants: [
    {
      size: "md",
      icons: ["none", "selected"],
      class: {
        handle:
          "inset-s-2 size-4 peer-disabled:peer-active:inset-s-2 peer-disabled:peer-active:size-4",
      },
    },
    {
      size: "md",
      icons: "both",
      class: {
        handle:
          "inset-s-1 size-6 peer-disabled:peer-active:inset-s-1 peer-disabled:peer-active:size-6",
      },
    },
    {
      size: "sm",
      icons: ["none", "selected"],
      class: {
        handle:
          "inset-s-1.5 size-3 peer-disabled:peer-active:inset-s-1.5 peer-disabled:peer-active:size-3",
      },
    },
    {
      size: "sm",
      icons: "both",
      class: {
        handle:
          "inset-s-0.75 size-4.5 peer-disabled:peer-active:inset-s-0.75 peer-disabled:peer-active:size-4.5",
      },
    },
  ],
  defaultVariants: { icons: "none", size: "md" },
});

export type SwitchProps = Omit<
  PropsOf<"input">,
  // `size` is the input's character width: meaningless on a checkbox, so ours.
  "type" | "role" | "checked" | "bind:checked" | "children" | "size"
> & {
  /** The text beside the switch. */
  label?: string;
  /** The state when no signal is bound; a new value from the parent is adopted. */
  checked?: boolean;
  /** Two-way state: the parent's signal is read and written. */
  "bind:checked"?: Signal<boolean>;
  /** Icons in the handle (M3): `both` check and cross, or `selected` (check only). */
  icons?: "none" | "selected" | "both";
  /** Icon shown while on. */
  checkIcon?: IconName;
  /** Icon shown while off (`icons="both"`). */
  uncheckIcon?: IconName;
  /** `md` (default, M3) or `sm` (e-store's 0.75 scale). */
  size?: "sm" | "md";
  /** A line under the label (e-store's `Switch.Description`), read as the input's description. */
  description?: string;
  /** An error under the label (e-store's `Switch.Error`): read as a description, `aria-invalid`. */
  error?: string;
};

/** A Material 3 switch: a checkbox with the switch role, and its label. */
export const Switch = component$<SwitchProps>((props) => {
  /* eslint-disable @typescript-eslint/no-unused-vars -- pulled out so they never reach the DOM */
  const {
    label,
    checked: _checked,
    "bind:checked": _bindChecked,
    icons = "none",
    checkIcon = "check",
    uncheckIcon = "close",
    size = "md",
    description,
    error,
    class: className,
    "aria-describedby": describedBy,
    ...rest
  } = props;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  // `useBindings` (as Chip, Radio): a parent that re-renders with a new `checked` moves it;
  // `useBoundSignal` alone only seeded it.
  const { checkedSig } = useBindings(props, { checked: false });
  const styles = switchVariants({ icons, size });
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const labelId = `${id}-label`;
  // With a description or an error, the <label> also holds their text, which would join the
  // switch's NAME (HTML-AAM: a label's whole subtree names its control). The label text then
  // names it by id, and the other two only describe it.
  const hasText = !!(description || error);
  // The caller's own ids first, then ours (only for parts that render).
  const describedByIds =
    [
      describedBy,
      description ? descriptionId : undefined,
      error ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <label data-qds-switch="" class={[styles.root(), className]}>
      <span class={styles.control()}>
        <input
          {...rest}
          type="checkbox"
          role="switch"
          bind:checked={checkedSig}
          aria-labelledby={
            hasText && label
              ? (rest["aria-labelledby"] ?? labelId)
              : rest["aria-labelledby"]
          }
          aria-describedby={describedByIds}
          aria-invalid={error && !rest.disabled ? "true" : undefined}
          class={styles.track()}
        />
        <span class={styles.handle()}>
          {icons !== "none" && (
            <Icon name={checkIcon} size="xs" class={styles.onIcon()} />
          )}
          {icons === "both" && (
            <Icon name={uncheckIcon} size="xs" class={styles.offIcon()} />
          )}
        </span>
      </span>
      {hasText ? (
        <span class={styles.text()}>
          {label && <span id={labelId}>{label}</span>}
          {description && (
            <span id={descriptionId} class={styles.description()}>
              {description}
            </span>
          )}
          {error && (
            <span id={errorId} class={styles.error()}>
              {error}
            </span>
          )}
        </span>
      ) : (
        label
      )}
    </label>
  );
});
