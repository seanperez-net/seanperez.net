import { expect, test, type Page } from "@playwright/test";

/**
 * The release WIP switch (2026-11-25, `src/demo/wip.ts`, `.claude/notes/release-readiness-2026-11-25.md`).
 * Unfinished features are ON under `pnpm dev` and OFF in every build. This spec checks both:
 *
 * - against a PRODUCTION build (the built Worker, `VITE_WIP` unset):
 *     pnpm --filter @seanperez/web build && pnpm --filter @seanperez/web serve --port 8794
 *     E2E_URL=http://[::1]:8794/ pnpm --filter @seanperez/web test:e2e release-wip --project=webkit
 *   the six are hidden: their routes 404, and no drawer row, FAB or button leads to them;
 * - against `pnpm dev` (the default `E2E_URL`): they are still there, so the dev suite keeps
 *   covering them.
 *
 * Which one is running is read from the server: `/api/dev-mail` answers only under `pnpm dev`
 * (404 in every build, `routes/api/dev-mail/index.ts`).
 */
async function isDevServer(page: Page) {
  const res = await page.request.get("/api/dev-mail?to=nobody@example.com");
  return res.status() === 200;
}

const HIDDEN_ROUTES = [
  "/messages/assistant/",
  "/messages/mentions/",
  "/messages/starred/",
  "/contacts/assistant/",
  "/contacts/other/",
];

test("production build: WIP routes are 404s", async ({ page }) => {
  test.skip(await isDevServer(page), "WIP is on under pnpm dev");
  for (const path of HIDDEN_ROUTES) {
    const res = await page.request.get(path);
    expect(res.status(), path).toBe(404);
  }
});

test("production build: no row, FAB or button leads to a WIP feature", async ({
  page,
}) => {
  test.skip(await isDevServer(page), "WIP is on under pnpm dev");

  // Messages: drawer rows (Shortcuts has Home only, no Apps section), the list, no New chat FAB.
  await page.goto("/messages/");
  const main = page.locator("main");
  await expect(main.getByRole("link", { name: /Sean Perez/ }).first()).toBeVisible();
  for (const href of HIDDEN_ROUTES) {
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "New chat" })).toHaveCount(0);
  await expect(page.getByText("Assistant", { exact: true })).toHaveCount(0);

  // A conversation: no "Search in this conversation" (button or More menu row).
  await page.goto("/messages/sean-perez/");
  await expect(
    page.getByRole("heading", { name: "Sean Perez", level: 2 }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Search in this conversation" }),
  ).toHaveCount(0);
  const more = page.getByRole("button", { name: "More actions" });
  if (await more.isVisible()) {
    await more.click();
    await expect(
      page.getByRole("menuitem", { name: "Search in this conversation" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
  }

  // Sean's contact page: no link to a hidden list or contact, no "To be added." résumé sections.
  // (The Messages window's video call button is gated by the same `DEMO && WIP` expression as
  // the conversation search above; not opened here.)
  await page.goto("/contacts/sean-perez/");
  await expect(page.locator(`a[href="/contacts/other/"]`)).toHaveCount(0);
  await expect(page.locator(`a[href="/contacts/assistant/"]`)).toHaveCount(0);
  await expect(page.getByText("To be added.")).toHaveCount(0);

  // Contacts list: the Assistant and the Apps label are gone.
  await page.goto("/contacts/");
  await expect(page.locator(`a[href="/contacts/sean-perez/"]`).first()).toBeVisible();
  await expect(page.locator(`a[href="/contacts/label/apps/"]`)).toHaveCount(0);
  const apps = await page.request.get("/contacts/label/apps/");
  expect(apps.status()).toBe(404);
});

test("pnpm dev: the WIP features are still there", async ({ page }) => {
  test.skip(!(await isDevServer(page)), "a production build hides them");
  for (const path of HIDDEN_ROUTES) {
    const res = await page.request.get(path);
    expect(res.status(), path).toBe(200);
  }
  await page.goto("/messages/");
  await expect(page.locator('a[href="/messages/assistant/"]').first()).toBeAttached();
  await expect(page.locator('a[href="/messages/mentions/"]').first()).toBeAttached();
  await expect(page.locator('a[href="/contacts/other/"]').first()).toBeAttached();
});
