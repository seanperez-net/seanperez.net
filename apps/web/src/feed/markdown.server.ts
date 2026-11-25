import { micromark } from "micromark";

/**
 * A post's markdown as HTML, on the server only (CommonMark, no extensions).
 *
 * micromark 4 is safe by default (its README "Security" and `lib/compile.js`, read 2026-11-24):
 * raw HTML in the markdown is written out as text, and link / image URLs with a protocol other
 * than http(s), mailto, irc(s), xmpp (so `javascript:`) are dropped. Posts are written only by
 * the owner, but they are served on the same origin as /admin, so a script in one would run
 * with his Access session: the two options stay off, stated here so nobody flips them.
 * Chosen over `marked`, which does not sanitise and would need a second library.
 */
export function renderMarkdown(markdown: string): string {
  return micromark(markdown, {
    allowDangerousHtml: false,
    allowDangerousProtocol: false,
  });
}

/** Plain text for a description: the first words of the markdown, without its syntax. */
export function excerpt(markdown: string, max = 160): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
