/**
 * Seed the LOCAL profile sections from a JSON file kept OUTSIDE the repo (the text is personal: it never
 * lands in git). The file is our document (`{ "v": 1, "sections": [...] }`) or a JSON Resume
 * document (mapped by `importSectionsJson`; `basics` and contact details are never imported). It
 * is checked with the same schema the admin's save uses, and nothing is written on a failure.
 *
 *   pnpm --filter @seanperez/db seed:sections ~/Documents/profile-sections.local.json
 *
 * LOCAL ONLY: it opens apps/web's local D1 state (the one `pnpm dev` and `pnpm dev:admin` share,
 * rule A13) through wrangler's `getPlatformProxy`, with the admin's `wrangler.jsonc` (only `DB`).
 * There is no remote mode: production text is entered in the admin app (Profile > Sections, or its
 * Import JSON). Apply the migrations locally first; restart running dev servers after (rule D21).
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { importSectionsJson } from "../src/profile/profile-sections.ts";
import { saveSections } from "../src/profile/profile.server.ts";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: seed:sections <path to a JSON file outside the repo>");
  process.exit(1);
}
const file = resolve(arg.replace(/^~(?=\/)/, homedir()));
const repo = fileURLToPath(new URL("../../../", import.meta.url));
if (file.startsWith(repo)) {
  console.error(`Refused: ${file} is inside the repo. Keep the profile text outside git.`);
  process.exit(1);
}

const { doc, ignored } = importSectionsJson(JSON.parse(await readFile(file, "utf8")));
if (ignored.length) console.log(`Not imported: ${ignored.join(", ")}`);

const proxy = await getPlatformProxy<{ DB: D1Database }>({
  configPath: fileURLToPath(new URL("../../../apps/admin/wrangler.jsonc", import.meta.url)),
  persist: {
    path: fileURLToPath(new URL("../../../apps/web/.wrangler/state/v3", import.meta.url)),
  },
});
try {
  const result = await saveSections(proxy.env.DB, doc);
  if (!result.ok) {
    console.error("Refused, nothing written:", JSON.stringify(result.issues, null, 2));
    process.exitCode = 1;
  } else {
    console.log("Saved the profile sections to the LOCAL D1. Restart running dev servers to be sure.");
  }
} finally {
  await proxy.dispose();
}
