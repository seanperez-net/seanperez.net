/**
 * The site search's shapes and limits, shared by the server (`search.server.ts`, the
 * `/api/search` endpoint, the `/search/` route) and the app bar's search (client). Client-safe:
 * no server imports (see `feed/limits.ts` for why).
 */

/** The groups, in the order All shows them. */
export const SEARCH_GROUPS = ["posts", "projects", "contacts", "pages"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

/** A chip: All, or one group. `?in=` in the URL. */
export type SearchScope = "all" | SearchGroup;

/** The chips' and the headings' text. */
export const GROUP_LABELS: Record<SearchScope, string> = {
  all: "All",
  posts: "Posts",
  projects: "Projects",
  contacts: "Contacts",
  pages: "Pages",
};

/** The chip row's order (owner's design, 2026-11-24): All · Posts · Contacts · Projects · Pages
 * (the About chip became Contacts with the Contacts app, 2026-11-24; `?in=about` still works). */
export const SCOPES: SearchScope[] = [
  "all",
  "posts",
  "contacts",
  "projects",
  "pages",
];

/** One result row. */
export interface SearchHit {
  group: SearchGroup;
  label: string;
  /** A path on this site, or an absolute URL (a GitHub repo). */
  href: string;
  /** A short plain-text line: the matched words in context, or the item's description. */
  snippet: string;
}

export interface SearchResultGroup {
  group: SearchGroup;
  label: string;
  /** Every match in the group (All shows at most `ALL_GROUP_ROWS` of them). */
  total: number;
  hits: SearchHit[];
}

export interface SearchResults {
  q: string;
  scope: SearchScope;
  /** Only groups with a match, in `SEARCH_GROUPS` order. */
  groups: SearchResultGroup[];
}

/** Rows per group in All; "See all N" selects the group's chip for the rest. */
export const ALL_GROUP_ROWS = 3;
/** Rows inside one chip. */
export const SCOPE_ROWS = 50;
/** The query is cut to this many characters and words. */
export const MAX_QUERY = 100;
export const MAX_WORDS = 6;

/** Old `?in=` values still accepted: About became Contacts (2026-11-24), links may say `about`. */
const SCOPE_ALIASES: Record<string, SearchScope> = { about: "contacts" };

/** `?in=` to a scope (an old name through `SCOPE_ALIASES`); anything else is All. */
export function parseScope(value: string | null | undefined): SearchScope {
  if (!value) return "all";
  const scope = Object.hasOwn(SCOPE_ALIASES, value) ? SCOPE_ALIASES[value] : value;
  return scope && Object.hasOwn(GROUP_LABELS, scope)
    ? (scope as SearchScope)
    : "all";
}

/** `?q=` as searched: control characters dropped, spaces collapsed, capped. */
export function cleanQuery(value: string | null | undefined): string {
  return (
    (value ?? "")
      // eslint-disable-next-line no-control-regex -- dropping them is the point
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_QUERY)
  );
}

/** `/search/?q=…&in=…`: the results page for a query (All leaves `in` out). */
export function searchPageHref(q: string, scope: SearchScope = "all"): string {
  const params = new URLSearchParams({ q });
  if (scope !== "all") params.set("in", scope);
  return `/search/?${params}`;
}
