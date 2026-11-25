-- Migration number: 0003 	 2026-11-24
-- Contact form messages. Written only by the contact form's action (after Turnstile, the
-- honeypot and the field limits); read, marked read and deleted only from /admin/messages
-- (behind Cloudflare Access). No IP address or any other visitor data is kept: the visitor's
-- email is shown only in /admin. Times are ISO 8601 UTC strings (sort as text).
CREATE TABLE IF NOT EXISTS message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

-- The inbox (newest first) and the per-day cap (messages since midnight UTC) both read it.
CREATE INDEX IF NOT EXISTS message_created ON message (created_at);
