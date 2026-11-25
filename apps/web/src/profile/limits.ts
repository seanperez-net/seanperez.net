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
