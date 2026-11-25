import { expect, test, type Page } from "@playwright/test";

/**
 * The person page in Google Contacts' structure (2026-11-24): actions in the pane header, the
 * labels row with its "+ Label" menu, the in-page edit view (`?edit`), and the app bar search
 * scoped to Contacts. Everything is local (memory `local-first-no-sync-on-site`): each test runs
 * in a fresh browser context, so its contacts vanish with it.
 */

/** Creates a contact through Create contact and waits for its page. */
async function createContact(page: Page, name: string) {
  await page.goto("/contacts/new/");
  const editor = page.locator("dialog[open]");
  await editor.getByRole("textbox", { name: /^name/i }).fill(name);
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("person page: star, edit in place, delete", async ({ page }) => {
  const name = `Ada Person ${Date.now()}`;
  await createContact(page, name);

  // Star ("Add to favorites"), kept after a reload.
  const star = page.getByRole("button", { name: "Add to favorites" });
  await star.click();
  // The snackbar comes after the write to the browser's store: then a reload keeps it.
  // The snackbar's live region (`role="status"`; its visible copy repeats the words).
  await expect(
    page.getByRole("status").filter({ hasText: "Added to favorites" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Remove from favorites" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove from favorites" }),
  ).toBeVisible();

  // Edit is a link to the same page in edit form; Save waits for a change.
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(/\?edit$/);
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeDisabled();
  await page.getByRole("textbox", { name: "Company" }).fill("Analytical Co");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page).not.toHaveURL(/\?edit/);
  await expect(
    page.getByRole("article").getByText("Analytical Co"),
  ).toBeVisible();

  // Delete moves it to the Trash, with Undo.
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(`${name} moved to Trash`, { exact: true })).toBeVisible();
});

test("labels: the + Label menu applies a label at once", async ({ page }) => {
  const name = `Bea Label ${Date.now()}`;
  await createContact(page, name);
  const labels = page.getByRole("group", { name: "Labels" });

  await labels.getByRole("button", { name: "Label" }).click();
  // The menu is named by its trigger (APG); "Manage labels" is its group heading.
  const menu = page.getByRole("menu");
  await menu.getByRole("menuitemcheckbox", { name: "Work" }).click();
  await expect(
    menu.getByRole("menuitemcheckbox", { name: "Work" }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  // The label is a link to its list; the "+ Label" button became the pencil.
  await expect(labels.getByRole("link", { name: "Work" })).toHaveAttribute(
    "href",
    "/contacts/label/work/",
  );
  await page.reload();
  await expect(labels.getByRole("link", { name: "Work" })).toBeVisible();
  await labels.getByRole("button", { name: "Manage labels" }).click();
  await page
    .getByRole("menu")
    .getByRole("menuitemcheckbox", { name: "Work" })
    .click();
  await page.keyboard.press("Escape");
  await expect(labels.getByRole("link", { name: "Work" })).toHaveCount(0);
});

test("app bar search is scoped to Contacts and stays in the browser", async ({
  page,
}) => {
  const name = `Quinn Searchtest ${Date.now()}`;
  const leaked: string[] = [];
  page.on("request", (r) => {
    if (r.url().toLowerCase().includes("searchtest")) leaked.push(r.url());
  });
  await createContact(page, name);
  await page.goto("/contacts/");

  // Below 600px the search is an icon that opens the full-screen view; from 600px it expands.
  await page.getByRole("button", { name: "Search contacts" }).click();
  const box = page.getByRole("combobox").locator("visible=true").first();
  await box.fill("searchtest");
  // A LOCAL contact (only in this browser) is found, on the Contacts chip.
  await expect(page.getByRole("option", { name: new RegExp(name) })).toBeVisible();
  await box.press("Enter");

  // Enter: the list pane's "Search results" (Google's), the query in the URL.
  await expect(page).toHaveURL(/\/contacts\/\?q=searchtest/);
  await expect(page.getByRole("heading", { name: "Search results (1)" })).toBeVisible();
  await expect(page.getByRole("link", { name: `Open ${name}` })).toBeVisible();

  // The search itself never asked the server (`/api/search`); only this page's own URL (and the
  // router's data request for it) carries the query.
  expect(leaked.filter((u) => u.includes("/api/"))).toEqual([]);
});
