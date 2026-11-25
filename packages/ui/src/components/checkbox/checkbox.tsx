import {
  $,
  component$,
  useId,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";
import type { ClassList, PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { destructureBindings, useBindings } from "../../utils/bindings";

/**
 * Material Design 3 checkbox. From e-store's `components/checkbox/checkbox.tsx` (2026-11-23).
 * Specs: https://m3.material.io/components/checkbox/specs
 * Pattern: a native `<input type="checkbox">` (https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
 * recommends the native element).
 *
 * e-store's anatomy, kept: the native input is the control (form value, `Space`, `required`,
 * form reset), drawn invisible (`appearance: none`) as the 40dp state-layer circle that carries
 * the M3 focus ring; the 18dp box and the tick are siblings painted from its state with `peer-*`
 * (no JavaScript in the paint). The tick draws itself (180ms in, 90ms out, e-store's).
 *
 * Changed from e-store (PROOFED 2026-11-23 against material-web
 * `tokens/versions/v0_192/_md-comp-checkbox.scss`, ARIA in HTML, and the M3 page):
 * - No `aria-checked` on the input: ARIA in HTML says authors MUST NOT set it on
 *   `input type=checkbox` (the native state and the `indeterminate` property say it).
 * - The 40dp circle and the 48dp touch target (`touch-target`) are there WITH a label too, and the
 *   state layer is painted on the circle: `on-surface` 8% hover / 10% focus, `primary` when
 *   checked; pressed is `primary` 12% unchecked and `on-surface` 12% checked (tokens). e-store
 *   painted a state layer only on a label-less checkbox, always `on-surface`.
 * - Hover, focus and press turn the unchecked outline `on-surface` (tokens; e-store kept
 *   `on-surface-variant`).
 * - Disabled: unchecked outline `on-surface` 38%; checked box `on-surface` 38% with a `surface`
 *   tick (tokens). e-store faded the whole box to 38%, so a disabled checked box stayed `primary`.
 * Added 2026-11-23: e-store's color props (`accentColor`, `checkmarkColor`, `uncheckedColor`,
 * `uncheckedBgColor`, with `contrastingCheckmark`) as CSS variables over the M3 roles, and its
 * `touch-state-layer`; M3's error state (`error`, material-web `_md-comp-checkbox.scss`
 * `*-error-*` tokens; new, not in e-store).
 * Left out: e-store's Layout-driven `density` (our Layout has no compact mode), `touch-wrapper`
 * (our 40dp circle and 48dp target are always there, M3) and `CheckboxUnstyled` (a headless
 * copy, not a variant).
 */
export const checkboxVariants = tv({
  slots: {
    root: [
      "group/checkbox",
      "relative",
      "inline-flex",
      "items-center",
      // 8dp: the focus ring reaches 5dp past the 40dp circle.
      "gap-2",
      "cursor-pointer",
      "has-disabled:cursor-default",
      "-webkit-tap-highlight-color-transparent",
    ],
    /** The 40dp box the input, the drawn box and the tick share; 48dp to the pointer. */
    control: [
      "touch-target",
      "relative",
      "inline-flex",
      "size-10",
      "shrink-0",
      "items-center",
      "justify-center",
    ],
    /** The input: the invisible 40dp state-layer circle that carries the focus ring. */
    input: [
      "peer",
      "absolute",
      "inset-0",
      "m-0",
      "size-10",
      "cursor-pointer",
      "appearance-none",
      "rounded-full",
      "border-0",
      "bg-transparent",
      "focus-ring",
      "transition-colors",
      "duration-short-2",
      "ease-standard",
      "motion-reduce:transition-none",
      "disabled:cursor-default",
      "disabled:bg-transparent",
      "disabled:group-hover/checkbox:bg-transparent",
    ],
    /** The visible 18dp box, 2dp corners, 2dp outline. The indeterminate dash is its `::before`. */
    box: [
      "pointer-events-none",
      "relative",
      "block",
      "size-4.5",
      "rounded-[2px]",
      "border-2",
      // The color props arrive as CSS variables; without them, the M3 roles.
      "border-(--checkbox-unchecked,var(--color-on-surface-variant))",
      "bg-(--checkbox-unchecked-bg,transparent)",
      "transition-colors",
      "duration-90",
      "ease-standard",
      "motion-reduce:transition-none",
      "group-hover/checkbox:border-(--checkbox-unchecked,var(--color-on-surface))",
      "peer-focus-visible:border-(--checkbox-unchecked,var(--color-on-surface))",
      "peer-active:border-(--checkbox-unchecked,var(--color-on-surface))",
      "peer-checked:border-(--checkbox-accent,var(--color-primary))",
      "peer-checked:bg-(--checkbox-accent,var(--color-primary))",
      "peer-checked:group-hover/checkbox:border-(--checkbox-accent,var(--color-primary))",
      "peer-data-indeterminate:border-(--checkbox-accent,var(--color-primary))",
      "peer-data-indeterminate:bg-(--checkbox-accent,var(--color-primary))",
      "peer-data-indeterminate:group-hover/checkbox:border-(--checkbox-accent,var(--color-primary))",
      // M3 error (the input's `aria-invalid`): `error` outline, `error` fill, `on-error` mark.
      "peer-aria-invalid:border-error",
      "peer-aria-invalid:group-hover/checkbox:border-error",
      "peer-aria-invalid:peer-focus-visible:border-error",
      "peer-aria-invalid:peer-active:border-error",
      "peer-aria-invalid:peer-checked:border-error",
      "peer-aria-invalid:peer-checked:bg-error",
      "peer-aria-invalid:peer-data-indeterminate:border-error",
      "peer-aria-invalid:peer-data-indeterminate:bg-error",
      "peer-aria-invalid:before:bg-on-error",
      "peer-disabled:border-on-surface/38",
      "peer-disabled:group-hover/checkbox:border-on-surface/38",
      "peer-disabled:peer-checked:border-transparent",
      "peer-disabled:peer-checked:bg-on-surface/38",
      "peer-disabled:peer-data-indeterminate:border-transparent",
      "peer-disabled:peer-data-indeterminate:bg-on-surface/38",
      "before:absolute",
      "before:-inset-0.5",
      "before:content-['']",
      "before:bg-(--checkbox-checkmark,var(--color-on-primary))",
      "before:opacity-0",
      "before:[clip-path:polygon(15%_42%,15%_58%,85%_58%,85%_42%)]",
      "peer-data-indeterminate:before:opacity-100",
      "peer-disabled:before:bg-surface",
    ],
    /** e-store's tick geometry; it draws along its path (stroke-dashoffset). */
    mark: [
      "pointer-events-none",
      "absolute",
      "inset-0",
      "m-auto",
      "size-4.5",
      "fill-none",
      "stroke-(--checkbox-checkmark,var(--color-on-primary))",
      "peer-aria-invalid:stroke-on-error",
      "stroke-[4.25px]",
      "[stroke-linecap:butt]",
      "[stroke-linejoin:miter]",
      "[stroke-dasharray:25px]",
      "[stroke-dashoffset:25px]",
      "peer-checked:[stroke-dashoffset:0px]",
      "peer-disabled:stroke-surface",
      // Unchecking: 90ms, accelerating; checking: 180ms, decelerating.
      "transition-[stroke-dashoffset]",
      "duration-90",
      "ease-[cubic-bezier(0.4,0,1,1)]",
      "peer-checked:duration-180",
      "peer-checked:ease-[cubic-bezier(0,0,0.2,1)]",
      "motion-reduce:transition-none",
    ],
    // `relative`: painted above the ring where it reaches into the gap (e-store's).
    label: [
      "relative",
      "text-body-medium",
      "text-on-surface",
      "select-none",
      "group-has-disabled/checkbox:text-on-surface/38",
    ],
  },
  variants: {
    /**
     * The 40dp circle's own hover / focus / press layer (M3 tokens). e-store's
     * `touch-state-layer={false}`: off where a row already paints one (a list item).
     */
    stateLayer: {
      true: {
        input: [
          "group-hover/checkbox:bg-on-surface/8",
          "focus-visible:bg-on-surface/10",
          "active:bg-primary/12",
          "checked:group-hover/checkbox:bg-primary/8",
          "checked:focus-visible:bg-primary/10",
          "checked:active:bg-on-surface/12",
          // M3 error: the layer is `error` (hover 8%, focus 10%, pressed 12%).
          "aria-invalid:group-hover/checkbox:bg-error/8",
          "aria-invalid:focus-visible:bg-error/10",
          "aria-invalid:active:bg-error/12",
        ],
      },
      false: { input: "" },
    },
  },
  defaultVariants: { stateLayer: true },
});

/**
 * Black or white for a tick on `color` (by its WCAG relative luminance), e-store's: what a native
 * checkbox does for `accent-color`, which the drawn box does not get for free. Parses `#rgb`,
 * `#rrggbb(aa)` and `rgb()` / `rgba()`; anything else (a named color, a `var()`) gives undefined
 * and the tick keeps `on-primary`.
 */
export function contrastingCheckmark(
  color: string,
): "black" | "white" | undefined {
  const c = color.trim();
  let rgb: number[] | undefined;
  const hex = /^#([0-9a-f]{3,8})$/i.exec(c)?.[1];
  if (hex && (hex.length === 3 || hex.length === 4))
    rgb = [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16));
  else if (hex && (hex.length === 6 || hex.length === 8))
    rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  else {
    const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
    if (m) rgb = [m[1], m[2], m[3]].map(Number);
  }
  if (!rgb || rgb.some((n) => Number.isNaN(n))) return undefined;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.5 ? "black" : "white";
}

export type CheckboxProps = Omit<
  PropsOf<"input">,
  | "type"
  | "id"
  | "value"
  | "checked"
  | "bind:checked"
  | "onChange$"
  | "children"
> & {
  /** The input's id. Default: unique per instance. */
  id?: string;
  /** The starting / controlled state. A later value from the parent replaces it. */
  checked?: boolean;
  /** Two-way state: the parent's signal is read and written. */
  "bind:checked"?: Signal<boolean>;
  /** Shows the dash. The click still sets `checked`; clear this when it does. */
  indeterminate?: boolean;
  /** The text beside the box. Without one, pass `aria-label`. */
  label?: string;
  /** Classes for the `<label>` wrapper (`class` lands on the input). Layout only. */
  labelClass?: ClassList;
  /** Called with the new state when the user toggles it. */
  onChange$?: QRL<(checked: boolean) => void>;
  /** Submitted when checked (default "on"). */
  value?: string;
  /**
   * M3 error state: `error` colors and `aria-invalid` on the input. Describe the error in text
   * too (`aria-describedby`). Ignored while `disabled`. New, not in e-store.
   */
  error?: boolean;
  /** The checked fill (any CSS color), e-store's. The tick picks black or white to contrast. */
  accentColor?: string;
  /** The tick's color: `auto` (default; black or white against `accentColor`) or a CSS color. */
  checkmarkColor?: "auto" | (string & {});
  /** The unchecked outline (any CSS color). Default `on-surface-variant`. */
  uncheckedColor?: string;
  /** The unchecked fill (any CSS color). Default transparent. */
  uncheckedBgColor?: string;
  /** The circle's own state layer (default true). Off where a row already paints one. */
  "touch-state-layer"?: boolean;
};

/**
 * Sets the input's `indeterminate` DOM PROPERTY, which has no attribute: only the client can set
 * it, and assistive technology reads it at once, so not on an interaction (e-store's). The dash
 * is painted from `data-indeterminate`, so nothing visual waits for this. A separate component,
 * rendered only when `indeterminate` is passed, so a plain checkbox runs no eager task (second
 * agent's review; e-store runs it for every checkbox).
 */
const IndeterminateSync = component$<{
  input: Signal<HTMLInputElement | undefined>;
  on: boolean;
}>((props) => {
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ track, cleanup }) => {
      const on = track(() => props.on);
      const el = props.input.value;
      if (!el) return;
      el.indeterminate = on;
      cleanup(() => {
        el.indeterminate = false;
      });
    },
    { strategy: "document-ready" },
  );
  return <></>;
});

/** The one bound key, shared by `useBindings` and `destructureBindings`. */
const CHECKBOX_BINDS: { checked: boolean } = { checked: false };

export const Checkbox = component$<CheckboxProps>((allProps) => {
  const { checkedSig: checked } = useBindings(allProps, CHECKBOX_BINDS);
  const {
    indeterminate,
    label,
    labelClass,
    onChange$,
    onInput$,
    value,
    error,
    accentColor,
    checkmarkColor = "auto",
    uncheckedColor,
    uncheckedBgColor,
    "touch-state-layer": stateLayer = true,
    id: idProp,
    class: className,
    ...rest
  } = destructureBindings(allProps, CHECKBOX_BINDS);
  const generatedId = useId();
  const styles = checkboxVariants({ stateLayer });
  // Colors reach the box as CSS variables, so checked / unchecked stays in CSS (e-store's).
  const checkmark =
    checkmarkColor !== "auto"
      ? checkmarkColor
      : accentColor
        ? contrastingCheckmark(accentColor)
        : undefined;
  const colors: Record<string, string> = {
    ...(accentColor ? { "--checkbox-accent": accentColor } : {}),
    ...(uncheckedColor ? { "--checkbox-unchecked": uncheckedColor } : {}),
    ...(uncheckedBgColor
      ? { "--checkbox-unchecked-bg": uncheckedBgColor }
      : {}),
    ...(checkmark ? { "--checkbox-checkmark": checkmark } : {}),
  };
  const inputRef = useSignal<HTMLInputElement>();

  // One write: `checked` IS the parent's signal when it passed `bind:checked`.
  const handleInput$ = $((event: Event, element: HTMLInputElement) => {
    checked.value = element.checked;
    onChange$?.(element.checked);
    if (onInput$)
      (onInput$ as QRL<(e: Event, el: HTMLInputElement) => void>)(
        event,
        element,
      );
  });

  // A form reset puts the input back without an input event; `reset` fires BEFORE it is applied,
  // so read the input on the next task (e-store's).
  const handleReset$ = $((event: Event) => {
    const el = inputRef.value;
    const form = event.target as Node | null;
    if (!el || typeof form?.contains !== "function" || !form.contains(el))
      return;
    setTimeout(() => {
      if (checked.value !== el.checked) {
        checked.value = el.checked;
        onChange$?.(el.checked);
      }
    }, 0);
  });

  return (
    <label data-qds-checkbox="" class={[styles.root(), labelClass]}>
      <span
        class={styles.control()}
        style={Object.keys(colors).length ? colors : undefined}
      >
        <input
          {...rest}
          ref={inputRef}
          type="checkbox"
          id={idProp ?? generatedId}
          value={value}
          checked={checked.value}
          data-indeterminate={indeterminate ? "" : undefined}
          // A disabled checkbox is not validated (M3's disabled colors win).
          aria-invalid={error && !rest.disabled ? "true" : undefined}
          onInput$={handleInput$}
          document:onReset$={handleReset$}
          class={[styles.input(), className]}
        />
        <span
          data-qds-checkbox-box=""
          aria-hidden="true"
          class={styles.box()}
        />
        {indeterminate !== undefined && (
          <IndeterminateSync input={inputRef} on={indeterminate} />
        )}
        {!indeterminate && (
          <svg
            data-qds-checkbox-mark=""
            viewBox="0 0 24 24"
            aria-hidden="true"
            class={styles.mark()}
          >
            <path d="M3.4,12.2 9.1,17.3 20.6,4.3" />
          </svg>
        )}
      </span>
      {label && <span class={styles.label()}>{label}</span>}
    </label>
  );
});
