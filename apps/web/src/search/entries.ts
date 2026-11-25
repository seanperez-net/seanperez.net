/**
 * The search's static entries: the site's pages, the owner's profile and the projects. Built from
 * the same content the pages render (`pages.ts`, `content/profile-content.ts`, `content/repos.json`;
 * his profile sections' rows come from D1 per search, `sectionSearchEntries`), so a
 * change there shows up in search with no index to rebuild. Server-side only in practice (the
 * endpoint and the /search/ loader import it), but holds no secrets.
 */
import type { PublicProfileSection } from "@seanperez/db/profile/profile-sections";
import { PROFILE_CONTENT } from "../content/profile-content";
import { PAGES } from "../pages";
import { DEFAULT_CONTACT_ID, contactHref } from "../content/contacts";
import type { SearchGroup } from "./types";

export interface SearchEntry {
  group: SearchGroup;
  label: string;
  href: string;
  /** Shown under the label. */
  snippet: string;
  /** Searched, with the label. */
  text: string;
}

/** The owner's contact profile, where his profile sections live (`ContactProfile`). */
const PROFILE = contactHref(DEFAULT_CONTACT_ID);

const pages: SearchEntry[] = Object.entries(PAGES)
  // The results page does not list itself; the owner's contact profile is the Contacts entry.
  .filter(([path]) => path !== "/search/" && path !== PROFILE)
  .map(([path, page]) => ({
    group: "pages",
    // "Maps · Sean Perez" -> "Maps"; Home's title is the site's name.
    label: path === "/" ? "Home" : page.title.split(" · ")[0],
    href: path,
    snippet: page.description,
    text: `${page.title} ${page.description} ${page.card ?? ""}`,
  }));

/**
 * The owner's profile sections' rows (2026-11-25: `Profile.sections` from `@seanperez/db`
 * `getProfile`, hidden parts already removed on the server), each linking to its row's anchor on
 * his page. Called per search by `search.server.ts`, so an admin edit shows within the profile's
 * minute.
 */
export const sectionSearchEntries = (
  sections: PublicProfileSection[],
): SearchEntry[] =>
  sections.flatMap((section) =>
    section.entries.map((entry) => ({
      group: "contacts" as const,
      label: entry.where ? `${entry.position}, ${entry.where}` : entry.position,
      href: `${PROFILE}#profile-${entry.id}`,
      snippet: [section.title, entry.dates, entry.summary]
        .filter(Boolean)
        .join(" · "),
      text: [
        section.title,
        entry.position,
        entry.where,
        entry.dates,
        entry.summary,
        ...entry.highlights,
        ...entry.keywords,
      ].join(" "),
    })),
  );

const contacts: SearchEntry[] = [
  {
    group: "contacts",
    // His profile is his contact page (owner, 2026-11-24: About -> Contacts). "cv" / "resume"
    // stay as search words only: what people type to find it.
    label: "Sean Perez",
    href: PROFILE,
    snippet: PROFILE_CONTENT.summary,
    text: `about résumé resume cv profile contact sean perez ${PROFILE_CONTENT.summary}`,
  },
  ...PROFILE_CONTENT.links.map(
    (link): SearchEntry => ({
      group: "contacts",
      label: link.label,
      href: link.href,
      snippet: link.detail,
      text: `${link.label} ${link.detail}`,
    }),
  ),
];

const projects: SearchEntry[] = PROFILE_CONTENT.projects.map((repo) => ({
  group: "projects",
  label: repo.name,
  href: repo.url,
  snippet: [repo.description, repo.language].filter(Boolean).join(" · "),
  text: `${repo.name} ${repo.description} ${repo.language}`,
}));

export const STATIC_ENTRIES: SearchEntry[] = [
  ...pages,
  ...contacts,
  ...projects,
];
