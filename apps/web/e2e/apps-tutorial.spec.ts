import { expect, test } from "@playwright/test";

/**
 * "How apps work" (2026-11-25, owner: removing Contact me should "send you to docs ... a tutorial
 * of sorts"): the companion's "Remove from my apps" and Profile's Remove open `/docs/apps/`, whose
 * buttons really remove Contact me and add it back (doc `apps.local`, this browser only), and
 * nothing is posted.
 */
test("the menu's Remove opens the tutorial; remove and add back work locally", async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(isMobile, "Contact me is a closed sheet below 840px");
  const sent: string[] = [];
  context.on("request", (r) => {
    if (r.method() !== "GET") sent.push(`${r.method()} ${r.url()}`);
  });

  await page.goto("/");
  // A client navigation, not a page load (2026-11-25): the window keeps this mark.
  await page.evaluate(() => ((window as { spaMark?: number }).spaMark = 1));
  await page.getByRole("button", { name: "More options for Contact me" }).click();
  await page.getByRole("menuitem", { name: "Remove from my apps" }).click();
  await expect(page).toHaveURL(/\/docs\/apps\/#remove$/);
  await expect(page.getByRole("heading", { name: "How apps work" })).toBeVisible();
  expect(await page.evaluate(() => (window as { spaMark?: number }).spaMark)).toBe(1);

  const status = page.locator("[data-apps-status]");
  const remove = page.getByRole("button", { name: "Remove Contact me" });
  const addBack = page.getByRole("button", { name: "Add it back" });
  const railButton = page.getByRole("button", { name: "Contact me", exact: true });
  // Contact me's panel is open: its More menu is in the pane's title row.
  const panelOpen = page.getByRole("button", { name: "More options for Contact me" });
  // The snackbar itself (its live region repeats the text for screen readers).
  const snackbar = page.locator("[data-snackbar]");
  const removedNotice = snackbar.getByText("Contact me removed. Add it back from Profile.", {
    exact: true,
  });
  const backNotice = snackbar.getByText("Contact me is back in your apps.", { exact: true });
  await expect(status).toHaveText("Contact me is in your apps.");
  await expect(panelOpen).toBeVisible();
  // ONE click, at once: it must never be lost (was retried on WebKit after a full page load).
  await remove.click();
  await expect(status).toHaveText("Contact me is removed from your apps.");
  await expect(railButton).toHaveCount(0);
  await expect(panelOpen).toHaveCount(0);
  await expect(removedNotice).toBeVisible();

  // Add it back: the rail button AND its open pane return, and "is back" replaces "removed".
  await addBack.click();
  await expect(status).toHaveText("Contact me is in your apps.");
  await expect(railButton).toBeVisible();
  await expect(panelOpen).toBeVisible();
  await expect(backNotice).toBeVisible();
  await expect(removedNotice).toHaveCount(0);

  // Kept in this browser: still removed after a reload, on another page too.
  await remove.click();
  await expect(status).toHaveText("Contact me is removed from your apps.");
  await page.goto("/profile/");
  await expect(page.getByRole("button", { name: "Add back" })).toBeVisible();
  await page.goto("/docs/apps/");
  await expect(status).toHaveText("Contact me is removed from your apps.");
  await expect(remove).toBeDisabled();

  await addBack.click();
  await expect(status).toHaveText("Contact me is in your apps.");
  await expect(railButton).toBeVisible();
  // Open on load by default, so open again once back.
  await expect(panelOpen).toBeVisible();

  expect(sent).toEqual([]);
});

test("Profile's Remove opens the tutorial", async ({ page }) => {
  await page.goto("/profile/");
  const link = page.getByRole("link", { name: "Remove", exact: true });
  await expect(link).toHaveAttribute("href", "/docs/apps/#remove");
  await link.click();
  await expect(page).toHaveURL(/\/docs\/apps\/#remove$/);
  await expect(page.getByRole("button", { name: "Remove Contact me" })).toBeVisible();
});
