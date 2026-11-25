import { component$, type Signal } from "@qwik.dev/core";
import { Turnstile } from "@seanperez/ui";
import { useContactSetup } from "./contact-panel";

/**
 * The security check for an UNVERIFIED contact session's send in Sean's thread (owner,
 * 2026-11-25, "DECIDED" (2); `useSendToSean` checks the token with Siteverify). Rendered by the
 * thread's hosts (the Messages pane, the floating window) only while `useDemoThread` says this
 * browser's session is unverified; a verified session never loads it.
 *
 * The same widget and settings as Contact me (`contact-panel.tsx`): `compact`,
 * `appearance="interaction-only"` (most visitors never see it; when Cloudflare needs a click it
 * shows here), action `contact`. It sits in its own small `<form>` because the widget writes its
 * token into the form around it, and the composer is the chat package's own form (no slot);
 * `useDemoThread`'s send reads the token from here with `waitForTurnstileToken`.
 *
 * `loadOn="visible"`, not Contact me's `"interaction"`: that mode arms on a focus or submit INSIDE
 * the widget's own form, and the visitor types in the composer's form, so it would never arm.
 * Since this is drawn only for an unverified session on Sean's thread, api.js still loads for
 * nobody else. No site key: renders nothing, the send posts no token and the server answers
 * "not open yet", as Contact me.
 *
 * `floating`: the floating Messages window is a popover at the bottom END from 600px (below 600px
 * the full page opens instead), so the check sits at the bottom START, where an interactive
 * challenge is not under the window.
 */
export const SendCheck = component$<{
  form: Signal<HTMLFormElement | undefined>;
  /** A send is using the token: true -> false resets the widget (tokens are single use). */
  pending: boolean;
  floating?: boolean;
}>(({ form, pending, floating = false }) => {
  const setup = useContactSetup();
  return (
    <form
      ref={form}
      aria-label="Security check"
      preventdefault:submit
      // Placement only (see the comment above).
      class={floating ? "fixed inset-s-6 bottom-6" : undefined}
    >
      <Turnstile
        siteKey={setup.value.siteKey}
        action="contact"
        size="compact"
        appearance="interaction-only"
        loadOn="visible"
        pending={pending}
      />
    </form>
  );
});
