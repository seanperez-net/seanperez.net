import type { RequestHandler } from "@qwik.dev/router";
import { adminUrl } from "@seanperez/server/hosts";

/**
 * `/admin` left the site on 2026-11-25: it is its own app (`apps/admin`, `admin.seanperez.net`,
 * behind Cloudflare Access on the whole hostname). Every old address, `/admin/` itself included
 * (`[...rest]` also matches an empty rest: next.qwik.dev `/docs/routing/` "Route priority"),
 * moves for good to the same path and query on the admin host (`@seanperez/server/hosts`; a local
 * request goes to `pnpm dev:admin`). `onRequest`, so every method is answered here and nothing
 * under `/admin` renders on the site. No data is read: this route needs no gate.
 *
 * Built from the ENCODED `url.pathname`, assigned as a property, never from the decoded
 * `params.rest` resolved as a string: `/admin/%2Fevil.com/` decodes to `//evil.com/`, which
 * `new URL()` would read as another host (open redirect, found by the RULE 2 review
 * 2026-11-25). Assigning `pathname` can never change the host.
 */
export const onRequest: RequestHandler = ({ url, redirect, headers }) => {
  const target = new URL(adminUrl("/", url));
  target.pathname = url.pathname.replace(/^\/admin(?=\/|$)/, "") || "/";
  target.search = url.search;
  headers.set("Cache-Control", "no-store");
  throw redirect(301, target.href);
};
