import { expect, test, type Page } from "@playwright/test";

/**
 * ONE NAME (owner, 2026-11-25): the Contact me form's Name and the guest's profile name are the
 * same value (`profile.local` through the seam). Typing a name in Contact me (committed: blur)
 * makes it the profile's; editing the profile fills Contact me's Name. The email is never kept.
 * Wide only: from 840px Contact me is open beside every page (the compact sheet is covered by
 * the other specs' iPhone runs).
 */
const trigger = (page: Page) => page.locator('[aria-label^="Account:"]').first();
const contactName = (page: Page) =>
  page.locator("aside").getByRole("textbox", { name: "Name" });

test("Contact me Name and the profile name are one value", async ({ page, isMobile }) => {
  test.skip(isMobile, "Contact me is a closed sheet below 840px");
  const posted: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") posted.push(r.url());
  });

  // Contact me -> profile.
  await page.goto("/profile/");
  await expect(page.locator("#profile-name")).toHaveText("You");
  const field = contactName(page);
  await expect(async () => {
    await field.fill("Grace Form");
    await expect(field).toHaveValue("Grace Form", { timeout: 500 });
  }).toPass();
  await field.blur();
  await expect(page.locator("#profile-name")).toHaveText("Grace Form");
  await page.reload();
  await expect(page.locator("#profile-name")).toHaveText("Grace Form");
  await expect(trigger(page)).toHaveAttribute("aria-label", /^Account: Grace Form,/);

  // Profile -> Contact me.
  await page.getByRole("button", { name: "Edit profile" }).click();
  const name = page.getByRole("dialog").getByRole("textbox", { name: "Name" });
  await expect(name).toBeFocused();
  await expect(async () => {
    await name.fill("Grace Profile");
    await expect(name).toHaveValue("Grace Profile", { timeout: 500 });
  }).toPass();
  await name.press("Enter");
  await expect(page.locator("#profile-name")).toHaveText("Grace Profile");
  await expect(contactName(page)).toHaveValue("Grace Profile");

  // The email is not kept anywhere: a reload shows it empty.
  await page.reload();
  await expect(page.locator("aside").getByRole("textbox", { name: "Email" })).toHaveValue("");

  expect(posted).toEqual([]);
});
