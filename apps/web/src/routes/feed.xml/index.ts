import type { RequestHandler } from "@qwik.dev/router";
import { renderMarkdown } from "../../feed/markdown.server";
import { listPublishedFull } from "../../feed/posts.server";
import { SITE_NAME } from "../../pages";

/** Text for XML: element content and attribute values. */
const xml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * `/feed.xml`: the newest published posts as an Atom 1.0 feed (RFC 4287). An endpoint (only
 * `onGet`, no component), so the router adds no trailing slash. Required parts: feed `id`,
 * `title`, `updated`, an `author` (a NAME only: no email anywhere, owner 2026-11-24), and per
 * entry `id`, `title`, `updated`; plus `link rel="self"` and `rel="alternate"`. Ids are the
 * permalinks on the canonical apex host, so they stay the same from www.
 */
export const onGet: RequestHandler = async ({ platform, send }) => {
  const origin = "https://seanperez.net";
  const posts = await listPublishedFull(platform.env.DB);
  const updated =
    posts.reduce(
      (latest, post) => (post.updated_at > latest ? post.updated_at : latest),
      "",
    ) || new Date(0).toISOString();

  const entries = posts.map((post) => {
    const url = `${origin}/feed/${post.slug}/`;
    return `  <entry>
    <id>${xml(url)}</id>
    <title>${xml(post.title)}</title>
    <link rel="alternate" type="text/html" href="${xml(url)}"/>
    <published>${xml(post.published_at!)}</published>
    <updated>${xml(post.updated_at)}</updated>
    <content type="html">${xml(renderMarkdown(post.body_md))}</content>
  </entry>`;
  });

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${origin}/feed/</id>
  <title>${xml(`${SITE_NAME}: Feed`)}</title>
  <link rel="self" type="application/atom+xml" href="${origin}/feed.xml"/>
  <link rel="alternate" type="text/html" href="${origin}/feed/"/>
  <updated>${updated}</updated>
  <author><name>${xml(SITE_NAME)}</name></author>
${entries.join("\n")}
</feed>
`;

  send(
    new Response(body, {
      headers: {
        "Content-Type": "application/atom+xml; charset=utf-8",
        // Readers poll; five minutes keeps a publish visible soon.
        "Cache-Control": "public, max-age=300",
      },
    }),
  );
};
