import { component$ } from "@qwik.dev/core";
import {
  Form,
  routeAction$,
  routeLoader$,
  valibot$,
  type DocumentHead,
} from "@qwik.dev/router";
import { Button, Layout, Modal, TextField } from "@seanperez/ui";
import * as v from "valibot";
import { requireAdmin } from "@seanperez/server/feed/access.server";
import { ARTICLE_CLASS, formatDate } from "@seanperez/server/feed/format";
import { renderMarkdown } from "@seanperez/server/feed/markdown.server";
import {
  MAX_BODY,
  MAX_SLUG,
  MAX_TITLE,
  SLUG_PATTERN,
} from "@seanperez/db/feed/limits";
import {
  deletePost,
  getById,
  savePost,
  slugify,
} from "@seanperez/db/feed/posts.server";

type FieldErrors = { title?: string; slug?: string };

/** `/new/` or `/<id>/`; anything else is a 404. */
const postId = (param: string): number | "new" | null =>
  param === "new" ? "new" : /^[1-9]\d*$/.test(param) ? Number(param) : null;

export const usePost = routeLoader$(async ({ platform, params, error }) => {
  const id = postId(params.id);
  if (id === null) throw error(404, "Post not found");
  if (id === "new") return null;
  const post = await getById(platform.env.DB, id);
  if (!post) throw error(404, "Post not found");
  return post;
});

/**
 * Save draft, Publish / Update, Unpublish and Preview: the form's submit buttons, told apart by
 * `intent`. Preview only renders the markdown (on the server, so the editor ships no markdown
 * library) and saves nothing. `requireAdmin` again here: the layout's `onRequest` already ran
 * for this POST; this keeps the action safe if it is ever moved.
 */
export const useSavePost = routeAction$(
  async (data, ev) => {
    await requireAdmin(ev);
    const html = renderMarkdown(data.body_md);
    if (data.intent === "preview") return { preview: html };

    const title = data.title.trim();
    const slug = data.slug.trim() || slugify(title);
    const fieldErrors: FieldErrors = {};
    if (!title) fieldErrors.title = "Enter a title.";
    if (!SLUG_PATTERN.test(slug)) {
      fieldErrors.slug = "Lowercase letters, digits and hyphens only.";
    }
    if (fieldErrors.title || fieldErrors.slug) {
      return ev.fail(400, { fieldErrors, preview: html });
    }

    const id = postId(ev.params.id);
    if (id === null) return ev.fail(404, { message: "Post not found." });
    const saved = await savePost(
      ev.platform.env.DB,
      {
        title,
        slug,
        body_md: data.body_md,
        publish: data.intent === "publish",
      },
      id === "new" ? undefined : id,
    );
    if (saved === "slug-taken") {
      return ev.fail(409, {
        fieldErrors: { slug: "Another post has this slug." } as FieldErrors,
        preview: html,
      });
    }
    // A new post moves to its own URL (303: the browser GETs it).
    if (id === "new") throw ev.redirect(303, `/${saved}/`);
    return {
      message: data.intent === "publish" ? "Published." : "Saved as a draft.",
      preview: html,
    };
  },
  valibot$(
    v.object({
      title: v.pipe(v.string(), v.maxLength(MAX_TITLE)),
      slug: v.pipe(v.string(), v.maxLength(MAX_SLUG)),
      body_md: v.pipe(v.string(), v.maxLength(MAX_BODY)),
      intent: v.picklist(["draft", "publish", "preview"]),
    }),
  ),
);

export const useDeletePost = routeAction$(async (_data, ev) => {
  await requireAdmin(ev);
  const id = postId(ev.params.id);
  if (typeof id === "number") await deletePost(ev.platform.env.DB, id);
  throw ev.redirect(303, "/");
});

/** The editor: plain markdown in a textarea, a server-rendered preview below. */
export default component$(() => {
  const post = usePost();
  const save = useSavePost();
  const remove = useDeletePost();
  // What a field shows: the stored post, or after a refused save the text that was sent (so a
  // no-JS submit keeps it). With JS the browser keeps what was typed while the prop is unchanged.
  // Preview saves nothing and is not a failure, so it keeps the sent text too: before this
  // (forms audit 2026-11-24) a no-JS Preview showed the stored post again and a new post came
  // back blank, and with JS a Preview after a refused save put the stored text back.
  const fieldValue = (name: "title" | "slug" | "body_md") =>
    save.value?.failed || save.formData?.get("intent") === "preview"
      ? (save.formData?.get(name)?.toString() ?? "")
      : (post.value?.[name] ?? "");
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title={post.value ? "Edit post" : "New post"}>
        <Button type="link" href="/" look="text" label="All posts" />
      </Layout.PaneHeader>
      {/* The pane's ONE body element (layout.md). */}
      <div class="grid max-w-3xl content-start gap-6">
        <p class="text-body-medium text-on-surface-variant">
          {!post.value
            ? "Not saved yet."
            : post.value.draft
              ? `Draft · edited ${formatDate(post.value.updated_at)}`
              : `Published ${formatDate(post.value.published_at)} · `}
          {post.value && !post.value.draft && (
            <a
              href={`/feed/${post.value.slug}/`}
              class="text-primary underline underline-offset-4"
            >
              View
            </a>
          )}
        </p>
        <Form action={save} class="grid gap-4">
          <TextField
            name="title"
            label="Title"
            // Not a person's title: Chrome's heuristics read a "title" field as an honorific.
            autocomplete="off"
            required
            maxLength={MAX_TITLE}
            value={fieldValue("title")}
            error={save.value?.fieldErrors?.title}
          />
          <TextField
            name="slug"
            label="Slug"
            autocomplete="off"
            autocapitalize="none"
            spellcheck={false}
            // The server's check, in the browser too (an empty slug is allowed: `pattern` is
            // not checked on an empty field, and the server makes one from the title).
            pattern={SLUG_PATTERN.source.slice(1, -1)}
            maxLength={MAX_SLUG}
            supportingText="The address: /feed/<slug>/. Left empty, it is made from the title."
            value={fieldValue("slug")}
            error={save.value?.fieldErrors?.slug}
          />
          <TextField
            name="body_md"
            type="textarea"
            rows={16}
            resize="vertical"
            label="Body (Markdown)"
            maxLength={MAX_BODY}
            value={fieldValue("body_md")}
          />
          {save.value?.failed && save.value.message && (
            <p role="alert" class="text-body-medium text-error">
              {save.value.message}
            </p>
          )}
          {save.value?.message && !save.value.failed && (
            <p role="status" class="text-body-medium text-on-surface">
              {save.value.message}
            </p>
          )}
          <div class="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="intent"
              value="preview"
              look="text"
              label="Preview"
            />
            <Button
              type="submit"
              name="intent"
              value="draft"
              look="outlined"
              label={
                post.value && !post.value.draft ? "Unpublish" : "Save draft"
              }
            />
            <Button
              type="submit"
              name="intent"
              value="publish"
              label={post.value && !post.value.draft ? "Update" : "Publish"}
              isLoading={save.isRunning}
            />
          </div>
        </Form>

        {save.value?.preview !== undefined && (
          <section aria-labelledby="preview-title" class="grid gap-4">
            <h2 id="preview-title" class="text-title-large text-on-surface">
              Preview
            </h2>
            <div
              class={ARTICLE_CLASS}
              dangerouslySetInnerHTML={save.value.preview}
            />
          </section>
        )}

        {post.value && (
          <Modal.Root>
            <div>
              <Modal.Trigger>Delete post</Modal.Trigger>
            </div>
            <Modal.Content>
              <Modal.Header>
                <Modal.Title>Delete this post?</Modal.Title>
                <Modal.Description>
                  It is removed from the feed and cannot be brought back.
                </Modal.Description>
              </Modal.Header>
              <Modal.Footer>
                <Modal.Close>Cancel</Modal.Close>
                <Form action={remove}>
                  <Button type="submit" look="text" label="Delete" />
                </Form>
              </Modal.Footer>
            </Modal.Content>
          </Modal.Root>
        )}
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = {
  title: "Edit post · Admin",
  meta: [{ name: "robots", content: "noindex", key: "robots" }],
};
