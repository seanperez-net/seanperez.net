import type { RequestHandler } from "@qwik.dev/router";

/**
 * `/feed/` has no page of its own: Home (`/`) IS the feed (owner, 2026-11-24). The posts live
 * under `/feed/<slug>/` beside the Atom feed `/feed.xml`, so this path moves people to Home.
 */
export const onGet: RequestHandler = ({ redirect }) => {
  throw redirect(301, "/");
};
