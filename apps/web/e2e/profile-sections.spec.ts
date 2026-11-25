import { expect, test } from "@playwright/test";
import { saveSections } from "@seanperez/db/profile/profile.server";
import { withLocalD1 } from "./local-d1";

/**
 * The owner's profile SECTIONS on his page (2026-11-25): `profile.sections` in D1
 * (`@seanperez/db` `profile-sections.ts`), drawn as `List.Group` sections (native `<details>`).
 * Writes a test document to the LOCAL D1 through `saveSections` (never remote), then checks:
 * - a `shown` section is open, a `collapsed` one closed, and it opens and closes by click;
 * - hidden sections and entries are NOT in the HTML at all (removed on the server);
 * - print opens every section (`beforeprint`) and puts them back after (`afterprint`);
 * - under print media the collapsed section's rows are visible and the actions row is not.
 * The previous sections are put back after. The site keeps the profile a minute per isolate, so
 * the spec reloads until its marker shows.
 */
const RUN = Date.now().toString(36);
const MARK = `e2e-${RUN}`;
const PAGE = "/contacts/sean-perez/";
let previous: { sections: string | null } | null = null;

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeAll(async () => {
  await withLocalD1(async (db) => {
    previous =
      (await db
        .prepare("SELECT sections FROM profile WHERE id = 1")
        .first<{ sections: string | null }>()) ?? null;
    const saved = await saveSections(db, {
      v: 1,
      sections: [
        {
          id: "e2e-work",
          title: `Work ${MARK}`,
          kind: "work",
          visibility: "shown",
          entries: [
            {
              id: "e2e-work-a",
              visibility: "shown",
              position: "Shown role (e2e)",
              name: "Shown Co",
              startDate: "2018-01",
              endDate: "present",
              highlights: ["Shown highlight (e2e)"],
            },
            {
              id: "e2e-work-b",
              visibility: "hidden",
              position: "SECRET ENTRY (e2e)",
            },
          ],
        },
        {
          id: "e2e-folded",
          title: "Folded (e2e)",
          kind: "work",
          visibility: "collapsed",
          entries: [
            {
              id: "e2e-folded-a",
              visibility: "shown",
              position: "Folded role (e2e)",
            },
          ],
        },
        {
          id: "e2e-secret",
          title: "SECRET SECTION (e2e)",
          kind: "other",
          visibility: "hidden",
          entries: [
            { id: "e2e-secret-a", visibility: "shown", position: "x (e2e)" },
          ],
        },
      ],
    });
    if (!saved.ok) throw new Error(JSON.stringify(saved.issues));
  });
});

test.afterAll(async () => {
  await withLocalD1(async (db) => {
    // Put the sections back (the profile's other fields were never touched).
    await db
      .prepare("UPDATE profile SET sections = ? WHERE id = 1")
      .bind(previous?.sections ?? null)
      .run();
  });
});

test("sections open, collapse, hide and print", async ({ page }) => {
  // Wait out the site's one-minute copy of the profile.
  await expect(async () => {
    await page.goto(PAGE);
    await expect(page.getByText(`Work ${MARK}`)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 90_000, intervals: [5_000] });

  const html = await page.content();
  expect(html).not.toContain("SECRET ENTRY");
  expect(html).not.toContain("SECRET SECTION");

  const work = page.locator("details", { hasText: `Work ${MARK}` });
  const folded = page.locator("details", { hasText: "Folded (e2e)" });
  await expect(work).toHaveAttribute("open", "");
  await expect(page.getByText("Shown highlight (e2e)")).toBeVisible();
  await expect(folded).not.toHaveAttribute("open");
  await expect(page.getByText("Folded role (e2e)")).toBeHidden();

  // Opens and closes by its summary.
  await folded.locator("summary").click();
  await expect(page.getByText("Folded role (e2e)")).toBeVisible();
  await folded.locator("summary").click();
  await expect(page.getByText("Folded role (e2e)")).toBeHidden();

  // Print opens every section, then puts them back.
  const states = await page.evaluate(() => {
    const all = [...document.querySelectorAll("details")];
    const list = all.filter((d) => d.closest("#profile-sections"));
    window.dispatchEvent(new Event("beforeprint"));
    const during = list.map((d) => d.open);
    window.dispatchEvent(new Event("afterprint"));
    return { during, after: list.map((d) => d.open) };
  });
  expect(states.during.every(Boolean)).toBe(true);
  expect(states.after).toContain(false);

  // Paper: the collapsed section's rows show, the actions row does not.
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(page.getByText("Folded role (e2e)")).toBeVisible();
  await expect(page.getByRole("group", { name: "Actions" })).toBeHidden();
});
