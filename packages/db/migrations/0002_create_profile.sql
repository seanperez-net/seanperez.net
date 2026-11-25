-- Migration number: 0002 	 2026-11-24
-- The owner's public profile (/profile/): ONE row (id = 1), written only from /admin/profile
-- (behind Cloudflare Access). An empty string or NULL in a column means "use the default"
-- (`content/resume.ts` and the site's name), so an empty table shows the defaults.
-- `links` is a JSON array of { label, href }; it is checked again in code on every read.
-- NO email column: the site shows no address anywhere (spam).
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT,
  headline TEXT,
  location TEXT,
  bio TEXT,
  links TEXT,
  updated_at TEXT NOT NULL
);
