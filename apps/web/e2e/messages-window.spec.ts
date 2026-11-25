import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The floating Messages window (2026-11-24/25): a contact's "Message" opens it (wide) or the
 * thread's page (below 600px); Escape closes it and focus returns to Message; a message sent in it
 * is kept in the browser (`messages.local`), shows on the thread's page and after a reload, and
 * nothing is posted.
 */
test("Message opens the window; a sent message is kept locally and shows on the page", async ({
  page,
  isMobile,
}) => {
  const posted: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") posted.push(r.url());
  });
  const text = `window test ${Date.now()}`;
  // A bubble's paragraph also holds the screen-reader prefix ("You, 5:21 AM:").
  const bubble = (scope: Page | Locator) => scope.locator("p", { hasText: text });

  await page.goto("/contacts/assistant/");
  const message = page.getByRole("group", { name: "Actions" }).getByRole("button", {
    name: "Message",
  });
  await message.click();

  if (isMobile) {
    // Compact: the thread's own page instead of a window.
    await expect(page).toHaveURL(/\/messages\/assistant\/$/);
  } else {
    const win = page.getByRole("dialog", { name: /Assistant/ });
    await expect(win).toBeVisible();
    // Focus goes to the composer.
    const composer = win.getByRole("textbox", { name: "Write a message" });
    await expect(composer).toBeFocused();
    await composer.fill(text);
    await composer.press("Enter");
    await expect(bubble(win)).toHaveCount(1);
    // Minimize keeps the window, hides its body.
    const min = win.getByRole("button", { name: "Minimize" });
    await min.click();
    await expect(min).toHaveAttribute("aria-expanded", "false");
    await min.click();
    await expect(min).toHaveAttribute("aria-expanded", "true");
    // Escape closes it; focus back on Message.
    await win.getByRole("textbox", { name: "Write a message" }).focus();
    await page.keyboard.press("Escape");
    await expect(win).toBeHidden();
    await expect(message).toBeFocused();
    await page.goto("/messages/assistant/");
  }

  if (isMobile) {
    const composer = page.getByRole("textbox", { name: "Write a message" });
    await composer.fill(text);
    await composer.press("Enter");
  }
  // On the page and after a reload, once.
  await expect(bubble(page)).toHaveCount(1);
  await page.reload();
  await expect(bubble(page)).toHaveCount(1);
  expect(posted).toEqual([]);
});
