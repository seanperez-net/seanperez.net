/**
 * Home's résumé, as plain typed data (owner, 2026-11-24: Home is the résumé, "it's not just code
 * stuff"). One file so the content can later come from a CMS unchanged; `routes/index.tsx` only
 * draws it with library components.
 *
 * PLACEHOLDERS for the owner: `summary` is neutral filler, and `experience` / `education` are
 * EMPTY on purpose (nothing is invented). Fill them in here; an empty list shows `emptyNote`.
 * Projects are not here: they are the public GitHub repos, `content/repos.json` (build time).
 */
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

export interface ResumeLink {
  label: string;
  /** The line under the label: the address as people would type it. */
  detail: string;
  href: string;
  /** A brand mark (`GithubIcon`); otherwise the `link` symbol. */
  brand?: "github";
  /** `rel="me"`: the owner's own profile (IndieWeb / Mastodon verification). */
  me?: boolean;
}

export interface Resume {
  summary: string;
  experience: ResumeEntry[];
  education: ResumeEntry[];
  projects: Repo[];
  links: ResumeLink[];
  /** Shown in a section that has no entries yet. */
  emptyNote: string;
}

export const RESUME: Resume = {
  // PLACEHOLDER (owner to replace): factual and neutral on purpose.
  summary: "Software engineer. Projects and code.",
  // EMPTY until the owner fills them in: no jobs, schools or dates are invented.
  experience: [],
  education: [],
  projects: repoList as Repo[],
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
  emptyNote: "To be added.",
};
