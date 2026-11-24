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
import { openPopover } from "../../utils/top-layer";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { Icon } from "../icon";
import type { IconName } from "../icon";

/**
 * Material Design 3 combobox (a searchable select), from e-store's
 * `components/combobox/combobox.tsx` (2026-11-23): Root, Input, Content, Item, Group,
 * GroupLabel, Empty. A text input with `role="combobox"` filters a `role="listbox"` popover;
 * focus stays in the input and the highlighted option is `aria-activedescendant`.
 * Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ (list autocomplete, manual selection)
 * M3: https://m3.material.io/components/menus/overview (exposed dropdown menu) and the outlined
 * text field https://m3.material.io/components/text-fields/specs
 *
 * Added 2026-11-23 from e-store: `variant="tonal"` on Root (a 40dp surface-container field, 14px
 * text, no floating label, the placeholder always shown; e-store's store look, NOT in M3, NOT
 * PROOFED). Its hidden label still names the input and the list (`aria-labelledby`).
 * Left out: e-store's anchor positioning polyfill (a dynamic import, forbidden here; CSS anchor
 * positioning is in every current browser).
 *
 * Changed from e-store (see combobox.md "Where it differs"):
 * - The highlighted option is STATE (`highlightedId`), rendered into `data-highlighted` and
 *   `aria-activedescendant`. e-store's `sync$` wrote both straight into the DOM and never set
 *   the signal, so typing could leave `aria-activedescendant` on an option that was now hidden.
 * - No `useVisibleTask$`: the popover's own `onToggle$` keeps `open` in step, and the list takes
 *   the field's width with CSS `anchor-size(width)` instead of a measured custom property.
 * - `Combobox.Empty` shows only when no option is visible (CSS `:has()`); e-store documented that
 *   but always showed it.
 * - `Item` takes its text as the required `label` prop (shown, matched, chosen); children are
 *   extra content after it. e-store's `label` was optional and fell back to `''`, so an item
 *   without one never matched and put an empty label in the field.
 * - `aria-invalid` and the error's `aria-describedby` are on the input, not the wrapper `div`.
 * - `Group` is named by its `GroupLabel` (`aria-labelledby`); e-store's group had no name.
 * - The clear / open button's names are props (`clearLabel`, `openLabel`).
 * - Signals are read in JSX / `useComputed$`, not component bodies; logical properties.
 */

export const comboboxVariants = tv({
  slots: {
    root: "group/combobox relative grid w-full",
    trigger: [
      "relative flex w-full cursor-text items-center rounded-xs",
      "has-disabled:cursor-default",
    ],
    input: [
      "peer w-full min-w-0 bg-transparent ps-4 outline-none",
      "text-on-surface caret-primary",
      "disabled:cursor-default disabled:text-on-surface/38",
    ],
    label: [
      "pointer-events-none absolute start-4 top-1/2 origin-[0_50%] -translate-y-1/2 select-none",
      "text-body-large text-on-surface-variant",
      "transition-all duration-short-4 ease-standard motion-reduce:transition-none",
      "group-hover/combobox:text-on-surface",
      // Floated: on focus, or when the field has text.
      "peer-focus:start-3 peer-focus:-top-2 peer-focus:translate-y-0 peer-focus:px-1",
      "peer-focus:text-body-small peer-focus:text-primary peer-focus:group-hover/combobox:text-primary",
      "peer-not-placeholder-shown:start-3 peer-not-placeholder-shown:-top-2 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:px-1",
      "peer-not-placeholder-shown:text-body-small",
      "peer-not-placeholder-shown:bg-(--field-bg,var(--color-surface)) peer-focus:bg-(--field-bg,var(--color-surface))",
      "group-data-invalid/combobox:text-error group-data-invalid/combobox:peer-focus:text-error",
      "peer-disabled:text-on-surface/38",
    ],
    button: [
      "touch-target relative me-1 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full",
      "text-on-surface-variant hover:text-on-surface",
      "disabled:pointer-events-none disabled:text-on-surface/38",
    ],
    content: [
      // `fixed inset-auto m-0`: the UA popover style centres it; the anchor places it instead.
      "fixed inset-auto m-0 max-h-72 overflow-x-hidden overflow-y-auto",
      "rounded-xs bg-surface-container py-2 shadow-2",
      // The library's scrollbar; 4dp corners need no track inset (as Select's list).
      "scrollbar-pane [--scrollbar-track-margin:0px]",
    ],
    item: [
      "relative flex min-h-12 w-full cursor-pointer items-center gap-3 px-3 py-2",
      "text-body-large text-on-surface select-none",
      "transition-colors duration-short-4 ease-standard motion-reduce:transition-none",
      "hover:bg-on-surface/8 data-highlighted:bg-on-surface/12",
      "aria-selected:bg-secondary-container aria-selected:text-on-secondary-container",
      "aria-selected:data-highlighted:bg-[color-mix(in_srgb,var(--color-on-secondary-container)_12%,var(--color-secondary-container))]",
      "aria-disabled:pointer-events-none aria-disabled:text-on-surface/38",
      // The keyboard's current option also gets an inward ring (focus stays in the input).
      "data-highlighted:outline-3 data-highlighted:-outline-offset-3 data-highlighted:outline-secondary",
    ],
    group: "py-1",
    groupLabel:
      "px-3 py-1.5 text-label-medium text-on-surface-variant select-none",
    // Hidden while any option is visible (the `content` slot's `:has()` shows it).
    empty:
      "hidden px-3 py-6 text-center text-body-large text-on-surface-variant",
    error: "px-4 pt-1 text-body-small text-error",
  },
  variants: {
    variant: {
      outlined: {
        trigger: [
          "outline -outline-offset-1 outline-outline",
          "hover:outline-on-surface",
          // M3 outlined text field focus: the outline 1 -> 3dp primary, inside (md-outlined-text-field).
          "focus-within:outline-3 focus-within:-outline-offset-3 focus-within:outline-primary",
          "group-data-invalid/combobox:outline-error group-data-invalid/combobox:focus-within:outline-error",
          "has-disabled:outline-on-surface/12",
          "transition-[outline-color,outline-width,outline-offset] duration-short-4 ease-standard motion-reduce:transition-none",
        ],
        input: [
          "h-14 text-body-large",
          // The placeholder shows only once the label has floated (M3).
          "placeholder:text-on-surface-variant placeholder:opacity-0 focus:placeholder:opacity-100",
        ],
      },
      // e-store's: a filled 40dp field, no floating label, a 2dp inset primary ring on focus.
      tonal: {
        trigger: [
          "bg-surface-container",
          "focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset",
          "group-data-invalid/combobox:bg-error-container",
          "has-disabled:bg-on-surface/4",
        ],
        input: [
          "h-10 text-body-medium",
          "placeholder:text-on-surface-variant/60",
        ],
        label: "hidden",
      },
    },
  },
  defaultVariants: { variant: "outlined" },
});

export type ComboboxVariant = "outlined" | "tonal";

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface ComboboxContextType {
  open: Signal<boolean>;
  search: Signal<string>;
  selectedValue: Signal<string>;
  selectedLabel: Signal<string>;
  highlightedId: Signal<string>;
  inputId: string;
  contentId: string;
  errorId: string;
  anchorName: string;
  inputRef: Signal<HTMLInputElement | undefined>;
  contentRef: Signal<HTMLElement | undefined>;
  /** Signals: the context object is captured once; forms flip these after mount. */
  disabled: Readonly<Signal<boolean>>;
  error: Readonly<Signal<string | undefined>>;
  variant: Readonly<Signal<ComboboxVariant>>;
  selectItem$: QRL<(value: string, label: string) => void>;
  /** Empties the field and the value (the clear button). */
  clear$: QRL<() => void>;
}

const comboboxContextId = createContextId<ComboboxContextType>(
  "net.seanperez.ui.combobox",
);

const groupContextId = createContextId<{ labelId: string }>(
  "net.seanperez.ui.combobox-group",
);

/* ------------------------------------------------------------------ */
/*  Root                                                              */
/* ------------------------------------------------------------------ */

export type ComboboxRootProps = PropsOf<"div"> & {
  /** Starting value when nothing is bound. */
  value?: string;
  /** Two-way state: the chosen option's `value`. */
  "bind:value"?: Signal<string>;
  /** Called when an option is chosen or the field is cleared. */
  onValueChange$?: QRL<(value: string) => void>;
  disabled?: boolean;
  /** Form field name: a hidden input posts the chosen value. */
  name?: string;
  /** Error message under the field; also marks the input `aria-invalid`. */
  error?: string;
  /** The chosen value's label at first render (shown in the input). */
  displayValue?: string;
  /** `outlined` (M3, default) or `tonal` (e-store's compact filled field, no floating label). */
  variant?: ComboboxVariant;
};

const Root = component$<ComboboxRootProps>((props) => {
  /* eslint-disable @typescript-eslint/no-unused-vars -- pulled out so they never reach the DOM */
  const {
    value: givenValue,
    "bind:value": bindValue,
    onValueChange$,
    disabled: _disabled,
    name,
    error: _error,
    displayValue,
    variant: _variant,
    // The id belongs to the input (the control), not this wrapper.
    id: givenId,
    class: className,
    ...rest
  } = props;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const open = useSignal(false);
  const selectedValue = useBoundSignal(bindValue, givenValue ?? "");
  const selectedLabel = useSignal(displayValue ?? "");
  const search = useSignal(displayValue ?? "");
  const highlightedId = useSignal("");

  const generatedId = useId();
  const inputId = givenId ?? `${generatedId}-input`;
  const contentId = `${generatedId}-listbox`;
  const errorId = `${generatedId}-error`;
  // A dashed-ident: a consumer id may hold characters an ident cannot.
  const anchorName = `--combobox-${generatedId.replace(/[^\w-]/g, "")}`;
  const inputRef = useSignal<HTMLInputElement | undefined>();
  const contentRef = useSignal<HTMLElement | undefined>();

  const state: {
    disabled?: boolean;
    error?: string;
    variant?: ComboboxVariant;
  } = props;
  const disabled = useComputed$(() => state.disabled ?? false);
  const variant = useComputed$(() => state.variant ?? "outlined");
  const error = useComputed$(() => state.error || undefined);

  const selectItem$ = $((value: string, label: string) => {
    selectedValue.value = value;
    selectedLabel.value = label;
    search.value = label;
    highlightedId.value = "";
    onValueChange$?.(value);
    contentRef.value?.hidePopover();
    inputRef.value?.focus();
  });

  const clear$ = $(() => {
    search.value = "";
    selectedLabel.value = "";
    highlightedId.value = "";
    if (selectedValue.value !== "") {
      selectedValue.value = "";
      onValueChange$?.("");
    }
    inputRef.value?.focus();
  });

  useContextProvider(comboboxContextId, {
    open,
    search,
    selectedValue,
    selectedLabel,
    highlightedId,
    inputId,
    contentId,
    errorId,
    anchorName,
    inputRef,
    contentRef,
    disabled,
    error,
    variant,
    selectItem$,
    clear$,
  });

  const styles = comboboxVariants();
  return (
    <div
      {...rest}
      data-qds-combobox=""
      // State for the styles only (a plain div may not carry aria-expanded / aria-invalid).
      data-open={open.value ? "" : undefined}
      data-invalid={error.value ? "" : undefined}
      class={[styles.root(), className]}
    >
      <Slot />
      {name && <input type="hidden" name={name} value={selectedValue.value} />}
      {error.value && (
        <div id={errorId} class={styles.error()}>
          {error.value}
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Input                                                             */
/* ------------------------------------------------------------------ */

/** Claimed synchronously: arrows must not move the caret, Enter on an option must not submit. */
const claimKeys = sync$((event: KeyboardEvent) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    return;
  }
  if (event.key !== "Enter") return;
  const input = event.target as HTMLInputElement | null;
  const id = input?.getAttribute?.("aria-activedescendant");
  if (id && input?.getAttribute("aria-expanded") === "true")
    event.preventDefault();
});

export type ComboboxInputProps = Omit<
  PropsOf<"input">,
  "type" | "onInput$" | "onKeyDown$" | "onClick$"
> & {
  /** Floating label (M3 outlined text field). */
  label?: string;
  /** Shown once the label has floated and the field is empty. */
  placeholder?: string;
  /** Icon of the button while the field has text (clears it). */
  clearIcon?: IconName;
  /** Icon of the button while the field is empty (opens the list). */
  expandIcon?: IconName;
  /** Name of the button while the field has text. */
  clearLabel?: string;
  /** Name of the button while the field is empty. */
  openLabel?: string;
  onInput$?: QRL<(event: InputEvent, element: HTMLInputElement) => void>;
  onKeyDown$?: QRL<(event: KeyboardEvent, element: HTMLInputElement) => void>;
  onClick$?: QRL<(event: PointerEvent, element: HTMLInputElement) => void>;
};

const Input = component$<ComboboxInputProps>(
  ({
    label,
    placeholder = " ",
    clearIcon = "close",
    expandIcon = "expand_more",
    clearLabel = "Clear",
    openLabel = "Show options",
    onInput$,
    onKeyDown$,
    onClick$,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(comboboxContextId);

    const show$ = $(() => {
      if (ctx.disabled.value || !ctx.contentRef.value) return;
      openPopover(ctx.contentRef.value);
    });

    const handleInput$ = $((_: InputEvent, input: HTMLInputElement) => {
      ctx.search.value = input.value;
      // The options under the highlight may have just been filtered out.
      ctx.highlightedId.value = "";
      show$();
    });

    const handleKeyDown$ = $(async (event: KeyboardEvent) => {
      const content = ctx.contentRef.value;
      if (!content) return;
      if (event.key === "Escape") {
        // A manual popover has no Escape of its own.
        if (ctx.open.value) content.hidePopover();
        return;
      }
      if (event.key === "Enter") {
        if (!ctx.open.value || !ctx.highlightedId.value) return;
        document.getElementById(ctx.highlightedId.value)?.click();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!ctx.open.value) await show$();
      const options = Array.from(
        content.querySelectorAll<HTMLElement>(
          '[role="option"]:not([aria-disabled="true"]):not([hidden])',
        ),
      );
      if (options.length === 0) return;
      const current = options.findIndex(
        (option) => option.id === ctx.highlightedId.value,
      );
      const down = event.key === "ArrowDown";
      const next =
        current === -1
          ? down
            ? 0
            : options.length - 1
          : (current + (down ? 1 : -1) + options.length) % options.length;
      ctx.highlightedId.value = options[next].id;
      options[next].scrollIntoView({ block: "nearest" });
    });

    // Clear mode only. In open mode the button is the popover's invoker (`popovertarget`): the
    // browser toggles the list, and a click on an invoker is not a light dismiss, so there is no
    // race between the light dismiss and this handler.
    // APG: the list closes when the field loses focus (Tab, a click elsewhere). Focus never
    // moves into the list or the button (both `preventdefault:mousedown`).
    const handleFocusOut$ = $(() => {
      if (ctx.open.value) ctx.contentRef.value?.hidePopover();
    });

    const handleButton$ = $(() => {
      if (ctx.search.value) ctx.clear$();
      else ctx.inputRef.value?.focus();
    });

    return (
      <div
        data-qds-combobox-trigger=""
        class={comboboxVariants({ variant: ctx.variant.value }).trigger()}
        style={{ anchorName: ctx.anchorName }}
      >
        <input
          {...rest}
          ref={ctx.inputRef}
          id={ctx.inputId}
          type="text"
          role="combobox"
          autocomplete="off"
          aria-autocomplete="list"
          aria-expanded={ctx.open.value}
          aria-controls={ctx.contentId}
          aria-activedescendant={ctx.highlightedId.value || undefined}
          // Tonal hides the label (display: none), which then names nothing through `for`.
          aria-labelledby={
            label && ctx.variant.value === "tonal"
              ? `${ctx.inputId}-label`
              : rest["aria-labelledby"]
          }
          aria-invalid={ctx.error.value ? "true" : undefined}
          aria-describedby={ctx.error.value ? ctx.errorId : undefined}
          disabled={ctx.disabled.value || undefined}
          placeholder={placeholder}
          value={ctx.search.value}
          onInput$={[handleInput$, onInput$]}
          onKeyDown$={[claimKeys, handleKeyDown$, onKeyDown$]}
          onClick$={[show$, onClick$]}
          onFocusOut$={handleFocusOut$}
          class={[
            comboboxVariants({ variant: ctx.variant.value }).input(),
            className,
          ]}
        />
        {label && (
          <label
            id={`${ctx.inputId}-label`}
            for={ctx.inputId}
            class={comboboxVariants({ variant: ctx.variant.value }).label()}
          >
            {label}
          </label>
        )}
        {/* Not a Tab stop (APG combobox: the input is the one stop); the keyboard has Escape,
            the arrows and select-all + Delete. */}
        <button
          type="button"
          tabIndex={-1}
          aria-label={ctx.search.value ? clearLabel : openLabel}
          aria-controls={ctx.contentId}
          popovertarget={ctx.search.value ? undefined : ctx.contentId}
          disabled={ctx.disabled.value || undefined}
          // Focus stays in the input.
          preventdefault:mousedown
          class={comboboxVariants().button()}
          onClick$={handleButton$}
        >
          <Icon
            name={ctx.search.value ? clearIcon : expandIcon}
            class={[
              "transition-transform duration-short-4 ease-standard motion-reduce:transition-none",
              !ctx.search.value && ctx.open.value ? "rotate-180" : "",
            ]}
          />
        </button>
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Content                                                           */
/* ------------------------------------------------------------------ */

export type ComboboxContentProps = Omit<PropsOf<"div">, "onToggle$"> & {
  onToggle$?: QRL<(event: ToggleEvent, element: HTMLDivElement) => void>;
};

const Content = component$<ComboboxContentProps>(
  ({ onToggle$, class: className, ...rest }) => {
    const ctx = useContext(comboboxContextId);
    const styles = comboboxVariants();

    const handleToggle$ = $((event: ToggleEvent) => {
      const isOpen = event.newState === "open";
      ctx.open.value = isOpen;
      if (isOpen) return;
      // Closing without a choice puts the chosen option's label back.
      ctx.search.value = ctx.selectedLabel.value;
      ctx.highlightedId.value = "";
    });

    return (
      <div
        {...rest}
        data-qds-combobox-content=""
        ref={ctx.contentRef}
        id={ctx.contentId}
        // Manual, not auto: an auto popover is light-dismissed by a pointerdown in the input
        // (neither inside it nor its invoker), which put the chosen label back over the typed
        // text. The input closes it on Escape and on focus out (APG).
        popover="manual"
        role="listbox"
        // The field's label. The input itself would name the list after the typed text
        // (accname 1.2 step 2E reads an embedded textbox's value).
        aria-labelledby={`${ctx.inputId}-label`}
        // Focus stays on the input; a scrollable popover is otherwise a Tab stop in Chrome.
        tabIndex={-1}
        preventdefault:mousedown
        onToggle$={[handleToggle$, onToggle$]}
        style={{
          positionAnchor: ctx.anchorName,
          // Logical, and `self-start`: a top-layer popover's containing block is the viewport, so
          // plain `anchor(start)` resolves in the ROOT's direction, not the field's. Checked in
          // Chrome with `dir="rtl"` on the root: `left: anchor(start)` and
          // `inset-inline-start: anchor(start)` both put the list off the field's left edge.
          insetBlockStart: "calc(anchor(end) + 4px)",
          insetInlineStart: "anchor(self-start)",
          minWidth: "anchor-size(width)",
          positionTryFallbacks: "flip-block",
        }}
        class={[
          styles.content(),
          // Combobox.Empty shows when no option is visible.
          "[&:not(:has([role=option]:not([hidden])))_[data-qds-combobox-empty]]:block",
          className,
        ]}
      >
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Item                                                              */
/* ------------------------------------------------------------------ */

export type ComboboxItemProps = Omit<PropsOf<"div">, "onClick$"> & {
  /** The value this option stands for. */
  value: string;
  /** Its text: shown, matched, and put in the input when chosen. Children follow it (extra content). */
  label: string;
  disabled?: boolean;
  /** More words that match it (besides `label`). */
  keywords?: string[];
  /** Icon shown on the chosen option. */
  selectedIcon?: IconName;
  onClick$?: QRL<(event: PointerEvent, element: HTMLDivElement) => void>;
};

const Item = component$<ComboboxItemProps>(
  ({
    value,
    label,
    disabled,
    keywords,
    selectedIcon = "check",
    onClick$,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(comboboxContextId);
    const itemId = useId();
    // Fixed for the item's lifetime: label and keywords are its identity.
    const matchText = [label, ...(keywords ?? [])].join(" ").toLowerCase();
    const isSelected = useComputed$(() => ctx.selectedValue.value === value);
    const isHidden = useComputed$(() => {
      const term = ctx.search.value.trim().toLowerCase();
      // The chosen label in the field is not a search: show everything.
      if (!term || term === ctx.selectedLabel.value.toLowerCase()) return false;
      return !matchText.includes(term);
    });
    const choose$ = $(() => {
      if (!disabled) ctx.selectItem$(value, label);
    });
    const styles = comboboxVariants();

    return (
      <div
        {...rest}
        data-qds-combobox-item=""
        id={itemId}
        role="option"
        aria-selected={isSelected.value}
        aria-disabled={disabled || undefined}
        data-highlighted={ctx.highlightedId.value === itemId ? "" : undefined}
        data-value={value}
        hidden={isHidden.value || undefined}
        // The pointer must not take focus from the input.
        preventdefault:mousedown
        onClick$={[choose$, onClick$]}
        class={[styles.item(), className]}
      >
        {isSelected.value && (
          <Icon name={selectedIcon} size="sm" class="shrink-0" />
        )}
        <span class="flex-1 truncate">{label}</span>
        <Slot />
      </div>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Group, GroupLabel, Empty                                          */
/* ------------------------------------------------------------------ */

const Group = component$<PropsOf<"div">>(({ class: className, ...rest }) => {
  const groupId = useId();
  const labelId = `${groupId}-label`;
  useContextProvider(groupContextId, { labelId });
  const styles = comboboxVariants();
  return (
    <div
      {...rest}
      role="group"
      aria-labelledby={labelId}
      class={[styles.group(), className]}
    >
      <Slot />
    </div>
  );
});

const GroupLabel = component$<PropsOf<"div">>(
  ({ class: className, ...rest }) => {
    const group = useContext(groupContextId, null);
    const styles = comboboxVariants();
    return (
      <div
        {...rest}
        id={group?.labelId}
        role="presentation"
        class={[styles.groupLabel(), className]}
      >
        <Slot />
      </div>
    );
  },
);

const Empty = component$<PropsOf<"div">>(({ class: className, ...rest }) => {
  const styles = comboboxVariants();
  // `role="none"`: a listbox may own only options and groups (axe aria-required-children).
  return (
    <div
      {...rest}
      data-qds-combobox-empty=""
      role="none"
      class={[styles.empty(), className]}
    >
      <Slot />
    </div>
  );
});

export const Combobox = {
  Root,
  Input,
  Content,
  Item,
  Group,
  GroupLabel,
  Empty,
};
