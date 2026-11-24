import {
  $,
  Slot,
  component$,
  createContextId,
  sync$,
  useComputed$,
  useContext,
  useContextProvider,
  useId,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { PropsOf, QRL, ReadonlySignal, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { destructureBindings, useBindings } from "../../utils/bindings";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 select (an exposed dropdown menu: a text field that opens a menu of
 * options). From e-store's `components/select/select.tsx` (2026-11-23): Root, Label, Trigger,
 * Value, Content, Item, ItemIndicator, SupportingText, HiddenSelect.
 * Specs: https://m3.material.io/components/menus/specs (the menu) and
 * https://m3.material.io/components/text-fields/specs (the field).
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/
 *
 * Changed from e-store (PROOFED 2026-11-23; see select.md "Where it differs"):
 * - APG select-only combobox: DOM focus STAYS on the combobox and the active option is
 *   `aria-activedescendant` (APG: "When visual focus is in the listbox, DOM focus remains on the
 *   combobox"). e-store moved DOM focus into the options, which a `role="combobox"` must not do.
 *   All keys are handled on the trigger in one `sync$` (DOM only). Tab picks the active option
 *   and moves on; arrows do not wrap (APG).
 * - The label rests at 28dp from the top (the 56dp field's centre). e-store's `top-1/2` was half
 *   of the Root, which also holds the supporting text, so the label sat low.
 * - Field colours, focus and disabled as the text field (material-web
 *   `_md-comp-{outlined,filled}-select.scss`): e-store faded the whole trigger to 38%.
 * - The error replaces the supporting text and is referenced by `aria-describedby` /
 *   `aria-errormessage`; e-store rendered it in a second, unreferenced line.
 * - `aria-required` on the combobox; no z-index on the popover (the top layer is above all);
 *   signals read in JSX, not component bodies (Qwik rc.5 best practice).
 * Added 2026-11-23 from e-store: the `plain` and `tonal` variants (compact dropdown buttons, 40dp,
 * or 36dp with `density="compact"`; no floating label: the hidden `Select.Label` names the
 * combobox through `aria-labelledby`; the M3 focus ring), and the Group, GroupLabel and
 * ErrorMessage parts. Group is named by its GroupLabel (e-store's Group had no
 * `aria-labelledby`). `plain` and `tonal` are not M3 select styles: NOT PROOFED against M3.
 * Left out: e-store's anchor-positioning polyfill (a dynamic `import()`, which our rules forbid).
 */

/* ------------------------------------------------------------------ */
/*  Variants                                                          */
/* ------------------------------------------------------------------ */

export const selectLabelVariants = tv({
  base: [
    "pointer-events-none",
    "absolute",
    "top-7",
    "inset-s-4",
    "z-1",
    "-translate-y-1/2",
    "select-none",
    "text-body-large",
    "text-on-surface-variant",
    "transition-all",
    "duration-spring-fast",
    "ease-spring-fast-spatial",
    "motion-reduce:transition-none",
    "group-data-open/select:text-primary",
    "group-has-[[data-qds-select-trigger]:focus-visible]/select:text-primary",
    // An invalid field keeps `error` while focused or open (M3 `error-focus-label-text-color`).
    "group-data-invalid/select:group-data-open/select:text-error",
    "group-data-invalid/select:group-has-[[data-qds-select-trigger]:focus-visible]/select:text-error",
    "group-data-invalid/select:text-error",
    "group-has-[[data-qds-select-trigger]:disabled]/select:text-on-surface/38",
    // Floated: open, a value shown, or a placeholder shown.
    "group-data-open/select:translate-y-0",
    "group-data-open/select:text-body-small",
    "group-data-has-value/select:translate-y-0",
    "group-data-has-value/select:text-body-small",
    "group-has-data-placeholder/select:translate-y-0",
    "group-has-data-placeholder/select:text-body-small",
    // No JS: the native `<select>` is the field and its value changes with nothing to update
    // `data-has-value`, so the label stays floated (e-store's).
    "noscript:group-has-data-qds-select-native/select:translate-y-0",
    "noscript:group-has-data-qds-select-native/select:text-body-small",
  ],
  variants: {
    variant: {
      outlined: [
        "rounded-full",
        "group-hover/select:text-on-surface",
        "group-data-open/select:group-hover/select:text-primary",
        "group-data-invalid/select:group-hover/select:text-on-error-container",
        "group-has-[[data-qds-select-trigger]:disabled]/select:group-hover/select:text-on-surface/38",
        "group-data-open/select:-top-2",
        "group-data-open/select:inset-s-3",
        "group-data-open/select:px-1",
        "group-data-open/select:bg-(--field-bg,var(--color-surface))",
        "group-data-has-value/select:-top-2",
        "group-data-has-value/select:inset-s-3",
        "group-data-has-value/select:px-1",
        "group-data-has-value/select:bg-(--field-bg,var(--color-surface))",
        "group-has-data-placeholder/select:-top-2",
        "group-has-data-placeholder/select:inset-s-3",
        "group-has-data-placeholder/select:px-1",
        "group-has-data-placeholder/select:bg-(--field-bg,var(--color-surface))",
        "noscript:group-has-data-qds-select-native/select:-top-2",
        "noscript:group-has-data-qds-select-native/select:inset-s-3",
        "noscript:group-has-data-qds-select-native/select:px-1",
        "noscript:group-has-data-qds-select-native/select:bg-(--field-bg,var(--color-surface))",
      ],
      filled: [
        "group-data-open/select:top-2",
        "group-data-has-value/select:top-2",
        "group-has-data-placeholder/select:top-2",
        "noscript:group-has-data-qds-select-native/select:top-2",
      ],
      // e-store's: no floating label; it stays in the DOM to name the combobox.
      plain: "hidden",
      tonal: "hidden",
    },
  },
  defaultVariants: { variant: "outlined" },
});

export const selectTriggerVariants = tv({
  base: [
    "relative",
    "flex",
    "w-full",
    "cursor-pointer",
    "items-center",
    "justify-between",
    "gap-1",
    "text-start",
    "text-on-surface",
    "disabled:cursor-default",
    "disabled:text-on-surface/38",
    "-webkit-tap-highlight-color-transparent",
  ],
  variants: {
    variant: {
      outlined: [
        "h-14",
        "ps-4",
        "pe-3",
        "text-body-large",
        "rounded-xs",
        "outline",
        "outline-1",
        "-outline-offset-1",
        "outline-outline",
        "transition-[outline-color,outline-width,outline-offset]",
        "duration-spring-fast-effects",
        "ease-spring-fast-effects",
        "motion-reduce:transition-none",
        "hover:outline-on-surface",
        // M3 focus: the outline 1 -> 3px `primary`, also while the menu is closed.
        "focus-visible:outline-3",
        "focus-visible:-outline-offset-3",
        "focus-visible:outline-primary",
        "aria-expanded:outline-3",
        "aria-expanded:-outline-offset-3",
        "aria-expanded:outline-primary",
        "aria-invalid:outline-error",
        "aria-invalid:hover:outline-on-error-container",
        "aria-invalid:focus-visible:outline-error",
        "aria-invalid:aria-expanded:outline-error",
        "disabled:outline-on-surface/12",
        "disabled:hover:outline-on-surface/12",
      ],
      filled: [
        "h-14",
        "ps-4",
        "pe-3",
        "text-body-large",
        // No outline: focus is the bottom line.
        "outline-none",
        "rounded-xs-top",
        "bg-surface-container-highest",
        "disabled:bg-on-surface/4",
        "before:pointer-events-none",
        "before:absolute",
        "before:inset-x-0",
        "before:bottom-0",
        "before:border-b",
        "before:border-on-surface-variant",
        "before:transition-[border-color,border-width]",
        "before:duration-spring-fast-effects",
        "before:ease-spring-fast-effects",
        "motion-reduce:before:transition-none",
        "hover:before:border-on-surface",
        "focus-visible:before:border-b-3",
        "focus-visible:before:border-primary",
        "aria-expanded:before:border-b-3",
        "aria-expanded:before:border-primary",
        "aria-invalid:before:border-error",
        "aria-invalid:hover:before:border-on-error-container",
        "aria-invalid:focus-visible:before:border-error",
        "aria-invalid:aria-expanded:before:border-error",
        "disabled:before:border-on-surface/38",
        "disabled:hover:before:border-on-surface/38",
        "after:pointer-events-none",
        "after:absolute",
        "after:inset-0",
        "after:rounded-[inherit]",
        "after:bg-on-surface",
        "after:opacity-0",
        "after:transition-opacity",
        "motion-reduce:after:transition-none",
        "hover:after:opacity-8",
        "disabled:hover:after:opacity-0",
      ],
      /*
       * e-store's compact dropdown button: body-medium, a state layer on hover (8%), focus and
       * open (12%), and the M3 focus ring (not an active indicator).
       */
      plain: [
        "px-3",
        "text-body-medium",
        "rounded-xs",
        "hover:bg-on-surface/8",
        "focus-visible:bg-on-surface/12",
        "aria-expanded:bg-on-surface/12",
        "disabled:bg-transparent",
        "focus-ring",
      ],
      // e-store's: a `surface-container` box, `error-container` when invalid, the focus ring.
      tonal: [
        "px-4",
        "text-body-medium",
        "rounded-xs",
        "bg-surface-container",
        "aria-invalid:bg-error-container",
        "disabled:bg-on-surface/4",
        "focus-ring",
      ],
    },
    /** `compact` (e-store's): 36dp instead of 40 for `plain` / `tonal`; no effect on the fields. */
    density: {
      default: "",
      compact: "",
    },
  },
  compoundVariants: [
    // Heights as compounds: lite `tv()` does not merge two `h-*`.
    { variant: ["plain", "tonal"], density: "default", class: "h-10" },
    { variant: ["plain", "tonal"], density: "compact", class: "h-9" },
  ],
  defaultVariants: { variant: "outlined", density: "default" },
});

/** The no-JS `<select>` as the visible field: the trigger's classes plus these. Internal. */
const selectNativeVariants = tv({
  base: ["appearance-none", "pe-12"],
  variants: {
    variant: {
      outlined: "bg-transparent",
      // The floated label sits at 8dp; the value goes under it.
      filled: "pt-4",
      plain: "bg-transparent",
      tonal: "",
    },
  },
  defaultVariants: { variant: "outlined" },
});

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

/**
 * One option: the label map for a value set from outside, and the no-JS `<select>`'s options.
 * `disabled` renders `<option disabled>` (never for the current value, which would then not be
 * submitted).
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectVariant = "outlined" | "filled" | "plain" | "tonal";
export type SelectDensity = "default" | "compact";

/** The variants with no floating label (the Label names the combobox by `aria-labelledby`). */
const isCompactButton = (variant: SelectVariant) =>
  variant === "plain" || variant === "tonal";

interface SelectContextType {
  open: Signal<boolean>;
  selectedValue: Signal<string>;
  selectedLabel: Signal<string>;
  /** A value or the label of a chosen `""` option ("None") is shown: the label floats on it. */
  hasValue: ReadonlySignal<boolean>;
  triggerId: string;
  contentId: string;
  descriptionId: string;
  labelId: string;
  /** Root's `aria-label` / `aria-labelledby`: they name the CONTROL, not Root's `<div>`. */
  ariaLabel?: string;
  ariaLabelledby?: string;
  /** The native `<select>` failed validation (required and empty) while JS runs. */
  nativeInvalid: Signal<boolean>;
  /** The browser's message for that failure, shown in place of the supporting text. */
  nativeMessage: Signal<string>;
  triggerRef: Signal<HTMLButtonElement | undefined>;
  contentRef: Signal<HTMLElement | undefined>;
  /** Reactive: a parent (the knobs panel) may switch it. */
  variant: ReadonlySignal<SelectVariant>;
  density: ReadonlySignal<SelectDensity>;
  name?: string;
  disabled: ReadonlySignal<boolean>;
  required: ReadonlySignal<boolean>;
  error: ReadonlySignal<string | undefined>;
  options: ReadonlySignal<SelectOption[] | undefined>;
  selectItem$: QRL<(value: string, label: string) => void>;
}

export const selectContextId = createContextId<SelectContextType>(
  "net.seanperez.ui.select",
);

/* ------------------------------------------------------------------ */
/*  Keyboard (APG select-only combobox), on the trigger               */
/* ------------------------------------------------------------------ */

/**
 * Every key, synchronously and from the DOM alone (a `sync$` cannot close over anything or call
 * module code, so the helpers are inline). The active option is the trigger's
 * `aria-activedescendant` plus `data-active` on the option; Qwik never renders either, so a
 * re-render does not reset them.
 */
const triggerKeys = sync$((e: KeyboardEvent, trigger: HTMLButtonElement) => {
  // The element comes as the second argument: Qwik listens on the document, so
  // `e.currentTarget` is not the trigger.
  if (trigger.disabled || e.ctrlKey || e.metaKey) return;
  const listbox = document.getElementById(
    trigger.getAttribute("aria-controls") || "",
  );
  if (!listbox) return;
  const items = Array.from(
    listbox.querySelectorAll<HTMLElement>(
      '[role="option"]:not([aria-disabled="true"])',
    ),
  );
  if (!items.length) return;
  const open = listbox.matches(":popover-open");
  const activeId = trigger.getAttribute("aria-activedescendant");
  const current = activeId ? document.getElementById(activeId) : null;
  let index = current ? items.indexOf(current) : -1;

  const setActive = (i: number) => {
    const next = items[Math.max(0, Math.min(items.length - 1, i))];
    listbox
      .querySelectorAll("[data-active]")
      .forEach((n) => n.removeAttribute("data-active"));
    next.setAttribute("data-active", "");
    trigger.setAttribute("aria-activedescendant", next.id);
    next.scrollIntoView({ block: "nearest" });
  };
  const show = () => {
    listbox.setAttribute("data-keyboard", "");
    // `openPopover`'s guard (utils/top-layer.ts), inline: a `sync$` cannot import it. The
    // listbox came from `getElementById`, so it is connected.
    if (!open) listbox.showPopover();
  };
  const typeahead = (char: string) => {
    const now = Date.now();
    const last = Number(listbox.getAttribute("data-typeahead-time") || "0");
    const buffer =
      now - last < 500
        ? (listbox.getAttribute("data-typeahead-buffer") || "") + char
        : char;
    listbox.setAttribute("data-typeahead-buffer", buffer);
    listbox.setAttribute("data-typeahead-time", String(now));
    // One repeated letter cycles through the options starting with it.
    const start = buffer.length === 1 ? index + 1 : Math.max(index, 0);
    for (let n = 0; n < items.length; n++) {
      const i = (start + n) % items.length;
      const copy = items[i].cloneNode(true) as Element;
      copy
        .querySelectorAll('[aria-hidden="true"]')
        .forEach((node) => node.remove());
      if (copy.textContent?.trim().toLowerCase().startsWith(buffer)) {
        setActive(i);
        return;
      }
    }
  };
  const selectedIndex = items.findIndex(
    (n) => n.getAttribute("aria-selected") === "true",
  );
  const key = e.key;
  const printable = key.length === 1 && key !== " " && !e.altKey;
  const typing =
    Date.now() - Number(listbox.getAttribute("data-typeahead-time") || "0") <
    500;

  if (!open) {
    if (
      key === "ArrowDown" ||
      key === "Enter" ||
      key === " " ||
      key === "ArrowUp" ||
      key === "Home" ||
      key === "End"
    ) {
      e.preventDefault();
      show();
      if (key === "Home" || key === "ArrowUp") setActive(0);
      else if (key === "End") setActive(items.length - 1);
      else setActive(selectedIndex >= 0 ? selectedIndex : 0);
    } else if (printable) {
      e.preventDefault();
      show();
      index = selectedIndex;
      typeahead(key.toLowerCase());
    }
    return;
  }

  if (key === "ArrowDown" && !e.altKey) {
    e.preventDefault();
    setActive(index + 1);
  } else if (key === "ArrowUp" && !e.altKey) {
    e.preventDefault();
    setActive(index - 1);
  } else if (key === "Home") {
    e.preventDefault();
    setActive(0);
  } else if (key === "End") {
    e.preventDefault();
    setActive(items.length - 1);
  } else if (key === "PageDown") {
    e.preventDefault();
    setActive(index + 10);
  } else if (key === "PageUp") {
    e.preventDefault();
    setActive(index - 10);
  } else if (key === " " && typing) {
    // A space inside a typed name ("New York") is type-ahead, not a pick (APG).
    e.preventDefault();
    typeahead(" ");
  } else if (
    key === "Enter" ||
    key === " " ||
    (key === "ArrowUp" && e.altKey)
  ) {
    e.preventDefault();
    if (current) current.click();
    else listbox.hidePopover();
  } else if (key === "Tab") {
    // Picks the active option and lets the focus move on (APG).
    if (current) current.click();
    else listbox.hidePopover();
  } else if (printable) {
    e.preventDefault();
    typeahead(key.toLowerCase());
  }
});

/**
 * A button activates on Space KEYUP. Cancelling the keydown stops that in Chrome; this makes
 * sure no browser then toggles the popover (`popovertarget`) shut again (second agent's review).
 */
const cancelSpaceUp = sync$((e: KeyboardEvent) => {
  if (e.key === " ") e.preventDefault();
});

/* ------------------------------------------------------------------ */
/*  Root                                                              */
/* ------------------------------------------------------------------ */

export type SelectRootProps = PropsOf<"div"> & {
  /** The value. A later value from the parent replaces it. */
  value?: string;
  /** Two-way value: the parent's signal is read and written. */
  "bind:value"?: Signal<string>;
  /** Called when the USER picks an option (not for a value set from outside). */
  onValueChange$?: QRL<(value: string) => void>;
  variant?: SelectVariant;
  /** `compact`: a 36dp `plain` / `tonal` trigger (e-store's). Default `default`. */
  density?: SelectDensity;
  disabled?: boolean;
  required?: boolean;
  /** The form key, on the native `<select>` (`Select.HiddenSelect`). */
  name?: string;
  /** An error message: shown by `Select.SupportingText`, marks the field invalid. */
  error?: string;
  /** Every option's label by value: the trigger shows a value set from outside by its label. */
  options?: SelectOption[];
};

/** The one bound key, shared by `useBindings` and `destructureBindings`. */
const SELECT_BINDS = { value: "" };

const Root = component$<SelectRootProps>((allProps) => {
  // `disabled`, `required` and `error` are pulled out only to keep them off the `<div>`; they are
  // read reactively through `allProps` below.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    onValueChange$,
    variant: _variant,
    density: _density,
    disabled: _disabled,
    required: _required,
    error: _error,
    options: optionsProp,
    name,
    id: idProp,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    class: className,
    ...rest
  } = destructureBindings(allProps, SELECT_BINDS);
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const { valueSig: selectedValue } = useBindings(allProps, SELECT_BINDS);

  // The label of the starting value, before any item renders.
  const selectedLabel = useSignal(
    optionsProp?.find((o) => o.value === selectedValue.value)?.label ?? "",
  );

  // Context fields that can change: the context object is captured once.
  const variant = useComputed$(() => allProps.variant ?? "outlined");
  const density = useComputed$(() => allProps.density ?? "default");
  const disabled = useComputed$(() => allProps.disabled ?? false);
  const required = useComputed$(() => allProps.required ?? false);
  const error = useComputed$(() => allProps.error || undefined);
  const options = useComputed$(() => allProps.options);

  // `id` belongs to the control (the trigger), which `Select.Label`'s `for` names.
  const generatedId = useId();
  const triggerId = idProp ?? generatedId;
  const contentId = useId();
  const descriptionId = useId();
  const labelId = useId();
  const open = useSignal(false);
  /** The value `selectedLabel` was taken for by a pick. */
  const labelOf = useSignal<string | undefined>(undefined);
  const nativeInvalid = useSignal(false);
  const nativeMessage = useSignal("");
  const triggerRef = useSignal<HTMLButtonElement>();
  const contentRef = useSignal<HTMLElement>();

  const selectItem$ = $((value: string, label: string) => {
    labelOf.value = value;
    selectedValue.value = value;
    selectedLabel.value = label;
    nativeInvalid.value = false;
    contentRef.value?.hidePopover();
    return onValueChange$?.(value);
  });

  // A value set from outside (or cleared): show its label from `options` (e-store's).
  useTask$(({ track }) => {
    const value = track(() => selectedValue.value);
    const opts = track(() => options.value);
    const match = opts?.find((o) => o.value === value);
    if (match) selectedLabel.value = match.label;
    // No declared label: keep the one a pick took from its row, drop any other (it belonged to
    // an earlier value; e-store kept it, so a value set from outside showed the old label).
    else if (labelOf.value !== value) selectedLabel.value = "";
  });

  const hasValue = useComputed$(
    () => !!(selectedValue.value || selectedLabel.value),
  );

  useContextProvider(selectContextId, {
    open,
    selectedValue,
    selectedLabel,
    hasValue,
    triggerId,
    contentId,
    descriptionId,
    labelId,
    ariaLabel,
    ariaLabelledby,
    nativeInvalid,
    nativeMessage,
    triggerRef,
    contentRef,
    variant,
    density,
    name,
    disabled,
    required,
    error,
    options,
    selectItem$,
  });

  return (
    <div
      {...rest}
      data-qds-select=""
      class={["group/select relative w-full", className]}
      data-has-value={hasValue.value ? "" : undefined}
      data-open={open.value ? "" : undefined}
      // A disabled select is not validated: M3's disabled colours win over an error's.
      data-invalid={
        !disabled.value && (error.value || nativeInvalid.value) ? "" : undefined
      }
    >
      <Slot />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Label                                                             */
/* ------------------------------------------------------------------ */

export type SelectLabelProps = PropsOf<"label"> & {
  /** The label text, and the combobox's accessible name. */
  label?: string;
};

const Label = component$<SelectLabelProps>(
  ({ label, class: className, ...rest }) => {
    const ctx = useContext(selectContextId);
    return (
      <label
        {...rest}
        id={ctx.labelId}
        for={ctx.triggerId}
        class={[selectLabelVariants({ variant: ctx.variant.value }), className]}
      >
        {label}
        <Slot />
        {ctx.required.value && <span aria-hidden="true">*</span>}
      </label>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Trigger                                                           */
/* ------------------------------------------------------------------ */

// No `variant` here: Label and Value read Root's, so a Trigger override split the field.
export type SelectTriggerProps = PropsOf<"button"> & {
  /** The arrow's icon name. */
  dropdownIcon?: IconName;
};

const Trigger = component$<SelectTriggerProps>(
  ({
    dropdownIcon = "arrow_drop_down",
    class: className,
    onKeyDown$,
    ...rest
  }) => {
    const ctx = useContext(selectContextId);
    return (
      <button
        {...rest}
        data-qds-select-trigger=""
        // The fields show focus with their active indicator; `plain` / `tonal` with the ring.
        data-focus-indicator={
          isCompactButton(ctx.variant.value) ? undefined : "active-indicator"
        }
        ref={ctx.triggerRef}
        id={ctx.triggerId}
        type="button"
        role="combobox"
        popovertarget={ctx.contentId}
        // A dashed-ident from a generated id (a caller's `id` may hold `.` or spaces).
        style={{ anchorName: `--select-${ctx.contentId}` }}
        aria-label={rest["aria-label"] ?? ctx.ariaLabel}
        // `plain` / `tonal`: the Label is `display: none`, which a `<label for>` cannot name
        // from, so it is referenced (a hidden `aria-labelledby` target still counts).
        aria-labelledby={
          rest["aria-labelledby"] ??
          ctx.ariaLabelledby ??
          (isCompactButton(ctx.variant.value) &&
          !(rest["aria-label"] ?? ctx.ariaLabel)
            ? ctx.labelId
            : undefined)
        }
        aria-haspopup="listbox"
        aria-expanded={ctx.open.value}
        aria-controls={ctx.contentId}
        aria-describedby={ctx.descriptionId}
        aria-errormessage={
          ctx.error.value && !ctx.disabled.value ? ctx.descriptionId : undefined
        }
        aria-invalid={
          !ctx.disabled.value && (ctx.error.value || ctx.nativeInvalid.value)
            ? true
            : undefined
        }
        aria-required={ctx.required.value ? true : undefined}
        disabled={ctx.disabled.value || undefined}
        onKeyDown$={[triggerKeys, onKeyDown$]}
        onKeyUp$={cancelSpaceUp}
        class={[
          "peer",
          // No JS: the native `<select>` takes this button's place (e-store's).
          "noscript:group-has-data-qds-select-native/select:hidden",
          selectTriggerVariants({
            variant: ctx.variant.value,
            density: ctx.density.value,
          }),
          className,
        ]}
      >
        <Slot />
        <span
          aria-hidden="true"
          class="inline-flex shrink-0 text-on-surface-variant transition-transform duration-spring-fast ease-spring-fast-spatial group-has-[[data-qds-select-trigger]:disabled]/select:text-on-surface/38 group-data-invalid/select:text-error group-data-open/select:rotate-180 group-data-open/select:text-primary group-data-invalid/select:group-data-open/select:text-error motion-reduce:transition-none"
        >
          {/* The compact buttons take a 20dp arrow (e-store's `sm`). */}
          <Icon
            name={dropdownIcon}
            size={isCompactButton(ctx.variant.value) ? "sm" : "md"}
          />
        </span>
      </button>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Value                                                             */
/* ------------------------------------------------------------------ */

export type SelectValueProps = PropsOf<"span"> & {
  /** Shown while no value is chosen; floats the label. */
  placeholder?: string;
};

const Value = component$<SelectValueProps>(
  ({ placeholder, class: className, ...rest }) => {
    const ctx = useContext(selectContextId);
    return (
      <span
        {...rest}
        data-qds-select-value=""
        data-placeholder={placeholder && !ctx.hasValue.value ? "" : undefined}
        class={[
          "min-w-0 flex-1 truncate text-start",
          "data-placeholder:text-on-surface-variant",
          // Filled: under the floated label (e-store's).
          ctx.variant.value === "filled" ? "self-end pb-2" : "",
          className,
        ]}
      >
        {ctx.selectedLabel.value ||
          ctx.selectedValue.value ||
          placeholder ||
          ""}
      </span>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Content                                                           */
/* ------------------------------------------------------------------ */

export type SelectContentProps = PropsOf<"div">;

const Content = component$<SelectContentProps>(
  ({ class: className, onToggle$, style, ...rest }) => {
    const ctx = useContext(selectContextId);

    const handleToggle$ = $((event: ToggleEvent, listbox: HTMLElement) => {
      const isOpen = event.newState === "open";
      ctx.open.value = isOpen;
      const trigger = ctx.triggerRef.value;
      if (!trigger) return;
      if (isOpen) {
        // Opened by a click: the chosen option (else the first) is the active one. The keyboard
        // has already set it.
        if (trigger.getAttribute("aria-activedescendant")) return;
        const options = Array.from(
          listbox.querySelectorAll<HTMLElement>(
            '[role="option"]:not([aria-disabled="true"])',
          ),
        );
        const start =
          options.find((n) => n.getAttribute("aria-selected") === "true") ??
          options[0];
        if (!start) return;
        start.setAttribute("data-active", "");
        trigger.setAttribute("aria-activedescendant", start.id);
        start.scrollIntoView({ block: "nearest" });
      } else {
        trigger.removeAttribute("aria-activedescendant");
        listbox.removeAttribute("data-keyboard");
        listbox
          .querySelectorAll("[data-active]")
          .forEach((n) => n.removeAttribute("data-active"));
      }
    });

    return (
      <div
        {...rest}
        data-qds-select-content=""
        ref={ctx.contentRef}
        id={ctx.contentId}
        role="listbox"
        // Named as the combobox is: by `Select.Label`, else by Root's `aria-label(ledby)`.
        aria-labelledby={
          ctx.ariaLabelledby ?? (ctx.ariaLabel ? undefined : ctx.labelId)
        }
        aria-label={ctx.ariaLabel}
        popover="auto"
        // A press on an option must not take the focus off the combobox (APG).
        preventdefault:mousedown
        onToggle$={[handleToggle$, onToggle$]}
        style={{
          positionAnchor: `--select-${ctx.contentId}`,
          // Logical sides, so the menu starts at the field's start edge in RTL too.
          insetBlockStart: "anchor(end)",
          insetInlineStart: "anchor(start)",
          minWidth: "anchor-size(width)",
          // Flip above when there is no room below; last, stay below and scroll in the room
          // left (`tokens/components/menu.css`).
          positionTryFallbacks: "flip-block, --qds-menu-scroll-below",
          ...(typeof style === "object" ? style : {}),
        }}
        class={[
          "fixed inset-auto m-0 max-h-72 overflow-y-auto rounded-xs bg-surface-container py-2 shadow-2",
          // 4dp corners: no track inset needed (the utility's default is 20px).
          "scrollbar-pane [--scrollbar-track-margin:0px]",
          className,
        ]}
      >
        <Slot />
      </div>
    );
  },
);

/** An option row's visible text, without `aria-hidden` parts (the indicator's icon). */
export function optionText(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return copy.textContent?.trim() ?? "";
}

/* ------------------------------------------------------------------ */
/*  Item                                                              */
/* ------------------------------------------------------------------ */

export type SelectItemProps = PropsOf<"div"> & {
  value: string;
  disabled?: boolean;
};

const Item = component$<SelectItemProps>(
  ({ value, disabled = false, class: className, onClick$, ...rest }) => {
    const ctx = useContext(selectContextId);
    const id = useId();

    const handleClick$ = $((_: Event, el: HTMLElement) => {
      if (disabled) return;
      // The declared label first, else the row's text without its icon (e-store's).
      const declared = ctx.options.value?.find((o) => o.value === value)?.label;
      return ctx.selectItem$(value, declared ?? optionText(el));
    });

    return (
      <div
        {...rest}
        id={id}
        data-qds-select-item=""
        role="option"
        aria-selected={ctx.selectedValue.value === value}
        aria-disabled={disabled || undefined}
        data-value={value}
        onClick$={[handleClick$, onClick$]}
        class={[
          "group/select-item relative flex min-h-12 w-full cursor-pointer items-center gap-3 px-3 select-none",
          "text-body-large text-on-surface",
          "transition-colors duration-short-4 ease-standard motion-reduce:transition-none",
          "hover:bg-on-surface/8 active:bg-on-surface/12 data-active:bg-on-surface/10",
          "aria-selected:bg-secondary-container aria-selected:text-on-secondary-container",
          "aria-selected:hover:bg-[color-mix(in_srgb,var(--color-on-secondary-container)_8%,var(--color-secondary-container))]",
          "aria-selected:data-active:bg-[color-mix(in_srgb,var(--color-on-secondary-container)_10%,var(--color-secondary-container))]",
          // The keyboard's active option takes M3's inward focus ring (it is not DOM-focused, so
          // `:focus-visible` cannot draw it).
          "in-data-keyboard:data-active:outline-(length:--outline-width-focus-ring) in-data-keyboard:data-active:-outline-offset-(--outline-width-focus-ring) in-data-keyboard:data-active:outline-(--color-focus-ring) in-data-keyboard:data-active:outline-solid",
          "aria-disabled:pointer-events-none aria-disabled:text-on-surface/38",
          className,
        ]}
      >
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  ItemIndicator                                                     */
/* ------------------------------------------------------------------ */

export type SelectItemIndicatorProps = PropsOf<"span"> & {
  /** The icon name. */
  icon?: IconName;
};

/** A check on the chosen option; its space is kept on the others (e-store's). */
const ItemIndicator = component$<SelectItemIndicatorProps>(
  ({ icon = "check", class: className, ...rest }) => (
    <span
      {...rest}
      aria-hidden="true"
      data-qds-select-item-indicator=""
      class={[
        "invisible ms-auto inline-flex group-aria-selected/select-item:visible",
        className,
      ]}
    >
      <Icon name={icon} />
    </span>
  ),
);

/* ------------------------------------------------------------------ */
/*  SupportingText                                                    */
/* ------------------------------------------------------------------ */

export type SelectSupportingTextProps = PropsOf<"div"> & {
  supportingText?: string;
};

/**
 * The line under the field: the supporting text, or Root's `error` in its place. Render it in
 * every Select: the trigger's `aria-describedby` points at it, and the line is reserved so an
 * error appearing does not move what is below.
 */
const SupportingText = component$<SelectSupportingTextProps>(
  ({ supportingText, class: className, ...rest }) => {
    const ctx = useContext(selectContextId);
    return (
      <div
        {...rest}
        id={ctx.descriptionId}
        data-qds-select-supporting-text=""
        class={[
          "min-h-5 px-4 pt-1 text-body-small text-on-surface-variant",
          "group-data-invalid/select:text-error",
          "group-has-[[data-qds-select-trigger]:disabled]/select:text-on-surface/38",
          className,
        ]}
      >
        {ctx.error.value ||
          (ctx.nativeInvalid.value ? ctx.nativeMessage.value : "") ||
          supportingText}
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  ErrorMessage                                                      */
/* ------------------------------------------------------------------ */

export type SelectErrorMessageProps = PropsOf<"div">;

/**
 * e-store's error line, for a Select with no `SupportingText`: Root's `error` (or the browser's
 * message), and nothing while there is none. It takes the description id, so the trigger's
 * `aria-describedby` / `aria-errormessage` point at it (e-store's was unreferenced). Use one of
 * the two lines, not both: `SupportingText` already shows the error in its place.
 */
const ErrorMessage = component$<SelectErrorMessageProps>(
  ({ class: className, ...rest }) => {
    const ctx = useContext(selectContextId);
    return (
      <div
        {...rest}
        id={ctx.descriptionId}
        data-qds-select-error-message=""
        // An error that appears is announced (as the text field's line).
        aria-live="polite"
        class={[
          "px-4 pt-1 text-body-small text-error empty:hidden",
          "group-has-[[data-qds-select-trigger]:disabled]/select:text-on-surface/38",
          className,
        ]}
      >
        {ctx.error.value ||
          (ctx.nativeInvalid.value ? ctx.nativeMessage.value : "")}
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Group, GroupLabel                                                 */
/* ------------------------------------------------------------------ */

const groupContextId = createContextId<{ labelId: string }>(
  "net.seanperez.ui.select-group",
);

export type SelectGroupProps = PropsOf<"div">;

/** Options that belong together (APG listbox with grouped options), named by its GroupLabel. */
const Group = component$<SelectGroupProps>(({ class: className, ...rest }) => {
  const groupId = useId();
  const labelId = `${groupId}-label`;
  useContextProvider(groupContextId, { labelId });
  return (
    <div
      {...rest}
      role="group"
      aria-labelledby={rest["aria-labelledby"] ?? labelId}
      data-qds-select-group=""
      class={["py-1", className]}
    >
      <Slot />
    </div>
  );
});

export type SelectGroupLabelProps = PropsOf<"div">;

/** The group's heading (e-store's: label-large, `on-surface-variant`). Not an option. */
const GroupLabel = component$<SelectGroupLabelProps>(
  ({ class: className, ...rest }) => {
    const group = useContext(groupContextId, null);
    return (
      <div
        {...rest}
        id={rest.id ?? group?.labelId}
        role="presentation"
        data-qds-select-group-label=""
        class={[
          "px-3 py-2 text-label-large text-on-surface-variant select-none",
          className,
        ]}
      >
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  HiddenSelect                                                      */
/* ------------------------------------------------------------------ */

export type SelectHiddenSelectProps = PropsOf<"select"> & {
  options?: SelectOption[];
  /** Text of the leading empty option, seen only with JS off. */
  placeholder?: string;
  /** The no-JS field's arrow. */
  dropdownIcon?: IconName;
};

/**
 * The native `<select>` that carries the value into a `<form>` (e-store's). With JS it is
 * `display: none` (still submitted, out of the tab order and the accessibility tree); with JS off
 * (`@media (scripting: none)`) it is the visible field in the trigger's place. Needs `options`.
 */
const HiddenSelect = component$<SelectHiddenSelectProps>(
  ({
    options: optionsProp,
    placeholder,
    dropdownIcon = "arrow_drop_down",
    class: className,
    onInvalid$,
    ...rest
  }) => {
    const ctx = useContext(selectContextId);
    // The browser cannot focus a hidden control to show its bubble: cancel it, mark the trigger
    // invalid and focus it instead.
    const cancelReport = sync$((e: Event) => e.preventDefault());
    const handleInvalid$ = $((_: Event, select: HTMLSelectElement) => {
      ctx.nativeInvalid.value = true;
      // Colour alone is not a message (WCAG 1.4.1, 3.3.1; second agent's review).
      ctx.nativeMessage.value = select.validationMessage;
      ctx.triggerRef.value?.focus();
    });

    return (
      <div
        data-qds-select-native=""
        class="hidden noscript:relative noscript:block"
      >
        <select
          {...rest}
          name={rest.name ?? ctx.name}
          required={ctx.required.value || undefined}
          disabled={ctx.disabled.value || undefined}
          aria-label={rest["aria-label"] ?? ctx.ariaLabel}
          aria-labelledby={
            rest["aria-labelledby"] ??
            ctx.ariaLabelledby ??
            (rest["aria-label"] || ctx.ariaLabel ? undefined : ctx.labelId)
          }
          aria-describedby={ctx.descriptionId}
          aria-invalid={
            ctx.error.value && !ctx.disabled.value ? true : undefined
          }
          onInvalid$={[cancelReport, handleInvalid$, onInvalid$]}
          class={[
            selectTriggerVariants({
              variant: ctx.variant.value,
              density: ctx.density.value,
            }),
            selectNativeVariants({ variant: ctx.variant.value }),
            className,
          ]}
        >
          {!(optionsProp ?? ctx.options.value)?.some((o) => o.value === "") && (
            <option value="">{placeholder ?? ""}</option>
          )}
          {(optionsProp ?? ctx.options.value)?.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              selected={ctx.selectedValue.value === opt.value}
              disabled={
                (opt.disabled && ctx.selectedValue.value !== opt.value) ||
                undefined
              }
            >
              {opt.label}
            </option>
          ))}
          {!(optionsProp ?? ctx.options.value) && ctx.selectedValue.value && (
            <option value={ctx.selectedValue.value} selected>
              {ctx.selectedLabel.value || ctx.selectedValue.value}
            </option>
          )}
        </select>
        <span class="pointer-events-none absolute inset-e-3 top-4 inline-flex text-on-surface-variant">
          <Icon name={dropdownIcon} />
        </span>
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Export                                                            */
/* ------------------------------------------------------------------ */

export const Select = {
  Root,
  Label,
  Trigger,
  Value,
  Content,
  Item,
  ItemIndicator,
  SupportingText,
  ErrorMessage,
  Group,
  GroupLabel,
  HiddenSelect,
};
