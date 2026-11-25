import { expect, test, type Page } from "@playwright/test";

/**
 * The Contacts list's row actions (owner 2026-11-25, `List.Item actions`): Star, Edit and More
 * BESIDE each row's link (never inside it), hidden by opacity until the row is hovered or holds
 * focus (always shown on touch), and only the focused row's controls in the tab order. All local, a fresh
 * browser context per test. "Last edited" (`editedAt`) is `contacts-history-profile.spec.ts`.
 */

async function createContact(page: Page, name: string) {
  await page.goto("/contacts/new/");
  const editor = page.locator("dialog[open]");
  await editor.getByRole("textbox", { name: /^name/i }).fill(name);
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

test("row actions: beside the link, shown on focus, star and More > Delete", async ({
  page,
  isMobile,
}) => {
  const name = `Row Actions ${Date.now()}`;
  await createContact(page, name);
  await page.goto("/contacts/");
  const row = page.locator("li[data-contact-id^='local/']", { hasText: name });
  const strip = row.locator("[data-list-item-actions]");
  // Siblings of the link, never inside it.
  await expect(row.locator("a [data-list-item-actions]")).toHaveCount(0);
  await expect(row.locator(":scope > a")).toHaveCount(1);
  const star = strip.getByRole("button", { name: `Add ${name} to favorites` });
  const edit = strip.getByRole("link", { name: `Edit ${name}` });
  await expect(edit).toHaveAttribute("href", /\/contacts\/local\/[^/]+\/\?edit$/);

  if (!isMobile) {
    // Hidden by opacity (still in the accessibility tree) until the row holds focus.
    await expect(strip).toHaveCSS("opacity", "0");
    await row.focus();
    await expect(strip).toHaveCSS("opacity", "1");
  } else {
    // Touch: always shown.
    await expect(strip).toHaveCSS("opacity", "1");
  }

  // Star from the row: the row's link is not followed.
  const url = page.url();
  await star.click();
  await expect(
    strip.getByRole("button", { name: `Remove ${name} from favorites` }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(page.url()).toBe(url);

  // More > Delete moves it to the Trash, with Undo.
  await row.focus();
  await strip.getByRole("button", { name: `More actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(
    page.getByText(`${name} moved to Trash`, { exact: true }),
  ).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("row actions: only the focused row's controls are Tab stops", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "keyboard");
  await page.goto("/contacts/");
  const rows = page.locator("li[data-contact-id]");
  await expect(rows.first()).toBeVisible();
  await rows.first().focus();
  const first = rows.first().locator("[data-list-item-actions] button").first();
  const second = rows.nth(1).locator("[data-list-item-actions] button").first();
  await expect(first).not.toHaveAttribute("tabindex", "-1");
  await expect(second).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("ArrowDown");
  await expect(second).not.toHaveAttribute("tabindex", "-1");
  await expect(first).toHaveAttribute("tabindex", "-1");
});
