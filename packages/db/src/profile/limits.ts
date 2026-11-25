/**
 * The profile's limits, shared by the /admin/profile inputs (client) and the server's checks.
 * Client-safe (see `feed/limits.ts` for why limits are not in a `.server.ts` file). Bio,
 * location and link lengths are e-store's social profile limits (`@estore/social/profile`:
 * bio 300, url 300, location 60); name, headline, label and the link count are ours.
 */
export const PROFILE_MAX = {
  name: 100,
  headline: 100,
  location: 60,
  bio: 300,
  linkLabel: 40,
  linkHref: 300,
  /** How many links the profile keeps (the form's Add stops here). Was 5; 10 since the social
   * icon row (2026-11-24), still one short line of 48dp icons in the side pane (two rows at most). */
  links: 10,
} as const;

/**
 * The profile's SECTIONS (Work, Education, Skills, ... and custom ones, 2026-11-25), shared by the
 * admin forms and the schema (`profile-sections.ts`). Ours: about 8 sections and 30 entries fit
 * with room. "Sections" as Google's profile has them (owner 2026-11-25: "the real app at google.com
 * doesnt have a resume it has the profile").
 */
export const SECTIONS_MAX = {
  sections: 12,
  entriesPerSection: 40,
  sectionTitle: 60,
  position: 100,
  name: 100,
  location: 60,
  summary: 300,
  /** One row each on the site (a nested compact list, owner 2026-11-25). */
  highlights: 6,
  highlight: 200,
  keywords: 30,
  keyword: 40,
  url: 300,
  /** The id of a section or an entry (its anchor `profile-<id>`). */
  id: 40,
  /** The whole stored document, as JSON text. */
  bytes: 64 * 1024,
} as const;
