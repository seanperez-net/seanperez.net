-- Migration number: 0006 	 2026-11-25
-- Inbound mail to sean@seanperez.net in the same inbox as the contact form
-- (.claude/notes/contact-email-routing-audit-2026-11-25.md, approved by the owner 2026-11-25).
-- The Worker's `email()` handler (src/mail/inbound.server.ts) forwards each mail to the owner's
-- Gmail FIRST, then stores it here. Attachments are never stored.
--
-- `source`: 'form' (Contact me, every row so far) or 'email' (the handler).
-- `subject`: the mail's subject (email rows only).
-- `message_id`: the mail's Message-ID header, for a later reply with In-Reply-To.
-- `auth`: the summary of the FIRST Authentication-Results header added by mx.cloudflare.net,
--   e.g. "dkim=pass spf=pass dmarc=pass"; NULL when there is none. A row whose summary lacks
--   dmarc=pass is shown flagged in /admin (its From could be forged).
ALTER TABLE message ADD COLUMN source TEXT NOT NULL DEFAULT 'form'
  CHECK (source IN ('form', 'email'));
ALTER TABLE message ADD COLUMN subject TEXT;
ALTER TABLE message ADD COLUMN message_id TEXT;
ALTER TABLE message ADD COLUMN auth TEXT;
CREATE INDEX message_source ON message (source, created_at);
