import { component$, isBrowser, useTask$ } from "@qwik.dev/core";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
  type DocumentHead,
  type RequestHandler,
  useLocation,
} from "@qwik.dev/router";
import { Button, Layout } from "@seanperez/ui";
import { ME_CHANGED_EVENT } from "../../account/me";
import { peekLink, verifyLink } from "@seanperez/db/account/account.server";
import {
  accountsOpen,
  notifyOwnerLater,
  readSessionCookie,
  sessionOf,
  setSessionCookie,
} from "@seanperez/server/account/contact.server";
import { TOO_MANY, WEIGHT, allow } from "@seanperez/server/limits/limit.server";

/**
 * `/verify/?t=<link token>`: the link in the verification email (plan 1.2). The GET only SHOWS a
 * Confirm button (mail scanners and link previews follow GET links and would use up a token that
 * a GET verified: Cloudflare's own OTP troubleshooting page, read for the accounts plan); the
 * POST (`useConfirmLink`) verifies. Works on any device, but confirms ONLY this browser (a new
 * verified session if it had none): the browser that asked may be a stranger's (owner, 2026-11-25,
 * second agent's HIGH). The browser that wrote confirms itself with the code.
 *
 * Private and never indexed: `no-store` (no edge cache, no service-worker copy), `noindex`,
 * `Referrer-Policy: no-referrer` (the token is in the URL). The masked address is shown only to
 * whoever holds the link.
 */
export const onRequest: RequestHandler = ({ headers, cacheControl }) => {
  cacheControl({ noStore: true });
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Referrer-Policy", "no-referrer");
};

type LinkState =
  | { state: "none" }
  | { state: "ok"; masked: string }
  | { state: "invalid" | "expired" | "used" | "locked" | "closed" };

export const useLink = routeLoader$(
  async ({ url, platform }): Promise<LinkState> => {
    const t = url.searchParams.get("t") ?? "";
    if (!t) return { state: "none" };
    if (!accountsOpen(platform.env)) return { state: "closed" };
    try {
      const peek = await peekLink(platform.env.DB, t);
      return peek.ok
        ? { state: "ok", masked: peek.masked }
        : { state: peek.reason };
    } catch (error) {
      console.error("verify: peek failed", error);
      return { state: "invalid" };
    }
  },
  { search: ["t"], cacheControl: { noStore: true } },
);

export const useConfirmLink = routeAction$(
  async (data, { platform, cookie, url, fail }) => {
    const env = platform.env;
    // Rate limit FIRST (2026-11-25, `limits/limit.server.ts`): one route-wide key. A 32-byte
    // token is out of reach of guessing; this only shields D1 from a flood.
    if (!(await allow(env, "link", WEIGHT.link)))
      return fail(429, { message: TOO_MANY });
    if (!accountsOpen(env)) return fail(503, { message: "Not open yet." });
    const current = await sessionOf(env, cookie, url);
    const result = await verifyLink(env.DB, data.t, current);
    if (!result.ok) {
      return fail(400, {
        message:
          result.reason === "expired"
            ? "This link has expired. Use “Send the email again” in Contact me for a new one."
            : result.reason === "used"
              ? "This link was already used."
              : "This link does not work. Use the newest email, or the code in it.",
      });
    }
    const token = result.sessionToken ?? readSessionCookie(cookie, url);
    if (token) setSessionCookie(cookie, url, token, true);
    notifyOwnerLater(env, platform.ctx, url.origin, result.accountId, null);
    return { verified: true };
  },
  {
    invalidate: [],
    validation: [zod$({ t: z.string().min(1).max(100) })],
  },
);

const STATE_TEXT = {
  none: "Open the link from the email, or enter its 6-digit code in Contact me.",
  invalid:
    "This link does not work. Use the newest email, or enter its code in Contact me.",
  expired:
    "This link has expired. Use “Send the email again” in Contact me for a new one.",
  used: "This link was already used. If your message is confirmed, there is nothing more to do.",
  locked:
    "This link was locked after too many wrong codes. Use “Send the email again” in Contact me.",
  closed: "Confirming is not open yet.",
} as const;

export default component$(() => {
  const link = useLink();
  const confirm = useConfirmLink();
  // Confirmed: an open Contact me panel (and Sean's thread) re-read the session, so they stop
  // asking for the code (found in Chrome, 2026-11-25).
  useTask$(({ track }) => {
    const done = track(() => confirm.value?.verified);
    if (isBrowser && done)
      document.dispatchEvent(new CustomEvent(ME_CHANGED_EVENT));
  });
  // The token from the address (the loader keeps it out of its JSON).
  const loc = useLocation();
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title="Confirm your message" />
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid max-w-3xl content-start justify-items-start gap-4">
        {confirm.value?.verified ? (
          <>
            <p role="status" class="text-body-large text-on-surface">
              Confirmed. This browser can now message Sean in Messages without
              the form. If you wrote from another browser, enter the code from
              the email there to confirm it too.
            </p>
            <Button
              type="link"
              href="/messages/sean-perez/"
              reload
              label="Open Messages"
            />
          </>
        ) : link.value.state === "ok" ? (
          <>
            <p class="text-body-large text-on-surface">
              Confirm that the message to Sean was sent by {link.value.masked}.
            </p>
            <Form action={confirm}>
              <input
                type="hidden"
                name="t"
                value={loc.url.searchParams.get("t") ?? ""}
              />
              <Button
                type="submit"
                label="Confirm"
                isLoading={confirm.isRunning}
              />
            </Form>
            {confirm.value?.failed && (
              <p role="alert" class="text-body-medium text-error">
                {confirm.value.message}
              </p>
            )}
          </>
        ) : (
          <p class="text-body-large text-on-surface">
            {STATE_TEXT[link.value.state]}
          </p>
        )}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = {
  title: "Confirm your message · Sean Perez",
  meta: [
    { name: "robots", content: "noindex", key: "robots" },
    { name: "referrer", content: "no-referrer", key: "referrer" },
  ],
};
