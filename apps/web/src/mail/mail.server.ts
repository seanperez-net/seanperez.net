/**
 * Outgoing mail (server only). Plan: `.claude/notes/contact-verify-email-plan-2026-11-25.md`
 * section 2; owner's answers 2026-11-25 (memory `contact-creates-account`, "DECIDED").
 *
 * - `sendMail`: Resend's HTTP API over plain `fetch`, no SDK (PROOFED 2026-11-25
 *   resend.com/docs/api-reference/emails/send-email: `POST https://api.resend.com/emails`,
 *   `Authorization: Bearer`, JSON `from` / `to` / `subject` / `text` / `html` / `reply_to` /
 *   `headers`, optional `Idempotency-Key` header (unique per request, 24 h, at most 256
 *   characters); answers `{ id }`). Secret `RESEND_API_KEY`. Every mail to a visitor and the
 *   owner's replies.
 * - `notifyOwner`: the Workers `send_email` binding `EMAIL` to the secret `OWNER_NOTIFY_TO`, the
 *   owner's verified Email Routing destination (free on any plan with Email Routing alone,
 *   PROOFED 2026-11-25 developers.cloudflare.com/email-service/configuration/destination-
 *   addresses/; `send({ from, to, subject, text, replyTo })` and `E_*` error codes, PROOFED
 *   /email-service/api/send-emails/workers-api/). Falls back to Resend if the binding throws.
 * - DEV: with no `RESEND_API_KEY` under `pnpm dev`, mail is printed to the server console WHOLE
 *   (e-store's `DevEmailProvider` idea: a cut link broke its dev verification) and kept in memory
 *   for `/api/dev-mail` (dev only; the e2e tests read the code there). Production with no key:
 *   nothing is sent, the outcome is `failed` / `not_configured` and the caller says so honestly.
 *
 * Never logged: addresses, tokens, codes (except the DEV console, which is the developer's own
 * machine), message text. Errors log the provider's status and error NAME only.
 */

/** From addresses (owner, 2026-11-25: in code; public addresses on the owner's own domain that
 * the site never shows; they reach the visitor's inbox only). */
export const FROM_NOREPLY = "Sean Perez <noreply@seanperez.net>";
export const FROM_SEAN = "Sean Perez <sean@seanperez.net>";
export const SEAN_REPLY_TO = "sean@seanperez.net";

const RESEND_URL = "https://api.resend.com/emails";

export interface Mail {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  /** Resend `Idempotency-Key`: a retried request never sends twice (24 h). */
  idempotencyKey: string;
}

export type SendOutcome =
  | { status: "sent"; id: string }
  /** DEV console sender: printed, not sent. */
  | { status: "logged" }
  | { status: "failed"; error: string };

/** The env this module reads (the generated `Env` has them as strings; any may be empty). */
export type MailEnv = Pick<Env, "RESEND_API_KEY" | "OWNER_NOTIFY_TO"> & {
  EMAIL?: SendEmail;
};

/** `pnpm dev` (Vite's flag). False in the Worker build and under `node --test`. */
const DEV = import.meta.env?.DEV === true;

/** DEV only: the last mails, newest last (`/api/dev-mail`). Module memory of the dev server. */
const devOutbox: Mail[] = [];

export function devMail(to: string): Mail | null {
  if (!DEV) return null;
  const want = to.trim().toLowerCase();
  for (let i = devOutbox.length - 1; i >= 0; i--) {
    if (devOutbox[i].to.toLowerCase() === want) return devOutbox[i];
  }
  return null;
}

function logDev(mail: Mail): SendOutcome {
  devOutbox.push(mail);
  if (devOutbox.length > 50) devOutbox.shift();
  console.info(
    `\n[dev mail] (not sent: no RESEND_API_KEY)\nTo: ${mail.to}\nFrom: ${mail.from}\nSubject: ${mail.subject}\n\n${mail.text}\n[/dev mail]\n`,
  );
  return { status: "logged" };
}

/** Whether visitor mail can go out here: a Resend key, or the dev console. */
export const canMail = (env: MailEnv) => !!env.RESEND_API_KEY || DEV;

export async function sendMail(
  env: MailEnv,
  mail: Mail,
  fetcher: typeof fetch = fetch,
): Promise<SendOutcome> {
  if (!env.RESEND_API_KEY) {
    return DEV ? logDev(mail) : { status: "failed", error: "not_configured" };
  }
  try {
    const res = await fetcher(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": mail.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        // RFC 3834 (NOT PROOFED: not read 2026-11-25): an automatic message, so auto-responders
        // do not answer it.
        headers: { "Auto-Submitted": "auto-generated" },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
    };
    if (res.ok && body.id) return { status: "sent", id: body.id };
    const error = `${res.status} ${body.name ?? "error"}`.slice(0, 120);
    console.error("mail: resend refused", error);
    return { status: "failed", error };
  } catch (error) {
    const name = error instanceof Error ? error.name : "error";
    console.error("mail: resend unreachable", name);
    return { status: "failed", error: name };
  }
}

/**
 * The owner's notification. `send_email` first (free, outside Resend's 100 a day), Resend to the
 * same address if it throws. No `OWNER_NOTIFY_TO`: printed in DEV, skipped in production.
 */
export async function notifyOwner(
  env: MailEnv,
  mail: Omit<Mail, "to" | "from">,
): Promise<SendOutcome> {
  const to = env.OWNER_NOTIFY_TO?.trim();
  if (!to) {
    return DEV
      ? logDev({ ...mail, to: "(OWNER_NOTIFY_TO)", from: FROM_NOREPLY })
      : { status: "failed", error: "not_configured" };
  }
  if (env.EMAIL) {
    try {
      const result = await env.EMAIL.send({
        from: { email: "noreply@seanperez.net", name: "seanperez.net" },
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      });
      if (DEV) logDev({ ...mail, to, from: FROM_NOREPLY });
      return { status: "sent", id: result.messageId };
    } catch (error) {
      console.error(
        "mail: send_email refused",
        (error as { code?: string }).code ?? (error as Error).name,
      );
    }
  }
  return sendMail(env, { ...mail, to, from: FROM_NOREPLY });
}

// --- templates (text + minimal HTML; no images, no tracking) ----------------------------------

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The verification email. Never the visitor's message, NOR the name they typed: the form must
 * not relay anyone's text to an address they typed (plan 5.5). Just the code and the link.
 */
export function verificationMail(link: string, code: string) {
  const text = [
    "Someone sent Sean Perez a message from this email address on seanperez.net.",
    "",
    `If it was you, confirm it with this code: ${code}`,
    `or open this link: ${link}`,
    "",
    "The code and the link work for 30 minutes.",
    "If it was not you, ignore this email: the message is deleted in 7 days.",
  ].join("\n");
  const html = `<p>Someone sent Sean Perez a message from this email address on seanperez.net.</p>
<p>If it was you, confirm it with this code:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
<p>or open this link: <a href="${escapeHtml(link)}">Confirm my message</a></p>
<p>The code and the link work for 30 minutes.<br>If it was not you, ignore this email: the message is deleted in 7 days.</p>`;
  return { subject: "Confirm your message to Sean Perez", text, html };
}

/** The owner's notification: who, the start of the message, a link to it in /admin. */
export function ownerNotice(name: string, preview: string, adminLink: string) {
  const start = preview.length > 200 ? `${preview.slice(0, 200)}…` : preview;
  const text = `New message from ${name} (verified).\n\n${start}\n\nRead it: ${adminLink}`;
  const html = `<p>New message from <b>${escapeHtml(name)}</b> (verified).</p>
<blockquote style="white-space:pre-wrap">${escapeHtml(start)}</blockquote>
<p><a href="${escapeHtml(adminLink)}">Read it in /admin</a></p>`;
  return { subject: `New message from ${name}`, text, html };
}

/** The owner's reply from /admin: his text, plain. */
export function replyMail(body: string) {
  const html = `<p style="white-space:pre-wrap">${escapeHtml(body)}</p>`;
  return { subject: "Re: your message to Sean Perez", text: body, html };
}
