/**
 * Reads the owner's public GitHub repositories and writes the ones Home shows as project cards
 * to `src/content/repos.json`. Run by the root `pnpm build` (after `og`, before the app build),
 * so every deploy, Workers Builds included, has a fresh list; the JSON is committed and is the
 * fallback.
 *
 * Why at build time (2026-11-24): GitHub allows 60 unauthenticated API requests an hour per IP
 * (https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api). A Worker
 * calling it per visit shares its egress IPs with every other Worker and would hit that limit;
 * a build calls it once. No token anywhere: the repos are public.
 *
 * If the request fails (offline, rate limited, GitHub down), the script warns, KEEPS the
 * committed list and exits 0: a deploy must never break over the project cards.
 *
 * Shown: public repos that are not forks and not archived, newest push first. The GitHub Pages
 * user site (`seanperez-net.github.io`) is included: it is a real project of its own (the
 * zero-JavaScript page), not a fork or a mirror.
 */
import { readFile, writeFile } from "node:fs/promises";
import type { Repo } from "../src/content/repos.ts";

const USER = "seanperez-net";
const URL_ = `https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`;
const out = new URL("../src/content/repos.json", import.meta.url);

/** The fields of GitHub's repository object this script reads. */
interface GithubRepo {
  name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
  private: boolean;
}

async function main() {
  let list: GithubRepo[];
  try {
    const res = await fetch(URL_, {
      headers: {
        // GitHub's documented media type and API version; a User-Agent is required.
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "seanperez.net-build",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: unknown = await res.json();
    if (!Array.isArray(body)) throw new Error("not a list");
    list = body as GithubRepo[];
  } catch (error) {
    console.warn(
      `repos: GitHub not reachable (${String(error)}); keeping the committed list.`,
    );
    return;
  }

  const repos: Repo[] = list
    .filter((r) => !r.fork && !r.archived && !r.private)
    .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
    .map((r) => ({
      name: r.name,
      description: r.description ?? "",
      language: r.language ?? "",
      url: r.html_url,
      pushedAt: r.pushed_at,
    }));

  const json = `${JSON.stringify(repos, null, 2)}\n`;
  const before = await readFile(out, "utf8").catch(() => "");
  if (json === before) {
    console.log(`repos: ${repos.length} unchanged`);
    return;
  }
  await writeFile(out, json);
  console.log(`repos: wrote ${repos.length} to src/content/repos.json`);
}

await main();
