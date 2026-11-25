import type { RequestHandler } from "@qwik.dev/router";
import { signOut, touchAccount } from "../../../account/account.server";
import {
  accountsOpen,
  clearSessionCookie,
  sessionOf,
} from "../../../account/contact.server";

/**
 * `GET /api/me`: this browser's contact account, `{ name, verified }`, or `null` (accounts plan
 * A.3; verify plan 1.5). Never the email address. `no-store`: private to the one visitor, so
 * neither the Qwik adapter's edge cache (it caches cookieless GETs unless told not to) nor the
 * service worker keeps it. Why not a root-layout loader: the service worker keeps loader JSON
 * even when `private` (`service-worker.ts` `storable`), so a name would outlive a sign-out
 * offline.
 *
 * `POST /api/me`: sign out (deletes the session row, expires the cookie). Same-origin only: Qwik
 * Router's `checkOrigin` refuses a cross-site POST (rule Q8).
 */
export const onGet: RequestHandler = async ({
  platform,
  cookie,
  url,
  cacheControl,
  json,
}) => {
  cacheControl({ noStore: true });
  const env = platform.env;
  const session = accountsOpen(env) ? await sessionOf(env, cookie, url) : null;
  if (!session) {
    json(200, null);
    return;
  }
  try {
    await touchAccount(env.DB, session.accountId);
  } catch (error) {
    console.error("account: touch failed", error);
  }
  json(200, { name: session.name, verified: session.verified });
};

export const onPost: RequestHandler = async ({
  platform,
  cookie,
  url,
  cacheControl,
  json,
}) => {
  cacheControl({ noStore: true });
  const session = await sessionOf(platform.env, cookie, url);
  if (session) await signOut(platform.env.DB, session.tokenHash);
  clearSessionCookie(cookie, url);
  json(200, null);
};
