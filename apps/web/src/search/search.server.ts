/**
 * The site search: ONE function for the `/api/search` endpoint (the app bar, as you type) and
 * the `/search/` route's loader (the results page, also without JavaScript).
 *
 * Posts: a plain `LIKE` over the published rows' title and markdown body (owner, 2026-11-24: "LIKE
 * now, an index later"). Every word must match (AND); title matches sort first, then newest.
 * At tens to hundreds of posts the scan is a few milliseconds; an FTS5 table can replace the
 * query later behind this same signature. D1 caveat if it does: a standard `wrangler d1 export`
 * fails on a database with virtual tables (developers.cloudflare.com/d1/best-practices/
 * import-export-data, read 2026-11-24).
 *
 * Pages, Contacts and Projects: `STATIC_ENTRIES`, matched here in code the same way.
 */
import { STATIC_ENTRIES } from "./entries";
import {
  ALL_GROUP_ROWS,
  GROUP_LABELS,
  MAX_WORDS,
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

/** Lowercase, accents dropped: "Résumé" matches "resume". */
const fold = (text: string) =>
  text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The query's words as typed (lowercased): SQL `LIKE` compares the stored text as it is. */
const wordsOf = (q: string) =>
  Array.from(new Set(q.toLowerCase().split(" ").filter(Boolean))).slice(
    0,
    MAX_WORDS,
  );

/** A `LIKE` pattern that matches the word literally anywhere (`%` and `_` escaped). */
const likePattern = (word: string) => `%${word.replace(/[\\%_]/g, "\\$&")}%`;

/** Markdown to one line of plain text, near enough for a snippet. */
const plain = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    // `_` stays: snake_case words are searched as typed.
    .replace(/[#>*`~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** About 120 characters around the first matched word, cut at spaces. */
function snippetOf(text: string, words: string[]): string {
  const folded = fold(text);
  const at = Math.min(
    ...words.map((word) => {
      const index = folded.indexOf(fold(word));
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

interface PostRow {
  slug: string;
  title: string;
  body_md: string;
}

async function searchPosts(
  db: D1Database,
  words: string[],
): Promise<SearchHit[]> {
  const where = words
    .map(
      (_, i) =>
        `(title LIKE ?${i + 1} ESCAPE '\\' OR body_md LIKE ?${i + 1} ESCAPE '\\')`,
    )
    .join(" AND ");
  const titleFirst = words
    .map((_, i) => `title LIKE ?${i + 1} ESCAPE '\\'`)
    .join(" AND ");
  try {
    const { results } = await db
      .prepare(
        `SELECT slug, title, body_md FROM post
         WHERE draft = 0 AND published_at IS NOT NULL AND ${where}
         ORDER BY (${titleFirst}) DESC, published_at DESC
         LIMIT ${SCOPE_ROWS}`,
      )
      .bind(...words.map(likePattern))
      .all<PostRow>();
    return results.map((post) => ({
      group: "posts",
      label: post.title,
      href: `/feed/${post.slug}/`,
      snippet: snippetOf(plain(post.body_md), words),
    }));
  } catch (error) {
    // As the feed's readers: no table yet (code deployed before the migration) is "no posts".
    console.error("search: posts failed", error);
    return [];
  }
}

function searchStatic(words: string[]): SearchHit[] {
  return STATIC_ENTRIES.filter((entry) => {
    const text = fold(`${entry.label} ${entry.text}`);
    return words.every((word) => text.includes(fold(word)));
  }).map(({ group, label, href, snippet }) => ({
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
  const words = wordsOf(q);
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
