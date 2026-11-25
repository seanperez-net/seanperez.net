import { component$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { Icon, Layout, List } from "@seanperez/ui";
import { formatDate } from "@seanperez/data/feed/format";
import { listPublished } from "@seanperez/data/feed/posts.server";
import { pageHead } from "../seo";

/** Published posts, newest first (drafts never leave /admin). */
export const usePosts = routeLoader$(({ platform }) =>
  listPublished(platform.env.DB),
);

/**
 * Home IS the feed (owner, 2026-11-24): the published posts, written in /admin. No pane header
 * (owner, 2026-11-24: "why do we need that there"; the app bar already names the site). Each post
 * is one link row (`list.md`, "Places to go"), its date as supporting text; a post opens at
 * `/feed/<slug>/`. The Atom feed `/feed.xml` has no button on the page (owner, same day): feed
 * readers find it through the `<link rel="alternate">` in `head` below (RSS / Atom
 * autodiscovery).
 */
export default component$(() => {
  const posts = usePosts();
  return (
    <Layout.Pane role="primary" aria-labelledby="home-title">
      {/* The page's heading for screen readers only (as /maps/): no visible header. */}
      <h2 id="home-title" class="sr-only">
        Feed
      </h2>
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid content-start">
        {posts.value.length ? (
          <List.Root aria-label="Posts">
            {posts.value.map((post) => (
              <List.Item
                key={post.id}
                href={`/feed/${post.slug}/`}
                headline={post.title}
                supportingText={formatDate(post.published_at)}
              />
            ))}
          </List.Root>
        ) : (
          // Empty state: an icon, a line saying what will be here, and why it is empty.
          <div class="grid justify-items-center gap-2 py-16 text-center text-on-surface-variant">
            {/* Decorative; `fill-current` takes the wrapper's color (no class on Icon). */}
            <Icon name="article" size="xl" aria-hidden="true" />
            <p class="text-title-medium text-on-surface">No posts yet</p>
            <p class="text-body-medium">
              New posts will show up here.
            </p>
          </div>
        )}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = ({ url }) => ({
  ...pageHead("/", url),
  links: [
    {
      rel: "alternate",
      type: "application/atom+xml",
      title: "Sean Perez: Feed",
      href: "/feed.xml",
    },
  ],
});
