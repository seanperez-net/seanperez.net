-- Migration number: 0004 	 2026-11-25
-- Contact accounts and email verification (.claude/notes/contact-verify-email-plan-2026-11-25.md,
-- section 4). Every first message makes an UNVERIFIED account (name + email) and a session; one
-- email carries a link and a 6-digit code; either verifies. Unverified accounts, their messages,
-- sessions and tokens are deleted after 7 days (`purgeExpired` in src/account/account.server.ts,
-- run on each contact send and on /admin/accounts/: no cron). No IP, user agent or location is
-- kept. Times are ISO 8601 UTC strings (sort as text).
--
-- Table names: `contact_account` / `contact_session`, NOT the plan's `account` / `session`: the
-- reverted Better Auth work (2026-11-22) left tables named `user`, `session`, `account` and
-- `verification` in the local database (made on first use by `ensureAuthTables`), and one may
-- exist remotely too. No `IF NOT EXISTS` on the new tables, so a clash fails loudly instead of
-- silently keeping a table of another shape.

CREATE TABLE contact_account (
  id TEXT PRIMARY KEY,                  -- crypto.randomUUID()
  email TEXT NOT NULL UNIQUE,           -- trimmed, lower-cased; shown only in /admin
  name TEXT NOT NULL,                   -- the name typed on the first message
  created_at TEXT NOT NULL,
  verified_at TEXT,                     -- NULL = unverified (purged after 7 days)
  notified_at TEXT,                     -- last owner notification (at most hourly)
  last_seen_at TEXT                     -- day precision (YYYY-MM-DD), from /api/me
);

CREATE TABLE contact_session (
  token_hash TEXT PRIMARY KEY,          -- SHA-256 (hex) of the cookie's 32 random bytes
  account_id TEXT NOT NULL REFERENCES contact_account(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  verified_at TEXT,                     -- set when THIS browser's link / code was used
  expires_at TEXT NOT NULL              -- 30 days (unverified: 7 days)
);
CREATE INDEX contact_session_account ON contact_session (account_id);

CREATE TABLE verify_token (
  link_hash TEXT PRIMARY KEY,           -- SHA-256 (hex) of the link's 32 random bytes
  account_id TEXT NOT NULL REFERENCES contact_account(id) ON DELETE CASCADE,
  session_hash TEXT,                    -- the browser that asked; upgraded on success
  code_hash TEXT NOT NULL,              -- HMAC-SHA-256(AUTH_SECRET, link_hash|code)
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,             -- +30 minutes
  used_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,  -- wrong codes; 5 = void
  send_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (send_status IN ('pending', 'sent', 'failed', 'logged')),
  send_id TEXT,                         -- Resend's email id
  send_error TEXT                       -- the provider's short error name, no addresses
);
-- The send caps (per address per day, site-wide per day) and "the latest code" read it.
CREATE INDEX verify_token_account ON verify_token (account_id, created_at);
CREATE INDEX verify_token_created ON verify_token (created_at);

-- The owner's email replies from /admin (verified accounts only).
CREATE TABLE message_reply (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  send_status TEXT NOT NULL CHECK (send_status IN ('pending', 'sent', 'failed', 'logged')),
  send_id TEXT,
  send_error TEXT
);
CREATE INDEX message_reply_message ON message_reply (message_id);

-- `message.name` / `message.email` stay: the typed values, and the rows from before accounts.
ALTER TABLE message ADD COLUMN account_id TEXT REFERENCES contact_account(id) ON DELETE SET NULL;
ALTER TABLE message ADD COLUMN confirmed_at TEXT;  -- NULL = sent before verification
UPDATE message SET confirmed_at = created_at;      -- the old rows predate accounts
CREATE INDEX message_account ON message (account_id, confirmed_at);
