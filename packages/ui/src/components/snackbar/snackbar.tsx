import {
  $,
  Slot,
  component$,
  createContextId,
  isBrowser,
  sync$,
  useComputed$,
  useContext,
  useContextProvider,
  useOnDocument,
  useSignal,
  useStore,
  useTask$,
} from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import {
  STAYS_ON_TOP_ATTR,
  openPopover,
  stayOnTop,
} from "../../utils/top-layer";
import { Button } from "../button";
import { IconButton } from "../icon-button";
import type { IconName } from "../icon";

/**
 * Material Design 3 snackbar: a brief message at the bottom of the screen, one at a time, with an
 * optional action and close button.
 *
 * e-store's `Snackbar` (a `Snackbar.Root` provider with a one-at-a-time queue, `useSnackbar()`
 * with `showSnackbar$` / `closeSnackbar$`, a `popover="manual"` container kept above later
 * overlays by `stayOnTop`, `role="status"`, Escape, the inverse colours) made smaller: one live
 * region that is always in the page, no `top` / `end` positions and no class overrides. See
 * `snackbar.md`.
 *
 * @see https://m3.material.io/components/snackbar/specs
 * @see https://m3.material.io/components/snackbar/accessibility
 */

export type SnackbarPosition = "start" | "center";

export interface SnackbarConfig {
  /** The text (M3: one or two lines, body-medium). */
  message: string;
  /** The action button's label (M3: one text button). A snackbar with an action stays until used. */
  action?: string;
  /** Put the action on its own line, under the text (M3's "longer action" configuration). */
  longerAction?: boolean;
  /** Show the close icon button. */
  showClose?: boolean;
  /** ms before it leaves by itself, 4000 to 10000 (M3). 0: stays. Ignored with an action. */
  duration?: number;
  /** Called when the action is pressed (the snackbar then closes). */
  onAction$?: QRL<() => void>;
  /** Called when it closes, whatever closed it. */
  onDismiss$?: QRL<() => void>;
}

export type SnackbarId = number;

export interface SnackbarContextValue {
  /** Queues a snackbar; it shows when the one before it has gone. Returns its id. */
  showSnackbar$: QRL<(config: SnackbarConfig) => SnackbarId>;
  /** Closes the snackbar with that id (shown or queued), or the one showing. */
  closeSnackbar$: QRL<(id?: SnackbarId) => void>;
}

const snackbarContextId = createContextId<SnackbarContextValue>("ui-snackbar");

/** `showSnackbar$` / `closeSnackbar$` of the nearest `Snackbar.Root`. */
export const useSnackbar = () => useContext(snackbarContextId);

type SnackbarItem = SnackbarConfig & { id: SnackbarId };

/** M3 motion: the snackbar leaves in 150ms (short3); the next one waits for it. */
const EXIT_MS = 150;

export const snackbarVariants = tv({
  slots: {
    container: [
      // Undo the UA popover box; a fixed box above the bottom edge, never flush with it (M3).
      "fixed",
      "m-0",
      "border-0",
      "bg-transparent",
      "p-0",
      "inset-auto",
      "bottom-4",
      "overflow-visible",
      // Compact: 16dp margins either side. From 600dp: as wide as its content, 344 to 672dp.
      "inset-x-4",
      "sm:w-max",
      "sm:min-w-86",
      "sm:max-w-168",
      "opacity-0",
      "translate-y-2",
      "transition-[opacity,translate,display,overlay]",
      "transition-discrete",
      "duration-short-3",
      "ease-standard-accelerate",
      "open:opacity-100",
      "open:translate-y-0",
      "open:duration-medium-2",
      "open:ease-standard-decelerate",
      "starting:open:opacity-0",
      "starting:open:translate-y-2",
      "motion-reduce:translate-y-0",
    ],
    // M3: inverse-surface, 4dp corners, level 3; 16dp before the text, 8dp after the controls.
    surface: [
      "flex",
      "flex-wrap",
      "items-center",
      "justify-end",
      "rounded-xs",
      "bg-inverse-surface",
      "text-inverse-on-surface",
      "shadow-3",
      "ps-4",
      "pe-2",
    ],
    // body-medium; 14dp above and below gives M3's 48dp for one line and 68dp for two.
    message: ["min-w-0", "flex-1", "py-3.5", "pe-2", "text-body-medium"],
    controls: ["flex", "shrink-0", "items-center", "gap-1"],
  },
  variants: {
    position: {
      center: { container: "sm:inset-x-0 sm:mx-auto" },
      start: { container: "sm:inset-x-auto sm:start-6" },
    },
    longerAction: {
      // The text takes the whole line; the action goes under it, at the end.
      true: { message: "basis-full pe-0", controls: "pb-2" },
      false: {},
    },
  },
  defaultVariants: { position: "center", longerAction: false },
});

export type SnackbarRootProps = {
  /** Default `duration` (ms). Default 5000 (M3: 4 to 10 seconds). */
  duration?: number;
  /** Where snackbars sit from 600dp: `center` (default) or `start` (M3: "left-aligned"). */
  position?: SnackbarPosition;
  /** The close button's name. Default "Dismiss". */
  closeLabel?: string;
  /** The close button's icon. Default `close`. */
  closeIcon?: IconName;
};

/**
 * Alt+G moves focus to the snackbar's first button (M3 accessibility: "a keyboard shortcut to
 * focus on actionable snackbars", for example Alt+G). Synchronous, so it can cancel the key (on
 * a Mac, Option+G would also type a character).
 */
const focusShortcut = sync$((event: KeyboardEvent) => {
  if (!event.altKey || event.code !== "KeyG") return;
  const button = document.querySelector<HTMLElement>(
    "[data-snackbar]:popover-open button",
  );
  if (!button) return;
  event.preventDefault();
  // Where focus goes back to when the snackbar closes.
  (window as { snackbarReturnFocus?: Element | null }).snackbarReturnFocus =
    document.activeElement;
  button.focus();
});

/**
 * Provides `useSnackbar()` and renders the one snackbar. Place once, around the app.
 */
const Root = component$<SnackbarRootProps>(
  ({
    duration = 5000,
    position = "center",
    closeLabel = "Dismiss",
    closeIcon = "close",
  }) => {
    const state = useStore<{ items: SnackbarItem[]; leaving: boolean }>({
      items: [],
      leaving: false,
    });
    const nextId = useSignal<SnackbarId>(0);
    const containerRef = useSignal<HTMLElement>();
    /** The live region's text: set a moment after the snackbar shows (see the region below). */
    const announce = useSignal("");

    /** Plays the exit of the one showing, then lets the next one in. */
    const leave$ = $(async (id: SnackbarId) => {
      const item = state.items[0];
      if (!item || item.id !== id || state.leaving) return;
      state.leaving = true;
      // Focus was in it (Alt+G, Tab): back to where it was, not to <body>.
      const el = containerRef.value;
      if (el?.contains(document.activeElement)) {
        const w = window as { snackbarReturnFocus?: Element | null };
        const back = w.snackbarReturnFocus;
        w.snackbarReturnFocus = null;
        if (back instanceof HTMLElement && back.isConnected) back.focus();
        else (document.activeElement as HTMLElement | null)?.blur();
      }
      await item.onDismiss$?.();
      setTimeout(() => {
        state.items = state.items.filter((i) => i.id !== id);
        state.leaving = false;
      }, EXIT_MS);
    });

    const showSnackbar$ = $((config: SnackbarConfig) => {
      const id = nextId.value++;
      state.items = [...state.items, { ...config, id }];
      return id;
    });

    const closeSnackbar$ = $(async (id?: SnackbarId) => {
      const current = state.items[0];
      if (!current) return;
      if (id === undefined || id === current.id) return leave$(current.id);
      const queued = state.items.find((i) => i.id === id);
      state.items = state.items.filter((i) => i.id !== id);
      await queued?.onDismiss$?.();
    });

    useContextProvider(snackbarContextId, { showSnackbar$, closeSnackbar$ });

    const currentId = useComputed$(() => state.items[0]?.id);

    // Show / hide the container and run the timer as the queue moves.
    useTask$(({ track, cleanup }) => {
      // The id, through a computed (it notifies only when the id changes): a queued
      // `showSnackbar$` replaces the array and must not restart the timer of the one showing.
      track(currentId);
      const leaving = track(() => state.leaving);
      const current = state.items[0];
      if (!isBrowser) return;
      const el = containerRef.value;
      if (!el?.isConnected) return;
      if (!current || leaving) {
        if (el.matches(":popover-open")) el.hidePopover();
        announce.value = "";
        return;
      }
      openPopover(el);
      // Text put into a live region in the same moment it appears is often missed.
      const say = setTimeout(() => {
        announce.value = current.action
          ? `${current.message}. ${current.action}`
          : current.message;
      }, 100);
      cleanup(() => clearTimeout(say));
      cleanup(stayOnTop(el));
      // M3 accessibility: a snackbar with an action does not leave by itself.
      const ms = current.duration ?? duration;
      if (!current.action && ms > 0) {
        const timer = setTimeout(() => leave$(current.id), ms);
        cleanup(() => clearTimeout(timer));
      }
    });

    useOnDocument("keydown", focusShortcut);

    const v = snackbarVariants({ position });

    return (
      <>
        <Slot />
        {/* The live region: always in the page and visible to assistive technology (the
            popover is `display: none` while closed), its text set after the snackbar shows. */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          class="sr-only"
        >
          {announce.value}
        </div>
        <div
          ref={containerRef}
          popover="manual"
          data-snackbar=""
          {...{ [STAYS_ON_TOP_ATTR]: "" }}
          class={v.container()}
        >
          {state.items.slice(0, 1).map((item) => {
            const s = snackbarVariants({
              position,
              longerAction: !!item.longerAction && !!item.action,
            });
            return (
              <div
                key={item.id}
                class={s.surface()}
                // M3 accessibility: Escape dismisses it when focus is in it.
                onKeyDown$={(event: KeyboardEvent) => {
                  if (event.key === "Escape") leave$(item.id);
                }}
              >
                <div class={s.message()}>{item.message}</div>
                {(item.action || item.showClose) && (
                  <div class={s.controls()}>
                    {item.action && (
                      <Button
                        look="text"
                        tone="inverse"
                        label={item.action}
                        onClick$={async () => {
                          await item.onAction$?.();
                          await leave$(item.id);
                        }}
                      />
                    )}
                    {item.showClose && (
                      <IconButton
                        look="inverse"
                        icon={closeIcon}
                        label={closeLabel}
                        onClick$={() => leave$(item.id)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  },
);

/** M3 snackbar: `Snackbar.Root` (provider) and `useSnackbar()`. */
export const Snackbar = { Root };
