import { Slot, component$ } from "@qwik.dev/core";
import type { RequestHandler } from "@qwik.dev/router";
import { requireAdmin } from "../../feed/access.server";

/**
 * The /admin gate. Qwik Router runs this before every /admin page render, every loader JSON
 * request (`q-loader-*.json`) and every action POST under /admin (router `user-response.mjs`,
 * `resolveRequestHandlers`); in a LAYOUT, not the page, because a page's own handlers are
 * skipped for loader requests the page does not define (`guardPageHandlerForLoader`).
 * Cloudflare Access sits in front in production; this checks its token (`access.server.ts`).
 * No `server$` or `globalAction$` in admin code: neither passes through here.
 */
export const onRequest: RequestHandler = async (ev) => {
  await requireAdmin(ev);
  // Never stored by a browser or a cache, never indexed.
  ev.headers.set("Cache-Control", "private, no-store");
  ev.headers.set("X-Robots-Tag", "noindex");
};

/** A pass-through (rule L2): the scaffold is the root layout's `Layout.Root`. */
export default component$(() => <Slot />);
