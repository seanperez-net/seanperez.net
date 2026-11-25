import { routeAction$, z, zod$ } from "@qwik.dev/router";
import {
  createToken,
  sendAsSession,
  verifyCode,
} from "@seanperez/db/account/account.server";
import {
  accountsOpen,
  checkTurnstile,
  notifyOwnerLater,
  readSessionCookie,
  sendVerificationLater,
  sessionOf,
  setSessionCookie,
} from "@seanperez/server/account/contact.server";
import { DEMO } from "../demo/demo";
import { MAX_BODY } from "../messages/messages-local";
import { TURNSTILE_ACTIONS } from "@seanperez/server/account/turnstile-actions";
import { TOO_MANY, WEIGHT, allow, sessionKey } from "@seanperez/server/limits/limit.server";

/**
 * The contact account's actions besides the first send (`useSendMessage` in `contact-panel.tsx`):
 * the 6-digit code, "Send the email again", and a message in Sean's thread from a browser that
 * already has a session (plan `.claude/notes/contact-verify-email-plan-2026-11-25.md` 1.2, 1.3).
 * Re-exported from `routes/layout.tsx`, the root layout, so they run on every route (Qwik rc.5
 * "Action": a `routeAction$` must be exported from a route boundary file), like `useSendMessage`.
 * Each reads the session cookie itself; none takes an account id from the browser.
 */

/** Wrong / expired / used / locked code, in the visitor's words. */
const CODE_ERRORS = {
  invalid: "That code did not work. Check it and try again.",
  expired: "That code has expired. Use “Send the email again” for a new one.",
  used: "That code was already used.",
  locked: "Too many tries. Use “Send the email again” for a new code.",
} as const;

// Re-exported from routes/layout.tsx (see the file comment).
// eslint-disable-next-line qwik/loader-location
export const useVerifyCode = routeAction$(
  async (data, { platform, cookie, url, fail }) => {
    if (!DEMO) return fail(404, { message: "Not found." });
    const env = platform.env;
    // Rate limit FIRST (2026-11-25, `limits/limit.server.ts`), keyed by this browser's session
    // hash (no D1 read). `WEIGHT.verify`: 5 tries a minute per browser, so wrong codes across tokens cannot hammer D1 (the 5 tries per token stay in D1).
    const key = await sessionKey("verify", readSessionCookie(cookie, url));
    if (!(await allow(env, key, WEIGHT.verify)))
      return fail(429, { message: TOO_MANY });
    if (!accountsOpen(env)) return fail(503, { message: "Not open yet." });
    const session = await sessionOf(env, cookie, url);
    if (!session) {
      return fail(400, {
        message: "Send a message first, then enter its code.",
      });
    }
    if (session.verified) return { verified: true };
    const result = await verifyCode(
      env.DB,
      env.AUTH_SECRET,
      session,
      data.code,
    );
    if (!result.ok) return fail(400, { message: CODE_ERRORS[result.reason] });
    // Verified browser: the cookie now lives 30 days.
    const token = result.sessionToken ?? readSessionCookie(cookie, url);
    if (token) setSessionCookie(cookie, url, token, true);
    notifyOwnerLater(env, platform.ctx, url.origin, result.accountId, null);
    return { verified: true };
  },
  {
    invalidate: [],
    validation: [
      zod$({
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/, "Enter the 6 digits from the email."),
      }),
    ],
  },
);

// Re-exported from routes/layout.tsx (see the file comment).
// eslint-disable-next-line qwik/loader-location
export const useResendVerification = routeAction$(
  async (data, { platform, request, cookie, url, fail }) => {
    if (!DEMO) return fail(404, { message: "Not found." });
    const env = platform.env;
    if (!accountsOpen(env)) return fail(503, { message: "Not open yet." });
    const session = await sessionOf(env, cookie, url);
    if (!session) return fail(400, { message: "Send a message first." });
    if (session.verified) return { resent: false, verified: true };
    // Turnstile on every resend (security review, 2026-11-25): an unverified session is anyone
    // who typed an address, so without it a script could make the 3 emails a day go to the real
    // address on its own. Its own action (`resend`). Fail closed; no secret: "not open yet".
    const check = await checkTurnstile(
      env,
      data["cf-turnstile-response"],
      request.headers.get("CF-Connecting-IP") ?? "",
      TURNSTILE_ACTIONS.resend,
    );
    if (!check.ok) return fail(check.status, { message: check.message });
    const token = await createToken(
      env.DB,
      env.AUTH_SECRET,
      session.accountId,
      session.tokenHash,
    );
    if (!token) {
      // Their own session: no address is revealed by saying so.
      return fail(429, {
        message:
          "A new email can be sent once a minute, three times a day. Please wait, or use the last code.",
      });
    }
    // After the response, as the first email (owner, 2026-11-25): a failure shows in /admin.
    void sendVerificationLater(
      env,
      platform.ctx,
      url.origin,
      session.email,
      token,
    );
    return { resent: true, verified: false };
  },
  {
    invalidate: [],
    validation: [
      zod$({
        // The security check's token (Turnstile tokens are at most 2048 characters).
        "cf-turnstile-response": z.string().max(2048).optional(),
      }),
    ],
  },
);

// Re-exported from routes/layout.tsx (see the file comment).
// eslint-disable-next-line qwik/loader-location
export const useSendToSean = routeAction$(
  async (data, { platform, request, cookie, url, fail }) => {
    if (!DEMO) return fail(404, { message: "Not found.", noSession: false });
    const env = platform.env;
    // Rate limit FIRST (2026-11-25, `limits/limit.server.ts`): this browser's session hash, no
    // D1 read; before Siteverify and the send.
    const key = await sessionKey("send", readSessionCookie(cookie, url));
    if (!(await allow(env, key, WEIGHT.send))) {
      return fail(429, { message: TOO_MANY, noSession: false });
    }
    const session = accountsOpen(env)
      ? await sessionOf(env, cookie, url)
      : null;
    // No session: the browser goes the Contact me way (`use-demo-thread.ts`).
    if (!session) return fail(401, { message: "", noSession: true });
    // An UNVERIFIED session passes Turnstile again on every send (owner, 2026-11-25, "DECIDED"
    // (2)): anyone can get one by typing any address. A verified session: none. No secret here:
    // refused as Contact me refuses ("not open yet").
    if (!session.verified) {
      const check = await checkTurnstile(
        env,
        data["cf-turnstile-response"],
        request.headers.get("CF-Connecting-IP") ?? "",
        TURNSTILE_ACTIONS.message,
      );
      if (!check.ok) {
        return fail(check.status, { message: check.message, noSession: false });
      }
    }
    let result;
    try {
      result = await sendAsSession(env.DB, session, data.message);
    } catch (error) {
      console.error("contact: session send failed", error);
      return fail(500, {
        message: "Your message could not be sent. Please try again later.",
        noSession: false,
      });
    }
    if (result.kind === "full") {
      return fail(429, {
        message: "Too many messages today. Please try again tomorrow.",
        noSession: false,
      });
    }
    if (result.kind === "capped") {
      return fail(429, {
        message: result.verified
          ? "You've sent 10 messages today. Please try again tomorrow."
          : "Confirm your email first: enter the code from the email in Contact me.",
        noSession: false,
      });
    }
    if (result.confirmed) {
      notifyOwnerLater(
        env,
        platform.ctx,
        url.origin,
        session.accountId,
        result.messageId,
      );
    }
    return { sent: true, confirmed: result.confirmed };
  },
  {
    invalidate: [],
    validation: [
      zod$({
        message: z
          .string()
          .trim()
          .min(1, "Enter a message.")
          .max(MAX_BODY, `At most ${MAX_BODY} characters.`),
        // The security check's token, for an unverified session (at most 2048 characters).
        "cf-turnstile-response": z.string().max(2048).optional(),
      }),
    ],
  },
);
