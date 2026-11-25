import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

/**
 * The Site updates channel (2026-11-25, `messages/site-updates.ts`): read-only, its messages are
 * the published posts in D1. This adds posts to the LOCAL D1 (the dev server's; never remote),
 * checks each shows in the channel after a reload, newest at the bottom, the unread count, that
 * the composer is a note with no field, and that nothing is POSTed. Its posts are deleted after.
 * Then (2026-11-25) the refresh when the page becomes visible again: a post added while the tab is
 * "hidden" shows after a `visibilitychange`, with no reload, keeping the draft, focus and scroll.
 */
const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
const RUN = Date.now().toString(36);
const SLUGS = [`su-spec-${RUN}-a`, `su-spec-${RUN}-b`, `su-spec-${RUN}-c`];

function d1(sql: string) {
  execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "seanperez-net", "--local", "--command", sql],
    { cwd: APP_DIR, stdio: "pipe" },
  );
}

function addPost(slug: string, title: string, body: string, at: Date) {
  const iso = at.toISOString();
  d1(
    `INSERT INTO post (slug, title, body_md, draft, published_at, updated_at) VALUES ('${slug}', '${title}', '${body}', 0, '${iso}', '${iso}')`,
  );
}

test.afterAll(() => {
  d1(`DELETE FROM post WHERE slug IN (${SLUGS.map((s) => `'${s}'`).join(", ")})`);
});

/** Records every non-GET request to the site (there must be none). */
function watchWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && r.url().includes("5173"))
      writes.push(`${r.method()} ${r.url()}`);
  });
  return writes;
}

const row = (page: Page) =>
  page.locator('[data-chat-conversation="site-updates"]').first();

test("Site updates shows the feed's posts, read-only, newest at the bottom", async ({
  page,
}, info) => {
  const writes = watchWrites(page);
  // Far in the future, so these are the newest posts whatever else the local D1 holds.
  const base = new Date("2099-01-01T10:00:00Z");
  addPost(SLUGS[0], `Spec update A ${RUN}`, "The **first** spec post.", base);

  // A visitor who never opened the channel: only the newest post is unread (1, not all listed).
  await page.goto("/messages/");
  await page.evaluate(() => localStorage.removeItem("spn.v1.siteUpdatesSeen"));
  await page.reload();
  await expect(row(page)).toContainText(`Spec update A ${RUN}`);
  await expect(row(page)).toContainText("1 unread");

  // The channel: the post's card links to it, same tab; the composer is a note, no field.
  await page.goto("/messages/site-updates/");
  const cards = page.locator('[data-chat-embed="internal"]');
  await expect(cards.last()).toHaveAttribute("href", `/feed/${SLUGS[0]}/`);
  await expect(cards.last()).not.toHaveAttribute("target", "_blank");
  await expect(cards.last()).toContainText("The first spec post.");
  const note = page.locator('[data-chat-composer="readonly"]');
  await expect(note).toHaveText(
    "Only Sean posts here. Updates come from the site's feed.",
  );
  await expect(page.locator("[data-chat-composer] textarea")).toHaveCount(0);
  // No send button in the thread (the Contact me panel has its own Send, not counted here).
  await expect(page.locator("[data-chat-composer] button")).toHaveCount(0);
  await expect(page.locator("form[data-chat-composer]")).toHaveCount(0);
  // Opening it saved this device's last-seen time (the newest post shown).
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("spn.v1.siteUpdatesSeen")))
    .toBe(JSON.stringify(base.toISOString()));

  // A new post on the server shows after a reload, at the bottom, unread in the list.
  addPost(
    SLUGS[1],
    `Spec update B ${RUN}`,
    "Newer than A.",
    new Date(base.getTime() + 3600_000),
  );
  await page.goto("/messages/");
  await expect(row(page)).toContainText(`Spec update B ${RUN}`);
  await expect(row(page)).toContainText("1 unread");
  await page.goto("/messages/site-updates/");
  await expect(cards.last()).toHaveAttribute("href", `/feed/${SLUGS[1]}/`);
  await page.screenshot({ path: info.outputPath("site-updates.png") });

  expect(writes).toEqual([]);
});

/** Sets what `document.visibilityState` reports and fires `visibilitychange`, as a tab switch. */
const setVisibility = (page: Page, state: "hidden" | "visible") =>
  page.evaluate((v) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => v,
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => v === "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);

test("a post made while the page is hidden shows when it is visible again", async ({
  page,
}) => {
  const writes = watchWrites(page);
  // The page's clock is Playwright's, so the once-a-minute limit can be passed without waiting.
  await page.clock.install();
  // A conversation open with a draft in its composer (the list is in the DOM, hidden or not).
  await page.goto("/messages/assistant/");
  const composer = page.locator("#messages-composer");
  await composer.fill("A draft that must survive");
  await composer.focus();
  await expect(row(page)).toBeAttached();
  // A mark on this document: a full page load would drop it.
  await page.evaluate(() => ((window as unknown as { suMark: number }).suMark = 1));

  // Hidden: a new post is published meanwhile.
  await setVisibility(page, "hidden");
  const title = `Spec update C ${RUN}`;
  addPost(SLUGS[2], title, "Made while hidden.", new Date("2099-01-01T12:00:00Z"));

  // Visible again within the minute: no refresh yet.
  await setVisibility(page, "visible");
  await page.waitForTimeout(1500);
  await expect(row(page)).not.toContainText(title);

  // Visible again after a minute: the list shows it, unread, with no page load.
  await setVisibility(page, "hidden");
  await page.clock.fastForward(61_000);
  await setVisibility(page, "visible");
  await expect(row(page)).toContainText(title);
  await expect(row(page)).toContainText(/unread/);
  expect(
    await page.evaluate(() => (window as unknown as { suMark?: number }).suMark),
  ).toBe(1);
  // Same URL, the draft kept, focus still in the composer.
  expect(new URL(page.url()).pathname).toBe("/messages/assistant/");
  await expect(composer).toHaveValue("A draft that must survive");
  await expect(composer).toBeFocused();

  expect(writes).toEqual([]);
});
