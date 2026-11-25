/** The plain-logic utilities: no DOM, no Qwik render. */
import { describe, expect, it } from "vitest";
import { appendId, removeId } from "./aria-ids";
import { cn } from "./cn";
import { safeHref } from "./safe-href";
import { openPopover } from "./top-layer";
import type { PopoverTarget } from "./top-layer";

describe("cn", () => {
  it("joins classes and skips falsy ones", () => {
    const wide = false;
    expect(cn("p-4", wide && "w-full", undefined, null, "text-start")).toBe(
      "p-4 text-start",
    );
  });

  it("returns an empty string for nothing", () => {
    expect(cn()).toBe("");
    expect(cn(false, undefined)).toBe("");
  });

  it("does not merge conflicting Tailwind classes (no merge engine)", () => {
    expect(cn("p-4", "p-2")).toBe("p-4 p-2");
  });
});

describe("safeHref", () => {
  it("keeps paths, anchors and the safe schemes", () => {
    for (const href of [
      "/about/",
      "#top",
      "?q=1",
      "./x",
      "../x",
      "//example.com/",
      "https://example.com/",
      "http://example.com/",
      "mailto:someone@example.com",
      "tel:+15555550100",
    ])
      expect(safeHref(href), href).toBe(href);
  });

  it("refuses script and data schemes, however they are disguised", () => {
    for (const href of [
      "javascript:alert(1)",
      " JaVaScRiPt:alert(1)",
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "\u0000javascript:alert(1)",
      "vbscript:x",
      "data:text/html,x",
    ])
      expect(safeHref(href), JSON.stringify(href)).toBeUndefined();
  });

  it("trims and strips tab / LF / CR as the URL parser does", () => {
    expect(safeHref("  /a\tb/  ")).toBe("/ab/");
  });

  it("returns undefined for empty or non-string input", () => {
    expect(safeHref("")).toBeUndefined();
    expect(safeHref("   ")).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref(42)).toBeUndefined();
  });

  it("reads a colon after / ? # as part of the path, not a scheme", () => {
    expect(safeHref("/a:b")).toBe("/a:b");
    expect(safeHref("?x=javascript:1")).toBe("?x=javascript:1");
  });
});

describe("appendId / removeId", () => {
  it("appends once", () => {
    expect(appendId(undefined, "a")).toBe("a");
    expect(appendId("a", "b")).toBe("a b");
    expect(appendId("a b", "b")).toBe("a b");
  });

  it("removes, and gives undefined when nothing is left", () => {
    expect(removeId("a b", "a")).toBe("b");
    expect(removeId("a", "a")).toBeUndefined();
    expect(removeId(null, "a")).toBeUndefined();
  });
});

describe("openPopover", () => {
  const fake = (connected: boolean, open: boolean) => {
    const state = { open, shown: 0, removed: [] as string[] };
    const el: PopoverTarget = {
      isConnected: connected,
      matches: () => state.open,
      removeAttribute: (name) => state.removed.push(name),
      showPopover: () => {
        state.shown++;
        state.open = true;
      },
    };
    return { el, state };
  };

  it("does nothing for a detached element", () => {
    const { el, state } = fake(false, false);
    expect(openPopover(el)).toBe(false);
    expect(state.shown).toBe(0);
  });

  it("shows a closed popover once, and not one already open", () => {
    const closed = fake(true, false);
    expect(openPopover(closed.el)).toBe(true);
    expect(closed.state.shown).toBe(1);
    const open = fake(true, true);
    expect(openPopover(open.el)).toBe(true);
    expect(open.state.shown).toBe(0);
  });
});
