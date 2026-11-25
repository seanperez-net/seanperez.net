/**
 * Inbound mail STORAGE (migration 0006, `message.source = 'email'`). The handler (forward to the
 * owner's Gmail, parse with postal-mime) is `@seanperez/server/mail/inbound.server`; it calls
 * `saveInbound` here. Split out 2026-11-25 (packages/data -> db + server).
 */
import { normalizeEmail } from "../account/account.server.ts";

/** Rows of `source = 'email'` kept per UTC day (a flood guard; Gmail keeps every mail anyway). */
export const EMAILS_PER_DAY = 100;

/** One mail as the inbox stores it (already cut to the form's limits by the parser). */
export interface InboundRow {
  name: string;
  email: string;
  body: string;
  subject: string | null;
  messageId: string | null;
  auth: string | null;
}

/** The `auth` summary says DMARC passed (only then may the row link to an account). */
export const dmarcPassed = (auth: string | null) =>
  !!auth && /\bdmarc=pass\b/.test(auth);

/**
 * Saves one email row, unless today's `EMAILS_PER_DAY` is reached (one statement, as
 * `saveMessage`). Linked to the contact account whose address is the envelope sender, only when
 * DMARC passed (a From that did not authenticate could be anyone's). Always `confirmed_at` =
 * `created_at`: "unverified" is the contact form's address check, and an unconfirmed row would
 * be purged after 7 days; a mail without dmarc=pass is flagged by its `auth` in /admin instead.
 *
 * Both statements stay RAW D1 (Drizzle port 2026-11-25): the insert is a cap insert
 * (`.claude/rules/db.md`), and the lookup is its one-line companion.
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
