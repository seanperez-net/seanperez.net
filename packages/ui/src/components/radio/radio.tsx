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
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { useBindings } from "../../utils/bindings";
import { rovingKeys } from "../../utils/roving-focus";

/**
 * Material Design 3 radio button group, from e-store's `components/radio/radio.tsx`
 * (2026-11-23): Group, Item, Indicator, Label, Description.
 * Specs: https://m3.material.io/components/radio-button/specs
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
 *
 * Also `Radio.Swatch` (e-store's colour / finish picker circle; not an M3 part, NOT PROOFED).
 *
 * Changed from e-store (see radio.md "Where it differs"):
 * - `{...rest}` first, the item's own handlers after it, consumer handlers composed by name
 *   (e-store spread `rest` last, so a consumer `onClick$` replaced the selection handler).
 * - Disabled styles key on `aria-disabled` (e-store used `disabled:`, which never matches a div).
 * - With nothing chosen, focusing an item takes the other items out of the Tab order, so the
 *   group is ONE Tab stop (APG); e-store left every item a Tab stop until a choice was made.
 * - Space chooses (APG); Enter does not (APG lists Space only).
 * - The checked state is read in JSX / `useComputed$`, not the component body (Qwik rc.5).
 * - The indicator draws M3's 40dp state layer and holds the 48dp touch target.
 */

/* ------------------------------------------------------------------ */
/*  Variants                                                          */
/* ------------------------------------------------------------------ */

export const radioGroupVariants = tv({
  // `relative`: the containing block of the items' hidden form inputs (siblings of each item).
  base: "relative",
  variants: {
    orientation: {
      vertical: "flex flex-col gap-2",
      horizontal: "flex flex-row flex-wrap gap-4",
    },
  },
  defaultVariants: { orientation: "vertical" },
});

export const radioVariants = tv({
  slots: {
    item: [
      "group/radio relative inline-flex min-h-10 cursor-pointer items-center gap-3 select-none",
      "aria-disabled:cursor-default",
      // The item is the focusable `role="radio"`: the ring frames indicator and label (e-store).
      "focus-ring rounded-sm",
    ],
    indicator: [
      "relative inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2",
      "border-on-surface-variant group-hover/radio:border-on-surface",
      "data-checked:border-primary group-hover/radio:data-checked:border-primary",
      "transition-colors duration-short-4 ease-standard motion-reduce:transition-none",
      // M3 state layer: a 40dp circle, on-surface (unselected) or primary (selected).
      "before:absolute before:top-1/2 before:left-1/2 before:size-10 before:-translate-1/2",
      "before:rounded-full before:bg-on-surface before:opacity-0 before:content-['']",
      "before:pointer-events-none before:transition-opacity",
      "data-checked:before:bg-primary",
      "group-hover/radio:before:opacity-hover group-active/radio:before:opacity-pressed",
      // 48dp to the pointer (M3), whatever the label's size.
      "touch-target",
      // Disabled: on-surface at 38% (M3), no state layer.
      "group-aria-disabled/radio:border-on-surface/38 group-aria-disabled/radio:before:hidden",
      // A disabled item that is chosen, or hovered, stays on-surface 38% (M3 disabled icon colour).
      "group-aria-disabled/radio:data-checked:border-on-surface/38",
      "group-aria-disabled/radio:group-hover/radio:border-on-surface/38",
      "group-aria-disabled/radio:group-hover/radio:data-checked:border-on-surface/38",
    ],
    dot: [
      "size-2.5 scale-0 rounded-full bg-primary",
      "transition-transform duration-short-4 ease-standard-decelerate motion-reduce:transition-none",
      "data-checked:scale-100",
      "group-aria-disabled/radio:bg-on-surface/38",
    ],
    label: [
      "text-body-large text-on-surface",
      "group-aria-disabled/radio:text-on-surface/38",
    ],
    description: "text-body-small text-on-surface-variant",
    input: "pointer-events-none absolute size-0 opacity-0",
  },
});

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface RadioGroupContextType {
  selectedValue: Signal<string>;
  /** The item that last took focus: the Tab stop while nothing is chosen. */
  focusedValue: Signal<string>;
  /** Fixed for the group's lifetime. */
  name: string;
  /** Signals: the context object is captured once, and forms flip these after mount. */
  disabled: Readonly<Signal<boolean>>;
  required: Readonly<Signal<boolean>>;
  selectItem$: QRL<(value: string) => void>;
}

const radioGroupContextId = createContextId<RadioGroupContextType>(
  "net.seanperez.ui.radio-group",
);

interface RadioItemContextType {
  /** Fixed for the item's lifetime. */
  value: string;
  itemId: string;
  checked: Readonly<Signal<boolean>>;
  disabled: Readonly<Signal<boolean>>;
}

const radioItemContextId = createContextId<RadioItemContextType>(
  "net.seanperez.ui.radio-item",
);

/* ------------------------------------------------------------------ */
/*  Keyboard (sync$: preventDefault in time; no outside references)  */
/* ------------------------------------------------------------------ */

/** Space chooses the focused item, without scrolling the page. */
const spaceChooses = sync$((event: KeyboardEvent) => {
  if (event.key !== " ") return;
  const target = event.target as HTMLElement | null;
  const radio = target?.closest?.('[role="radio"]') as HTMLElement | null;
  if (!radio) return;
  event.preventDefault();
  radio.click();
});

/* ------------------------------------------------------------------ */
/*  Radio.Group                                                       */
/* ------------------------------------------------------------------ */

export interface RadioGroupProps extends Omit<
  PropsOf<"div">,
  "role" | "onKeyDown$" | "onFocusIn$"
> {
  /** Starting value when nothing is bound. */
  value?: string;
  /** Two-way state: the parent's signal is read and written. */
  "bind:value"?: Signal<string>;
  /** Called when the chosen value changes. */
  onValueChange$?: QRL<(value: string) => void>;
  /** `name` of the hidden native radios (form submission). Generated when absent. */
  name?: string;
  /** One of the items must be chosen. */
  required?: boolean;
  /** Disables every item. */
  disabled?: boolean;
  /** Layout direction; arrows work both ways either way (APG). */
  orientation?: "horizontal" | "vertical";
  onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLDivElement) => void>;
  onFocusIn$?: QRL<(event: FocusEvent, element: HTMLDivElement) => void>;
}

const Group = component$<RadioGroupProps>((props) => {
  // Pulled out so they never land on the `<div>`; the reactive reads go through `state`.
  /* eslint-disable @typescript-eslint/no-unused-vars -- pulled out so they never reach the DOM */
  const {
    value: _value,
    "bind:value": _bindValue,
    onValueChange$,
    name: nameProp,
    required: _required,
    disabled: _disabled,
    orientation = "vertical",
    onKeyDown$,
    onFocusIn$,
    class: className,
    ...rest
  } = props;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // A view of the same props proxy that names only the two scalars: capturing `props` itself
  // makes the closure capture `children` (not serialisable). Same object, same reactivity.
  const state: { disabled?: boolean; required?: boolean } = props;
  const disabled = useComputed$(() => state.disabled ?? false);
  const required = useComputed$(() => state.required ?? false);

  const fallbackId = useId();
  const name = nameProp ?? `radio-${fallbackId}`;
  const { valueSig: selectedValue } = useBindings(props, { value: "" });

  const focusedValue = useSignal("");

  const selectItem$ = $((value: string) => {
    if (selectedValue.value === value) return;
    selectedValue.value = value;
    onValueChange$?.(value);
  });

  // With nothing chosen every item is a Tab stop until one takes focus; that one then stays the
  // group's only stop (APG: one Tab stop). State, not a DOM write: the tabindexes are rendered.
  const trackFocus$ = $((event: FocusEvent) => {
    const radio = (event.target as HTMLElement | null)?.closest?.(
      '[role="radio"]',
    );
    const value = radio?.getAttribute("data-value");
    if (value != null) focusedValue.value = value;
  });

  useContextProvider(radioGroupContextId, {
    selectedValue,
    focusedValue,
    name,
    disabled,
    required,
    selectItem$,
  });

  return (
    <div
      {...rest}
      data-qds-radio=""
      role="radiogroup"
      aria-orientation={orientation}
      aria-required={required.value || undefined}
      aria-disabled={disabled.value || undefined}
      // Arrows move focus AND choose, wrapping, skipping disabled items, mirrored in right-to-left
      // text; no Home / End (APG radio group). `utils/roving-focus.ts`.
      data-roving=""
      data-roving-items='[role="radio"]'
      data-roving-home-end="false"
      data-roving-select=""
      onKeyDown$={[rovingKeys, onKeyDown$]}
      onFocusIn$={[trackFocus$, onFocusIn$]}
      class={[radioGroupVariants({ orientation }), className]}
    >
      <Slot />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Radio.Item                                                        */
/* ------------------------------------------------------------------ */

export interface RadioItemProps extends Omit<
  PropsOf<"div">,
  "role" | "onClick$" | "onKeyDown$"
> {
  /** The value this item stands for. */
  value: string;
  /** Disables this item only. */
  disabled?: boolean;
  onClick$?: QRL<(event: PointerEvent, element: HTMLDivElement) => void>;
  onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLDivElement) => void>;
}

const Item = component$<RadioItemProps>((props) => {
  /* eslint-disable @typescript-eslint/no-unused-vars -- pulled out so they never reach the DOM */
  const {
    value,
    disabled: _disabled,
    id: givenId,
    onClick$,
    onKeyDown$,
    class: className,
    ...rest
  } = props;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const ctx = useContext(radioGroupContextId);
  const generatedId = useId();
  // The `role="radio"` div is the control, so a consumer's `id` wins.
  const itemId = givenId ?? generatedId;
  const state: { disabled?: boolean } = props;
  const isDisabled = useComputed$(
    () => (state.disabled ?? false) || ctx.disabled.value,
  );
  const isChecked = useComputed$(() => ctx.selectedValue.value === value);
  // Roving tabindex: the chosen item is the group's Tab stop. With no choice, the last focused
  // item is; before any focus, all are (the first one Tab reaches wins).
  const isTabStop = useComputed$(
    () =>
      isChecked.value ||
      (ctx.selectedValue.value === "" &&
        (ctx.focusedValue.value === "" || ctx.focusedValue.value === value)),
  );

  useContextProvider(radioItemContextId, {
    value,
    itemId,
    checked: isChecked,
    disabled: isDisabled,
  });

  const choose$ = $(() => {
    if (!isDisabled.value) ctx.selectItem$(value);
  });

  const styles = radioVariants();
  // Named by its Radio.Label, described by its Radio.Description. A reference to a part that is
  // not rendered is ignored by the name computation (accname 1.2, step 2B), and an `aria-label`
  // replaces the label reference.
  const ariaLabel = rest["aria-label"];
  return (
    <>
      <div
        {...rest}
        data-qds-radio-item=""
        role="radio"
        id={itemId}
        aria-labelledby={ariaLabel ? undefined : `${itemId}-label`}
        aria-describedby={`${itemId}-description`}
        aria-checked={isChecked.value}
        aria-disabled={isDisabled.value || undefined}
        data-value={value}
        tabIndex={isTabStop.value ? 0 : -1}
        onClick$={[choose$, onClick$]}
        onKeyDown$={[spaceChooses, onKeyDown$]}
        class={[styles.item(), className]}
      >
        <Slot />
      </div>
      {/* The native radio is for form submission only: out of the accessibility tree and the
          Tab order, and a SIBLING of the item (a focusable element inside role="radio" is nested
          interactive content). Absolutely positioned, so the group's gap ignores it. */}
      <input
        type="radio"
        name={ctx.name}
        value={value}
        checked={isChecked.value}
        required={ctx.required.value}
        disabled={isDisabled.value}
        aria-hidden="true"
        tabIndex={-1}
        class={styles.input()}
      />
    </>
  );
});

/* ------------------------------------------------------------------ */
/*  Radio.Indicator                                                   */
/* ------------------------------------------------------------------ */

export type RadioIndicatorProps = PropsOf<"span">;

const Indicator = component$<RadioIndicatorProps>(
  ({ class: className, ...rest }) => {
    const item = useContext(radioItemContextId);
    const styles = radioVariants();
    return (
      <span
        {...rest}
        aria-hidden="true"
        data-checked={item.checked.value || undefined}
        class={[styles.indicator(), className]}
      >
        <span
          data-checked={item.checked.value || undefined}
          class={styles.dot()}
        />
      </span>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Radio.Label                                                       */
/* ------------------------------------------------------------------ */

/**
 * A `<span>`, not a `<label>`: a label's `for` must point at a labelable element, and the radio
 * is a `role="radio"` div. The item names itself from this span; a click on it reaches the item.
 */
export type RadioLabelProps = PropsOf<"span">;

const Label = component$<RadioLabelProps>(({ class: className, ...rest }) => {
  const item = useContext(radioItemContextId);
  const styles = radioVariants();
  return (
    <span
      {...rest}
      id={`${item.itemId}-label`}
      data-qds-radio-label=""
      class={[styles.label(), className]}
    >
      <Slot />
    </span>
  );
});

/* ------------------------------------------------------------------ */
/*  Radio.Description                                                 */
/* ------------------------------------------------------------------ */

export type RadioDescriptionProps = PropsOf<"div">;

const Description = component$<RadioDescriptionProps>(
  ({ class: className, ...rest }) => {
    // Optional: also used outside an item (a group's helper text).
    const item = useContext(radioItemContextId, null);
    const styles = radioVariants();
    return (
      <div
        {...rest}
        id={item ? `${item.itemId}-description` : rest.id}
        class={[styles.description(), className]}
      >
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Radio.Swatch                                                      */
/* ------------------------------------------------------------------ */

/** SVG radii per size (e-store's): the colour disc and the selection ring around it. */
const SWATCH_DIMS = {
  sm: { viewBox: 24, fill: 8.5, ring: 11 },
  md: { viewBox: 32, fill: 11.5, ring: 15 },
  lg: { viewBox: 40, fill: 14.5, ring: 19 },
} as const;

export const radioSwatchVariants = tv({
  base: "inline-flex shrink-0 items-center justify-center",
  variants: {
    size: {
      sm: "size-6",
      md: "size-8",
      lg: "size-10",
    },
  },
  defaultVariants: { size: "md" },
});

export type RadioSwatchSize = keyof typeof SWATCH_DIMS;

export interface RadioSwatchProps extends Omit<PropsOf<"span">, "color"> {
  /** The swatch's colour: any CSS colour. */
  color: string;
  /** sm 24px, md 32px (default), lg 40px. */
  size?: RadioSwatchSize;
}

/**
 * A colour disc in place of the radio's dot, for a colour or finish picker (e-store's). Inside a
 * `Radio.Item` a 2px `on-surface` ring shows the choice; it also renders alone (a filter's colour
 * dot), so the item context is optional. Decorative: name the item with `Radio.Label` or
 * `aria-label` ("Midnight blue"), as the colour alone says nothing to a screen reader.
 * NOT PROOFED against M3 (M3 has no swatch); the ring is on `on-surface` at 3:1 or more against
 * `surface` in both themes (WCAG 1.4.11).
 */
const Swatch = component$<RadioSwatchProps>(
  ({ color, size = "md", class: className, ...rest }) => {
    const item = useContext(radioItemContextId, null);
    const dims = SWATCH_DIMS[size];
    const centre = dims.viewBox / 2;
    return (
      <span
        {...rest}
        aria-hidden="true"
        data-qds-radio-swatch=""
        data-checked={item?.checked.value || undefined}
        class={[radioSwatchVariants({ size }), className]}
      >
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${dims.viewBox} ${dims.viewBox}`}
          class="size-full"
        >
          <g transform={`translate(${centre} ${centre})`}>
            <circle fill={color} r={dims.fill} />
            {/* A faint edge, so a white or very light colour still reads as a disc. */}
            <circle
              fill="none"
              stroke="currentColor"
              stroke-width="0.5"
              r={dims.fill}
              class="text-outline-variant"
            />
            {item?.checked.value && (
              <circle
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                r={dims.ring}
                class="text-on-surface"
              />
            )}
          </g>
        </svg>
      </span>
    );
  },
);

export const Radio = { Group, Item, Indicator, Swatch, Label, Description };
