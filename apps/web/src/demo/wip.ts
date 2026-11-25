/**
 * THE RELEASE WIP SWITCH (owner, 2026-11-25: "we need the web to be publishable ... if something
 * isnt finished finish it now or stash it"). Unfinished features stay in the code, and in the e2e
 * suite (which runs on `pnpm dev`), but a production build hides them: no row, button, FAB or
 * search entry points at them, and their routes answer 404.
 *
 * What it hides (`grep -rn "WIP:" apps/web/src` lists every gate; the list and how to turn each
 * back on: `.claude/notes/release-readiness-2026-11-25.md`):
 * the Assistant (contact, thread, Messages "Apps" group, the "Apps" label), Messages' "New chat"
 * FAB, "Search in this conversation", the Messages window's video call, the Mentions and Starred
 * shortcuts, and Contacts' "Other contacts".
 *
 * - ON under `pnpm dev` (`import.meta.env.DEV`), OFF in every build (`pnpm build`, Workers Builds).
 * - `VITE_WIP=on` turns it on in a build (Workers Builds: a BUILD variable, as `VITE_DEMO`);
 *   `VITE_WIP=off pnpm dev` turns it off locally (restart the dev server).
 * - When a feature is finished, remove its `WIP:` gate rather than shipping the switch on.
 *
 * Separate from `DEMO` (`demo.ts`): DEMO is the portfolio layer (Contact me) and stays ON in
 * production; WIP is "not finished yet". Same mechanism (a build-time `import.meta.env` constant,
 * replaced by Vite, so the hidden branch is dropped from the bundles). `?.`: harmless if a plain
 * Node script ever imports a module that reads it (`import.meta.env` is undefined there).
 */
const flag = String(import.meta.env?.VITE_WIP ?? "").toLowerCase();

export const WIP: boolean =
  flag === "on" ? true : flag === "off" ? false : !!import.meta.env?.DEV;
