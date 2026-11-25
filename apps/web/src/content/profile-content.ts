/**
 * The parts of the owner's profile that are BUILD-TIME content: the summary and links (the
 * profile's defaults, `@seanperez/db` `profile/profile-seed.ts`, shared with the admin app) and
 * the projects (the public GitHub repos, `content/repos.json`, `scripts/repos.ts`). The Profile
 * card on `/contacts/sean-perez/` draws them (`components/profile-card.tsx`).
 *
 * The profile's SECTIONS (Work, Education, Skills, ..., some collapsed or hidden) are D1 data since
 * 2026-11-25, part of the profile itself (`Profile.sections`, `@seanperez/db` `getProfile`), edited
 * in the admin app's Profile.
 */
import {
  PROFILE_SEED,
  type SeedLink,
} from "@seanperez/db/profile/profile-seed";
import type { Repo } from "./repos";
import repoList from "./repos.json";

/** One of the owner's links (the profile seed's shape). */
export type ProfileContentLink = SeedLink;

export interface ProfileContent {
  summary: string;
  projects: Repo[];
  links: ProfileContentLink[];
}

export const PROFILE_CONTENT: ProfileContent = {
  // The profile seed's (shared with the admin app).
  summary: PROFILE_SEED.summary,
  projects: repoList as Repo[],
  links: PROFILE_SEED.links,
};
