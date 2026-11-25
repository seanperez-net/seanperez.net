import { expect, test } from "@playwright/test";

/**
 * Contacts is local-first (memory `local-first-no-sync-on-site`): create, delete, delete forever,
 * all in the browser. No request may carry the contact's data.
 */
test("create, trash and delete a contact without sending it anywhere", async ({ page }) => {
  const name = `Zed Playwright ${Date.now()}`;
  const leaked: string[] = [];
  page.on("request", (r) => {
    const body = r.postData() ?? "";
    if (r.url().includes("Zed%20Playwright") || body.includes("Zed Playwright")) leaked.push(r.url());
  });

  await page.goto("/contacts/new/");
  // Scope to the open editor: the page also holds Contact me's "Name" and hidden dialogs' "Save".
  const editor = page.locator("dialog[open]");
  await editor.getByRole("textbox", { name: /^name/i }).fill(name);
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  // Delete goes back to the list, then says so; wait for that before leaving.
  await expect(page.getByText(`${name} moved to Trash`, { exact: true })).toBeVisible();
  await page.goto("/contacts/trash/");
  await page.getByRole("button", { name: `Delete ${name} forever` }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Delete forever" }).click();
  // Gone from the Trash (the "deleted forever" snackbar also names it: match the row only).
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);

  expect(leaked).toEqual([]);
});
