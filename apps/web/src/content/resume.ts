/**
 * Home's résumé, as plain typed data (owner, 2026-11-24: Home is the résumé, "it's not just code
 * stuff"). One file so the content can later come from a CMS unchanged; `routes/index.tsx` only
 * draws it with library components.
 *
 * PLACEHOLDERS for the owner: `experience` / `education` are EMPTY on purpose (nothing is
 * invented). Fill them in here; an empty list's section is not drawn. `summary` and `links` are the
 * profile's defaults (`@seanperez/db` `profile/profile-seed.ts`, 2026-11-25, shared with the
 * admin app): edit them there.
 * Projects are not here: they are the public GitHub repos, `content/repos.json` (build time).
 */
import { PROFILE_SEED, type SeedLink } from "@seanperez/db/profile/profile-seed";
import type { Repo } from "./repos";
import repoList from "./repos.json";

export interface ResumeEntry {
  /** The job title or the qualification. */
  title: string;
  /** The employer or the school. */
  place: string;
  /** As it should read, e.g. "2021 to 2024". */
  dates: string;
  /** One or two lines on what was done. */
  detail?: string;
}

/** One of the owner's links (the profile seed's shape). */
export type ResumeLink = SeedLink;

export interface Resume {
  summary: string;
  experience: ResumeEntry[];
  education: ResumeEntry[];
  projects: Repo[];
  links: ResumeLink[];
}

export const RESUME: Resume = {
  // The profile seed's (shared with the admin app).
  summary: PROFILE_SEED.summary,
  // EMPTY until the owner fills them in: no jobs, schools or dates are invented.
  experience: [],
  education: [],
  projects: repoList as Repo[],
  links: PROFILE_SEED.links,
};
