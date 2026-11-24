/**
 * Pure avatar helpers, from e-store's `avatar-utils.ts`: Qwik-free, so a server or a test can
 * import them anywhere.
 */

/** The three M3 container roles an initials avatar is seeded onto. */
export type AvatarTone = "primary" | "secondary" | "tertiary";

const TONES: readonly AvatarTone[] = ["primary", "secondary", "tertiary"];

/**
 * Up to two initials for an avatar without an image.
 *
 * - Two or more words: the first letter of the first two ("Ada Lovelace Byron" gives "AL").
 * - One word: its first two letters ("Northern" gives "NO").
 * - An email: the local part, split on `.`, `_`, `-` and `+` ("jane.doe@x.io" gives "JD").
 * - A handle: a leading `@` is dropped; `_` and `-` separate words ("quiet-kitchen" gives "QK").
 *
 * Letters are taken by code point, so a surrogate pair is never cut in half. Empty or
 * whitespace-only input gives `""`.
 */
export function initialsOf(name: string | null | undefined): string {
  let source = (name ?? "").trim();
  if (!source) return "";
  const at = source.indexOf("@");
  if (at > 0 && !/\s/.test(source)) source = source.slice(0, at);
  source = source.replace(/^@+/, "");
  const words = source.split(/[\s._+-]+/).filter(Boolean);
  if (words.length === 0) return "";
  const letters =
    words.length > 1
      ? [[...words[0]][0], [...words[1]][0]]
      : [...words[0]].slice(0, 2);
  return letters.join("").toLocaleUpperCase();
}

/**
 * A stable tone for a seed (a name, an email or an id): the same seed always draws the same
 * colour, on the server and in the browser. Theme roles only, never a hex value, so the colour
 * follows the theme and dark mode. An empty seed is `primary`.
 */
export function avatarTone(seed: string | null | undefined): AvatarTone {
  const text = (seed ?? "").trim().toLowerCase();
  if (!text) return "primary";
  // FNV-1a, 32-bit: cheap, and spreads short strings well enough across three buckets.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return TONES[(hash >>> 0) % TONES.length];
}
