/**
 * The ONE text fold and word rule every search uses (2026-11-25, owner: accents "Both now";
 * `.claude/notes/local-search-orama-opfs-2026-11-25.md` "Round 2"):
 * - the site search on the server (`apps/web/src/search/search.server.ts`): the query's words, and
 *   the static entries;
 * - the posts' stored folded text (`post.search_title`, `post.search_text`, written by `savePost`);
 * - the visitor's contacts in the browser (`apps/web/src/contacts/search-local.ts`).
 * So "garcia" finds "García" and "resume" finds "Résumé" everywhere, the same way.
 *
 * Client-safe and pure (no Drizzle, no D1): the browser imports it. SQLite cannot do this fold
 * (`lower()` is ASCII only), which is why posts store the folded text.
 */

/**
 * Lowercase, accents dropped: Unicode NFKD splits "é" into "e" + a combining mark, and the
 * combining marks (U+0300-U+036F) are removed. NFKD also turns compatibility forms into plain
 * letters ("ﬁ" -> "fi", full-width "Ａ" -> "a"). Letters with no decomposition stay ("ø", "ł",
 * "ß"); Chinese and Japanese text is unchanged, so a substring still finds it.
 */
export const fold = (text: string): string =>
  text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Markdown to one line of plain text, near enough for a search and a snippet: code blocks, images,
 * link targets and HTML tags go (so "https" does not match every post with a link). `_` stays:
 * snake_case words are searched as typed.
 */
export const plainText = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/[#>*`~|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** What `post.search_title` / `post.search_text` hold: the folded title and folded plain body. */
export const postSearchColumns = (title: string, bodyMd: string) => ({
  search_title: fold(title),
  search_text: fold(plainText(bodyMd)),
});

/** At most this many words of a query are matched (the rest are ignored). */
export const MAX_SEARCH_WORDS = 6;

/** A query's distinct folded words, split on white space, at most `MAX_SEARCH_WORDS`. */
export const searchWords = (query: string): string[] =>
  Array.from(new Set(fold(query).split(/\s+/).filter(Boolean))).slice(
    0,
    MAX_SEARCH_WORDS,
  );

/**
 * True when EVERY word is contained in the folded text (AND, anywhere, any order). `folded` must
 * already be `fold(...)`ed and `words` come from `searchWords`. No words = no match.
 */
export const matchesWords = (folded: string, words: string[]): boolean =>
  words.length > 0 && words.every((word) => folded.includes(word));
