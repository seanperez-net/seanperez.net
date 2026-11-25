import { component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import type { IconName } from "../icon";
import { IconButton } from "../icon-button";
import type { IconButtonLook, IconButtonSize } from "../icon-button";

/**
 * FullscreenButton: puts one element (a pane) into full screen with the Fullscreen API, and
 * takes it out again.
 *
 * From e-store's `fullscreen-button/fullscreen-button.tsx` (2026-11-24), cut from a media
 * player's button to any element: `targetId` instead of `mediaId` / `containerId`, and no
 * `webkitEnterFullscreen()` video fallback (there is no video to fall back to).
 *
 * As e-store's: absent until the browser says it can (server render, iPhone Safari, an iframe
 * without `allow="fullscreen"`), so a dead button is never shown; the wrapper `<span hidden>`
 * stays so the visible task has an element. The click is a NATIVE listener, not an `onClick$`:
 * `requestFullscreen()` needs the click's transient activation, which a lazily loaded `$()`
 * handler can outlive (HTML "transient activation"; e-store's research). The state is read back
 * from `fullscreenchange`, never set by the click, because the request can be refused.
 *
 * ARIA: a toggle button (WAI-ARIA APG "button"): a constant name, `aria-pressed`, and
 * `aria-controls` = the target. Escape leaves full screen (the browser's).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
 * @see https://fullscreen.spec.whatwg.org/
 */
export interface FullscreenButtonProps {
  /** The `id` of the element to make full screen. Required. */
  targetId: string;
  /** Accessible name and tooltip; constant (`aria-pressed` carries the state). */
  label?: string;
  /** Icon while not full screen. */
  enterIcon?: IconName;
  /** Icon while full screen. */
  exitIcon?: IconName;
  look?: IconButtonLook;
  size?: IconButtonSize;
  /** Every full-screen change of the target. */
  onFullscreenChange$?: QRL<(fullscreen: boolean) => void>;
}

export const FullscreenButton = component$<FullscreenButtonProps>(
  ({
    targetId,
    label = "Full screen",
    enterIcon = "fullscreen",
    exitIcon = "fullscreen_exit",
    look = "standard",
    size = "sm",
    onFullscreenChange$,
  }) => {
    const supported = useSignal(false);
    const active = useSignal(false);
    const rootRef = useSignal<HTMLElement>();

    // `document-ready`: the wrapper is `display: contents` (and `hidden` at first), so an
    // IntersectionObserver would never see it (e-store's note).
    // VISIBLE-TASK AUDIT 2026-11-25: KEEP — requestFullscreen needs a synchronous native click; display:contents root so document-ready (MDN user activation)
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(
      ({ cleanup }) => {
        const root = rootRef.value;
        const doc = root?.ownerDocument;
        const target = doc?.getElementById(targetId);
        if (!root || !doc || !target) return;
        // `fullscreenEnabled` is false where the API exists but may not be used (an iframe
        // without `allow="fullscreen"`, Permissions-Policy); iPhone Safari has no
        // `requestFullscreen` on elements at all (MDN BCD, `Element.requestFullscreen`).
        supported.value =
          typeof target.requestFullscreen === "function" &&
          doc.fullscreenEnabled;
        if (!supported.value) return;
        const report = () => {
          const on = doc.fullscreenElement === target;
          if (on === active.value) return;
          active.value = on;
          onFullscreenChange$?.(on);
        };
        const onClick = (event: Event) => {
          if (!(event.target as Element | null)?.closest("button")) return;
          if (doc.fullscreenElement === target) {
            doc.exitFullscreen().catch(() => {});
          } else {
            // A refusal (the window is not active, a showing popover: Fullscreen spec "ready
            // check") changes nothing; the state follows `fullscreenchange`.
            target.requestFullscreen().catch(() => {});
          }
        };
        doc.addEventListener("fullscreenchange", report);
        root.addEventListener("click", onClick);
        report();
        cleanup(() => {
          doc.removeEventListener("fullscreenchange", report);
          root.removeEventListener("click", onClick);
        });
      },
      { strategy: "document-ready" },
    );

    return (
      <span
        ref={rootRef}
        data-qds-fullscreen-button=""
        hidden={!supported.value}
        class="contents"
      >
        {supported.value && (
          <IconButton
            type="button"
            look={look}
            size={size}
            label={label}
            aria-pressed={active.value}
            aria-controls={targetId}
            icon={active.value ? exitIcon : enterIcon}
          />
        )}
      </span>
    );
  },
);
