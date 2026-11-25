import {
  $,
  Slot,
  component$,
  createContextId,
  sync$,
  useContext,
  useContextProvider,
  useId,
  useOnDocument,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";
import { tv } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { IconButton } from "../icon-button";
import { Modal } from "../modal";
import { safeHref } from "../../utils/safe-href";
import { useBoundSignal } from "../../utils/use-bound-signal";

/**
 * Material Design 3 search, ported from e-store's `components/search/search.tsx` (2026-11-23):
 * the same parts (`Search.Root`, `Bar`, `View`, `Trigger`), prop names and context.
 *
 * - `layout="fullscreen"` (e-store's default): `Search.Bar` is a button; `Search.View` is a
 *   full-screen `<dialog>` (our `Modal`, `showModal()`) holding the real input and the results.
 * - `layout="docked"`: `Search.Bar` IS the input; `Search.View` drops below it.
 * - `layout="adaptive"` (NEW, not in e-store): M3's adaptive rule, "full-screen in compact
 *   windows, docked in larger breakpoints". Below 600px only `Search.Trigger` (an icon button)
 *   shows and opens the full-screen view; from 600px only `Search.Bar` (docked) shows. Which one
 *   shows is the component's own CSS (`max-sm:hidden` / `sm:hidden`), never a breakpoint read in
 *   render; which surface is open is STATE (`surface`), set by the control that opened it.
 *
 * Differs from e-store: native `<dialog>` through our `Modal` (no Qwik UI HModal); `useId()` for
 * the ARIA ids (e-store: a module counter, which gives a new id whenever Root re-renders on the
 * client); the highlighted option is state (`activeId`) that `Search.Item` renders; the
 * full-screen bar is M3's filled 56dp container (e-store: an outlined 64dp bar). Left out: `look`,
 * `fused`, the `dense` size, the `leading` / `trailing` slots, `onQueryChange$` (use `bind:query`).
 *
 * Site search (2026-11-24, owner-approved NEW parts, see search.md): `keyboardShortcut`
 * (e-store's Cmd/Ctrl+K, default OFF here: a page may hold several searches), `showOnEmpty`
 * (the view opens on an empty query, for recent searches), a `filters` slot outside the listbox
 * (a chip row), `Search.Group` (a heading over options) and `Search.Item` `supportingText`,
 * `keepOpen`, `onRemove$`, `disabled`.
 *
 * @see https://m3.material.io/components/search/specs
 * @see https://m3.material.io/components/search/guidelines
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 */

// ─── Context ─────────────────────────────────────────────────────────────────

export type SearchLayout = "fullscreen" | "docked" | "adaptive";
type SearchSurface = "fullscreen" | "docked";

interface SearchContext {
  open: Signal<boolean>;
  query: Signal<string>;
  /** Unique id prefix for the ARIA relationships. */
  searchId: string;
  /** The id of the keyboard-highlighted option ("" = none): the input's `aria-activedescendant`. */
  activeId: Signal<string>;
  layout: SearchLayout;
  /** Which view is open. Fixed for `fullscreen` / `docked`; `adaptive` sets it from the opener. */
  surface: Signal<SearchSurface>;
  /** The docked bar's input, for focus. */
  inputRef: Signal<HTMLInputElement | undefined>;
  /** The root, for the docked view's click outside. */
  rootRef: Signal<HTMLElement | undefined>;
  /**
   * `adaptive`, from 600px: the Trigger has turned into the docked Bar. Starts `false` (the
   * icon); Escape on an empty field or focus leaving it empty turns it back.
   */
  expanded: Signal<boolean>;
  /** The view opens with an empty query too (recent searches, suggestions). */
  showOnEmpty: boolean;
}

export const searchContextId = createContextId<SearchContext>("search.context");

// ─── Variants ────────────────────────────────────────────────────────────────

/** The root (new: e-store sets `relative` inline for docked). */
export const searchRootVariants = tv({
  base: [],
  variants: {
    layout: {
      fullscreen: [],
      docked: ["relative", "w-full"],
      // In an app bar's middle column: the icon at its end when compact, the bar centred after.
      adaptive: ["relative", "flex", "w-full", "items-center", "justify-end"],
    },
  },
  defaultVariants: { layout: "fullscreen" },
});

export const searchBarVariants = tv({
  base: [
    "relative flex items-center text-on-surface-variant",
    "w-full rounded-full",
    "bg-surface-container-high focus-within:bg-surface-container-highest",
    "transition-all duration-medium-2 ease-standard motion-reduce:transition-none",
  ],
  variants: {
    // M3: 24dp padding unfocused, 12dp focused (search bar measurements).
    focused: {
      true: "gap-1 ps-3 pe-3",
      false: "gap-1 ps-6 pe-6",
    },
    disabled: {
      true: "pointer-events-none cursor-default opacity-disabled",
    },
    size: {
      default: "h-14 max-w-180 min-w-90",
      compact: "h-12 max-w-180 min-w-0",
    },
    /**
     * `layout="adaptive"`: the bar shows only once the Trigger expanded it, and never below 600px
     * (there the Trigger opens the full-screen view).
     */
    expand: {
      collapsed: "hidden",
      expanded: "max-sm:hidden",
    },
  },
  defaultVariants: { focused: false, size: "default" },
});

export const searchViewVariants = tv({
  slots: {
    // Docked: under the bar, as wide as it (M3: min 240dp, max 2/3 of the screen high).
    docked: [
      // No option, no box (no empty 240dp card under the bar).
      "not-has-[[role=option]]:hidden",
      "absolute top-full z-50 mt-1 flex flex-col",
      "max-h-[66vh] min-h-60 w-full max-w-180 overflow-hidden",
      "rounded-xl bg-surface-container-high shadow-3",
    ],
    // The docked card's listbox: it scrolls, under the filters row.
    dockedList: [
      "min-h-0 flex-1 overflow-y-auto overscroll-contain py-2",
      // Our scrollbar (tokens/utilities.css); the default 20px track margin clears the 28dp corners.
      "scrollbar-pane",
    ],
    // The `filters` slot (a ChipGroup), outside the listbox; nothing projected, no row.
    filters: ["not-has-[*]:hidden", "shrink-0 px-4 pt-3 pb-1"],
    // Full screen: M3 contained style, the view is surface-container-low.
    dialog: ["bg-surface-container-low!"],
    column: ["mx-auto", "flex", "h-full", "w-full", "max-w-180", "flex-col"],
    barRow: ["px-2", "pt-2", "sm:px-4", "sm:pt-3"],
    // The focused bar in the full-screen view: filled, 56dp (M3 full-screen color roles).
    bar: [
      "flex h-14 items-center gap-1 rounded-full ps-2 pe-2",
      "bg-surface-container-high text-on-surface-variant",
    ],
    input: [
      "text-body-large text-on-surface placeholder:text-on-surface-variant",
      "min-w-0 flex-1 border-none bg-transparent outline-none",
      "[&::-webkit-search-cancel-button]:hidden",
    ],
    list: [
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
      "overscroll-contain",
      // Our scrollbar; square ends, so no corner clearance.
      "scrollbar-pane",
      "[--scrollbar-track-margin:0px]",
      "py-2",
    ],
  },
  variants: {
    /** The docked list lines up with its bar: at the start (`docked`), at the end (`adaptive`,
     * where the bar sits at the end of its column, and is hidden below 600px). */
    layout: {
      fullscreen: {},
      docked: { docked: "inset-s-0" },
      adaptive: { docked: "inset-e-0 max-sm:hidden" },
    },
  },
});

/** One result row: an M3 one-line list item (56dp) with the Combobox's highlight. */
export const searchItemVariants = tv({
  base: [
    "relative flex min-h-14 w-full cursor-pointer items-center gap-4 px-4 py-2",
    "text-body-large text-on-surface outline-none select-none",
    "transition-colors duration-short-4 ease-standard motion-reduce:transition-none",
    "hover:bg-on-surface/8 data-highlighted:bg-on-surface/12",
    // The keyboard's current option also gets an inward ring (focus stays in the input).
    "data-highlighted:outline-3 data-highlighted:-outline-offset-3 data-highlighted:outline-secondary",
    "[&>svg]:text-on-surface-variant",
    // With supporting text: M3's two-line list item, 72dp (found with :has(), the CMS rule).
    "has-data-search-supporting:min-h-18",
    // `disabled` (a "no results" line): not chosen, no state layer.
    "aria-disabled:cursor-default aria-disabled:text-on-surface-variant aria-disabled:hover:bg-transparent",
  ],
});

/** `Search.Group`: a heading over options (as Dropdown's group label, 48dp, label-large). */
export const searchGroupVariants = tv({
  slots: {
    root: "py-1",
    heading:
      "flex h-12 items-center px-4 text-label-large text-on-surface-variant select-none",
  },
});

// ─── Keyboard (shared by the docked bar and the full-screen input) ──────────

/**
 * Arrow keys must not move the caret. Escape must not do its native jobs: in a `type=search`
 * field Chrome's first Escape only clears the text (checked 2026-11-23), and in the dialog it
 * would close the `<dialog>` behind Qwik's back. `createKeyNav` closes instead, in one press.
 */
const preventSearchKeys = sync$(
  (event: KeyboardEvent, input: HTMLInputElement) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Escape" ||
      // Enter chooses the highlighted option; it must not also submit a surrounding form.
      (event.key === "Enter" && input.hasAttribute("aria-activedescendant")) ||
      // Delete removes a highlighted removable option (a recent search), not a character.
      (event.key === "Delete" &&
        document
          .getElementById(input.getAttribute("aria-activedescendant") ?? "")
          ?.querySelector("[data-search-remove]"))
    ) {
      event.preventDefault();
    }
  },
);

/**
 * APG combobox keys: ArrowDown / ArrowUp move the highlight (wrapping), Enter chooses it,
 * Escape closes.
 */
const createKeyNav = (ctx: SearchContext, listId: string) =>
  $((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      // APG: Escape on a closed docked list clears the field.
      if (ctx.surface.value === "docked" && !ctx.open.value) {
        if (ctx.query.value) {
          ctx.query.value = "";
        } else if (ctx.expanded.value) {
          // `adaptive`: back to the icon, and focus with it (the bar is about to be hidden).
          ctx.expanded.value = false;
          focusTriggerWhenShown(ctx.rootRef.value, 10);
        }
        return;
      }
      // Docked: closes the list and KEEPS focus in the input (APG combobox). Full screen: closes
      // the dialog, and the browser returns focus to the control that opened it.
      ctx.open.value = false;
      ctx.activeId.value = "";
      if (ctx.surface.value === "fullscreen") ctx.query.value = "";
      return;
    }
    if (event.key === "Enter") {
      if (ctx.activeId.value)
        document.getElementById(ctx.activeId.value)?.click();
      return;
    }
    if (event.key === "Delete") {
      // The highlighted option's remove button (`Search.Item onRemove$`), if it has one.
      const remove = ctx.activeId.value
        ? document
            .getElementById(ctx.activeId.value)
            ?.querySelector<HTMLElement>("[data-search-remove]")
        : null;
      if (remove) {
        ctx.activeId.value = "";
        remove.click();
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!ctx.open.value && (ctx.query.value.trim() || ctx.showOnEmpty))
      ctx.open.value = true;
    const list = document.getElementById(listId);
    const options = Array.from(
      list?.querySelectorAll<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"])',
      ) ?? [],
    ).filter((option) => option.id);
    if (options.length === 0) return;
    const current = options.findIndex(
      (option) => option.id === ctx.activeId.value,
    );
    const next =
      event.key === "ArrowDown"
        ? (current + 1) % options.length
        : current <= 0
          ? options.length - 1
          : current - 1;
    ctx.activeId.value = options[next].id;
    options[next].scrollIntoView({ block: "nearest" });
  });

/**
 * A press in the result list must not move focus out of the input (APG combobox: focus stays on
 * the combobox). Without this the press focuses the nearest focusable ancestor (a supporting
 * pane is one), the Root's focus-out closes the docked list, the list unmounts under the pointer
 * and the click never reaches the option (Chrome, 2026-11-24).
 *
 * A handler, not the bare `preventdefault:mousedown` attribute: qwikloader only listens to event
 * types that some element has a handler for (`registerQwikLoaderEvent` runs from the handler path
 * only; its defaults are `click` and `input`), so with no `onMouseDown$` on the page the attribute
 * was never read (installed `@qwik.dev/core` 2.0.0-rc.5, `qwikloader.debug.js` `dispatch`,
 * `core.mjs` `registerQwikLoaderEvent`). Touch: the compatibility mousedown comes after the touch
 * ends and is prevented the same way; the click still fires.
 */
const keepInputFocus = sync$((event: MouseEvent) => {
  event.preventDefault();
});

/**
 * Focuses an element that a state change is about to show: Qwik renders it on its own schedule,
 * so this tries once per frame (at most `frames` times) until the element takes focus.
 */
const focusWhenShown = (
  ref: Signal<HTMLElement | undefined>,
  frames: number,
): void => {
  requestAnimationFrame(() => {
    const element = ref.value;
    element?.focus();
    if (document.activeElement !== element && frames > 1)
      focusWhenShown(ref, frames - 1);
  });
};

/**
 * `adaptive`: focuses the Trigger once the collapse has shown it again (it is `display: none`
 * while the bar is expanded, and Qwik re-renders on its own schedule: one frame was not always
 * enough, Chrome 2026-11-24, focus fell to the body). Tries once per frame, at most `frames`.
 */
const focusTriggerWhenShown = (
  root: HTMLElement | undefined,
  frames: number,
): void => {
  requestAnimationFrame(() => {
    const trigger = root?.querySelector<HTMLElement>("[data-search-trigger]");
    trigger?.focus();
    if (trigger && document.activeElement !== trigger && frames > 1)
      focusTriggerWhenShown(root, frames - 1);
  });
};

/**
 * Opens the search as its entry point would (`Search.Trigger`, Cmd/Ctrl+K): docked, focus the
 * bar; `adaptive` from 600px, expand the icon into the bar and focus it; otherwise the
 * full-screen view. The width is read here, in a handler, never in render (L19).
 */
const openSearch = (ctx: SearchContext): void => {
  if (ctx.layout === "docked") {
    ctx.open.value = true;
    ctx.inputRef.value?.focus();
  } else if (
    ctx.layout === "adaptive" &&
    matchMedia("(min-width: 600px)").matches
  ) {
    // The input shows after this render, so it is focused on a later frame (as Menu does).
    ctx.surface.value = "docked";
    ctx.expanded.value = true;
    if (ctx.showOnEmpty) ctx.open.value = true;
    focusWhenShown(ctx.inputRef, 10);
  } else {
    ctx.surface.value = "fullscreen";
    ctx.open.value = true;
  }
};

/**
 * Cmd/Ctrl+K must be prevented synchronously (Chrome on Windows / Linux focuses the address bar).
 * A `sync$` closes over nothing, so it asks the DOM whether a search with the shortcut is on the
 * page (e-store's pattern; the Qwik sync-events cookbook's data-attribute workaround).
 */
const preventShortcut = sync$((event: KeyboardEvent) => {
  if (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "k" &&
    document.querySelector("[data-search-root][data-keyboard-shortcut]")
  )
    event.preventDefault();
});

// ─── Search.Root ─────────────────────────────────────────────────────────────

export type SearchRootProps = PropsOf<"div"> & {
  /** Two-way binding for the open state. */
  "bind:open"?: Signal<boolean>;
  /** Two-way binding for the query. */
  "bind:query"?: Signal<string>;
  /**
   * `fullscreen` (default): the view is a full-screen dialog. `docked`: results drop below the
   * bar. `adaptive`: full-screen from an icon below 600px, docked bar from 600px (M3).
   */
  layout?: SearchLayout;
  /**
   * Cmd+K / Ctrl+K opens this search (e-store's prop). Default `false` (e-store: `true`): a page
   * may hold more than one search (the site's app bar and the Maps panel's), and only one may
   * answer the shortcut.
   */
  keyboardShortcut?: boolean;
  /**
   * The view also opens with an empty query (focusing the docked bar opens it, at either size),
   * for recent searches or suggestions (M3: the search view "can display recent searches"). With
   * nothing to show it stays hidden. Default `false`: opens once there is text.
   */
  showOnEmpty?: boolean;
};

const Root = component$<SearchRootProps>(
  ({
    "bind:open": bindOpen,
    "bind:query": bindQuery,
    layout = "fullscreen",
    keyboardShortcut = false,
    showOnEmpty = false,
    class: className,
    ...rest
  }) => {
    const open = useBoundSignal<boolean>(bindOpen, false);
    const query = useBoundSignal<string>(bindQuery, "");
    const activeId = useSignal("");
    const surface = useSignal<SearchSurface>(
      layout === "fullscreen" ? "fullscreen" : "docked",
    );
    const inputRef = useSignal<HTMLInputElement>();
    const rootRef = useSignal<HTMLElement>();
    const searchId = useId();
    const expanded = useSignal(false);

    const ctx: SearchContext = {
      open,
      query,
      searchId,
      activeId,
      layout,
      surface,
      inputRef,
      rootRef,
      expanded,
      showOnEmpty,
    };
    useContextProvider(searchContextId, ctx);

    // Cmd/Ctrl+K (e-store's): two document listeners, the `sync$` one prevents the browser's
    // default (only while a search with the shortcut is on the page), this one opens (only this
    // search's own, when enabled).
    useOnDocument("keydown", preventShortcut);
    useOnDocument(
      "keydown",
      $((event: Event) => {
        const key = event as KeyboardEvent;
        if (
          !keyboardShortcut ||
          !(key.metaKey || key.ctrlKey) ||
          key.altKey ||
          key.shiftKey ||
          key.key.toLowerCase() !== "k"
        )
          return;
        // Already in the docked bar: select its text, as a second press in a browser's search does.
        if (surface.value === "docked" && document.activeElement === inputRef.value) {
          inputRef.value?.select();
          return;
        }
        openSearch(ctx);
      }),
    );

    useTask$(({ track }) => {
      if (!track(open)) activeId.value = "";
    });

    // Docked: a press outside the search closes its list (e-store's).
    useOnDocument(
      "pointerdown",
      $((event: Event) => {
        if (surface.value !== "docked" || !open.value) return;
        const target = event.target as Node;
        if (rootRef.value && !rootRef.value.contains(target)) {
          open.value = false;
        }
      }),
    );

    return (
      <div
        {...rest}
        ref={rootRef}
        role="search"
        data-search-root=""
        data-search-layout={layout}
        // Read by `preventShortcut` (a `sync$` cannot close over the prop).
        data-keyboard-shortcut={keyboardShortcut ? "" : undefined}
        class={[searchRootVariants({ layout }), className]}
        // Tab out of the search closes the docked list. A press elsewhere is the document
        // listener's: Safari does not focus a clicked button, so it has no `relatedTarget`.
        onFocusOut$={(event: FocusEvent, element: HTMLDivElement) => {
          const next = event.relatedTarget as Node | null;
          if (surface.value === "docked" && next && !element.contains(next))
            open.value = false;
          // `adaptive`: the bar's INPUT losing focus to anything outside the search, while empty,
          // turns the bar back into the icon. Only the input counts: expanding hides the focused
          // icon, which is a focusout too.
          if (
            expanded.value &&
            event.target === inputRef.value &&
            !query.value.trim() &&
            (!next || !element.contains(next))
          ) {
            open.value = false;
            expanded.value = false;
          }
        }}
      >
        <Slot />
      </div>
    );
  },
);

// ─── Search.Bar ──────────────────────────────────────────────────────────────

export type SearchBarProps = Omit<PropsOf<"div">, "children"> & {
  /** M3 "supporting text"; also the accessible name without `aria-label`. Default "Search". */
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  /** The leading search icon. */
  searchIcon?: IconName;
  /** The back button (docked, focused, default size). */
  backIcon?: IconName;
  backLabel?: string;
  /** The clear button (docked, focused, with text). */
  clearIcon?: IconName;
  clearLabel?: string;
  /** `default` 56dp, min 360px; `compact` 48dp, for a top app bar. */
  size?: "default" | "compact";
  /** The docked input's `name` (the query parameter in a GET form). Default "q". */
  name?: string;
  /** The docked input's `id`, e.g. for a `<label for>`. */
  inputId?: string;
};

const Bar = component$<SearchBarProps>(
  ({
    placeholder = "Search",
    disabled,
    "aria-label": ariaLabel,
    searchIcon = "search",
    backIcon = "arrow_back",
    backLabel = "Close search",
    clearIcon = "close",
    clearLabel = "Clear search",
    size = "default",
    name = "q",
    inputId,
    class: className,
    ...rest
  }) => {
    const ctx = useContext(searchContextId);

    if (ctx.layout === "fullscreen") {
      // A button that opens the full-screen view, whose dialog holds the real input.
      return (
        <button
          {...(rest as PropsOf<"button">)}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          aria-haspopup="dialog"
          class={[
            searchBarVariants({ focused: false, disabled, size }),
            "focus-ring cursor-pointer",
            className,
          ]}
          onClick$={() => {
            ctx.surface.value = "fullscreen";
            ctx.open.value = true;
          }}
        >
          <Icon name={searchIcon} class="shrink-0" />
          <span class="min-w-0 flex-1 truncate text-start text-body-large">
            {placeholder}
          </span>
        </button>
      );
    }

    // ─── Docked: the real input ───────────────────────────────────────────
    const resultsId = `${ctx.searchId}-results`;
    const keyNav$ = createKeyNav(ctx, resultsId);

    const handleInput$ = $((event: Event) => {
      const value = (event.target as HTMLInputElement).value;
      ctx.surface.value = "docked";
      ctx.query.value = value;
      ctx.activeId.value = "";
      if ((value.trim() || ctx.showOnEmpty) && !ctx.open.value)
        ctx.open.value = true;
    });

    const handleFocus$ = $(() => {
      ctx.surface.value = "docked";
      // Compact opens on typing only (e-store's: a focus re-render there stole the focus), unless
      // the view has something for an empty query (`showOnEmpty`).
      if ((size !== "compact" || ctx.showOnEmpty) && !ctx.open.value)
        ctx.open.value = true;
    });

    const handleClose$ = $(() => {
      ctx.open.value = false;
      ctx.query.value = "";
      // M3: the back icon releases focus and returns the bar to its first state.
      ctx.inputRef.value?.blur();
    });

    const handleClear$ = $(() => {
      ctx.query.value = "";
      ctx.activeId.value = "";
      ctx.inputRef.value?.focus();
    });

    return (
      <div
        {...rest}
        data-focus-indicator="search-view"
        class={[
          searchBarVariants({
            focused: ctx.open.value,
            disabled,
            size,
            expand:
              ctx.layout !== "adaptive"
                ? undefined
                : ctx.expanded.value
                  ? "expanded"
                  : "collapsed",
          }),
          className,
        ]}
      >
        {/* A stable wrapper: swapping the icon for the back button as a direct sibling of the
            input made Qwik move the input, which dropped its focus (e-store, 2026-11-16). */}
        <span class="flex shrink-0 items-center">
          {ctx.open.value && size !== "compact" ? (
            <IconButton
              icon={backIcon}
              label={backLabel}
              onClick$={handleClose$}
            />
          ) : (
            <Icon name={searchIcon} class="shrink-0" />
          )}
        </span>
        <input
          ref={ctx.inputRef}
          type="search"
          role="combobox"
          id={inputId}
          name={name}
          value={ctx.query.value}
          placeholder={placeholder}
          autocomplete="off"
          disabled={disabled}
          aria-label={ariaLabel ?? placeholder}
          aria-autocomplete="list"
          // The list renders only while open with a query (or `showOnEmpty`): point at it only then.
          aria-expanded={
            ctx.open.value && (ctx.showOnEmpty || !!ctx.query.value.trim())
          }
          aria-controls={
            ctx.open.value && (ctx.showOnEmpty || ctx.query.value.trim())
              ? resultsId
              : undefined
          }
          aria-activedescendant={ctx.activeId.value || undefined}
          onInput$={handleInput$}
          onFocus$={handleFocus$}
          onKeyDown$={[preventSearchKeys, keyNav$]}
          class={searchViewVariants().input()}
        />
        {ctx.open.value && ctx.query.value && (
          <IconButton
            icon={clearIcon}
            label={clearLabel}
            onClick$={handleClear$}
          />
        )}
      </div>
    );
  },
);

// ─── Search.View ─────────────────────────────────────────────────────────────

export type SearchViewProps = {
  class?: PropsOf<"div">["class"];
  /** Placeholder (and name) of the full-screen input. Default "Search". */
  placeholder?: string;
  backIcon?: IconName;
  backLabel?: string;
  clearIcon?: IconName;
  clearLabel?: string;
  /** The full-screen input's `name`. Default "q". */
  name?: string;
  /** The result list's accessible name. Default "Results". */
  resultsLabel?: string;
};

/**
 * The results. Its children (`Search.Item`s) are projected into whichever surface is open: the
 * full-screen dialog or the docked list. One `<Slot />` is rendered at a time.
 */
const View = component$<SearchViewProps>(
  ({
    placeholder = "Search",
    backIcon = "arrow_back",
    backLabel = "Close search",
    clearIcon = "close",
    clearLabel = "Clear search",
    name = "q",
    resultsLabel = "Results",
    class: className,
  }) => {
    const ctx = useContext(searchContextId);
    const styles = searchViewVariants({ layout: ctx.layout });
    const viewId = `${ctx.searchId}-view`;
    const dockedId = `${ctx.searchId}-results`;
    const viewInputRef = useSignal<HTMLInputElement>();
    // The dialog is open only for the full-screen surface (`adaptive` also has a docked one). A
    // writable signal, not `useComputed$`: `Modal` writes its `bind:open` when it closes.
    const dialogOpen = useSignal(false);
    useTask$(({ track }) => {
      const open = track(ctx.open);
      const surface = track(ctx.surface);
      dialogOpen.value = open && surface === "fullscreen";
    });

    const keyNav$ = createKeyNav(ctx, viewId);

    const handleInput$ = $((event: Event) => {
      ctx.query.value = (event.target as HTMLInputElement).value;
      ctx.activeId.value = "";
    });
    // Back, Escape, a scrim press: every way the dialog closes. The browser returns focus to the
    // control that opened it.
    const handleClose$ = $(() => {
      ctx.open.value = false;
      ctx.query.value = "";
      ctx.activeId.value = "";
    });
    const handleClear$ = $(() => {
      ctx.query.value = "";
      ctx.activeId.value = "";
      viewInputRef.value?.focus();
    });

    return (
      <>
        {ctx.layout !== "docked" && (
          <Modal.Root bind:open={dialogOpen} position="fullScreen">
            <Modal.Content
              aria-label={placeholder}
              class={styles.dialog()}
              onClose$={handleClose$}
            >
              <div class={styles.column()}>
                <div class={styles.barRow()}>
                  <div class={styles.bar()}>
                    <IconButton
                      icon={backIcon}
                      label={backLabel}
                      onClick$={handleClose$}
                    />
                    <input
                      ref={viewInputRef}
                      type="search"
                      role="combobox"
                      name={name}
                      value={ctx.query.value}
                      placeholder={placeholder}
                      autocomplete="off"
                      // `showModal()` focuses it (HTML dialog focusing steps).
                      autofocus
                      aria-label={placeholder}
                      aria-autocomplete="list"
                      aria-expanded="true"
                      aria-controls={viewId}
                      aria-activedescendant={ctx.activeId.value || undefined}
                      onInput$={handleInput$}
                      onKeyDown$={[preventSearchKeys, keyNav$]}
                      class={styles.input()}
                    />
                    {ctx.query.value && (
                      <IconButton
                        icon={clearIcon}
                        label={clearLabel}
                        onClick$={handleClear$}
                      />
                    )}
                  </div>
                </div>
                {/* The chip row (`q:slot="filters"`): outside the listbox, which may own only
                    options and groups; a Tab stop after the input. A press keeps the input's
                    focus, as on an option. */}
                <div class={styles.filters()} onMouseDown$={keepInputFocus}>
                  {ctx.surface.value === "fullscreen" && <Slot name="filters" />}
                </div>
                <div
                  id={viewId}
                  role="listbox"
                  aria-label={resultsLabel}
                  // A press on an option must not take focus from the input (APG combobox).
                  onMouseDown$={keepInputFocus}
                  class={[styles.list(), className]}
                >
                  {ctx.surface.value === "fullscreen" && <Slot />}
                </div>
              </div>
            </Modal.Content>
          </Modal.Root>
        )}
        {ctx.layout !== "fullscreen" &&
          ctx.surface.value === "docked" &&
          ctx.open.value &&
          (ctx.showOnEmpty || ctx.query.value.trim()) && (
            <div class={styles.docked()}>
              <div class={styles.filters()} onMouseDown$={keepInputFocus}>
                <Slot name="filters" />
              </div>
              <div
                id={dockedId}
                role="listbox"
                aria-label={resultsLabel}
                onMouseDown$={keepInputFocus}
                class={[styles.dockedList(), className]}
              >
                <Slot />
              </div>
            </div>
          )}
      </>
    );
  },
);

// ─── Search.Trigger ──────────────────────────────────────────────────────────

export const searchTriggerVariants = tv({
  variants: {
    /** `layout="adaptive"`: from 600px the icon gives way to the bar it expanded into. */
    expand: { collapsed: "", expanded: "sm:hidden" },
  },
});

export type SearchTriggerProps = Omit<
  PropsOf<"button">,
  "onClick$" | "type"
> & {
  /** Its accessible name and hover title. Default "Search". */
  label?: string;
  searchIcon?: IconName;
  onClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
};

/** An icon button that opens the search: M3's "search icon button" entry point. */
const Trigger = component$<SearchTriggerProps>(
  ({
    label = "Search",
    searchIcon = "search",
    class: className,
    onClick$,
    ...rest
  }) => {
    const ctx = useContext(searchContextId);
    const open$ = $(async (event: PointerEvent, element: HTMLElement) => {
      // From 600px `adaptive` expands the icon into the docked bar in place (`openSearch`).
      openSearch(ctx);
      await onClick$?.(event, element);
    });
    return (
      <IconButton
        {...rest}
        icon={searchIcon}
        label={label}
        data-search-trigger=""
        // Only `fullscreen` always opens a dialog; docked it moves focus to the bar, and adaptive
        // depends on the window (a dialog below 600px, the bar in place from 600px).
        aria-haspopup={ctx.layout === "fullscreen" ? "dialog" : undefined}
        class={[
          searchTriggerVariants({
            expand:
              ctx.layout !== "adaptive"
                ? undefined
                : ctx.expanded.value
                  ? "expanded"
                  : "collapsed",
          }),
          className,
        ]}
        onClick$={open$}
      />
    );
  },
);

// ─── Search.Item (new, not in e-store) ───────────────────────────────────────

export type SearchItemProps = Omit<PropsOf<"div">, "onClick$" | "children"> & {
  /** The row's text. */
  label: string;
  /** A second line (M3 two-line list item): a snippet, a description. */
  supportingText?: string;
  /** A link: the router's `<Link>`. Without it the row is a plain option. */
  href?: string;
  /** A leading icon. */
  icon?: IconName;
  /**
   * Choosing the row runs `onClick$` and leaves the search open with its query (a "See all"
   * row that switches the filter). Default `false`: choosing closes it.
   */
  keepOpen?: boolean;
  /**
   * Shows a trailing remove button (a recent search), also run by Delete while the row is
   * highlighted. The button is not a Tab stop (focus stays in the input) and is hidden from
   * assistive tech: the option announces the Delete key instead (`aria-keyshortcuts`).
   */
  onRemove$?: QRL<() => void>;
  /** The remove button's hover label, before the row's label. Default "Remove". */
  removeLabel?: string;
  removeIcon?: IconName;
  /** Not choosable (`aria-disabled`): a "no results" line. */
  disabled?: boolean;
  onClick$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
};

/**
 * One result: `role="option"` with its own id, highlighted from the input (`activeId`). Choosing
 * it closes the search. e-store leaves rows to the consumer; this part keeps that wiring (and
 * the M3 list styling) out of the page.
 */
const Item = component$<SearchItemProps>(
  ({
    label,
    supportingText,
    href,
    icon,
    keepOpen = false,
    onRemove$,
    removeLabel = "Remove",
    removeIcon = "close",
    disabled = false,
    class: className,
    onClick$,
    ...rest
  }) => {
    const ctx = useContext(searchContextId);
    const id = useId();
    const nav = useNavigate();
    const target = disabled ? undefined : safeHref(href);
    const remove$ = $(async () => {
      if (ctx.activeId.value === id) ctx.activeId.value = "";
      await onRemove$?.();
    });
    // The Item navigates ITSELF, then closes. Through the router's `<Link>` the close ran first
    // (a Link calls `onClick$` before its own navigation handler), the docked list unmounted, and
    // the detached link never navigated (Chrome, 2026-11-23).
    const choose$ = $(async (event: PointerEvent, element: HTMLElement) => {
      // A modified click (new tab, new window) is the browser's own: leave the search open.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      if (disabled) return;
      await onClick$?.(event, element);
      if (keepOpen) {
        // The options under it are about to change (another filter, another query).
        ctx.activeId.value = "";
        return;
      }
      if (target) {
        const url = new URL(target, location.href);
        if (url.origin === location.origin)
          await nav(url.pathname + url.search + url.hash);
        else location.assign(url.href);
      }
      ctx.open.value = false;
      ctx.query.value = "";
      if (ctx.expanded.value) {
        // `adaptive`: the bar turns back into the icon, which takes the focus (as Escape does);
        // the focused input is about to be hidden, which would drop focus to the body.
        ctx.expanded.value = false;
        focusTriggerWhenShown(ctx.rootRef.value, 10);
      }
    });
    // Not focusable: focus stays in the input (APG combobox); the listbox stops a press moving it
    // (`keepInputFocus`). The highlighted option is `aria-selected="true"`, as in the
    // APG list-autocomplete examples.
    return (
      <div
        {...rest}
        id={id}
        role="option"
        aria-selected={ctx.activeId.value === id ? "true" : "false"}
        aria-disabled={disabled ? "true" : undefined}
        aria-keyshortcuts={onRemove$ ? "Delete" : undefined}
        data-highlighted={ctx.activeId.value === id ? "" : undefined}
        class={[searchItemVariants(), className]}
        onClick$={choose$}
      >
        {icon && <Icon name={icon} />}
        {target ? (
          // A real link (copy it, open it in a new tab); a plain click is handled above.
          <a
            href={target}
            tabIndex={-1}
            class={ITEM_TEXT}
            onClick$={preventPlainClick}
          >
            <span class={ITEM_LABEL}>{label}</span>
            {supportingText && (
              <span data-search-supporting="" class={ITEM_SUPPORTING}>
                {supportingText}
              </span>
            )}
          </a>
        ) : (
          <span class={ITEM_TEXT}>
            <span class={ITEM_LABEL}>{label}</span>
            {supportingText && (
              <span data-search-supporting="" class={ITEM_SUPPORTING}>
                {supportingText}
              </span>
            )}
          </span>
        )}
        {onRemove$ && (
          // Not a Tab stop and hidden from assistive tech (focus stays in the input; the option
          // names the Delete key). `stoppropagation:click`: the press must not choose the row.
          <IconButton
            icon={removeIcon}
            label={`${removeLabel} ${label}`}
            tabIndex={-1}
            aria-hidden="true"
            data-search-remove=""
            stoppropagation:click
            onClick$={remove$}
          />
        )}
      </div>
    );
  },
);

/** The row's text column; each line is cut with an ellipsis. */
const ITEM_TEXT = "flex min-w-0 flex-1 flex-col outline-none";
const ITEM_LABEL = "truncate";
/** M3 list supporting text: body-medium, on-surface-variant. */
const ITEM_SUPPORTING = "truncate text-body-medium text-on-surface-variant";

/** Stops a plain click following the link (the Item navigates); a modified click still does. */
const preventPlainClick = sync$((event: MouseEvent) => {
  if (!(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))
    event.preventDefault();
});

// ─── Search.Group (new, not in e-store) ──────────────────────────────────────

export type SearchGroupProps = PropsOf<"div"> & {
  /** The heading over the group's options; it names the group. */
  label: string;
};

/**
 * Options under a heading (`role="group"`, named by it), inside the View's listbox: a listbox
 * may own options and groups only (APG listbox, "grouped options" example: the heading is
 * presentational). The keys move through every group's options as one list.
 */
const Group = component$<SearchGroupProps>(
  ({ label, class: className, ...rest }) => {
    const id = useId();
    const styles = searchGroupVariants();
    return (
      <div
        {...rest}
        role="group"
        aria-labelledby={id}
        class={[styles.root(), className]}
      >
        <div id={id} role="presentation" class={styles.heading()}>
          {label}
        </div>
        <Slot />
      </div>
    );
  },
);

// ─── Compound export ─────────────────────────────────────────────────────────

export const Search = {
  Root,
  Bar,
  View,
  Trigger,
  Item,
  Group,
};
