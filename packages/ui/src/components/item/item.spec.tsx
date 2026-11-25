/**
 * Item: the M3 padding per line count (lists specs, baseline diagrams, 2026-11-25) and the
 * per-part disabled colours of a button row. Heights are measured in Chrome (no layout here).
 */
import { describe, expect, it } from "vitest";
import { itemVariants } from "./item";

const classes = (props: Parameters<typeof itemVariants>[0]) =>
  itemVariants(props).split(/\s+/);

describe("itemVariants", () => {
  it("pads one- and two-line rows 8dp and three-line rows 12dp", () => {
    expect(classes({ lines: "one-line" })).toEqual(
      expect.arrayContaining(["py-2", "min-h-14"]),
    );
    expect(classes({ lines: "two-line" })).toEqual(
      expect.arrayContaining(["py-2", "min-h-18"]),
    );
    expect(classes({ lines: "three-line" })).toEqual(
      expect.arrayContaining(["py-3", "min-h-22"]),
    );
    expect(classes({ lines: "one-line" })).not.toContain("py-3");
  });

  it("keeps the compact density's own padding", () => {
    const c = classes({ lines: "two-line", density: "compact" });
    expect(c).toContain("py-1");
    expect(c).not.toContain("py-2");
  });

  it("dims a disabled button row per part, not as a whole", () => {
    const c = classes({ as: "button" });
    expect(c).toContain("disabled:**:[.item-headline]:text-on-surface/30");
    expect(c).toContain("disabled:*:[.item-start]:text-on-surface/38");
    expect(c).not.toContain("disabled:opacity-38");
  });
});
