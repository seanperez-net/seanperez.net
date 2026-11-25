import { component$ } from "@qwik.dev/core";
import {
  Form,
  routeAction$,
  routeLoader$,
  type DocumentHead,
} from "@qwik.dev/router";
import { Button, Layout, Modal } from "@seanperez/ui";
import { requireAdmin } from "../../../../feed/access.server";
import { formatDate } from "../../../../feed/format";
import {
  deleteMessage,
  getMessage,
  markRead,
} from "../../../../messages/messages.server";

const messageId = (param: string): number | null =>
  /^[1-9]\d*$/.test(param) ? Number(param) : null;

/**
 * One message. Opening it marks it read (the first time only). That is a write on a GET, kept
 * here because it is the simplest form of "read on open" and it is idempotent; the inbox links
 * here with `reload` so a hover prefetch never runs it. `requireAdmin` again, as the post editor
 * does: the layout's `onRequest` already ran, this keeps it safe if the loader is ever moved.
 */
export const useMessage = routeLoader$(async (ev) => {
  await requireAdmin(ev);
  const id = messageId(ev.params.id);
  if (id === null) throw ev.error(404, "Message not found");
  const db = ev.platform.env.DB;
  const message = await getMessage(db, id);
  if (!message) throw ev.error(404, "Message not found");
  if (!message.read_at) await markRead(db, id);
  return message;
});

export const useDeleteMessage = routeAction$(async (_data, ev) => {
  await requireAdmin(ev);
  const id = messageId(ev.params.id);
  if (id !== null) await deleteMessage(ev.platform.env.DB, id);
  throw ev.redirect(303, "/admin/messages/");
});

export default component$(() => {
  const message = useMessage();
  const remove = useDeleteMessage();
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title={message.value.name}>
        <Button
          type="link"
          href="/admin/messages/"
          look="text"
          label="All messages"
        />
      </Layout.PaneHeader>
      {/* The pane's ONE body element (layout.md). Everything below is visitor input shown as
          TEXT (Qwik escapes it); nothing is rendered as HTML. */}
      <div class="grid max-w-3xl content-start gap-6">
        <p class="text-body-medium text-on-surface-variant">
          {formatDate(message.value.created_at)} ·{" "}
          {/* The visitor's address, shown here only (behind Access). Encoded, so an address
              with `?cc=` or `&body=` cannot add fields to the mail draft. */}
          <a
            href={`mailto:${encodeURIComponent(message.value.email)}`}
            class="text-primary underline underline-offset-4"
          >
            {message.value.email}
          </a>
        </p>
        <p class="text-body-large wrap-break-word whitespace-pre-wrap text-on-surface">
          {message.value.body}
        </p>
        <Modal.Root>
          <div>
            <Modal.Trigger>Delete message</Modal.Trigger>
          </div>
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Delete this message?</Modal.Title>
              <Modal.Description>It cannot be brought back.</Modal.Description>
            </Modal.Header>
            <Modal.Footer>
              <Modal.Close>Cancel</Modal.Close>
              <Form action={remove}>
                <Button type="submit" look="text" label="Delete" />
              </Form>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      </div>
    </Layout.Pane>
  );
});

export const head: DocumentHead = {
  title: "Message · Admin",
  meta: [{ name: "robots", content: "noindex", key: "robots" }],
};
