import {
  $,
  component$,
  isBrowser,
  useOnDocument,
  useSignal,
  useTask$,
} from "@qwik.dev/core";
import { routeAction$ } from "@qwik.dev/router";
import { Button, List, useSnackbar } from "@seanperez/ui";
import { deleteOwnAccount } from "../account/account.server";
import { clearSessionCookie, sessionOf } from "../account/contact.server";
import { ME_CHANGED_EVENT, fetchMe, type Me } from "../account/me";
import { ConfirmDialog } from "./contacts-dialogs";
import { ResumeSection } from "./resume-section";

/**
 * "Your account" on /profile/ (owner, 2026-11-25, "DECIDED" (3)): the contact account this
 * browser is signed in to (made by Contact me), and "Delete my account". Shown only with a
 * session (`/api/me`, read in the browser: never in a loader, which the service worker would
 * keep). No email address is shown (no-email rule).
 *
 * The action is a POST (`routeAction$`; re-exported from `routes/profile/index.tsx`, a route
 * boundary file, Qwik rc.5 "Action"), same-origin only (Qwik Router's `checkOrigin`, rule Q8),
 * and reads the account from the session COOKIE alone: it takes no field from the browser. What
 * goes and who may: `deleteOwnAccount` (`account/account.server.ts`): only a browser that
 * confirmed the address (an unverified session may be a stranger who typed it), so the button
 * is shown only then.
 */

/** The section's heading id (the list is labelled by it). */
const ACCOUNT_ID = "profile-account";

export const ACCOUNT_DELETED_NOTICE = "Account deleted";

// Re-exported from routes/profile/index.tsx (see the file comment).
// eslint-disable-next-line qwik/loader-location
export const useDeleteMyAccount = routeAction$(
  async (_data, { platform, cookie, url, cacheControl, fail }) => {
    cacheControl({ noStore: true });
    const env = platform.env;
    // Not gated on `accountsOpen`: a session made while accounts were on can always be deleted.
    const session = await sessionOf(env, cookie, url);
    if (!session) {
      clearSessionCookie(cookie, url);
      return fail(401, { message: "This browser is not signed in." });
    }
    let result;
    try {
      result = await deleteOwnAccount(env.DB, session);
    } catch (error) {
      console.error("account: delete failed", (error as Error).name);
      return fail(500, {
        message: "Your account could not be deleted. Please try again later.",
      });
    }
    if (result.kind === "verify-first") {
      return fail(403, {
        message:
          "Confirm your email in Contact me first, then you can delete the account here.",
      });
    }
    // Deleted, or already gone: either way this browser is signed out.
    clearSessionCookie(cookie, url);
    return { deleted: true };
  },
  { invalidate: [] },
);

export const ProfileAccount = component$(() => {
  const del = useDeleteMyAccount();
  const { showSnackbar$ } = useSnackbar();
  const me = useSignal<Me | null>(null);
  const confirmOpen = useSignal(false);
  const error = useSignal("");
  const readMe = $(async () => {
    me.value = await fetchMe();
  });
  // Server-rendered page: read on resume (`qinit`); rendered in the browser (a client
  // navigation to /profile/): read right away. Again when this tab signs in, verifies or signs
  // out (Contact me). As `contact-panel.tsx` reads it.
  useOnDocument("qinit", readMe);
  useOnDocument(ME_CHANGED_EVENT, readMe);
  useTask$(() => {
    if (isBrowser) return readMe();
  });
  const confirm$ = $(async () => {
    error.value = "";
    const { value } = await del.submit();
    if (value.failed) {
      error.value = value.message ?? "Your account could not be deleted.";
      return;
    }
    me.value = null;
    document.dispatchEvent(new CustomEvent(ME_CHANGED_EVENT));
    await showSnackbar$({ message: ACCOUNT_DELETED_NOTICE });
  });
  return (
    // Placement only: no box of its own, so the page's grid gap appears only with the section.
    <div class="contents">
      {me.value && (
        <ResumeSection id={ACCOUNT_ID} title="Your account" full>
          <List.Root aria-labelledby={ACCOUNT_ID}>
            <List.Item
              startIcon="person"
              // Unverified: `/api/me` gives no name (it may be another person's account).
              headline={me.value.name || "Your contact account"}
              supportingText={
                me.value.verified
                  ? "Made by Contact me. Email confirmed."
                  : "Email not confirmed yet. Confirm it in Contact me to delete the account here; unconfirmed accounts are deleted after 7 days."
              }
              // Only a browser that confirmed the address may delete (`deleteOwnAccount`).
              end={
                me.value.verified ? (
                <Button
                  look="text"
                  leadingIcon="delete"
                  label="Delete my account"
                  isLoading={del.isRunning}
                  onClick$={() => {
                    confirmOpen.value = true;
                  }}
                />
                ) : undefined
              }
            />
          </List.Root>
          {error.value && (
            <p role="alert" class="px-4 pb-4 text-body-medium text-error">
              {error.value}
            </p>
          )}
        </ResumeSection>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete your account?"
        description="Your account, your messages to Sean and its sign-in on every browser are deleted from the site's server. This can't be undone."
        confirmLabel="Delete"
        onConfirm$={confirm$}
      />
    </div>
  );
});
