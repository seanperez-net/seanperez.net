import { expect, test, type Page } from "@playwright/test";

/**
 * Accent-folded site search (2026-11-25, owner on accents: "Both now";
 * `.claude/notes/local-search-orama-opfs-2026-11-25.md` "Round 2"):
 * - the app bar search finds the visitor's LOCAL contact on any route (not only /contacts/*),
 *   typed without accents, and never sends it to the server;
 * - it finds a published post whose title has accents ("Résumé") when typed without them
 *   (the post's folded columns, written by the admin's save).
 * Creates its own contact (in this browser) and post (admin, local D1) and deletes both.
 * The admin dev server: `E2E_ADMIN_URL` (`pnpm --filter @seanperez/admin dev --port <n>`).
 */
const ADMIN = process.env.E2E_ADMIN_URL ?? "http://[::1]:5180/";

async function openSearch(page: Page) {
  // Below 600px an icon opens the full-screen view; from 600px the bar expands.
  await page.getByRole("button", { name: "Search the site" }).click();
  return page.getByRole("combobox").locator("visible=true").first();
}

test("app bar search folds accents for local contacts and posts", async ({
  page,
}) => {
  const stamp = Date.now().toString(36);
  const contact = `José García ${stamp}`;
  const title = `Mon Résumé ${stamp}`;
  const leaked: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/") && r.url().includes("contacts"))
      leaked.push(r.url());
  });

  // The post, published from the admin (same local D1 as the site).
  await page.goto(new URL("new/", ADMIN).href);
  await page.getByRole("textbox", { name: /^title/i }).fill(title);
  await page.getByRole("textbox", { name: /^body/i }).fill("Travail à Paris.");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/\d+\/$/);
  const postUrl = page.url();

  try {
    // The contact, only in this browser.
    await page.goto("/contacts/new/");
    const editor = page.locator("dialog[open]");
    await editor.getByRole("textbox", { name: /^name/i }).fill(contact);
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: contact })).toBeVisible();

    // Home, not Contacts: the site-wide search still has the visitor's contacts.
    await page.goto("/");
    const box = await openSearch(page);
    await box.fill(`garcia ${stamp}`);
    await expect(
      page.getByRole("option", { name: new RegExp(contact) }),
    ).toBeVisible();

    await box.fill(`resume ${stamp}`);
    await expect(
      page.getByRole("option", { name: new RegExp(title) }),
    ).toBeVisible();

    // The Contacts chip is matched in the browser only.
    await box.fill(`garcia ${stamp}`);
    await page.getByRole("button", { name: "Contacts", exact: true }).click();
    await expect(
      page.getByRole("option", { name: new RegExp(contact) }),
    ).toBeVisible();
    // Past the 200 ms debounce: a request would have gone by now.
    await page.waitForTimeout(600);
    expect(leaked).toEqual([]);

    // /search/ adds the visitor's own contacts after load.
    await page.goto(`/search/?q=${encodeURIComponent(`garcia ${stamp}`)}`);
    await expect(
      page.getByRole("heading", { name: "Your contacts (1)" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(contact) })).toBeVisible();
  } finally {
    // Clean up: the contact (Trash, then forever) and the post.
    await page.goto("/contacts/");
    const open = page.getByRole("link", { name: `Open ${contact}` });
    if (await open.count()) {
      await open.click();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(
        page.getByText(`${contact} moved to Trash`, { exact: true }),
      ).toBeVisible();
      await page.goto("/contacts/trash/");
      await page
        .getByRole("button", { name: `Delete ${contact} forever` })
        .click();
      await page
        .locator("dialog[open]")
        .getByRole("button", { name: "Delete forever" })
        .click();
      await expect(page.getByText(contact, { exact: true })).toHaveCount(0);
    }
    await page.goto(postUrl);
    await page.getByRole("button", { name: "Delete post" }).click();
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page).toHaveURL(new URL("/", ADMIN).href);
  }
});
