import { expect, test, type Page } from "@playwright/test";

/**
 * Presence is the VISITOR's own status, kept in their browser (memory `presence-follows-visitor`):
 * automatic from activity, a manual status from the account menu, the same in every tab, and
 * nothing sent. `?presence-test=fast` (dev only) uses seconds: away after 5 s, offline after 15 s,
 * busy for 10 s.
 */
const FAST = "/profile/?presence-test=fast";
const trigger = (page: Page) => page.locator('[aria-label^="Account:"]').first();

// The status is ONE "Status: ..." row opening the choices (2026-11-25, `presenceLook="submenu"`).
const openStatus = (page: Page) =>
  page.getByRole("menuitem", { name: /^Status:/ }).click();

async function busyFor(page: Page, length: string) {
  await trigger(page).click();
  await openStatus(page);
  await page.getByRole("menuitem", { name: /^Busy/ }).click();
  await page.getByRole("menuitemradio", { name: length }).click();
}

async function choose(page: Page, status: string) {
  await trigger(page).click();
  await openStatus(page);
  await page.getByRole("menuitemradio", { name: status }).click();
}

test("idle, manual status, expiry, reload and a second tab, with nothing sent", async ({
  page,
  context,
}) => {
  const sent: string[] = [];
  context.on("request", (r) => {
    if (r.method() !== "GET" || /presence/i.test(r.postData() ?? ""))
      sent.push(`${r.method()} ${r.url()}`);
  });

  await page.goto(FAST);
  // Server render: online, before and after the page wakes.
  await expect(trigger(page)).toHaveAttribute("aria-label", /, Online$/);
  // No input: away after 5 s.
  await expect(trigger(page)).toHaveAttribute("aria-label", /, Away$/, { timeout: 12_000 });
  // Activity: online again.
  await page.mouse.move(200, 200);
  await page.mouse.move(240, 260);
  await expect(trigger(page)).toHaveAttribute("aria-label", /, Online$/);

  // Busy is a submenu of durations (2026-11-24). "For 4 hours" ends after 20 s in fast mode,
  // then automatic; the account menu says until when.
  await busyFor(page, "For 4 hours");
  await expect(trigger(page)).toHaveAttribute("aria-label", /, Busy$/);
  await trigger(page).click();
  await expect(page.locator("[data-qds-account-menu-status]")).toHaveText(/Busy · Until \d/);
  await expect(page.getByRole("menuitem", { name: /^Status: Busy\W+Until \d/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger(page)).not.toHaveAttribute("aria-label", /, Busy$/, { timeout: 25_000 });

  // "Until I change it" survives a reload and has no end time.
  await busyFor(page, "Until I change it");
  await page.reload();
  await expect(trigger(page)).toHaveAttribute("aria-label", /, Busy$/);
  await trigger(page).click();
  await expect(page.locator("[data-qds-account-menu-status]")).toHaveText("Busy · Until you change it");
  await page.keyboard.press("Escape");

  // Appear offline lasts until changed: through a reload, and in a second tab.
  await choose(page, "Appear offline");
  await expect(trigger(page)).toHaveAttribute("aria-label", /, Offline$/);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(trigger(page)).toHaveAttribute("aria-label", /, Offline$/);
  const second = await context.newPage();
  await second.goto("/messages/?presence-test=fast");
  await expect(trigger(second)).toHaveAttribute("aria-label", /, Offline$/);

  // Back to automatic in the second tab: the first agrees.
  await choose(second, "Automatic");
  await expect(trigger(second)).toHaveAttribute("aria-label", /, Online$/);
  await expect(trigger(page)).toHaveAttribute("aria-label", /, Online$/);

  expect(sent).toEqual([]);

  // Nothing to clean: every Playwright context starts with empty storage. (WebKit here has no
  // usable OPFS, `getDirectory()` fails, so this run also covered the IndexedDB fallback.)
});
