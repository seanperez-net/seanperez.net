// A message body as text, link and reference tokens (2026-11-24). Pure: no DOM, no fetch.
//
// The rules are those of e-store's feed tokenizer (`packages/feed/src/text/tokenize.ts`, itself
// adapted from farcaster-client's linkify rules), cut down (keep-it-basic, second agent's review):
// - only `http://` / `https://` links; NO bare domains (e-store's TLD list is not taken);
// - not glued to a word before it ("xhttps://..." is text);
// - sentence punctuation and unbalanced closing brackets after a link are not part of it;
// - a link with a user name or password ("https://bank.example@evil.example") stays text, and so
//   does a host with no dot;
// - zero-width and bidi controls end a link (they could hide or reorder what the reader sees).
// The reference tokens are e-store's `<@id>` mention token (`@estore/chat` `mentions.ts`) and a
// NEW `<#id>` place token. Joining every token's `text` gives the body back unchanged.

import type { ChatLabels } from "./labels";
import type { ChatMessage, ChatRef } from "./types";

export type ChatBodyToken =
  | { type: "text"; text: string }
  /** `text` as written, `href` the parsed absolute URL. */
  | { type: "url"; text: string; href: string }
  /** `<@id>` (person) or `<#id>` (place): `text` is the raw token. */
  | { type: "ref"; text: string; sigil: "@" | "#"; id: string };

const INVISIBLE =
  "\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF";
const URL_CHAR = `[^\\s<>"'\`${INVISIBLE}]`;
const CANDIDATE = new RegExp(
  `<([@#])([A-Za-z0-9_-]{1,64})>|(https?:\\/\\/${URL_CHAR}+)`,
  "gi",
);
const WORD_BEFORE = /[\p{L}\p{N}\p{M}_]/u;
const TRAILING = new Set([
  ".",
  ",",
  ";",
  ":",
  "!",
  "?",
  "'",
  '"',
  "…",
  "*",
  "_",
]);
const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/** The longest link kept; a longer one stays text. */
const URL_MAX = 2048;

/** Where a link ends once trailing punctuation and unbalanced closers are dropped. */
function trimmedEnd(s: string): number {
  let end = s.length;
  while (end > 0) {
    const last = s[end - 1];
    if (TRAILING.has(last)) {
      end--;
      continue;
    }
    const open = CLOSERS[last];
    if (open) {
      const head = s.slice(0, end);
      if (head.split(last).length > head.split(open).length) {
        end--;
        continue;
      }
    }
    break;
  }
  return end;
}

/**
 * A site path for an internal link card (`ChatLinkEmbed.internal`), or null. Only `/` followed
 * by something that is not `/` or a backslash: browsers read `//host` and `/\host` as another site.
 */
export function chatSitePath(raw: string): string | null {
  if (!/^\/(?![/\\])/.test(raw) || /[\s\\]/.test(raw)) return null;
  return raw.length <= URL_MAX ? raw : null;
}

/** The URL a written link opens, or null when it must stay text. */
export function chatLinkHref(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".") && !url.hostname.startsWith("[")) return null;
  return url.href.length <= URL_MAX ? url.href : null;
}

/** The body as tokens, in order; adjacent text is merged. */
export function chatBodyTokens(body: string): ChatBodyToken[] {
  const tokens: ChatBodyToken[] = [];
  const text = (t: string) => {
    if (!t) return;
    const prev = tokens[tokens.length - 1];
    if (prev?.type === "text") prev.text += t;
    else tokens.push({ type: "text", text: t });
  };
  if (typeof body !== "string" || body === "") return tokens;
  let at = 0;
  for (const m of body.matchAll(CANDIDATE)) {
    const start = m.index;
    const [whole, sigil, id, raw] = m;
    if (sigil !== undefined) {
      text(body.slice(at, start));
      tokens.push({ type: "ref", text: whole, sigil: sigil as "@" | "#", id });
      at = start + whole.length;
      continue;
    }
    if (start < at) continue;
    const before = start > 0 ? body[start - 1] : "";
    if (before && WORD_BEFORE.test(before)) continue;
    const shown = raw.slice(0, trimmedEnd(raw));
    const after = body[start + raw.length];
    if (after !== undefined && /\p{Cf}/u.test(after)) continue;
    const href = chatLinkHref(shown);
    if (href === null) continue;
    text(body.slice(at, start));
    tokens.push({ type: "url", text: shown, href });
    at = start + shown.length;
  }
  text(body.slice(at));
  return tokens;
}

/** The `ChatRef` a token names, if the message carries it. */
export const chatRefFor = (
  refs: readonly ChatRef[] | undefined,
  token: { sigil: "@" | "#"; id: string },
): ChatRef | undefined =>
  refs?.find(
    (r) => r.id === token.id && (r.kind === "person") === (token.sigil === "@"),
  );

/** A token's words: the person's name, the place's label, or `unknownRef`. */
export function chatRefName(
  ref: ChatRef | undefined,
  labels: Pick<ChatLabels, "unknownRef">,
): string {
  if (!ref) return labels.unknownRef;
  return ref.kind === "person" ? ref.person.name : ref.label;
}

/**
 * The body as plain words: tokens replaced by names (`@Name` for a person, as Google Chat's
 * previews show a mention). For list previews, search and notifications.
 */
export function chatPlainText(
  message: Pick<ChatMessage, "body" | "refs">,
  labels: Pick<ChatLabels, "unknownRef">,
): string {
  return chatBodyTokens(message.body)
    .map((t) => {
      if (t.type !== "ref") return t.text;
      const name = chatRefName(chatRefFor(message.refs, t), labels);
      return t.sigil === "@" ? `@${name}` : name;
    })
    .join("");
}

/** The host name shown on a link card (`www.` dropped), e-store's `embedDomain`. */
export function chatEmbedHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
