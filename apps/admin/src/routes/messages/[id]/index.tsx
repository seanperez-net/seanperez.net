import { component$ } from "@qwik.dev/core";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
  type DocumentHead,
} from "@qwik.dev/router";
import { Button, Layout, Modal, TextField } from "@seanperez/ui";
import { createToken, getAccount } from "@seanperez/db/account/account.server";
import { sendVerification } from "@seanperez/server/account/contact.server";
import { siteOrigin } from "@seanperez/server/hosts";
import { requireAdmin } from "@seanperez/server/feed/access.server";
import { formatDate } from "@seanperez/server/feed/format";
import {
  FROM_SEAN,
  SEAN_REPLY_TO,
  replyMail,
  sendMail,
} from "@seanperez/server/mail/mail.server";
import {
  addReply,
  deleteMessage,
  getMessage,
  listReplies,
  markRead,
  recordReplySend,
} from "@seanperez/db/messages/messages.server";

const messageId = (param: string): number | null =>
  /^[1-9]\d*$/.test(param) ? Number(param) : null;

/** Characters in an owner reply. */
const MAX_REPLY = 5000;

/**
 * One message. Opening it marks it read (the first time only). That is a write on a GET, kept
 * here because it is the simplest form of "read on open" and it is idempotent; the inbox links
 * here with `reload` so a hover prefetch never runs it. `requireAdmin` again, as the post editor
 * does: the layout's `onRequest` already ran, this keeps it safe if the loader is ever moved.
 *
 * Contact accounts (2026-11-25, plan 3.3): the sender's account (verified or not, the last
 * verification email's status), "Resend verification" (unverified only) and "Reply" (VERIFIED
 * only: an address that never confirmed is never mailed free text), sent with Resend from
 * sean@seanperez.net; replies come back to the owner's Gmail through the catch-all.
 */
export const useMessage = routeLoader$(async (ev) => {
  await requireAdmin(ev);
  const id = messageId(ev.params.id);
  if (id === null) throw ev.error(404, "Message not found");
  const db = ev.platform.env.DB;
  const message = await getMessage(db, id);
  if (!message) throw ev.error(404, "Message not found");
  if (!message.read_at) await markRead(db, id);
  let account = null;
  let replies: Awaited<ReturnType<typeof listReplies>> = [];
  try {
    account = message.account_id
      ? await getAccount(db, message.account_id)
      : null;
    replies = await listReplies(db, id);
  } catch (error) {
    // Migration 0004 not applied yet: the message alone.
    console.error("admin: account read failed", error);
  }
  return { message, account, replies };
});

export const useDeleteMessage = routeAction$(async (_data, ev) => {
  await requireAdmin(ev);
  const id = messageId(ev.params.id);
  if (id !== null) await deleteMessage(ev.platform.env.DB, id);
  throw ev.redirect(303, "/messages/");
});

export const useResendVerificationAdmin = routeAction$(async (_data, ev) => {
  await requireAdmin(ev);
  const env = ev.platform.env;
  const id = messageId(ev.params.id);
  const message = id === null ? null : await getMessage(env.DB, id);
  const account = message?.account_id
    ? await getAccount(env.DB, message.account_id)
    : null;
  if (!account)
    return ev.fail(404, { message: "No account for this message." });
  if (account.verified_at)
    return ev.fail(400, { message: "Already verified." });
  if (!env.AUTH_SECRET)
    return ev.fail(503, { message: "AUTH_SECRET is not set." });
  // Counts against the same caps as the visitor's own "Send again" (1 a minute, 3 a day).
  const token = await createToken(env.DB, env.AUTH_SECRET, account.id, null);
  if (!token) {
    return ev.fail(429, {
      message:
        "Capped: one email a minute, three a day per address, forty a day in all.",
    });
  }
  const outcome = await sendVerification(
    env,
    // The link opens the SITE's `/verify/` (`hosts.ts`), not this app's host.
    siteOrigin(ev.url),
    account.email,
    token,
  );
  return outcome.status === "failed"
    ? ev.fail(502, { message: `Not sent: ${outcome.error}.` })
    : {
        done:
          outcome.status === "logged" ? "Printed to the dev console." : "Sent.",
      };
});

export const useReply = routeAction$(
  async (data, ev) => {
    await requireAdmin(ev);
    const env = ev.platform.env;
    const id = messageId(ev.params.id);
    const message = id === null ? null : await getMessage(env.DB, id);
    const account = message?.account_id
      ? await getAccount(env.DB, message.account_id)
      : null;
    if (!message || !account?.verified_at) {
      return ev.fail(400, {
        message: "Replies go only to verified addresses.",
      });
    }
    const replyId = await addReply(env.DB, message.id, data.body);
    const outcome = await sendMail(env, {
      to: account.email,
      from: FROM_SEAN,
      replyTo: SEAN_REPLY_TO,
      ...replyMail(data.body),
      idempotencyKey: `reply-${replyId}`,
    });
    await recordReplySend(env.DB, replyId, outcome);
    return outcome.status === "failed"
      ? ev.fail(502, { message: `Saved, not sent: ${outcome.error}.` })
      : { done: true };
  },
  {
    // The new reply shows in the list (the loader runs again; marking read is idempotent).
    invalidate: [useMessage],
    validation: [
      zod$({
        body: z
          .string()
          .trim()
          .min(1, "Write a reply.")
          .max(MAX_REPLY, `At most ${MAX_REPLY} characters.`),
      }),
    ],
  },
);

const SEND_TEXT: Record<string, string> = {
  pending: "not sent yet",
  sent: "sent",
  logged: "printed to the dev console (no RESEND_API_KEY)",
  failed: "FAILED",
};

export default component$(() => {
  const data = useMessage();
  const remove = useDeleteMessage();
  const resend = useResendVerificationAdmin();
  const reply = useReply();
  return (
    <Layout.Pane role="primary">
      <Layout.PaneHeader title={data.value.message.name}>
        <Button
          type="link"
          href="/messages/"
          look="text"
          label="All messages"
        />
      </Layout.PaneHeader>
      {/* The pane's ONE body element (layout.md). Everything below is visitor input shown as
          TEXT (Qwik escapes it); nothing is rendered as HTML. */}
      <div class="grid max-w-3xl content-start gap-6">
        <p class="text-body-medium text-on-surface-variant">
          {formatDate(data.value.message.created_at)} ·{" "}
          {data.value.message.confirmed_at ? "Verified" : "Unverified"} ·{" "}
          {/* The visitor's address, shown here only (behind Access). Encoded, so an address
              with `?cc=` or `&body=` cannot add fields to the mail draft. */}
          <a
            href={`mailto:${encodeURIComponent(data.value.message.email)}`}
            class="text-primary underline underline-offset-4"
          >
            {data.value.message.email}
          </a>
        </p>
        {/* A mail to sean@ (migration 0006, `mail/inbound.server.ts`): its subject, and what
          Cloudflare's own Authentication-Results said (no dmarc=pass: the From may be forged). */}
        {data.value.message.source === "email" && (
          <div class="grid gap-1">
            <p class="text-title-medium wrap-break-word text-on-surface">
              {data.value.message.subject || "(no subject)"}
            </p>
            <p class="text-body-medium text-on-surface-variant">
              Email to sean@ ·{" "}
              {data.value.message.auth ?? "no Cloudflare authentication result"}
              {data.value.message.auth?.includes("dmarc=pass")
                ? ""
                : " · not authenticated"}
            </p>
          </div>
        )}
        <p class="text-body-large wrap-break-word whitespace-pre-wrap text-on-surface">
          {data.value.message.body}
        </p>

        {data.value.account && (
          <section class="grid gap-2" aria-labelledby="account-heading">
            <h2 id="account-heading" class="text-title-medium text-on-surface">
              Sender's account
            </h2>
            <p class="text-body-medium text-on-surface-variant">
              {data.value.account.name} · created{" "}
              {formatDate(data.value.account.created_at)} ·{" "}
              {data.value.account.verified_at
                ? `verified ${formatDate(data.value.account.verified_at)}`
                : "not verified (deleted 7 days after it was created)"}
            </p>
            {data.value.account.lastSend && (
              <p class="text-body-medium text-on-surface-variant">
                Last verification email{" "}
                {formatDate(data.value.account.lastSend.created_at)}:{" "}
                {SEND_TEXT[data.value.account.lastSend.send_status]}
                {data.value.account.lastSend.send_error
                  ? ` (${data.value.account.lastSend.send_error})`
                  : ""}
              </p>
            )}
            {!data.value.account.verified_at && (
              <Form action={resend}>
                <Button
                  type="submit"
                  look="outlined"
                  label="Resend verification"
                  isLoading={resend.isRunning}
                />
              </Form>
            )}
            {resend.value?.failed && (
              <p role="alert" class="text-body-medium text-error">
                {resend.value.message}
              </p>
            )}
            {resend.value?.done && (
              <p role="status" class="text-body-medium text-on-surface-variant">
                {resend.value.done}
              </p>
            )}
          </section>
        )}

        {data.value.replies.length > 0 && (
          <section class="grid gap-2" aria-labelledby="replies-heading">
            <h2 id="replies-heading" class="text-title-medium text-on-surface">
              Your replies
            </h2>
            {data.value.replies.map((r) => (
              <div key={r.id} class="grid gap-1">
                <p class="text-body-small text-on-surface-variant">
                  {formatDate(r.created_at)} · {SEND_TEXT[r.send_status]}
                  {r.send_error ? ` (${r.send_error})` : ""}
                </p>
                <p class="text-body-medium wrap-break-word whitespace-pre-wrap text-on-surface">
                  {r.body}
                </p>
              </div>
            ))}
          </section>
        )}

        {data.value.account?.verified_at && (
          <Form action={reply} class="grid gap-3">
            <TextField
              name="body"
              type="textarea"
              rows={6}
              label="Reply by email"
              supportingText="Sent from sean@seanperez.net; their answer reaches your inbox."
              required
              maxLength={MAX_REPLY}
              error={reply.value?.fieldErrors?.body}
            />
            {reply.value?.failed && reply.value.message && (
              <p role="alert" class="text-body-medium text-error">
                {reply.value.message}
              </p>
            )}
            <div>
              <Button
                type="submit"
                label="Send reply"
                leadingIcon="send"
                isLoading={reply.isRunning}
              />
            </div>
          </Form>
        )}

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
