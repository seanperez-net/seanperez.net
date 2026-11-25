import { component$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { Button, Layout, List } from "@seanperez/ui";
import { formatDate } from "../../feed/format";
import { listAll } from "../../feed/posts.server";

/** Every post, drafts too, last edited first. */
export const usePosts = routeLoader$(({ platform }) =>
  listAll(platform.env.DB),
);

/** The admin home: the posts, each row opening its editor. */
export default component$(() => {
  const posts = usePosts();
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title="Posts">
        {/* Messages and Profile are the admin rail's destinations (routes/layout.tsx
          `ADMIN_RAIL_ITEMS`); only the page's own action stays here (owner, 2026-11-24:
          "remove the duplicate buttons"). */}
        <Button
          type="link"
          href="/admin/new/"
          leadingIcon="add"
          label="New post"
        />
      </Layout.PaneHeader>
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid content-start">
        {posts.value.length === 0 ? (
          <p class="text-body-large text-on-surface-variant">
            No posts yet. Start with New post.
          </p>
        ) : (
          <List.Root aria-label="Posts">
            {posts.value.map((post) => (
              <List.Item
                key={post.id}
                href={`/admin/${post.id}/`}
                headline={post.title}
                supportingText={
                  post.draft
                    ? `Draft · edited ${formatDate(post.updated_at)}`
                    : `Published ${formatDate(post.published_at)}`
                }
              />
            ))}
          </List.Root>
        )}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = {
  title: "Posts · Admin",
  meta: [{ name: "robots", content: "noindex", key: "robots" }],
};
