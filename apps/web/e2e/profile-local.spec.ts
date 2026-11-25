import { expect, test, type Page } from "@playwright/test";

/**
 * The visitor's own profile edit (2026-11-24, owner: "yes ... save profile locally"): Save on
 * `/profile/` keeps the changed fields in THEIR browser (`profile.local` through the shared seam),
 * the account menu and Messages show them, a second tab agrees, Reset has Undo, Contact me keeps
 * the real owner, and nothing is posted. Since 2026-11-25 the visitor is a GUEST ("You",
 * `visitor-is-guest-you`): the edit renames the guest, never the owner, whose contact keeps his
 * real name.
 */
const NAME = "Ada Visitor";
const trigger = (page: Page) => page.locator('[aria-label^="Account:"]').first();

async function editName(page: Page, name: string) {
  await page.getByRole("button", { name: "Edit profile" }).click();
  const field = page.getByRole("dialog").getByRole("textbox", { name: "Name" });
  // The dialog focuses Name when it opens; on a cold dev server its code may still be loading,
  // so fill until the value holds.
  await expect(field).toBeFocused();
  await expect(async () => {
    await field.fill(name);
    await expect(field).toHaveValue(name, { timeout: 500 });
  }).toPass();
  // Enter submits the form at every width (the dialog's Save moves between bar and footer).
  await field.press("Enter");
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("save locally, reload, a second tab, reset with Undo, nothing sent", async ({
  page,
  context,
}) => {
  const sent: string[] = [];
  context.on("request", (r) => {
    if (r.method() !== "GET") sent.push(`${r.method()} ${r.url()}`);
  });

  await page.goto("/profile/");
  await expect(page.locator("#profile-name")).toHaveText("You");
  await editName(page, NAME);
  await expect(page.getByText("Profile saved on this device. Only you see it.", { exact: true })).toBeVisible();
  await expect(page.locator("#profile-name")).toHaveText(NAME);
  await expect(trigger(page)).toHaveAttribute("aria-label", new RegExp(`^Account: ${NAME},`));

  // A reload reads it back; a second tab shows it in Messages (self thread).
  await page.reload();
  await expect(page.locator("#profile-name")).toHaveText(NAME);
  const second = await context.newPage();
  await second.goto("/messages/you/");
  await expect(second.getByRole("heading", { name: `${NAME} (you)` })).toBeVisible();
  // Contact me still shows the real owner's links (never the visitor's profile).
  await expect(second.locator('aside a[href="https://github.com/seanperez-net"]').first()).toBeAttached();

  // Reset to the original, then Undo; the other tab follows both.
  await page.getByRole("button", { name: "Reset to the original" }).click();
  await expect(page.locator("#profile-name")).toHaveText("You");
  await expect(trigger(second)).toHaveAttribute("aria-label", /^Account: You,/);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#profile-name")).toHaveText(NAME);
  await expect(trigger(second)).toHaveAttribute("aria-label", new RegExp(`^Account: ${NAME},`));

  // The owner's contact is still HIS (the guest's edit never lands there).
  await second.goto("/contacts/sean-perez/");
  await expect(second.getByRole("heading", { name: "Sean Perez" }).first()).toBeAttached();
  await expect(second.locator("main").getByText(NAME)).toHaveCount(0);

  // Clean up: back to the original (every Playwright context starts empty anyway).
  await page.getByRole("button", { name: "Reset to the original" }).click();
  await expect(page.locator("#profile-name")).toHaveText("You");

  expect(sent).toEqual([]);
});

test("a corrupt stored profile falls back to the guest profile", async ({ page }) => {
  await page.goto("/profile/");
  // Write a doc that fails the schema (an unknown key) where the seam keeps it (IndexedDB in
  // WebKit here: no usable OPFS), then reload.
  await page.evaluate(async () => {
    const bad = JSON.stringify({ v: 1, fields: { name: "Hacked", email: "x@y.z" }, updatedAt: 1 });
    try {
      const root = await navigator.storage.getDirectory();
      const h = await root.getFileHandle("spn.v1.profile.local.json", { create: true });
      const w = await (h as FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }).createWritable();
      await w.write(bad);
      await w.close();
      return;
    } catch {
      // no OPFS writer: IndexedDB below
    }
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("spn.v1", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("docs");
      req.onsuccess = () => {
        const tx = req.result.transaction("docs", "readwrite");
        tx.objectStore("docs").put(bad, "profile.local");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  await page.reload();
  // Wait for resume (the presence glyph is corrected on qinit), then check.
  await page.waitForTimeout(1500);
  await expect(page.locator("#profile-name")).toHaveText("You");
  await expect(page.getByRole("button", { name: "Reset to the original" })).toHaveCount(0);
});
