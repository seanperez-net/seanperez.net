import { expect, test, type Page } from "@playwright/test";

/**
 * Drawer auto-float on WebKit (`packages/ui/src/components/layout/layout.md` "Drawer
 * auto-float", owner 2026-11-25): a docked drawer gives up its track when docking it would
 * leave a pair of panes under their minimum widths, and docks again when the room returns. The
 * site starts docked (`bind:drawerDocked` true), so /messages/ is docked by choice.
 */

const scaffold = (page: Page) => page.locator(".layout-scaffold");
const menu = (page: Page) => page.locator("[data-layout-rail] button").first();
const drawer = (page: Page) => page.locator("#layout-drawer");
const visiblePanes = (page: Page) =>
  page.evaluate(
    () =>
      [
        ...document.querySelectorAll(
          "[data-qds-list-pane], [data-qds-detail-pane]",
        ),
      ].filter((e) => getComputedStyle(e).display !== "none").length,
  );

/** Collapse the supporting pane if the page opened one. */
async function closeSupport(page: Page) {
  const open = page.locator("[data-layout-trail] button[aria-pressed=true]");
  if (await open.count()) await open.first().click();
  await expect(scaffold(page)).toHaveAttribute("data-support", "collapsed");
}

test.describe("drawer auto-float (desktop WebKit)", () => {
  test.skip(({ isMobile }) => isMobile, "from 600px only");

  test("Messages at 1000px keeps two panes with the drawer floating, docks when wide", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto("/messages/");
    await closeSupport(page);

    // The choice stays docked; the drawer floats so list and detail both show.
    await expect(scaffold(page)).toHaveAttribute("data-nav", "");
    await expect(scaffold(page)).toHaveAttribute(
      "data-nav-effective",
      "floating",
    );
    await expect(drawer(page)).toHaveAttribute("data-docked", "false");
    await expect.poll(() => visiblePanes(page)).toBe(2);

    // The button shows the effective state and opens the section's card.
    await expect(menu(page)).toHaveAttribute("aria-expanded", "false");
    await expect(menu(page)).toHaveAttribute("aria-label", "Open menu");
    await menu(page).click();
    await expect(menu(page)).toHaveAttribute("aria-expanded", "true");
    await expect
      .poll(() => drawer(page).evaluate((e) => e.matches(":popover-open")))
      .toBe(true);
    await page.keyboard.press("Escape");

    // Room again: docked again, with the choice it had.
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect(scaffold(page)).not.toHaveAttribute("data-nav-effective", /.*/);
    await expect(drawer(page)).toHaveAttribute("data-docked", "true");
    await expect(menu(page)).toHaveAttribute("aria-label", "Undock drawer");
    await expect(menu(page)).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => visiblePanes(page)).toBe(2);
  });

  test("crossing the line by resizing starts no track transition", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/messages/");
    await closeSupport(page);
    await expect(drawer(page)).toHaveAttribute("data-docked", "true");
    // The supporting pane's own slide has ended.
    await page.waitForFunction(
      () =>
        document.querySelector(".layout-scaffold")!.getAnimations().length ===
        0,
    );
    await page.setViewportSize({ width: 1000, height: 900 });
    const running = await page.evaluate(() =>
      document
        .querySelector(".layout-scaffold")!
        .getAnimations()
        .map((a) => (a as CSSTransition).transitionProperty),
    );
    expect(running).toEqual([]);
    await expect(scaffold(page)).toHaveAttribute(
      "data-nav-effective",
      "floating",
    );
  });

  test("reduced motion: opening a pane floats the drawer with no slide", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Contacts is one pane, so only the supporting pane's pair counts: at 1000px a 360px body
    // fits beside it only without the drawer.
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto("/contacts/");
    await closeSupport(page);
    await expect(drawer(page)).toHaveAttribute("data-docked", "true");
    const pill = page.locator("[data-layout-trail] button[aria-pressed]").first();
    await pill.click();
    const running = await page.evaluate(
      () =>
        document.querySelector(".layout-scaffold")!.getAnimations().length,
    );
    expect(running).toBe(0);
    await expect(scaffold(page)).toHaveAttribute(
      "data-nav-effective",
      "floating",
    );
    await expect(drawer(page)).toHaveAttribute("data-docked", "false");
  });
});
