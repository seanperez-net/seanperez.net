import type { QRL } from "@qwik.dev/core";
import {
  $,
  component$,
  isServer,
  useOnDocument,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";

/**
 * Cloudflare Turnstile widget (explicit rendering). Ported 2026-11-24 from e-store's
 * `packages/ui/src/components/turnstile/turnstile.tsx` (a worktree, not e-store's main tree),
 * structure and names unchanged; see `turnstile.md` "Where it differs from e-store".
 *
 * Renders NOTHING without a `siteKey`. Server-side validation is the host's job (Siteverify);
 * this component only produces the token. Placed inside a `<form>`, the widget adds the hidden
 * input `cf-turnstile-response` (or `responseFieldName`), so a Qwik `<Form>` post carries the
 * token with no extra wiring.
 *
 * Docs (PROOFED 2026-11-24, Cloudflare docs):
 * - https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/ : explicit
 *   mode loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` and calls
 *   `turnstile.render(container, { sitekey, ... })`, `turnstile.reset(id)`,
 *   `turnstile.remove(id)`; explicit rendering is the one for SPAs (implicit rendering only scans
 *   the page on load, so a client navigation to the form would show no widget).
 * - .../widget-configurations/ : `theme` `auto | light | dark`, `size`
 *   `normal | flexible | compact`, `response-field-name`, `action` (32 characters: letters,
 *   digits, `_`, `-`), `appearance` `always | execute | interaction-only` ("Appearance modes",
 *   read 2026-11-24: `interaction-only` shows the widget only when the visitor must interact;
 *   most visitors never see it).
 *
 * Tokens are single-use and expire after 300 s. The widget refreshes an expired token itself;
 * after a submit has spent one, the form's `pending` flips true -> false and the widget resets.
 */

export const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const turnstileVariants = tv({
  slots: {
    root: "flex flex-col gap-2",
    widget: "max-w-full",
    noscript: "text-body-medium text-error",
  },
  variants: {
    appearance: {
      // 65px: the widget's own height (normal and flexible), reserved so the form does not jump.
      always: { root: "min-h-[65px]" },
      // Hidden until needed: reserving space would leave an empty gap for most visitors.
      execute: {},
      "interaction-only": {},
    },
  },
});

export interface TurnstileProps {
  /** The widget's site key. Empty or absent: renders nothing. */
  siteKey?: string | null;
  /** Echoed back by Siteverify and checked by the server; one per form (`contact`, ...). */
  action?: string;
  /**
   * `auto`: the PAGE's mode (the `dark` class on `<html>` that `ThemeModeScript` / `ThemeToggle`
   * set) when the widget renders; Turnstile's own `auto` would follow the OS instead.
   */
  theme?: "auto" | "light" | "dark";
  size?: "normal" | "flexible" | "compact";
  /**
   * When the widget is visible (Cloudflare's `appearance`). `always` (Cloudflare's default);
   * `execute`: once the challenge starts; `interaction-only`: only when the visitor must click.
   */
  appearance?: "always" | "execute" | "interaction-only";
  /** `auto` (the visitor's language), an ISO 639-1 code or a language-country code. */
  language?: string;
  /** Name of the hidden input the widget adds to its form. */
  responseFieldName?: string;
  /**
   * The owning form's in-flight flag (`action.isRunning`). When it goes from `true` back to
   * `false` the widget is reset, because the token it held was spent by that submit.
   */
  pending?: boolean;
  /**
   * When api.js loads and the widget renders. `visible` (default, e-store's): once the widget
   * scrolls into view. `interaction`: on the visitor's first `focusin`, `pointerdown`, `input` or
   * `submit` inside the widget's own `<form>`, so a form that is on screen but never used costs
   * no third-party script. Pair it with {@link waitForTurnstileToken} in the form's async
   * `onSubmit$`, since a fast submit can come before the token. NEW 2026-11-24 (perf audit).
   */
  loadOn?: "visible" | "interaction";
  /** Shown only without JavaScript (`<noscript>`): the server will refuse the form. */
  noScriptMessage?: string;
  /** After a challenge is solved, with the token (Turnstile's `callback`). */
  onSolve$?: QRL<(token: string) => void>;
  /** The token expired (300 s) before the form was sent (`expired-callback`); the widget
   *  refreshes it itself. */
  onExpire$?: QRL<() => void>;
  /** The widget failed (network, unsupported browser; `error-callback`), with its error code. */
  onError$?: QRL<(code: string) => void>;
  /** The api.js URL. Override only in tests; Cloudflare requires the exact published URL. */
  scriptUrl?: string;
  class?: string;
}

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: Record<string, unknown>,
  ): string | undefined;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
  __qdsTurnstileLoading?: Promise<TurnstileApi>;
};

/**
 * For a form with a `Turnstile`, in its ASYNC `onSubmit$` (the router's `<Form action>` awaits
 * async submit handlers before it reads the form and posts: `@qwik.dev/router` rc.5 `Form`):
 * resolves with the widget's token once its hidden input holds one. Resolves `""` at once when
 * the form has no widget (no site key), as soon as the widget reports an error
 * (`data-error`), or after `timeoutMs`; the form is then posted without a token and the server
 * answers with its own message. Polls, because the widget writes the input by script (no
 * `input` event) and creates it only when it renders. NEW 2026-11-24 (perf audit).
 */
export function waitForTurnstileToken(
  form: HTMLFormElement,
  {
    fieldName = "cf-turnstile-response",
    timeoutMs = 10_000,
    intervalMs = 100,
  }: { fieldName?: string; timeoutMs?: number; intervalMs?: number } = {},
): Promise<string> {
  const token = () => {
    const field = form.elements.namedItem(fieldName);
    return field instanceof HTMLInputElement ? field.value : "";
  };
  const widget = () => form.querySelector("[data-qds-turnstile]");
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const value = token();
      if (value) return resolve(value);
      if (
        !widget() ||
        widget()?.hasAttribute("data-error") ||
        Date.now() - started >= timeoutMs
      )
        return resolve("");
      setTimeout(check, intervalMs);
    };
    check();
  });
}

/** Load api.js once per page; every widget awaits the same promise. */
function loadTurnstile(src: string): Promise<TurnstileApi> {
  const w = window as TurnstileWindow;
  if (w.turnstile) return Promise.resolve(w.turnstile);
  if (w.__qdsTurnstileLoading) return w.__qdsTurnstileLoading;
  w.__qdsTurnstileLoading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    // A nonce'd CSP: hand the page's nonce on (Turnstile propagates it to what it loads).
    const nonce = (
      document.querySelector("script[nonce]") as HTMLScriptElement | null
    )?.nonce;
    if (nonce) script.nonce = nonce;
    script.onload = () =>
      w.turnstile
        ? resolve(w.turnstile)
        : reject(new Error("Turnstile did not initialise"));
    script.onerror = () => {
      w.__qdsTurnstileLoading = undefined;
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return w.__qdsTurnstileLoading;
}

export const Turnstile = component$<TurnstileProps>(
  ({
    siteKey,
    action,
    theme = "auto",
    size = "flexible",
    appearance = "always",
    language = "auto",
    responseFieldName = "cf-turnstile-response",
    pending = false,
    noScriptMessage = "This form uses a security check that needs JavaScript. Turn JavaScript on to send it.",
    scriptUrl = TURNSTILE_SCRIPT_URL,
    loadOn = "visible",
    onSolve$,
    onExpire$,
    onError$,
    class: className,
  }) => {
    const host = useSignal<HTMLElement>();
    const widgetId = useSignal<string>("");
    const wasPending = useSignal(false);
    // `loadOn="interaction"`: false until the visitor first uses the form.
    const armed = useSignal(loadOn === "visible");
    // The widget's error callback ran; `waitForTurnstileToken` stops waiting on it.
    const failed = useSignal(false);
    const slots = turnstileVariants({ appearance });

    // `loadOn="interaction"`: the first focus, press, typing or submit inside this widget's own
    // form arms it. On the document because `focusin` on the fields never reaches this element
    // (they are its siblings). `pointerdown` covers Safari, which does not focus a clicked button
    // (a draft restored into the fields can make Send the first thing pressed); `submit`
    // covers anything else, and `waitForTurnstileToken` then waits for the late token.
    useOnDocument(
      ["focusin", "pointerdown", "input", "submit"],
      $((event: Event) => {
        if (armed.value) return;
        const form = host.value?.closest("form");
        if (form && event.target instanceof Node && form.contains(event.target))
          armed.value = true;
      }),
    );

    // Browser-only, once the widget scrolls into view (and, with `loadOn="interaction"`, once
    // armed): the third-party script is not loaded for a form nobody reaches or uses. The root is a real element, so the visible strategy holds.
    // A third-party widget needs the DOM element and `window`: no useTask$ / useOn equivalent.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(async ({ cleanup, track }) => {
      // Tracked first, so arming re-runs this task (`loadOn="interaction"`).
      const go = track(() => armed.value);
      const el = host.value;
      if (!go || !el || !siteKey) return;
      let removed = false;
      let id: string | undefined;
      cleanup(() => {
        removed = true;
        if (id) (window as TurnstileWindow).turnstile?.remove(id);
      });
      try {
        const api = await loadTurnstile(scriptUrl);
        if (removed) return;
        const resolvedTheme =
          theme === "auto"
            ? document.documentElement.classList.contains("dark")
              ? "dark"
              : "light"
            : theme;
        id = api.render(el, {
          sitekey: siteKey,
          ...(action ? { action } : {}),
          theme: resolvedTheme,
          size,
          appearance,
          language,
          "response-field-name": responseFieldName,
          callback: (token: string) => {
            failed.value = false;
            void onSolve$?.(token);
          },
          "expired-callback": () => void onExpire$?.(),
          // Returning nothing lets Turnstile log the error and retry as it does by default.
          "error-callback": (code: string) => {
            failed.value = true;
            void onError$?.(code);
          },
        });
        widgetId.value = id ?? "";
      } catch (error) {
        console.error("[turnstile]", error);
      }
    });

    // A submit spent the token: reset when the form's pending flag falls back to false.
    // `useTask$` (e-store: a second `useVisibleTask$`): it reruns in the browser when `pending`
    // changes, and on the server there is no widget id yet, so nothing runs.
    useTask$(({ track }) => {
      const now = track(() => pending);
      if (isServer) return;
      const id = widgetId.value;
      if (wasPending.value && !now && id)
        (window as TurnstileWindow).turnstile?.reset(id);
      wasPending.value = now;
    });

    if (!siteKey) return null;
    return (
      <div
        class={slots.root({ class: className })}
        data-qds-turnstile=""
        data-action={action}
        data-error={failed.value ? "" : undefined}
      >
        <div ref={host} class={slots.widget()} />
        {/* Qwik allows only text inside <noscript>, so the styled frame sits outside it and is
            empty (zero height) whenever script runs. */}
        <p class={slots.noscript()} data-qds-turnstile-noscript="">
          <noscript>{noScriptMessage}</noscript>
        </p>
      </div>
    );
  },
);
