import { expect, test, type Page } from "@playwright/test";

/**
 * Layout motion on WebKit (rules L23, L26, L27 in `.claude/rules/ui-m3-layout.md`):
 * the drawer and the supporting pane slide without a scrollbar flash, the compact drawer
 * opens and closes (its exit plays before it leaves the top layer), reduced motion is honoured.
 */

/** Count animation frames, over `ms`, in which any element shows a horizontal scrollbar. */
async function scrollbarFrames(page: Page, ms = 700) {
  return page.evaluate(async (ms) => {
    const bad: number[] = [];
    const t0 = performance.now();
    await new Promise<void>((done) => {
      const tick = () => {
        let n = 0;
        for (const e of document.querySelectorAll<HTMLElement>("body *")) {
          const ox = getComputedStyle(e).overflowX;
          if ((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth + 1) n++;
        }
        bad.push(n);
        if (performance.now() - t0 < ms) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return { frames: bad.length, withScrollbar: bad.filter((n) => n > 0).length };
  }, ms);
}

test.describe("wide (desktop WebKit)", () => {
  test.skip(({ isMobile }) => isMobile, "wide layout only");

  test("docking the Messages drawer slides with no scrollbar", async ({ page }) => {
    // Wide enough that the drawer can dock beside Messages' two panes: below about 1016px of
    // room the drawer auto-floats (layout.md "Drawer auto-float"), and the button opens the
    // floating card instead of docking.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/messages/");
    const menu = page.locator("nav[aria-label=Main] button[aria-controls]").first();
    await expect(menu).toBeEnabled();
    const before = await menu.getAttribute("aria-label");
    const sample = scrollbarFrames(page);
    await menu.click();
    const r = await sample;
    expect(r.withScrollbar, `${r.withScrollbar}/${r.frames} frames`).toBe(0);
    await expect(menu).not.toHaveAttribute("aria-label", before ?? "");
    await menu.click(); // back to how it was
    await expect(menu).toHaveAttribute("aria-label", before ?? "");
  });

  test("Contact me pane opens and closes, filled icon while open", async ({ page }) => {
    await page.goto("/");
    const pill = page.locator('nav button[aria-label="Contact me"]').first();
    const pane = page.locator("aside.scaffold-support");
    const wasOpen = (await pill.getAttribute("aria-pressed")) === "true";
    if (wasOpen) await pill.click();
    await expect(pill).toHaveAttribute("aria-pressed", "false");
    await expect(pane).toBeHidden();

    const sample = scrollbarFrames(page);
    await pill.click();
    const r = await sample;
    expect(r.withScrollbar, `${r.withScrollbar}/${r.frames} frames`).toBe(0);
    await expect(pill).toHaveAttribute("aria-pressed", "true");
    await expect(pane.getByRole("textbox", { name: /name/i })).toBeVisible();
    // Outline icon hidden, filled one shown.
    const shown = await pill.locator("svg").evaluateAll((s) =>
      s.map((e) => getComputedStyle(e).display !== "none"),
    );
    expect(shown).toEqual([false, true]);
    // Corners: the outer box paints nothing (rounded panel visible at the gap).
    expect(await pane.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
      "rgba(0, 0, 0, 0)",
    );

    await pill.click();
    await expect(pane).toBeHidden();
    if (wasOpen) await pill.click();
  });
});

test.describe("compact (iPhone)", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  test("the drawer opens, then closes and leaves the top layer", async ({ page }) => {
    await page.goto("/contacts/");
    await page.getByRole("button", { name: "Open menu" }).first().tap();
    const drawer = page.locator("dialog[open]").first();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Trash" })).toBeVisible();
    await drawer.getByRole("button", { name: "Close menu" }).first().tap();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });

  test("Escape closes the focused button's tooltip first, then the drawer (APG)", async ({
    page,
  }) => {
    await page.goto("/contacts/");
    await page.getByRole("button", { name: "Open menu" }).first().tap();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    // WebKit treats the focus moved into the dialog as :focus-visible, so the Close button's
    // tooltip shows; Chromium does not. Either way, Escape until the drawer is gone, at most two.
    await page.keyboard.press("Escape");
    if ((await page.locator("dialog[open]").count()) > 0) {
      await expect(page.locator("[data-tooltip-tip]:popover-open")).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });

  test("reduced motion: the drawer has no transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/contacts/");
    await page.getByRole("button", { name: "Open menu" }).first().tap();
    const drawer = page.locator("dialog[open]").first();
    await expect(drawer).toBeVisible();
    // `motion-reduce:transition-none` sets transition-property: none (durations stay as set).
    const property = await drawer.evaluate((e) => getComputedStyle(e).transitionProperty);
    expect(property).toBe("none");
    await drawer.getByRole("button", { name: "Close menu" }).first().tap();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });
});
