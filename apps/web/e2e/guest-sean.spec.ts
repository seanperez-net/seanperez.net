import { expect, test, type Page } from "@playwright/test";

/**
 * The visitor is a GUEST, the owner a separate person (owner decision 2026-11-25, memory
 * `visitor-is-guest-you`): the account menu says "You"; Sean's contact keeps his real name; his
 * "Message" opens HIS thread with his welcome message, which the visitor can delete (kept after a
 * reload, Undo available); Contact me can be removed and added back. Nothing is posted.
 */
const trigger = (page: Page) => page.locator('[aria-label^="Account:"]').first();
const WELCOME = "Hi, and welcome! I'm Sean";

test("guest account, Sean's welcome deleted locally, Contact me removed and back", async ({
  page,
  isMobile,
}) => {
  const posted: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") posted.push(r.url());
  });

  await page.goto("/contacts/sean-perez/");
  await expect(trigger(page)).toHaveAttribute("aria-label", /^Account: You,/);
  await expect(page.getByRole("heading", { name: "Sean Perez" }).first()).toBeAttached();

  // Message: Sean's thread (window from 600px, the page below), with his welcome.
  await page
    .getByRole("group", { name: "Actions" })
    .getByRole("button", { name: "Message" })
    .click();
  if (isMobile) {
    await expect(page).toHaveURL(/\/messages\/sean-perez\/$/);
  } else {
    const win = page.getByRole("dialog", { name: /Sean Perez/ });
    await expect(win).toBeVisible();
    await expect(win.getByText(WELCOME)).toBeVisible();
    await page.goto("/messages/sean-perez/");
  }
  const welcome = page.locator("[data-chat-message='w1']");
  await expect(welcome).toBeVisible();

  // Delete it: the actions menu, then the confirm dialog.
  await welcome.hover();
  await welcome.getByRole("button", { name: /^Message actions/ }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Delete" }).click();
  await expect(welcome).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Message deleted from this browser" }),
  ).toHaveCount(1);
  await page.reload();
  await expect(page.locator("[data-chat-message='w1']")).toHaveCount(0);

  // Contact me: remove from Profile's "Your apps", then the account menu offers it back.
  // Remove opens "How apps work" (/docs/apps/, owner 2026-11-25), where the removal happens.
  await page.goto("/profile/");
  await page.getByRole("link", { name: "Remove", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/apps\/#remove$/);
  const removeIt = page.getByRole("button", { name: "Remove Contact me" });
  const addItBack = page.getByRole("button", { name: "Add it back" });
  // An early click can be lost on WebKit before the page resumes (apps-tutorial.spec.ts).
  await expect(async () => {
    if (await removeIt.isEnabled()) await removeIt.click({ timeout: 2_000 });
    await expect(addItBack).toBeEnabled({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.goto("/profile/");
  await expect(page.getByRole("button", { name: "Add back" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Add back" })).toBeVisible();
  await trigger(page).click();
  await expect(page.getByRole("menuitem", { name: "Add Contact me back" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add back" }).click();
  await expect(page.getByRole("link", { name: "Remove", exact: true })).toBeVisible();

  expect(posted).toEqual([]);
});
