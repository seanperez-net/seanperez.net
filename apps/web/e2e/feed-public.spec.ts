import { expect, test } from "@playwright/test";
import { deletePost, savePost } from "@seanperez/db/feed/posts.server";
import { withLocalD1 } from "./local-d1";

/**
 * The public feed and a static endpoint (2026-11-25; the backend inventory's "not covered"
 * list): `/feed.xml` (Atom 1.0), `/feed/<slug>/`, Home's list of posts and
 * `/.well-known/security.txt`. One published post and one draft are written into the LOCAL D1 the
 * dev server reads (never remote) through `savePost` (`./local-d1.ts`), with `e2e-` slugs unique
 * to this run and project, and deleted after.
 */
const RUN = Date.now().toString(36);
/** Far in the future, so the post is the newest whatever else the local D1 holds. */
const PUBLISHED_AT = "2099-06-01T10:00:00.000Z";

/** This run's posts; set in beforeAll (the project name keeps webkit and iphone apart). */
let pub = { id: 0, slug: "", title: "" };
let draft = { id: 0, slug: "", title: "" };

test.beforeAll(async ({}, info) => {
  const tag = `${RUN}-${info.project.name}`;
  pub = { id: 0, slug: `e2e-feed-${tag}-pub`, title: `E2E feed post ${tag}` };
  draft = { id: 0, slug: `e2e-feed-${tag}-draft`, title: `E2E feed draft ${tag}` };
  await withLocalD1(async (db) => {
    const a = await savePost(db, {
      title: pub.title,
      slug: pub.slug,
      body_md: "Hello **bold** world & <friends>.",
      publish: true,
    });
    const b = await savePost(db, {
      title: draft.title,
      slug: draft.slug,
      body_md: "Not yet.",
      publish: false,
    });
    if (typeof a !== "number" || typeof b !== "number") throw new Error("slug taken");
    pub.id = a;
    draft.id = b;
    // A fixed date to check in the feed (savePost stamps "now").
    await db
      .prepare("UPDATE post SET published_at = ? WHERE id = ?")
      .bind(PUBLISHED_AT, a)
      .run();
  });
});

test.afterAll(async () => {
  await withLocalD1(async (db) => {
    for (const id of [pub.id, draft.id]) if (id) await deletePost(db, id);
  });
});

test("/feed.xml is a well-formed Atom feed with the published post and without the draft", async ({
  page,
  request,
}) => {
  const res = await request.get("/feed.xml");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/atom+xml; charset=utf-8");
  const xml = await res.text();

  // Parsed by the browser's XML parser: no parse error, the Atom namespace, the required parts.
  await page.goto("about:blank");
  const feed = await page.evaluate(
    ({ text, slug }) => {
      const doc = new DOMParser().parseFromString(text, "application/xml");
      if (doc.getElementsByTagName("parsererror").length) return null;
      const ns = "http://www.w3.org/2005/Atom";
      const root = doc.documentElement;
      const entries = [...root.getElementsByTagNameNS(ns, "entry")];
      const entry = entries.find(
        (e) => e.getElementsByTagNameNS(ns, "id")[0]?.textContent ===
          `https://seanperez.net/feed/${slug}/`,
      );
      const child = (el: Element, name: string) =>
        el.getElementsByTagNameNS(ns, name)[0]?.textContent ?? null;
      return {
        root: root.localName,
        ns: root.namespaceURI,
        id: child(root, "id"),
        title: child(root, "title"),
        updated: child(root, "updated"),
        author: child(root, "name"),
        titles: entries.map((e) => child(e, "title")),
        entry: entry && {
          title: child(entry, "title"),
          published: child(entry, "published"),
          updated: child(entry, "updated"),
          content: child(entry, "content"),
          contentType: entry.getElementsByTagNameNS(ns, "content")[0]?.getAttribute("type"),
          link: entry.getElementsByTagNameNS(ns, "link")[0]?.getAttribute("href"),
        },
      };
    },
    { text: xml, slug: pub.slug },
  );
  expect(feed).not.toBeNull();
  expect(feed!.root).toBe("feed");
  expect(feed!.ns).toBe("http://www.w3.org/2005/Atom");
  expect(feed!.id).toBe("https://seanperez.net/feed/");
  expect(feed!.title).toBeTruthy();
  expect(feed!.author).toBeTruthy();
  expect(Number.isNaN(Date.parse(feed!.updated ?? ""))).toBe(false);
  expect(feed!.entry).toBeTruthy();
  expect(feed!.entry!.title).toBe(pub.title);
  expect(feed!.entry!.published).toBe(PUBLISHED_AT);
  expect(feed!.entry!.link).toBe(`https://seanperez.net/feed/${pub.slug}/`);
  expect(feed!.entry!.contentType).toBe("html");
  // The rendered markdown, escaped once in the XML, so the parsed text is the HTML.
  expect(feed!.entry!.content).toContain("<strong>bold</strong>");
  expect(feed!.entry!.content).not.toContain("<friends>");
  expect(feed!.titles).not.toContain(draft.title);
  expect(xml).not.toContain(draft.slug);
});

test("/feed/<slug>/ renders a published post; a draft and an unknown slug are 404", async ({
  page,
}) => {
  const res = await page.goto(`/feed/${pub.slug}/`);
  expect(res?.status()).toBe(200);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: pub.title })).toBeVisible();
  await expect(main.locator("article strong")).toHaveText("bold");
  await expect(main.locator("article")).toContainText("Hello bold world & <friends>.");
  // The raw HTML in the body is text, never an element.
  await expect(main.locator("article friends")).toHaveCount(0);
  await expect(page).toHaveTitle(new RegExp(pub.title));

  expect((await page.goto(`/feed/${draft.slug}/`))?.status()).toBe(404);
  expect((await page.goto(`/feed/e2e-feed-${RUN}-unknown/`))?.status()).toBe(404);
});

test("Home lists the published post, not the draft, and links to it", async ({
  page,
}) => {
  await page.goto("/");
  const posts = page.getByRole("list", { name: "Posts" });
  const link = posts.getByRole("link", { name: new RegExp(pub.title) });
  await expect(link).toHaveAttribute("href", `/feed/${pub.slug}/`);
  await expect(posts).not.toContainText(draft.title);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/feed/${pub.slug}/$`));
  await expect(
    page.getByRole("main").getByRole("heading", { name: pub.title }),
  ).toBeVisible();
});

test("/.well-known/security.txt is text/plain with Contact and a future Expires", async ({
  request,
}) => {
  const res = await request.get("/.well-known/security.txt");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toMatch(/^text\/plain\b/);
  const text = await res.text();
  expect(text).toMatch(/^Contact: https:\/\/\S+$/m);
  const expires = /^Expires: (\S+)$/m.exec(text)?.[1];
  expect(expires).toBeTruthy();
  expect(Date.parse(expires!)).toBeGreaterThan(Date.now());
  // No email anywhere (owner, 2026-11-24).
  expect(text).not.toMatch(/mailto:|@seanperez\.net/);
});
