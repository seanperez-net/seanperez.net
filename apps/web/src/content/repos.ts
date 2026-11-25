/**
 * Home's project cards: the owner's public GitHub repositories, as `scripts/repos.ts` writes
 * them to `repos.json` at build time (newest push first). Plain data, no imports: the script
 * imports the type with Node's own type stripping.
 */
export interface Repo {
  name: string;
  /** GitHub's description; empty when the repo has none. */
  description: string;
  /** GitHub's main language; empty when it detected none. */
  language: string;
  url: string;
  /** ISO 8601 time of the last push. */
  pushedAt: string;
}
