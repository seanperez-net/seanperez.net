/**
 * Turnstile action names, one per form that sends a token (security review, 2026-11-25). The
 * widget sends its `action` with the challenge and Siteverify returns it; `checkTurnstile`
 * (`contact.server.ts`) refuses a token whose action is not the one the receiving endpoint
 * expects, so a token solved for one form cannot be spent on another. Cloudflare: "Validate the
 * action and hostname when specified" (turnstile/get-started/server-side-validation, "Best
 * practices"; read 2026-11-25). At most 32 characters of letters, digits, `_` and `-`
 * (widget-configurations). Shared by the widgets (browser) and the actions (server): plain
 * strings, no imports.
 */
export const TURNSTILE_ACTIONS = {
  /** Contact me's Send (`useSendMessage`, `contact-panel.tsx`). */
  contact: "contact",
  /** An UNVERIFIED session's send in Sean's thread (`useSendToSean`, `send-check.tsx`). */
  message: "message",
  /** "Send the email again" (`useResendVerification`, `contact-panel.tsx`). */
  resend: "resend",
} as const;
