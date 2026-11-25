/**
 * Recent searches, kept in this browser only (localStorage). The model is Algolia DocSearch's
 * `createStoredSearches` (algolia/docsearch `packages/docsearch-react/src/stored-searches.ts`,
 * read 2026-11-24): what is stored is the CHOSEN result, not the typed text; the newest goes
 * first, an older copy of the same entry is dropped (by `href`), the list is capped, and each
 * entry can be removed. DocSearch keeps 5 by default (7 in its modal) and a second "favorites"
 * list; we keep 5 and no favorites (keep it basic). A query sent with Enter is stored as its
 * results page (`/search/?q=`).
 *
 * Stored through `local-store.ts` (`spn.v1.recentSearches`): read only in handlers and tasks that
 * run after resume, never during server render. Another tab's change shows the next time the
 * popup opens (it re-reads the list).
 */
import { readPref, writePref } from "../local-store";
import type { SearchGroup } from "./types";

const NAME = "recentSearches";
export const RECENT_LIMIT = 5;

export interface RecentSearch {
  label: string;
  href: string;
  /** The result's group, or `search` for a results page. */
  group: SearchGroup | "search";
}

const isRecent = (value: unknown): value is RecentSearch => {
  const entry = value as RecentSearch | null;
  return (
    typeof entry?.label === "string" &&
    typeof entry.href === "string" &&
    typeof entry.group === "string"
  );
};

export function readRecent(): RecentSearch[] {
  return (
    readPref(NAME, (raw) =>
      Array.isArray(raw) ? raw.filter(isRecent).slice(0, RECENT_LIMIT) : null,
    ) ?? []
  );
}

function write(list: RecentSearch[]): RecentSearch[] {
  writePref(NAME, list.length ? list : null);
  return list;
}

/** Puts `entry` first; returns the new list. */
export function addRecent(entry: RecentSearch): RecentSearch[] {
  const { label, href, group } = entry;
  return write(
    [
      { label, href, group },
      ...readRecent().filter((old) => old.href !== href),
    ].slice(0, RECENT_LIMIT),
  );
}

export function removeRecent(href: string): RecentSearch[] {
  return write(readRecent().filter((old) => old.href !== href));
}
