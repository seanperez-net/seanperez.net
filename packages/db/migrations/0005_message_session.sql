-- Migration number: 0005 	 2026-11-25
-- Which browser sent a waiting message (security review gap, plan note
-- .claude/notes/contact-verify-email-plan-2026-11-25.md section 12, "Follow-ups"). Until now a
-- confirmed link or code confirmed EVERY waiting message of the account, including one a stranger
-- sent from another browser by typing the same address. Now confirming confirms only the messages
-- of the session(s) the verification upgrades: the browser that typed the code or pressed Confirm,
-- and the browser that asked for that email when it is upgraded too (`complete` in
-- src/account/account.server.ts). Other sessions' waiting messages stay unconfirmed and go with
-- the 7-day purge.
--
-- `session_hash` is `contact_session.token_hash` (SHA-256 of the cookie's random bytes), no
-- foreign key: the session row may be signed out or purged while its messages wait.
--
-- Existing rows: NULL. Rows from before accounts (0003) are already confirmed (0004 set them).
-- A row sent after 0004 and still waiting has no session to match, so no code or link confirms
-- it: it is purged after 7 days like any other unconfirmed message (local only so far; 0004 is
-- not applied remotely, so production has no such rows).
ALTER TABLE message ADD COLUMN session_hash TEXT;
CREATE INDEX message_session ON message (session_hash);
