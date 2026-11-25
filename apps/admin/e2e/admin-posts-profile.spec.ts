import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  getProfileForm,
  resetProfile,
} from "@seanperez/db/profile/profile.server";
import { withLocalD1 } from "./local-d1";

/**
 * The admin's writes (2026-11-25; the backend inventory's "not covered" list): the post editor
 * creates a draft, publishes it, edits it and deletes it, and each step is checked on the SITE
 * (Home's loader, `/feed/<slug>/`, `/feed.xml`); and the Profile form's Save persists. Under
 * `pnpm dev:admin` the Access gate is open (dev bypass), as for `admin-accounts.spec.ts`. Both
 * dev servers share apps/web's LOCAL D1. Run it against an admin dev server on its own port:
 *
 *   E2E_ADMIN_URL=http://[::1]:<port>/ (vite --mode ssr --port <port> in apps/admin, started first)
 *
 * The site is `E2E_URL` (default the site's dev server, 5173). Every post this spec makes has an
 * `e2e-` slug and is deleted after; the profile row is put back as it was.
 */
const SITE = process.env.E2E_URL ?? "http://[::1]:5173/";
const RUN = Date.now().toString(36);
const site = (path: string) => new URL(path, SITE).href;

/** What the site shows for a slug: the post page's status, Home and the Atom feed. */
async function onSite(request: APIRequestContext, slug: string) {
  const [page, home, feed] = await Promise.all([
    request.get(site(`/feed/${slug}/`)),
    request.get(site("/")),
    request.get(site("/feed.xml")),
  ]);
  return {
    status: page.status(),
    body: await page.text(),
    home: await home.text(),
    feed: await feed.text(),
  };
}

test.describe("post editor", () => {
  const slug = `e2e-admin-post-${RUN}`;

  test.afterAll(async () => {
    // Only if the test failed before its own Delete.
    await withLocalD1((db) =>
      db.prepare("DELETE FROM post WHERE slug LIKE ?").bind(`e2e-admin-post-${RUN}%`).run(),
    );
  });

  test("creates a draft, publishes, edits and deletes a post; the site follows", async ({
    page,
    request,
  }) => {
    const title = `E2E admin post ${RUN}`;
    const main = page.getByRole("main");

    // New post, saved as a draft: it moves to its own URL.
    await page.goto("/new/");
    await expect(main.getByRole("heading", { name: "New post" })).toBeVisible();
    await main.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    await main.getByLabel("Slug", { exact: true }).fill(slug);
    await main.getByLabel("Body (Markdown)").fill("First **draft** body.");
    await main.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/\/\d+\/$/);
    const editorUrl = page.url();
    await expect(main.getByRole("heading", { name: "Edit post" })).toBeVisible();
    await expect(main).toContainText("Draft · edited");
    await expect(main.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(title);

    // The admin list shows it as a draft.
    await page.goto("/");
    await expect(main.getByRole("link", { name: new RegExp(title) })).toContainText(
      "Draft",
    );

    // A draft is not on the site.
    let seen = await onSite(request, slug);
    expect(seen.status).toBe(404);
    expect(seen.home).not.toContain(slug);
    expect(seen.feed).not.toContain(slug);

    // Publish.
    await page.goto(editorUrl);
    await main.getByRole("button", { name: "Publish" }).click();
    await expect(main.getByRole("status")).toHaveText("Published.");
    await page.reload();
    await expect(main.getByRole("button", { name: "Update" })).toBeVisible();
    await expect(main.getByRole("button", { name: "Unpublish" })).toBeVisible();
    seen = await onSite(request, slug);
    expect(seen.status).toBe(200);
    expect(seen.body).toContain(title);
    expect(seen.body).toContain("<strong>draft</strong>");
    expect(seen.home).toContain(`/feed/${slug}/`);
    expect(seen.feed).toContain(`https://seanperez.net/feed/${slug}/`);

    // Edit while published: the site shows the new title and body.
    const edited = `${title} (edited)`;
    await main.getByRole("textbox", { name: "Title", exact: true }).fill(edited);
    await main.getByLabel("Body (Markdown)").fill("Edited *body*.");
    await main.getByRole("button", { name: "Update" }).click();
    await expect(main.getByRole("status")).toHaveText("Published.");
    seen = await onSite(request, slug);
    expect(seen.status).toBe(200);
    expect(seen.body).toContain(edited);
    expect(seen.body).toContain("<em>body</em>");
    expect(seen.feed).toContain(edited);

    // Delete, confirmed in the dialog: back to the list, gone from the site.
    await page.reload();
    await main.getByRole("button", { name: "Delete post" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete this post?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    // The list's own URL (the editor's `/<id>/` also ends in a slash).
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expect(page.getByRole("main").getByText(edited)).toHaveCount(0);
    expect((await page.goto(editorUrl))?.status()).toBe(404);
    seen = await onSite(request, slug);
    expect(seen.status).toBe(404);
    expect(seen.home).not.toContain(slug);
    expect(seen.feed).not.toContain(slug);
  });
});

test.describe("profile", () => {
  /** The row as it was before this spec (null: no row), put back after. */
  let backup: Record<string, unknown> | null = null;

  test.beforeAll(async () => {
    backup = await withLocalD1((db) =>
      db.prepare("SELECT * FROM profile WHERE id = 1").first<Record<string, unknown>>(),
    );
  });

  test.afterAll(async () => {
    await withLocalD1(async (db) => {
      if (!backup) return resetProfile(db);
      const cols = Object.keys(backup);
      await db
        .prepare(
          `INSERT OR REPLACE INTO profile (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
        )
        .bind(...cols.map((c) => backup![c]))
        .run();
    });
  });

  test("Save persists the fields after a reload and in D1", async ({ page }) => {
    const headline = `e2e-headline-${RUN}`;
    const location = `e2e-location-${RUN}`;
    const main = page.getByRole("main");
    await page.goto("/profile/");
    await expect(main.getByRole("heading", { name: "Profile" })).toBeVisible();
    await main.getByLabel("Headline", { exact: true }).fill(headline);
    await main.getByLabel("Location", { exact: true }).fill(location);
    await main.getByRole("button", { name: "Save", exact: true }).click();
    await expect(main.getByRole("status")).toContainText("Saved.");

    await page.reload();
    await expect(main.getByLabel("Headline", { exact: true })).toHaveValue(headline);
    await expect(main.getByLabel("Location", { exact: true })).toHaveValue(location);
    await expect(main).toContainText(/Saved \w/);

    const form = await withLocalD1((db) => getProfileForm(db));
    expect(form.headline).toBe(headline);
    expect(form.location).toBe(location);
    expect(form.updatedAt).toBeTruthy();
  });
});
