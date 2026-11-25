import { component$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { EmptyState, Layout, List } from "@seanperez/ui";
import { formatDate } from "@seanperez/server/feed/format";
import { listPublished } from "@seanperez/db/feed/posts.server";
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
          // The library's empty state (rule B8): what will be here, and why it is empty. `h3`
          // under the pane's sr-only `h2`; `live={false}`: the state IS the page on load.
          <EmptyState
            icon="article"
            headline="No posts yet"
            description="New posts will show up here."
            headingLevel="h3"
            live={false}
          />
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
