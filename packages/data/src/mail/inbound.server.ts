import PostalMime, { type Email } from "postal-mime";
import { normalizeEmail } from "../account/account.server.ts";

/**
 * Inbound mail for sean@seanperez.net (2026-11-25; `.claude/notes/contact-email-routing-audit-
 * 2026-11-25.md`, approved by the owner). Email Routing's rule for sean@ points at this Worker
 * ("Send to a Worker", an owner step AFTER the deploy); the catch-all stays a plain forward to
 * Gmail and never reaches this code. Exported as `email` from `entry.cloudflare-pages.tsx` and
 * `public/_worker.js` (QWIK-DEFAULTS.md 2026-11-25).
 *
 * In order:
 * 1. FORWARD to the owner's Gmail (`OWNER_NOTIFY_TO`, a verified destination) first, so a parse
 *    or D1 failure never loses the mail. A failed forward is logged; the row is still saved.
 * 2. Only mail to sean@ and at most `MAX_RAW_BYTES` is read further (forward-only otherwise).
 * 3. Buffer `message.raw` once (single-use stream), parse with postal-mime.
 * 4. Save one row in `message` (`source = 'email'`, migration 0006). No attachments, the text
 *    cut to the form's limit, the auth summary from the FIRST `Authentication-Results` header
 *    whose authserv-id is `mx.cloudflare.net` (later ones may come from the sender), and the row
 *    linked to a contact account when the envelope sender matches one AND dmarc=pass.
 * The handler never replies (no loops, no backscatter) and never throws.
 *
 * Sources read 2026-11-25: Cloudflare email handler page
 * (developers.cloudflare.com/email-service/api/route-emails/email-handler/: `forward()`, `raw`,
 * `rawSize`, "read the first Authentication-Results header ... verify that its authentication
 * service identifier is mx.cloudflare.net"; "Only headers with an X- prefix can be added");
 * installed `@cloudflare/workers-types` 5.20261119.1 `ForwardableEmailMessage`; installed
 * postal-mime 4.2.1 README (`parse(buffer)`, `headers` in sent order with duplicates,
 * `attachmentEncoding`, the size note "untrusted input should still be bounded by size").
 *
 * NOT PROOFED: whether `message.raw` can still be read after `forward()` in production (the
 * docs do not say; the owner's order is forward first). If it reads empty, the row is saved
 * from `message.headers` alone (subject, Message-ID, no body, auth unknown = flagged).
 */

/** The one address stored in the inbox. */
export const INBOUND_ADDRESS = "sean@seanperez.net";
/** Bigger mail is forwarded only (Free-plan CPU; the inbox only needs the text). */
export const MAX_RAW_BYTES = 1024 * 1024;
/** Same limits as the contact form (`contact-panel.tsx` MAX). */
const MAX_BODY = 5000;
const MAX_NAME = 100;
const MAX_SUBJECT = 300;
const MAX_MESSAGE_ID = 500;
/** Rows of `source = 'email'` kept per UTC day (a flood guard; Gmail keeps every mail anyway). */
export const EMAILS_PER_DAY = 100;

export type InboundEnv = {
  DB: D1Database;
  OWNER_NOTIFY_TO?: string;
};

/** The parts of `ForwardableEmailMessage` used here (so tests can pass a plain object). */
export type InboundMessage = Pick<
  ForwardableEmailMessage,
  "from" | "to" | "raw" | "rawSize" | "headers" | "forward"
> & { canBeForwarded?: boolean };

export interface InboundRow {
  name: string;
  email: string;
  body: string;
  subject: string | null;
  messageId: string | null;
  auth: string | null;
}

/** One line, no control characters (shown as one line in the admin inbox). */
const oneLine = (s: string, max: number) =>
  s
    .replace(/\p{Cc}+/gu, " ")
    .trim()
    .slice(0, max);

/**
 * `dkim=… spf=… dmarc=…` from the first `Authentication-Results` header, when Cloudflare added
 * it (authserv-id `mx.cloudflare.net`); null otherwise. Headers are in the order sent and
 * Cloudflare's own is on top, so only the FIRST one is looked at: a sender-supplied one further
 * down never counts, even if it names mx.cloudflare.net.
 */
export function authSummary(headers: Email["headers"]): string | null {
  const first = headers.find((h) => h.key === "authentication-results");
  if (!first) return null;
  const value = first.value.trim();
  if (!/^mx\.cloudflare\.net(\s*;|\s|$)/i.test(value)) return null;
  const parts: string[] = [];
  for (const method of ["dkim", "spf", "dmarc"]) {
    const m = new RegExp(`\\b${method}=([a-z]+)`, "i").exec(value);
    if (m) parts.push(`${method}=${m[1].toLowerCase()}`);
  }
  return parts.join(" ") || null;
}

export const dmarcPassed = (auth: string | null) =>
  !!auth && /\bdmarc=pass\b/.test(auth);

/** Plain text of an HTML-only mail: tags out, entities left as typed (shown as text in /admin). */
const htmlToText = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();

/** The row for a parsed mail. `envelopeFrom` is SMTP MAIL FROM (Cloudflare: trustworthy). */
export function rowFromParsed(parsed: Email, envelopeFrom: string): InboundRow {
  const from = parsed.from?.address ? parsed.from : null;
  const text =
    parsed.text?.trim() || (parsed.html ? htmlToText(parsed.html) : "");
  return {
    name: oneLine(from?.name || from?.address || envelopeFrom, MAX_NAME),
    email: oneLine(envelopeFrom, 254),
    body: text.slice(0, MAX_BODY),
    subject: parsed.subject ? oneLine(parsed.subject, MAX_SUBJECT) : null,
    messageId: parsed.messageId
      ? oneLine(parsed.messageId, MAX_MESSAGE_ID)
      : null,
    auth: authSummary(parsed.headers),
  };
}

/** Parses raw MIME (bytes already bounded by the caller). No attachment bytes are kept. */
export async function parseInbound(
  raw: ArrayBuffer | string,
  envelopeFrom: string,
): Promise<InboundRow> {
  const parsed = await PostalMime.parse(raw, {
    // Attachments are dropped right after; keep their decoded form small.
    attachmentEncoding: "arraybuffer",
    maxNestingDepth: 50,
    maxPartCount: 500,
  });
  return rowFromParsed(parsed, envelopeFrom);
}

/**
 * Saves one email row, unless today's `EMAILS_PER_DAY` is reached (one statement, as
 * `saveMessage`). Linked to the contact account whose address is the envelope sender, only when
 * DMARC passed (a From that did not authenticate could be anyone's). Always `confirmed_at` =
 * `created_at`: "unverified" is the contact form's address check, and an unconfirmed row would
 * be purged after 7 days; a mail without dmarc=pass is flagged by its `auth` in /admin instead.
 */
export async function saveInbound(
  db: D1Database,
  row: InboundRow,
  now = new Date(),
): Promise<{ saved: boolean; id: number | null; accountId: string | null }> {
  const created = now.toISOString();
  const dayStart = `${created.slice(0, 10)}T00:00:00.000Z`;
  const account = dmarcPassed(row.auth)
    ? await db
        .prepare("SELECT id FROM contact_account WHERE email = ?")
        .bind(normalizeEmail(row.email))
        .first<{ id: string }>()
    : null;
  const inserted = await db
    .prepare(
      `INSERT INTO message
         (name, email, body, created_at, account_id, confirmed_at, source, subject, message_id, auth)
       SELECT ?, ?, ?, ?, ?, ?, 'email', ?, ?, ?
       WHERE (SELECT COUNT(*) FROM message WHERE source = 'email' AND created_at >= ?) < ?
       RETURNING id`,
    )
    .bind(
      row.name,
      row.email,
      row.body,
      created,
      account?.id ?? null,
      created,
      row.subject,
      row.messageId,
      row.auth,
      dayStart,
      EMAILS_PER_DAY,
    )
    .first<{ id: number }>();
  return {
    saved: !!inserted,
    id: inserted?.id ?? null,
    accountId: inserted ? (account?.id ?? null) : null,
  };
}

/** What the handler did, for tests and the log line (no addresses, no text). */
export type InboundOutcome = {
  forwarded: boolean;
  stored: "saved" | "full" | "skipped" | "headers-only" | "failed";
};

/** The Worker's `email()` handler. Never throws. */
export async function handleInbound(
  message: InboundMessage,
  env: InboundEnv,
): Promise<InboundOutcome> {
  // 1. Gmail copy first.
  let forwarded = false;
  const to = env.OWNER_NOTIFY_TO?.trim();
  if (!to) {
    console.error("inbound: OWNER_NOTIFY_TO is not set; not forwarded");
  } else if (message.canBeForwarded === false) {
    console.warn("inbound: message cannot be forwarded");
  } else {
    try {
      await message.forward(to);
      forwarded = true;
    } catch (error) {
      console.error("inbound: forward failed", (error as Error).name);
    }
  }

  // 2. Only sean@, only a bounded size.
  if (normalizeEmail(message.to) !== INBOUND_ADDRESS) {
    return { forwarded, stored: "skipped" };
  }
  if (message.rawSize > MAX_RAW_BYTES) {
    console.warn("inbound: over the size cap; forwarded only", message.rawSize);
    return { forwarded, stored: "skipped" };
  }

  try {
    // 3. Buffer once, parse.
    let raw: ArrayBuffer | null = null;
    try {
      raw = await new Response(message.raw).arrayBuffer();
    } catch (error) {
      console.warn("inbound: raw not readable", (error as Error).name);
    }
    let row: InboundRow;
    let stored: InboundOutcome["stored"] = "saved";
    if (raw && raw.byteLength > 0 && raw.byteLength <= MAX_RAW_BYTES) {
      row = await parseInbound(raw, message.from);
    } else {
      // The stream was empty (see NOT PROOFED above): the headers Cloudflare already parsed.
      stored = "headers-only";
      const subject = message.headers.get("subject");
      const messageId = message.headers.get("message-id");
      row = {
        name: oneLine(message.from, MAX_NAME),
        email: oneLine(message.from, 254),
        body: "",
        subject: subject ? oneLine(subject, MAX_SUBJECT) : null,
        messageId: messageId ? oneLine(messageId, MAX_MESSAGE_ID) : null,
        // `Headers.get` joins repeated headers, so "the first one" cannot be told apart here.
        auth: null,
      };
    }
    // 4. Save.
    const result = await saveInbound(env.DB, row);
    if (!result.saved) {
      console.warn("inbound: daily cap reached; forwarded only");
      return { forwarded, stored: "full" };
    }
    return { forwarded, stored };
  } catch (error) {
    console.error("inbound: parse or save failed", (error as Error).name);
    return { forwarded, stored: "failed" };
  }
}

/**
 * `email(message, env, ctx)` for the Worker's default export. Awaited (not `waitUntil`): the
 * mail is already forwarded, and a D1 failure then shows as a logged error in Workers Logs.
 */
export const email: EmailExportedHandler<InboundEnv> = async (message, env) => {
  await handleInbound(message, env);
};
