import { component$ } from "@qwik.dev/core";
import { routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { Layout } from "@seanperez/ui";
import { ARTICLE_CLASS, formatDate } from "../../../feed/format";
import { excerpt, renderMarkdown } from "../../../feed/markdown.server";
import { getPublished } from "../../../feed/posts.server";
import { seoHead } from "../../../seo";

/**
 * One published post, its markdown rendered here on the server (safe by default, see
 * `markdown.server.ts`). A draft, an unknown or a malformed slug is a 404.
 */
export const usePost = routeLoader$(async ({ platform, params, error }) => {
  const post = await getPublished(platform.env.DB, params.slug);
  if (!post) throw error(404, "Post not found");
  return {
    title: post.title,
    published: post.published_at,
    updated: post.updated_at,
    html: renderMarkdown(post.body_md),
    description: excerpt(post.body_md) || post.title,
  };
});

export default component$(() => {
  const post = usePost();
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title={post.value.title} />
      {/* The pane's ONE body element (layout.md). */}
      <article class={ARTICLE_CLASS}>
        <p class="text-body-medium text-on-surface-variant">
          <time dateTime={post.value.published ?? undefined}>
            {formatDate(post.value.published)}
          </time>
        </p>
        <div class="contents" dangerouslySetInnerHTML={post.value.html} />
      </article>
    </Layout.Pane>
  );
});

export const head: DocumentHead = ({ resolveValue, url }) => {
  const post = resolveValue(usePost);
  return seoHead({
    title: `${post.title} · Sean Perez`,
    description: post.description,
    url,
    type: "article",
  });
};
