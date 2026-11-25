/**
 * Drawer auto-float (NEW 2026-11-25, `layout.md` "Drawer auto-float"). What a `createDOM` render
 * can check: the markup Root starts with (the dock choice on `data-nav`, the probe, the rail
 * button before any measurement) and that the CSS and its tokens stay paired. The decision
 * itself (CSS layout, the probe's ResizeObserver, the floating card) needs a layout engine:
 * `apps/web/e2e/drawer-auto-float.spec.ts` (WebKit).
 */
import { readFileSync } from "node:fs";
import { createDOM } from "@qwik.dev/core/testing";
import { QwikRouterMockProvider } from "@qwik.dev/router";
import { useSignal, component$ } from "@qwik.dev/core";
import { describe, expect, it } from "vitest";
import { Layout } from "./index";
import type { LayoutDrawerItem } from "./layout-context";

const drawerItems: LayoutDrawerItem[] = [
  {
    href: "/messages/",
    label: "Messages",
    items: [{ href: "/messages/home/", label: "Home" }],
  },
];

const Docked = component$<{ items?: LayoutDrawerItem[] }>(({ items }) => {
  const docked = useSignal(true);
  return (
    <Layout.Root
      title="Test"
      activeHref="/messages/home/"
      railItems={[{ href: "/messages/", label: "Messages", icon: "chat" }]}
      drawerItems={items}
      drawerType="floating"
      bind:drawerDocked={docked}
    >
      <Layout.Rail />
      <Layout.Drawer />
      <Layout.Pane role="primary">
        <p>Body</p>
      </Layout.Pane>
    </Layout.Root>
  );
});

describe("Layout drawer auto-float", () => {
  it("renders the dock choice, the probe, and the docked state before measuring", async () => {
    const { screen, render } = await createDOM();
    await render(
      <QwikRouterMockProvider>
        <Docked items={drawerItems} />
      </QwikRouterMockProvider>,
    );
    const scaffold = screen.querySelector(".layout-scaffold")!;
    // `data-nav` is the CHOICE (CSS decides the track from it), nothing forced yet.
    expect(scaffold.hasAttribute("data-nav")).toBe(true);
    expect(scaffold.hasAttribute("data-nav-effective")).toBe(false);
    const probe = screen.querySelector("[data-layout-nav-fit]");
    expect(probe).toBeTruthy();
    expect(probe!.getAttribute("data-layout-nav-fit")).toBe("layout-drawer");
    expect(probe!.getAttribute("aria-hidden")).toBe("true");
    const button = screen.querySelector("[data-layout-rail] button")!;
    expect(button.getAttribute("aria-label")).toBe("Undock drawer");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("renders no probe without drawer items", async () => {
    const { screen, render } = await createDOM();
    await render(
      <QwikRouterMockProvider>
        <Docked />
      </QwikRouterMockProvider>,
    );
    expect(screen.querySelector("[data-layout-nav-fit]")).toBeFalsy();
  });

  it("keeps the list-detail token equal to its container query literal", () => {
    const tokens = readFileSync(
      new URL("../../tokens/layout/layout-tokens.css", import.meta.url),
      "utf8",
    );
    const tsx = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    const css = readFileSync(
      new URL("../../tokens/layout/layout.css", import.meta.url),
      "utf8",
    );
    const token = /--layout-list-detail-min:\s*([\d.]+rem)/.exec(tokens)?.[1];
    expect(token).toBeTruthy();
    // Every list-detail container query uses that same width.
    const literals = new Set(
      [...tsx.matchAll(/@(?:min|max)-\[([\d.]+rem)\]\/list-detail/g)].map(
        (m) => m[1],
      ),
    );
    for (const m of css.matchAll(
      /@container list-detail \(min-width: ([\d.]+rem)\)/g,
    )) {
      literals.add(m[1]);
    }
    expect([...literals]).toEqual([token]);
    // The CSS decision reads the tokens, not literals.
    expect(css).toContain(
      "--layout-nav-need-ld: var(--layout-list-detail-min)",
    );
    expect(css).toContain("--layout-nav-need-support: var(--layout-body-min)");
  });
});
