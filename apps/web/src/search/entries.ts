/**
 * The search's static entries: the site's pages, the résumé and the projects. Built from the
 * same content the pages render (`pages.ts`, `content/resume.ts`, `content/repos.json`), so a
 * change there shows up in search with no index to rebuild. Server-side only in practice (the
 * endpoint and the /search/ loader import it), but holds no secrets.
 */
import { RESUME } from "../content/resume";
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

/** The owner's contact profile, where the résumé sections live (`ContactProfile`). */
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

const resumeRows = (
  rows: typeof RESUME.experience,
  anchor: string,
): SearchEntry[] =>
  rows.map((row) => ({
    group: "contacts",
    label: `${row.title}, ${row.place}`,
    href: `${PROFILE}#${anchor}`,
    snippet: [row.dates, row.detail].filter(Boolean).join(" · "),
    text: `${row.title} ${row.place} ${row.dates} ${row.detail ?? ""}`,
  }));

const contacts: SearchEntry[] = [
  {
    group: "contacts",
    // The résumé is the owner's contact profile now (owner, 2026-11-24: About -> Contacts).
    label: "Sean Perez",
    href: PROFILE,
    snippet: RESUME.summary,
    text: `about résumé resume cv profile contact sean perez ${RESUME.summary}`,
  },
  ...resumeRows(RESUME.experience, "resume-experience"),
  ...resumeRows(RESUME.education, "resume-education"),
  ...RESUME.links.map(
    (link): SearchEntry => ({
      group: "contacts",
      label: link.label,
      href: link.href,
      snippet: link.detail,
      text: `${link.label} ${link.detail}`,
    }),
  ),
];

const projects: SearchEntry[] = RESUME.projects.map((repo) => ({
  group: "projects",
  label: repo.name,
  href: repo.url,
  snippet: [repo.description, repo.language].filter(Boolean).join(" · "),
  text: `${repo.name} ${repo.description} ${repo.language}`,
}));

export const STATIC_ENTRIES: SearchEntry[] = [...pages, ...contacts, ...projects];
