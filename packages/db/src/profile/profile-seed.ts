/**
 * The profile's defaults: what the site shows while the D1 `profile` row (edited in the admin
 * app's Profile) is empty, field by field (`profile.server.ts`). Until 2026-11-25 these were read
 * from `apps/web/src/content/resume.ts` (now `content/profile-content.ts`); they live here since the package cannot import an app,
 * and `resume.ts` now reads its `summary` and `links` from this file (one source for both apps).
 *
 * PLACEHOLDER for the owner: `summary` is neutral filler. Nothing is invented.
 */
export interface SeedLink {
  label: string;
  /** The line under the label: the address as people would type it. */
  detail: string;
  href: string;
  /** A brand mark (`GithubIcon`); otherwise the `link` symbol. */
  brand?: "github";
  /** `rel="me"`: the owner's own profile (IndieWeb / Mastodon verification). */
  me?: boolean;
}

export const PROFILE_SEED: { name: string; summary: string; links: SeedLink[] } = {
  name: "Sean Perez",
  summary: "Software engineer. Projects and code.",
  links: [
    {
      label: "GitHub",
      detail: "github.com/seanperez-net",
      href: "https://github.com/seanperez-net",
      brand: "github",
      me: true,
    },
    {
      label: "Source of this site",
      detail: "github.com/seanperez-net/seanperez.net",
      href: "https://github.com/seanperez-net/seanperez.net",
    },
  ],
};
