import { $, component$, useSignal, useTask$ } from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { destructureBindings, useBindings } from "../../utils/bindings";

/**
 * The `<input>` or `<textarea>` of a text field. From e-store's
 * `components/text-field/text-field-input.tsx` (2026-11-23), outlined and filled only.
 *
 * Changed from e-store (each PROOFED 2026-11-23 against material-web
 * `tokens/versions/v0_192/_md-comp-{outlined,filled}-text-field.scss`):
 * - The placeholder shows while the field is focused and empty (M3: the label floats, the
 *   placeholder appears under it). e-store hid it at all times (`placeholder:opacity-0` with
 *   nothing to bring it back), so a labelled field's placeholder was never seen. Without a label
 *   it is always shown.
 * - The input fills the container's height and carries the padding (outlined 16dp top and
 *   bottom; filled 24dp top under the floated label, 8dp bottom), so a click anywhere in the field
 *   lands in it. e-store sized filled inputs with margins and `self-end`, and its `[textarea]:`
 *   variants are not valid Tailwind selectors.
 * - `value` and `bind:value` both work (`useBindings`), so a parent may own the value as a signal.
 *
 * Added 2026-11-23 from e-store: `plain` and `tonal` variants, `density` (`compact`), `textSize`,
 * `resize` horizontal / both, the date and time types and `showPicker`. The body size is a
 * compound (`textSize="auto"` only), as e-store's: lite `tv()` does not merge two type scales.
 */
export const textFieldInputVariants = tv({
  base: [
    "peer",
    "col-start-3",
    "row-start-1",
    "w-full",
    "min-w-0",
    "self-stretch",
    "bg-transparent",
    "text-on-surface",
    "text-start",
    "caret-primary",
    "outline-none",
    "aria-invalid:caret-error",
    "disabled:cursor-default",
    "disabled:text-on-surface/38",
    "placeholder:text-on-surface-variant",
    "placeholder:transition-opacity",
    "placeholder:duration-spring-fast-effects",
    "placeholder:ease-spring-fast-effects",
    "motion-reduce:placeholder:transition-none",
    "-webkit-tap-highlight-color-transparent",
  ],
  variants: {
    variant: {
      outlined: "py-4",
      filled: "",
      // e-store's: no floating label, so the placeholder is the hint and always shown (60%).
      plain: "py-2 placeholder:text-on-surface-variant/60",
      // e-store's `h-10` sat at the top of its 56dp box; here the input fills it and centres.
      tonal: "py-4 placeholder:text-on-surface-variant/60",
    },
    /** `compact`: 14px text in a 36px row (e-store's, Gmail's compose rows). */
    density: {
      default: "",
      compact: "",
    },
    /** The type size. `auto`: body (from `variant` and `density`); or a title field's. */
    textSize: {
      auto: "",
      "title-large": "text-title-large",
      "headline-small": "text-headline-small",
    },
    /** A floating label is rendered: the placeholder waits for focus. */
    labelled: {
      true: "placeholder:opacity-0 focus:placeholder:opacity-100",
      false: "",
    },
    resize: {
      none: "resize-none",
      vertical: "resize-y",
      horizontal: "resize-x",
      both: "resize",
    },
  },
  compoundVariants: [
    // Filled: the floated label takes the top 24dp (8dp + its 16dp line).
    { variant: "filled", labelled: true, class: "pt-6 pb-2" },
    { variant: "filled", labelled: false, class: "py-4" },
    // Body text only while `textSize` is `auto` (e-store's compounds).
    {
      textSize: "auto",
      density: "default",
      variant: ["outlined", "filled", "plain"],
      class: "text-body-large",
    },
    {
      textSize: "auto",
      density: "default",
      variant: "tonal",
      class: "text-body-medium",
    },
    { textSize: "auto", density: "compact", class: "text-body-medium" },
  ],
  defaultVariants: {
    variant: "outlined",
    density: "default",
    textSize: "auto",
    labelled: true,
    resize: "none",
  },
});

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

export type TextFieldType =
  | "text"
  | "email"
  | "password"
  | "tel"
  | "url"
  | "search"
  | "number"
  | "date"
  | "datetime-local"
  | "month"
  | "time"
  | "week"
  | "color"
  | "textarea";

/** The types `showPicker` opens a native picker for. */
const PICKER_TYPES = new Set([
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

export type TextFieldInputProps = Omit<
  PropsOf<"input">,
  | "type"
  | "value"
  | "bind:value"
  | "class"
  | "children"
  | "onInput$"
  | "onChange$"
  | "onKeyDown$"
> &
  Omit<VariantProps<typeof textFieldInputVariants>, "labelled"> & {
    type?: TextFieldType;
    /** The value. A later value from the parent replaces what is shown. */
    value?: string;
    /** Two-way value: the parent's signal is read and written. */
    "bind:value"?: Signal<string>;
    /** A floating label is rendered for this input. Set by `TextField`. */
    labelled?: boolean;
    /** Visible rows, `type="textarea"` only. Default 10 (e-store's). */
    rows?: number;
    /** Sets `aria-invalid`. The message itself is `TextField`'s `error`. */
    invalid?: boolean;
    /**
     * Date and time types: set it to `true` to open the browser's picker (`showPicker()`), as
     * e-store's. Set it from a click or key handler: browsers open a picker only after a user
     * gesture.
     */
    showPicker?: Signal<boolean>;
    onInput$?: QRL<(event: Event, element: FieldElement) => void>;
    onChange$?: QRL<(event: Event, element: FieldElement) => void>;
    onKeyDown$?: QRL<(event: KeyboardEvent, element: FieldElement) => void>;
  };

/** The one bound key, shared by `useBindings` and `destructureBindings`. */
const INPUT_BINDS = { value: "" };

export const TextFieldInput = component$<TextFieldInputProps>((allProps) => {
  const { valueSig } = useBindings(allProps, INPUT_BINDS);
  const {
    type = "text",
    variant,
    density,
    textSize,
    resize,
    labelled = true,
    showPicker,
    ref: givenRef,
    rows = 10,
    invalid,
    placeholder,
    onInput$,
    onChange$,
    onKeyDown$,
    ...rest
  } = destructureBindings(allProps, INPUT_BINDS);

  // One write: `valueSig` IS the parent's signal when it passed `bind:value`.
  const handleInput$ = $((event: Event, element: FieldElement) => {
    valueSig.value = element.value;
    return onInput$?.(event, element);
  });

  const inputRef = useSignal<HTMLInputElement>();
  useTask$(({ track }) => {
    if (!showPicker) return;
    const open = track(showPicker);
    if (open && PICKER_TYPES.has(type)) inputRef.value?.showPicker();
  });

  const shared = {
    "data-qds-text-field-input": "",
    "aria-invalid": invalid ? ("true" as const) : undefined,
    // A space keeps `:placeholder-shown` true while the field is empty: the label floats on it.
    placeholder: placeholder || " ",
    class: textFieldInputVariants({
      variant,
      density,
      textSize,
      resize,
      labelled,
    }),
  };

  if (type === "textarea") {
    return (
      <textarea
        {...(rest as PropsOf<"textarea">)}
        {...shared}
        rows={rows}
        value={valueSig.value}
        onInput$={handleInput$}
        onChange$={onChange$}
        onKeyDown$={onKeyDown$}
      />
    );
  }

  return (
    <input
      {...rest}
      {...shared}
      ref={(element: HTMLInputElement) => {
        inputRef.value = element;
        // The caller's own ref, a signal or a function, still gets the element.
        if (typeof givenRef === "function") givenRef(element);
        else if (givenRef) givenRef.value = element;
      }}
      type={type}
      value={valueSig.value}
      onInput$={handleInput$}
      onChange$={onChange$}
      onKeyDown$={onKeyDown$}
    />
  );
});
