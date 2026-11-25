import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, Layout } from "@seanperez/ui";

/**
 * What the service worker shows for a page this device has not saved yet, when there is no
 * internet (`routes/service-worker.ts`, offline 2026-11-24). Stored at install, so it always
 * opens offline. Not in `pages.ts` (no card, not in the sitemap) and `noindex`: it is never a
 * page to land on from a search. `reload`: a plain link, so the click is a real navigation the
 * service worker answers.
 */
export default component$(() => (
  <Layout.Pane role="primary">
    <Layout.PaneHeader title="You're offline" />
    {/* The pane's ONE body element (layout.md). */}
    <div class="grid max-w-3xl content-start justify-items-start gap-4">
      <p class="text-body-large text-on-surface">
        This page has not been saved on this device yet, so it needs the
        internet. Pages you have opened before still work, and this one opens as
        soon as you are back online.
      </p>
      <Button type="link" href="/" reload label="Home" leadingIcon="home" />
    </div>
  </Layout.Pane>
));

export const head: DocumentHead = {
  title: "Offline · Sean Perez",
  meta: [{ name: "robots", content: "noindex" }],
};
