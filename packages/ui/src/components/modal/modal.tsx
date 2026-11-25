import {
  $,
  Slot,
  component$,
  createContextId,
  isBrowser,
  sync$,
  useComputed$,
  useConstant,
  useContext,
  useContextProvider,
  useId,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import type { PropsOf, QRL, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import type { VariantProps } from "tailwind-variants/lite";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { Button } from "../button";
import { iconButtonVariants } from "../icon-button";
import { closeAnimated, openModal } from "../../utils/top-layer";
import { useBoundSignal } from "../../utils/use-bound-signal";

/**
 * Material Design 3 dialogs and sheets on the native `<dialog>` element, opened with
 * `showModal()`: the browser supplies the scrim (`::backdrop`), the focus trap, the inert page
 * behind and Escape.
 *
 * A smaller copy of e-store's `Modal` (`components/modal/modal.tsx` and `unstyled/*`), same part
 * names. Left out: `mode` (always modal), the `top` position, `scrim={false}`, `maxHeight`,
 * Container, Grid, DragBar, Media, Image, nested levels, the JavaScript scroll lock.
 *
 * @see https://m3.material.io/components/dialogs/specs
 * @see https://m3.material.io/components/side-sheets/specs
 * @see https://m3.material.io/components/bottom-sheets/specs
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */

export type ModalPosition =
  | "center"
  | "fullScreen"
  | "adaptive"
  | "bottom"
  | "left"
  | "right";

type ModalContext = {
  contentRef: Signal<HTMLDialogElement | undefined>;
  isOpen: Signal<boolean>;
  position: Readonly<Signal<ModalPosition>>;
  closeOnOutsideClick: Readonly<Signal<boolean>>;
  isTitle: Signal<boolean>;
  isDescription: Signal<boolean>;
  localId: string;
  alert: Readonly<Signal<boolean>>;
};

export const modalContextId = createContextId<ModalContext>("ui-modal");

/** Trigger and Close when used as plain text buttons. */
const focusRing = [
  "focus-visible:outline-2",
  "focus-visible:outline-offset-2",
  "focus-visible:outline-secondary",
];

export const modalContentVariants = tv({
  base: [
    "group",
    "border-none",
    "p-0",
    "text-on-surface",
    // A closed dialog is hidden only by the browser's own rule, which a `flex` class would beat.
    "not-open:hidden",
    // Fixed to the window as a modal is (`:modal`), stated for every state.
    "fixed",
    // A scroll that reaches the end of the dialog does not carry on into the page (iOS).
    "overscroll-contain",
    // Motion (`modal.md` "Motion"). Enter: `@starting-style` (`starting:open:`). Exit: the Root
    // sets `data-closing` while the dialog is still open (in the top layer, scrim and all), the
    // `open:data-closing:` classes give the closed look, and `dialog.close()` runs when that
    // transition ends (`closeAnimated`, `utils/top-layer.ts`). No `display` / `overlay` in the
    // list: Safari and Firefox cannot transition `overlay`, so an exit that ran after `close()`
    // played under the page with no scrim (iOS, 2026-11-24). `max-height`: a bottom sheet
    // expanded by its drag handle.
    "transition-[opacity,translate,max-height]",
    // M3: the page behind is dimmed with scrim at 32%, faded linearly (material-web's scrim).
    "backdrop:bg-scrim/32",
    "backdrop:opacity-0",
    "backdrop:transition-opacity",
    "backdrop:ease-linear",
    "open:backdrop:opacity-100",
    "starting:open:backdrop:opacity-0",
    "open:data-closing:backdrop:opacity-0",
    // Reduced motion: no transition, it appears and goes at once (rule L23).
    "motion-reduce:transition-none",
    "motion-reduce:backdrop:transition-none",
  ],
  variants: {
    position: {
      // M3 basic dialog: 28px corners, surface-container-high, at most 560px, 24px from the
      // window's edges.
      center: [
        "m-auto",
        "max-h-[calc(100dvh-3rem)]",
        "max-w-[min(35rem,calc(100dvw-3rem))]",
        // M3: at least 280dp wide.
        "min-w-[min(17.5rem,calc(100dvw-3rem))]",
        "rounded-xl",
        "bg-surface-container-high",
        "shadow-3",
        "open:flex",
        "open:flex-col",
        // material-web's dialog: in, 500ms Emphasized, sliding 50px down as it fades in; out,
        // 150ms Emphasized accelerate, back up 50px (no scale: M3 transition patterns).
        "opacity-0",
        "open:opacity-100",
        "starting:open:opacity-0",
        "open:data-closing:opacity-0",
        "-translate-y-[50px]",
        "open:translate-y-0",
        "starting:open:-translate-y-[50px]",
        "open:data-closing:-translate-y-[50px]",
        "duration-long-2",
        "ease-emphasized",
        "open:data-closing:duration-short-3",
        "open:data-closing:ease-emphasized-accelerate",
        "backdrop:duration-long-2",
        "open:data-closing:backdrop:duration-short-3",
      ],
      // M3 full-screen dialog: square corners, the whole window.
      fullScreen: [
        "inset-0",
        "m-0",
        "h-dvh",
        "max-h-dvh",
        "w-dvw",
        "max-w-dvw",
        "rounded-none",
        "bg-surface-container-high",
        "open:flex",
        "open:flex-col",
        // Enters the screen: 400ms Emphasized decelerate; exits: 200ms Emphasized accelerate
        // (M3 easing and duration pairs).
        "opacity-0",
        "open:opacity-100",
        "starting:open:opacity-0",
        "open:data-closing:opacity-0",
        "translate-y-12",
        "open:translate-y-0",
        "starting:open:translate-y-12",
        "open:data-closing:translate-y-12",
        "duration-medium-4",
        "ease-emphasized-decelerate",
        "open:data-closing:duration-short-4",
        "open:data-closing:ease-emphasized-accelerate",
        "backdrop:duration-medium-4",
        "open:data-closing:backdrop:duration-short-4",
      ],
      // M3 adaptive dialog (2026-11-24, for forms): "Full-screen dialogs are for compact
      // breakpoints only ... For medium and expanded breakpoints, use a basic dialog"; "Dialogs
      // can swap variants as the breakpoint changes" (m3.material.io/components/dialogs/
      // guidelines). Below 600px it IS `fullScreen`, from 600px `center` at its full 560px
      // (M3 full-screen width "Container width; Max 560dp"; a form needs the room: the basic
      // dialog's fit-content width shrank to its inputs' 20-character intrinsic width). CSS
      // only, no breakpoint read in render (rule L19). Every class is a literal so Tailwind
      // finds it; both sides are prefixed so neither depends on variant order.
      adaptive: [
        "bg-surface-container-high",
        "open:flex",
        "open:flex-col",
        "opacity-0",
        "open:opacity-100",
        "starting:open:opacity-0",
        "open:data-closing:opacity-0",
        "open:data-closing:ease-emphasized-accelerate",
        // Compact: the full-screen dialog (as `fullScreen`).
        "max-sm:inset-0",
        "max-sm:m-0",
        "max-sm:h-dvh",
        "max-sm:max-h-dvh",
        "max-sm:w-dvw",
        "max-sm:max-w-dvw",
        "max-sm:rounded-none",
        "max-sm:translate-y-12",
        "max-sm:open:translate-y-0",
        "max-sm:starting:open:translate-y-12",
        "max-sm:open:data-closing:translate-y-12",
        "max-sm:duration-medium-4",
        "max-sm:ease-emphasized-decelerate",
        "max-sm:open:data-closing:duration-short-4",
        "max-sm:backdrop:duration-medium-4",
        "max-sm:open:data-closing:backdrop:duration-short-4",
        // From 600px: the basic dialog (as `center`), 560px wide or the window less 24px a side.
        "sm:m-auto",
        "sm:max-h-[calc(100dvh-3rem)]",
        "sm:w-[min(35rem,calc(100dvw-3rem))]",
        "sm:rounded-xl",
        "sm:shadow-3",
        "sm:-translate-y-[50px]",
        "sm:open:translate-y-0",
        "sm:starting:open:-translate-y-[50px]",
        "sm:open:data-closing:-translate-y-[50px]",
        "sm:duration-long-2",
        "sm:ease-emphasized",
        "sm:open:data-closing:duration-short-3",
        "sm:backdrop:duration-long-2",
        "sm:open:data-closing:backdrop:duration-short-3",
      ],
      // M3 bottom sheet: 28px top corners, surface-container-low, at most 640px wide, 72dp below
      // the window's top (56dp once the window is wider than 640dp). With a `Modal.DragHandle`
      // it opens at most half the window high and the handle (or a drag up) expands it.
      bottom: [
        "inset-x-0",
        "top-auto",
        "bottom-0",
        "mx-auto",
        "mt-auto",
        "mb-0",
        "max-h-[calc(100dvh-4.5rem)]",
        "min-[40rem]:max-h-[calc(100dvh-3.5rem)]",
        "has-[>[data-drag-handle]]:not-data-expanded:max-h-[50dvh]",
        "data-dragging:transition-none",
        "w-full",
        "max-w-160",
        "rounded-t-xl",
        "bg-surface-container-low",
        "shadow-1",
        "open:flex",
        "open:flex-col",
        // M3: "This Bottom sheet enters with Emphasized decelerate and exits permanently with
        // Emphasized accelerate": 400ms in, 200ms out (the suggested pairs).
        "translate-y-full",
        "open:translate-y-0",
        "starting:open:translate-y-full",
        "open:data-closing:translate-y-full",
        "duration-medium-4",
        "ease-emphasized-decelerate",
        "open:data-closing:duration-short-4",
        "open:data-closing:ease-emphasized-accelerate",
        "backdrop:duration-medium-4",
        "open:data-closing:backdrop:duration-short-4",
      ],
      // M3 modal side sheet / modal navigation drawer: 16px inner corners,
      // surface-container-low, at most 400px wide, the window's full height.
      left: [
        "inset-y-0",
        "right-auto",
        "left-0",
        "m-0",
        "mr-auto",
        "h-full",
        "max-h-dvh",
        // The host can narrow a side sheet: `--modal-sheet-width`.
        "w-(--modal-sheet-width,100%)",
        "max-w-100",
        "rounded-r-lg",
        "bg-surface-container-low",
        "shadow-1",
        "open:flex",
        "open:flex-col",
        // M3: "This drawer enters and exits temporarily with Emphasized easing": 500ms in,
        // 200ms out (enter long, exit short: M3 "Enter vs. exit transitions").
        "-translate-x-full",
        "open:translate-x-0",
        "starting:open:-translate-x-full",
        "open:data-closing:-translate-x-full",
        "duration-long-2",
        "ease-emphasized",
        "open:data-closing:duration-short-4",
        "backdrop:duration-long-2",
        "open:data-closing:backdrop:duration-short-4",
      ],
      right: [
        "inset-y-0",
        "right-0",
        "left-auto",
        "m-0",
        "ml-auto",
        "h-full",
        "max-h-dvh",
        // The host can narrow a side sheet: `--modal-sheet-width`.
        "w-(--modal-sheet-width,100%)",
        "max-w-100",
        "rounded-l-lg",
        "bg-surface-container-low",
        "shadow-1",
        "open:flex",
        "open:flex-col",
        // M3: "This drawer enters and exits temporarily with Emphasized easing": 500ms in,
        // 200ms out (enter long, exit short: M3 "Enter vs. exit transitions").
        "translate-x-full",
        "open:translate-x-0",
        "starting:open:translate-x-full",
        "open:data-closing:translate-x-full",
        "duration-long-2",
        "ease-emphasized",
        "open:data-closing:duration-short-4",
        "backdrop:duration-long-2",
        "open:data-closing:backdrop:duration-short-4",
      ],
    },
  },
  defaultVariants: { position: "center" },
});

/** The bar with the close button and the title. */
export const modalBarVariants = tv({
  // `--modal-bar-inset`: the host can line the close button up with the button that opened it.
  base: [
    "flex",
    "w-full",
    "shrink-0",
    "items-center",
    "gap-3",
    "px-(--modal-bar-inset,1.5rem)",
  ],
  variants: {
    position: {
      center: "h-16",
      fullScreen: "h-14",
      // The full-screen bar, on compact only: from 600px the Header and Footer take over.
      adaptive: "h-14 sm:hidden",
      bottom: "h-16",
      left: "h-16",
      right: "h-16",
    },
  },
});

export const modalHeaderVariants = tv({
  base: [
    "flex",
    "w-full",
    "shrink-0",
    "flex-col",
    "items-start",
    "gap-4",
    "text-start",
    // With a hero icon the header is centred (M3); a variant, so it wins over the two above.
    "has-[>svg]:items-center",
    "has-[>svg]:text-center",
  ],
  variants: {
    variant: {
      dialog: "p-6",
      sheet: "px-6 pb-4",
    },
    /** `position="adaptive"`: compact shows the bar's headline instead. */
    adaptive: {
      true: "max-sm:hidden",
      false: "",
    },
  },
  defaultVariants: { adaptive: false },
});

export const modalSectionVariants = tv({
  // Between the bar and the footer, away from the surface's corners: a full-height track.
  base: [
    "min-h-0",
    "overscroll-contain",
    "scrollbar-pane",
    "[--scrollbar-track-margin:0px]",
  ],
  variants: {
    padding: {
      default: "overflow-y-auto px-6 py-4",
      none: "overflow-hidden p-0",
    },
    /** M3 dialog dividers: a 1dp line above and below scrolling content. */
    dividers: {
      true: "border-y border-outline-variant",
      false: "",
    },
  },
  defaultVariants: { padding: "default", dividers: false },
});

export const modalFooterVariants = tv({
  base: ["mt-auto", "flex", "shrink-0", "gap-3"],
  variants: {
    variant: {
      dialog: "min-h-14 p-6",
      sheet: "min-h-18 border-t border-outline-variant px-6 py-2",
    },
    position: {
      center: "justify-end",
      fullScreen: "justify-end",
      // Compact: the bar's action (Save) and close button replace the footer (M3 full screen).
      adaptive: "justify-end max-sm:hidden",
      bottom: "justify-end",
      left: "justify-end",
      right: "justify-start",
    },
  },
});

const isDialogPosition = (position: ModalPosition): boolean =>
  position === "center" || position === "fullScreen" || position === "adaptive";

/**
 * A backdrop press targets the `<dialog>` itself (the `::backdrop` belongs to it) AND lands
 * outside its box. Both checks are needed: a press on the dialog's own edge also targets it.
 */
export const isBackdropClick = (
  dialog: HTMLDialogElement,
  event: PointerEvent,
): boolean => {
  if (event.target !== dialog) return false;
  const box = dialog.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return !(x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
};

/**
 * Notes on the dialog that a press began on its scrim. A `sync$`, so it runs at once: a lazy
 * `$()` handler is still loading on the first press after the page loads, and that press was
 * lost. It is serialized as text, so everything it uses is inline.
 */
const markBackdropDown = sync$(
  (event: PointerEvent, dialog: HTMLDialogElement) => {
    const box = dialog.getBoundingClientRect();
    const outside =
      event.target === dialog &&
      !(
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom
      );
    dialog.toggleAttribute("data-backdrop-down", outside);
  },
);

export type ModalRootProps = PropsOf<"div"> & {
  /** Whether the modal is open. Pass a signal to open and close it from outside. */
  "bind:open"?: Signal<boolean>;
  /** Where the surface sits and which M3 component it is. */
  position?: ModalPosition;
  /** A press on the scrim closes it. */
  closeOnOutsideClick?: boolean;
  /** `role="alertdialog"`: a confirmation that needs an answer. */
  alert?: boolean;
};

/** Holds the open state. Wraps the Trigger and the Content. */
const Root = component$<ModalRootProps>(
  ({
    "bind:open": givenOpen,
    position: givenPosition,
    closeOnOutsideClick: givenCloseOnOutsideClick,
    alert: givenAlert,
    class: className,
    ...rest
  }) => {
    const isOpen = useBoundSignal(givenOpen, false);
    const contentRef = useSignal<HTMLDialogElement>();
    const isTitle = useSignal(false);
    const isDescription = useSignal(false);
    const localId = useId();
    const position = useComputed$<ModalPosition>(
      () => givenPosition ?? "center",
    );
    // Signals, not the values at creation, so a change of either prop applies to an open or a
    // later dialog without remounting the Root (as `position`).
    const closeOnOutsideClick = useComputed$(
      () => givenCloseOnOutsideClick ?? true,
    );
    const alert = useComputed$(() => givenAlert ?? false);

    useTask$(({ track }) => {
      const open = track(isOpen);
      if (!isBrowser) return;
      const dialog = contentRef.value;
      if (!dialog) return;
      if (open) openModal(dialog);
      // The exit plays first, then `close()` (see `closeAnimated`). Not awaited: the task must
      // not hold the render.
      else if (dialog.open) void closeAnimated(dialog, () => dialog.close());
    });

    useContextProvider(modalContextId, {
      contentRef,
      isOpen,
      position,
      closeOnOutsideClick,
      isTitle,
      isDescription,
      localId,
      alert,
    });

    return (
      <div {...rest} class={["contents", className]}>
        <Slot />
      </div>
    );
  },
);

export type ModalTriggerProps = Omit<PropsOf<"button">, "onClick$"> & {
  onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
};

/** A button that opens the modal. Any other control can do it through `bind:open`. */
const Trigger = component$<ModalTriggerProps>(
  ({ class: className, onClick$, ...rest }) => {
    const context = useContext(modalContextId);
    const toggle$ = $(() => {
      context.isOpen.value = !context.isOpen.value;
    });
    return (
      <button
        {...rest}
        type="button"
        aria-haspopup="dialog"
        class={[
          "relative inline-flex h-10 min-w-10 cursor-pointer items-center justify-center gap-2",
          "rounded-full border border-outline-variant px-4 text-label-large text-on-surface-variant",
          "hover:bg-on-surface/8 active:bg-on-surface/10",
          "disabled:pointer-events-none disabled:opacity-38",
          focusRing,
          className,
        ]}
        onClick$={[toggle$, onClick$]}
      >
        <Slot />
      </button>
    );
  },
);

export type ModalCloseProps = Omit<PropsOf<"button">, "onClick$"> & {
  onClick$?: QRL<(event: PointerEvent, element: HTMLButtonElement) => void>;
};

/** A text button that closes the modal. */
const Close = component$<ModalCloseProps>(
  ({ class: className, onClick$, ...rest }) => {
    const context = useContext(modalContextId);
    const close$ = $(() => {
      context.isOpen.value = false;
    });
    return (
      <button
        {...rest}
        type="button"
        class={[
          "relative inline-flex h-10 min-w-10 cursor-pointer items-center justify-center",
          "rounded-full px-3 text-label-large text-primary",
          "hover:bg-primary/8 active:bg-primary/10",
          focusRing,
          className,
        ]}
        onClick$={[close$, onClick$]}
      >
        <Slot />
      </button>
    );
  },
);

export type ModalContentProps = Omit<
  PropsOf<"dialog">,
  "open" | "onClose$" | "onCancel$" | "onPointerDown$" | "onPointerUp$"
> & {
  onClose$?: QRL<(event: Event, element: HTMLDialogElement) => void>;
  /** Escape (or a phone's back gesture) asked it to close; it then closes with its exit. */
  onCancel$?: QRL<(event: Event, element: HTMLDialogElement) => void>;
};

/** The surface: the `<dialog>` itself. Always rendered closed; the Root opens it. */
const Content = component$<ModalContentProps>(
  ({
    class: className,
    onClose$,
    onCancel$,
    // A name or description passed by the caller wins over the Title / Description defaults.
    "aria-label": ariaLabel,
    "aria-labelledby": labelledBy,
    "aria-describedby": describedBy,
    ...rest
  }) => {
    const context = useContext(modalContextId);
    // The press must START on the scrim too: a drag that begins inside the dialog (selecting
    // text) and ends outside it is not a dismissal. `markBackdropDown` records that at once.
    const backdropUp$ = $((event: PointerEvent, dialog: HTMLDialogElement) => {
      const wasDown = dialog.hasAttribute("data-backdrop-down");
      dialog.removeAttribute("data-backdrop-down");
      if (!wasDown || !context.closeOnOutsideClick.value) return;
      if (isBackdropClick(dialog, event)) context.isOpen.value = false;
    });
    // Escape: the browser's own close is cancelled (`preventdefault:cancel`) so the Root plays
    // the exit first, as material-web's dialog does. When Chrome makes `cancel` uncancellable
    // (a second Escape with no click in between: the close-watcher rule) it closes at once.
    const cancel$ = $(() => {
      context.isOpen.value = false;
    });
    // Anything else that closes the dialog natively.
    const closed$ = $(() => {
      context.isOpen.value = false;
    });

    return (
      <dialog
        {...rest}
        ref={context.contentRef}
        role={context.alert.value ? "alertdialog" : undefined}
        aria-label={ariaLabel}
        aria-labelledby={
          labelledBy ??
          (ariaLabel === undefined && context.isTitle.value
            ? `${context.localId}-title`
            : undefined)
        }
        aria-describedby={
          describedBy ??
          (context.isDescription.value
            ? `${context.localId}-description`
            : undefined)
        }
        data-position={context.position.value}
        class={[
          modalContentVariants({ position: context.position.value }),
          className,
        ]}
        onPointerDown$={markBackdropDown}
        onPointerUp$={backdropUp$}
        preventdefault:cancel
        onCancel$={[cancel$, onCancel$]}
        onClose$={[closed$, onClose$]}
      >
        <Slot />
      </dialog>
    );
  },
);

export type ModalCloseTitleActionProps = Omit<PropsOf<"div">, "title"> & {
  /** The headline in the bar. */
  title?: string;
  /** The close button's icon. */
  closeIcon?: IconName;
  /** The close button's name for screen readers. */
  closeLabel?: string;
  /** The title also names the dialog (`aria-labelledby`). Use it when there is no `Modal.Title`. */
  namesDialog?: boolean;
  /** A text button at the end of the bar (M3 full-screen dialog: "Save"). */
  actionLabel?: string;
  /**
   * The action's button type. `"submit"` when the bar is inside the dialog's `<form>`, so Save
   * submits it as the footer's Save does (`position="adaptive"`). Default `"button"`.
   */
  actionType?: "button" | "submit";
  /** Runs when the action is pressed. The dialog stays open: close it here if it should. */
  onAction$?: QRL<(event: PointerEvent, element: HTMLElement) => void>;
};

/**
 * The bar at the top of a sheet or a full-screen dialog: a close button, a title and an optional
 * action. The close button leads on a `left` sheet and on a full-screen dialog (M3: close
 * affordance, headline, action) and trails everywhere else.
 */
const CloseTitleAction = component$<ModalCloseTitleActionProps>(
  ({
    title,
    closeIcon = "close",
    closeLabel = "Close",
    namesDialog = false,
    actionLabel,
    actionType = "button",
    onAction$,
    class: className,
    ...rest
  }) => {
    const context = useContext(modalContextId);
    useConstant(() => {
      if (namesDialog && title) context.isTitle.value = true;
    });
    const close$ = $(() => {
      context.isOpen.value = false;
    });
    return (
      <div
        {...rest}
        class={[
          modalBarVariants({ position: context.position.value }),
          "group/bar",
          className,
        ]}
        data-position={context.position.value}
      >
        {/* A raw <button> with IconButton's classes (U7): it predates this change and keeps
            the bar's own order classes; `IconButton` would do as well. */}
        <button
          type="button"
          aria-label={closeLabel}
          data-tooltip=""
          class={[
            iconButtonVariants(),
            "order-last group-data-[position=adaptive]/bar:order-first group-data-[position=fullScreen]/bar:order-first group-data-[position=left]/bar:order-first",
          ]}
          onClick$={close$}
        >
          <Icon name={closeIcon} />
        </button>
        {title ? (
          <h2
            id={namesDialog ? `${context.localId}-title` : undefined}
            class="min-w-0 flex-1 truncate text-title-large text-on-surface"
          >
            {title}
          </h2>
        ) : (
          <span class="flex-1" aria-hidden="true" />
        )}
        {actionLabel && (
          <Button
            type={actionType}
            look="text"
            label={actionLabel}
            onClick$={onAction$}
          />
        )}
      </div>
    );
  },
);

export type ModalHeaderProps = PropsOf<"header"> & {
  /**
   * M3 dialog hero icon, above the title (24dp, secondary). With it the header is centred (M3:
   * "if a dialog has an icon, the headline is center-aligned"). From e-store's Header.
   */
  icon?: IconName;
};

/** The top of a dialog: holds the Title and the Description. */
const Header = component$<ModalHeaderProps>(
  ({ icon, class: className, ...rest }) => {
    const context = useContext(modalContextId);
    return (
      // `role="none"`: a <header> in a <dialog> would be exposed as the page's banner landmark.
      <header
        role="none"
        {...rest}
        class={[
          modalHeaderVariants({
            variant: isDialogPosition(context.position.value)
              ? "dialog"
              : "sheet",
            adaptive: context.position.value === "adaptive",
          }),
          className,
        ]}
      >
        {icon && <Icon name={icon} class="size-6 text-secondary" />}
        <Slot />
      </header>
    );
  },
);

/** The dialog's name: a level-2 heading the dialog is labelled by. */
const Title = component$<PropsOf<"h2">>(({ class: className, ...rest }) => {
  const context = useContext(modalContextId);
  useConstant(() => {
    context.isTitle.value = true;
  });
  return (
    <h2
      {...rest}
      id={`${context.localId}-title`}
      class={["w-full text-headline-small text-on-surface", className]}
    >
      <Slot />
    </h2>
  );
});

/** Supporting text the dialog is described by. */
const Description = component$<PropsOf<"p">>(
  ({ class: className, ...rest }) => {
    const context = useContext(modalContextId);
    useConstant(() => {
      context.isDescription.value = true;
    });
    return (
      <p
        {...rest}
        id={`${context.localId}-description`}
        class={[
          "text-body-medium text-pretty text-on-surface-variant",
          className,
        ]}
      >
        <Slot />
      </p>
    );
  },
);

export type ModalSectionProps = PropsOf<"section"> &
  VariantProps<typeof modalSectionVariants>;

/** The part that scrolls when the content is taller than the surface. */
const Section = component$<ModalSectionProps>(
  ({ padding, dividers, class: className, ...rest }) => {
    return (
      <section
        {...rest}
        class={[modalSectionVariants({ padding, dividers }), className]}
      >
        <Slot />
      </section>
    );
  },
);

/** The actions, at the bottom. */
const Footer = component$<PropsOf<"footer">>(
  ({ class: className, ...rest }) => {
    const context = useContext(modalContextId);
    return (
      <footer
        role="none"
        {...rest}
        class={[
          modalFooterVariants({
            variant: isDialogPosition(context.position.value)
              ? "dialog"
              : "sheet",
            position: context.position.value,
          }),
          className,
        ]}
      >
        <Slot />
      </footer>
    );
  },
);

export type ModalDragHandleProps = Omit<
  PropsOf<"button">,
  "onClick$" | "onPointerDown$" | "onPointerMove$" | "onPointerUp$"
> & {
  /** Its name (M3 accessibility: the drag handle is a labelled button). */
  label?: string;
};

/** A drag on the handle moves the sheet with the pointer (synchronous: no lazy-load lag). */
const dragStart = sync$((event: PointerEvent, handle: HTMLElement) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  handle.removeAttribute("data-dragged");
  delete handle.dataset.dragResult;
  handle.setPointerCapture(event.pointerId);
  handle.dataset.startY = String(event.clientY);
  handle.closest("dialog")?.setAttribute("data-dragging", "");
});
const dragMove = sync$((event: PointerEvent, handle: HTMLElement) => {
  const start = handle.dataset.startY;
  const dialog = handle.closest("dialog");
  if (start === undefined || !dialog) return;
  // Down only follows the pointer; up is a request to expand, settled on release.
  const dy = Math.max(0, event.clientY - Number(start));
  dialog.style.translate = `0 ${dy}px`;
  if (Math.abs(event.clientY - Number(start)) > 6) {
    handle.setAttribute("data-dragged", "");
  }
});

/**
 * Ends a drag: puts the sheet back under the pointer and records the result on the handle
 * (`data-drag-result`: up / down / none) at once, so the click that follows (a lazy `$()`)
 * reads it whatever order the handlers load in.
 */
const dragEnd = sync$((event: PointerEvent, handle: HTMLElement) => {
  const start = handle.dataset.startY;
  delete handle.dataset.startY;
  const dialog = handle.closest("dialog");
  dialog?.removeAttribute("data-dragging");
  if (dialog) dialog.style.translate = "";
  if (start === undefined || !handle.hasAttribute("data-dragged")) return;
  handle.removeAttribute("data-dragged");
  // A cancelled drag (no click follows) only puts the sheet back.
  if (event.type === "pointercancel") return;
  const dy = event.clientY - Number(start);
  // A quarter of the sheet's height, or 80px, decides it.
  const far = Math.min(80, (dialog ? dialog.offsetHeight : 320) / 4);
  handle.dataset.dragResult = dy < -far ? "up" : dy > far ? "down" : "none";
});

/**
 * M3 bottom sheet drag handle, for `Modal position="bottom"`: the first child of
 * `Modal.Content`. With it the sheet opens at most half the window high (M3: a modal bottom
 * sheet's initial height is capped at 50% of the screen) and:
 * - a press (Enter / Space / click) expands it to full height, or back (M3: the handle cycles
 *   the preset heights; it is a button with `aria-expanded`, in the tab order);
 * - a drag up expands it; a drag down collapses it, and closes it when already collapsed.
 * The press is the single-pointer alternative to dragging (WCAG 2.5.7). From e-store's
 * `Modal.DragHandle` idea and its `Sheet` handle, smaller (two heights, no detents).
 */
const DragHandle = component$<ModalDragHandleProps>(
  ({ label = "Drag handle", class: className, ...rest }) => {
    const context = useContext(modalContextId);
    const expanded = useSignal(false);
    useTask$(({ track }) => {
      // A sheet opens collapsed every time.
      if (track(context.isOpen)) return;
      expanded.value = false;
      if (isBrowser) context.contentRef.value?.removeAttribute("data-expanded");
    });
    const set$ = $((handle: HTMLElement, value: boolean) => {
      expanded.value = value;
      handle.closest("dialog")?.toggleAttribute("data-expanded", value);
    });
    // A press, or the end of a drag (its result recorded by `dragEnd`).
    const press$ = $((_: PointerEvent, handle: HTMLElement) => {
      const result = handle.dataset.dragResult;
      delete handle.dataset.dragResult;
      if (result === undefined) return set$(handle, !expanded.value);
      if (result === "up") return set$(handle, true);
      if (result === "down") {
        if (expanded.value) return set$(handle, false);
        context.isOpen.value = false;
      }
    });
    return (
      <button
        {...rest}
        type="button"
        aria-label={label}
        aria-expanded={expanded.value}
        data-drag-handle=""
        class={[
          // 48dp high (22dp above and below the 4dp bar), the whole width a grip.
          "flex h-12 w-full shrink-0 cursor-grab touch-none items-center justify-center",
          "rounded-t-xl border-0 bg-transparent p-0 active:cursor-grabbing",
          "focus-ring-inward",
          className,
        ]}
        onClick$={press$}
        onPointerDown$={dragStart}
        onPointerMove$={dragMove}
        onPointerUp$={dragEnd}
        onPointerCancel$={dragEnd}
      >
        {/* M3: 32 x 4dp, on-surface-variant at 40%. */}
        <span
          class="pointer-events-none h-1 w-8 rounded-full bg-on-surface-variant/40"
          aria-hidden="true"
        />
      </button>
    );
  },
);

export const Modal = {
  Root,
  Trigger,
  Close,
  Content,
  CloseTitleAction,
  Header,
  Title,
  Description,
  Section,
  Footer,
  DragHandle,
};
