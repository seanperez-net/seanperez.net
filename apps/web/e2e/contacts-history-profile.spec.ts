import { expect, test, type Page } from "@playwright/test";

/**
 * The person page's Google parts (2026-11-25): "Recent interactions" (from Messages), "History"
 * (Last edited, Added to contacts), the owner's profile in ONE "Profile" card, and a PROFILE linked
 * to the visitor's own contact (More > Add profile: a site account or an address). All local: each
 * test runs in a fresh browser context.
 */

async function createContact(page: Page, name: string) {
  await page.goto("/contacts/new/");
  const editor = page.locator("dialog[open]");
  await editor.getByRole("textbox", { name: /^name/i }).fill(name);
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function addProfile(page: Page) {
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Add profile" }).click();
  return page.locator("dialog[open]");
}

test("owner's page: Profile card, Recent interactions, History", async ({
  page,
}) => {
  await page.goto("/contacts/sean-perez/");
  const article = page.getByRole("article");
  // ONE Profile card holding his profile (h4 sections with stable ids).
  await expect(
    article.getByRole("heading", { name: "Profile", level: 3 }),
  ).toBeVisible();
  await expect(
    article.getByRole("heading", { name: "Projects", level: 4 }),
  ).toHaveAttribute("id", "profile-projects");
  // His Work / Education sections are D1 data (`profile.sections`), not asserted here.
  await expect(article.getByText("To be added.")).toHaveCount(0);
  await expect(
    article.getByRole("heading", { name: "Contact details", level: 3 }),
  ).toBeVisible();
  await expect(
    article.getByRole("link", { name: /Add phone number/ }),
  ).toHaveAttribute("href", /\?edit$/);
  // The Profile card comes FIRST, above Contact details (owner, 2026-11-25).
  const profileBox = await article
    .getByRole("heading", { name: "Profile", level: 3 })
    .boundingBox();
  const detailsBox = await article
    .getByRole("heading", { name: "Contact details", level: 3 })
    .boundingBox();
  expect(profileBox!.y).toBeLessThan(detailsBox!.y);

  // His welcome message is a recent interaction, a link to the thread.
  const recent = article.getByRole("list", { name: "Recent interactions" });
  await expect(
    recent.getByRole("link", { name: /welcome/i }).first(),
  ).toHaveAttribute("href", "/messages/sean-perez/");

  // History: a site contact comes with the site; no "Last edited" until the visitor EDITS it.
  // A star is not an edit (`editedAt`, owner 2026-11-25), an edit is.
  const history = article.locator("[data-contact-history]");
  await expect(history).toContainText("Added to contacts");
  await expect(history).not.toContainText("Last edited");
  await page.getByRole("button", { name: "Add to favorites" }).click();
  await expect(
    page.getByRole("button", { name: "Remove from favorites" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(history).not.toContainText("Last edited");
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: "Company" }).fill("Edited Co");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).not.toHaveURL(/\?edit/);
  await expect(history).toContainText("Last edited · Today");
});

test("own contact: History, then link and remove a profile", async ({
  page,
}) => {
  const name = `Pat Profile ${Date.now()}`;
  await createContact(page, name);
  const article = page.getByRole("article");
  const history = article.locator("[data-contact-history]");
  await expect(history).toContainText("Last edited · Today");
  await expect(history).toContainText("Added to contacts · Today");
  // No account: no Recent interactions card.
  await expect(
    article.getByRole("heading", { name: "Recent interactions" }),
  ).toHaveCount(0);

  // An address that is not https:// is refused.
  let dialog = await addProfile(page);
  await dialog.getByRole("radio", { name: "A profile address" }).click();
  const field = dialog.getByRole("textbox", { name: "Profile address" });
  await field.fill("javascript:alert(1)");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toContainText("starting with https://");
  await field.fill("https://github.com/octocat");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const profile = article.getByRole("list", { name: "Profile link" });
  await expect(profile.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
    "href",
    "https://github.com/octocat",
  );
  await page.reload();
  await expect(
    article.getByRole("list", { name: "Profile link" }),
  ).toBeVisible();

  // Change it to the owner's profile on this site: his profile shows, read-only.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Change profile" }).click();
  dialog = page.locator("dialog[open]");
  await dialog
    .getByRole("radio", { name: "Sean Perez's profile on this site" })
    .click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    // Projects: Experience / Education are not drawn while empty (release 2026-11-25).
    article.getByRole("heading", { name: "Projects", level: 4 }),
  ).toBeVisible();
  await expect(article).toContainText("From Sean Perez's profile");

  // Remove, with Undo.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Remove profile" }).click();
  await expect(
    article.getByRole("heading", { name: "Profile", level: 3 }),
  ).toHaveCount(0);
  await expect(page.getByText("Profile removed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    article.getByRole("heading", { name: "Profile", level: 3 }),
  ).toBeVisible();
});
