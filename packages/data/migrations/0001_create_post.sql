-- Migration number: 0001 	 2026-11-24
-- The feed's posts. Written only from /admin (behind Cloudflare Access); read by /feed/,
-- /feed/<slug>/ and /feed.xml, which show only rows with draft = 0 and a published_at.
-- Times are ISO 8601 UTC strings (new Date().toISOString()), which sort as text.
CREATE TABLE IF NOT EXISTS post (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  draft INTEGER NOT NULL DEFAULT 1 CHECK (draft IN (0, 1)),
  published_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS post_published ON post (draft, published_at);
