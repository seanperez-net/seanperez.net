/**
 * Every playground destination in `routes/layout.tsx` (`sections`, the rail and drawer list) has
 * a route file, so no link in the playground answers 404. e-store `233eba9ff` pattern (its Keep
 * views). `sections` is not exported, so the hrefs are read from the source text.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routes = fileURLToPath(new URL("./routes/", import.meta.url));
const layout = readFileSync(`${routes}layout.tsx`, "utf8");

/** The `sections` array literal: from its declaration to the statement after it. */
const start = layout.indexOf("const sections");
const end = layout.indexOf("\nconst ", start + 1);
const block = layout.slice(start, end);
const hrefs = [
  ...new Set([...block.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1])),
];

describe("playground sections", () => {
  it("are found in routes/layout.tsx", () => {
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(hrefs.length).toBeGreaterThan(10);
  });

  it("each have a route file", () => {
    const missing = hrefs.filter((href) => {
      const dir = `${routes}${href.replace(/^\//, "")}`;
      return !["index.tsx", "index.ts", "index.mdx", "index.md"].some((f) =>
        existsSync(`${dir}${f}`),
      );
    });
    expect(missing).toEqual([]);
  });
});
