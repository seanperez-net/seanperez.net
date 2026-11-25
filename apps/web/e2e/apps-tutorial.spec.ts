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
  await page.getByRole("button", { name: "More options for Contact me" }).click();
  await page.getByRole("menuitem", { name: "Remove from my apps" }).click();
  await expect(page).toHaveURL(/\/docs\/apps\/#remove$/);
  await expect(page.getByRole("heading", { name: "How apps work" })).toBeVisible();

  const status = page.locator("[data-apps-status]");
  const remove = page.getByRole("button", { name: "Remove Contact me" });
  const addBack = page.getByRole("button", { name: "Add it back" });
  await expect(status).toHaveText("Contact me is in your apps.");
  // On WebKit a click made right after arriving from the menu was sometimes lost (the button
  // stayed enabled, nothing ran): click again only while nothing happened.
  await expect(async () => {
    if (await remove.isEnabled()) await remove.click();
    await expect(status).toHaveText("Contact me is removed from your apps.", {
      timeout: 3000,
    });
  }).toPass();
  await expect(page.getByRole("button", { name: "Contact me", exact: true })).toHaveCount(0);
  await expect(page.getByText("Contact me removed. Add it back from Profile.", { exact: true })).toBeVisible();

  // Kept in this browser: still removed after a reload, on another page too.
  await page.goto("/profile/");
  await expect(page.getByRole("button", { name: "Add back" })).toBeVisible();
  await page.goto("/docs/apps/");
  await expect(status).toHaveText("Contact me is removed from your apps.");
  await expect(remove).toBeDisabled();

  await addBack.click();
  await expect(status).toHaveText("Contact me is in your apps.");
  await expect(page.getByRole("button", { name: "Contact me", exact: true })).toBeVisible();

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
