/**
 * The site search: ONE function for the `/api/search` endpoint (the app bar, as you type) and
 * the `/search/` route's loader (the results page, also without JavaScript).
 *
 * Posts: every word must match (AND), title matches first, then newest. Matched on the stored
 * FOLDED text (`post.search_title` / `search_text`, written by `savePost`; 2026-11-25, owner: "Both
 * now"), so "resume" finds "Résumé" and "elan" finds "Élan": SQLite's `LIKE` and `lower()` fold
 * ASCII only. The SQL is `searchPublished` in `@seanperez/db`. FTS5 was
 * weighed and NOT used (breaks CJK and partial words, D1 export caveat):
 * `.claude/notes/local-search-orama-opfs-2026-11-25.md` "Round 2".
 *
 * Pages, Contacts and Projects: `STATIC_ENTRIES`, matched here in code the same way.
 */
import {
  fold,
  matchesWords,
  plainText,
  searchWords,
} from "@seanperez/db/search/fold";
import { searchPublished } from "@seanperez/db/feed/posts.server";
import { STATIC_ENTRIES } from "./entries";
import {
  ALL_GROUP_ROWS,
  GROUP_LABELS,
  SCOPE_ROWS,
  SEARCH_GROUPS,
  cleanQuery,
} from "./types";
import type {
  SearchGroup,
  SearchHit,
  SearchResultGroup,
  SearchResults,
  SearchScope,
} from "./types";

/** About 120 characters around the first matched word, cut at spaces. */
function snippetOf(text: string, words: string[]): string {
  const folded = fold(text);
  const at = Math.min(
    ...words.map((word) => {
      const index = folded.indexOf(word);
      return index < 0 ? Infinity : index;
    }),
  );
  if (!Number.isFinite(at) || text.length <= 120) return text.slice(0, 120);
  let start = Math.max(0, at - 40);
  let end = Math.min(text.length, start + 120);
  if (start > 0) start = text.indexOf(" ", start) + 1 || start;
  if (end < text.length) end = text.lastIndexOf(" ", end) || end;
  return `${start > 0 ? "… " : ""}${text.slice(start, end)}${end < text.length ? " …" : ""}`;
}

async function searchPosts(
  db: D1Database,
  words: string[],
): Promise<SearchHit[]> {
  const posts = await searchPublished(db, words, SCOPE_ROWS);
  return posts.map((post) => ({
    group: "posts",
    label: post.title,
    href: `/feed/${post.slug}/`,
    snippet: snippetOf(plainText(post.body_md), words),
  }));
}

function searchStatic(words: string[]): SearchHit[] {
  return STATIC_ENTRIES.filter((entry) =>
    matchesWords(fold(`${entry.label} ${entry.text}`), words),
  ).map(({ group, label, href, snippet }) => ({
    group,
    label,
    href,
    snippet,
  }));
}

/**
 * Results for `q` in `scope`, grouped. All keeps every group's total but at most
 * `ALL_GROUP_ROWS` rows; one scope returns that group only, up to `SCOPE_ROWS` rows.
 */
export async function search(
  db: D1Database,
  rawQuery: string,
  scope: SearchScope,
): Promise<SearchResults> {
  const q = cleanQuery(rawQuery);
  const words = searchWords(q);
  if (!words.length) return { q, scope, groups: [] };

  const wanted = (group: SearchGroup) => scope === "all" || scope === group;
  const posts = wanted("posts") ? await searchPosts(db, words) : [];
  const hits = [...posts, ...searchStatic(words)];

  const groups: SearchResultGroup[] = SEARCH_GROUPS.filter(wanted)
    .map((group) => {
      const inGroup = hits.filter((hit) => hit.group === group);
      return {
        group,
        label: GROUP_LABELS[group],
        total: inGroup.length,
        hits: inGroup.slice(0, scope === "all" ? ALL_GROUP_ROWS : SCOPE_ROWS),
      };
    })
    .filter((group) => group.total > 0);
  return { q, scope, groups };
}
