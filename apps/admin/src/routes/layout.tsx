import { component$, Slot, useComputed$ } from "@qwik.dev/core";
import { useLocation, type RequestHandler } from "@qwik.dev/router";
import { requireAdmin } from "@seanperez/data/feed/access.server";
import { Layout, type LayoutRailItem } from "@seanperez/ui";

/**
 * The admin's ONE scaffold (rule L2; `.claude/rules/admin.md`). The rail was apps/web's
 * `ADMIN_RAIL_ITEMS` (`apps/web/src/routes/layout.tsx`, until 2026-11-25) at this app's own
 * paths, without "Site" (the public site is another host). The pages moved here from apps/web's
 * `routes/admin/` on 2026-11-25. The Cloudflare OS shell (`.claude/notes/admin-app-plan-2026-11-25.md`)
 * grows on this same `Layout.Root`, by props only.
 */
/**
 * The gate (rule A7, moved from apps/web's `routes/admin/layout.tsx` 2026-11-25). Qwik Router
 * runs this ROOT layout's `onRequest` before every page render, every loader JSON request
 * (`q-loader-*.json`) and every action POST in the app (router `user-response.mjs`,
 * `resolveRequestHandlers`); in a LAYOUT, not a page, because a page's own handlers are skipped
 * for loader requests the page does not define (`guardPageHandlerForLoader`). Cloudflare Access
 * fronts the whole hostname in production; `requireAdmin` checks its token and FAILS CLOSED
 * (403 when a setting is unset or the token is wrong). Only `pnpm dev:admin`
 * (`import.meta.env.DEV`) skips it. No `server$` or `globalAction$` in this app: neither passes
 * through here (rule A11). Every response is private and never indexed (A12).
 */
export const onRequest: RequestHandler = async (ev) => {
  await requireAdmin(ev);
  ev.headers.set("Cache-Control", "private, no-store");
  ev.headers.set("X-Robots-Tag", "noindex");
};

const RAIL_ITEMS: LayoutRailItem[] = [
  { href: "/", label: "Posts", icon: "article" },
  { href: "/messages/", label: "Messages", icon: "mail" },
  { href: "/accounts/", label: "Accounts", icon: "groups" },
  { href: "/profile/", label: "Profile", icon: "person" },
];

export default component$(() => {
  const loc = useLocation();
  // The rail destination the page is in (a detail page sits under its list), read in a
  // computed, not the component body (rule Q12).
  const activeHref = useComputed$(() => {
    const path = loc.url.pathname;
    const within = RAIL_ITEMS.map((item) => item.href)
      .filter((href) => href !== "/" && path.startsWith(href))
      .sort((a, b) => b.length - a.length)[0];
    // Posts is the root list, so a post's editor (`/<id>/`, `/new/`) sits under "/".
    return within ?? "/";
  });
  return (
    <Layout.Root
      title="Admin"
      titleHref="/"
      activeHref={activeHref.value}
      railItems={RAIL_ITEMS}
      themeToggle="rail"
    >
      <Layout.Rail />
      <Layout.Drawer />
      <Layout.AppBar />
      {/* Each page renders its own `Layout.Pane` (as apps/web). */}
      <Slot />
    </Layout.Root>
  );
});
