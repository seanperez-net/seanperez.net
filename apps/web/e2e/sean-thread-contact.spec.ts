import { expect, test } from "@playwright/test";

/**
 * A message to Sean goes through Contact me (owner, 2026-11-25: "when trying to send a message to
 * me and not logged in ... it should pop that contact me window and ... auto focus the name").
 * Sending in his thread moves the text into Contact me's Message field, opens Contact me and
 * focuses Name; nothing is posted and no "Not sent" bubble is left in the thread. Wide only:
 * below 840px Contact me is a sheet (covered by the window spec's iPhone run for the thread).
 */
test("Send in Sean's thread opens Contact me with Name focused", async ({ page, isMobile }) => {
  test.skip(isMobile, "Contact me is a sheet below 840px");
  const posted: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") posted.push(r.url());
  });
  const text = `to Sean ${Date.now()}`;

  await page.goto("/messages/sean-perez/");
  const composer = page.getByRole("main").getByRole("textbox", { name: "Write a message" });
  await expect(async () => {
    await composer.fill(text);
    await expect(composer).toHaveValue(text, { timeout: 500 });
  }).toPass();
  await composer.press("Enter");

  const aside = page.locator("aside");
  await expect(aside.getByRole("textbox", { name: "Name" })).toBeFocused();
  await expect(aside.getByRole("textbox", { name: "Message" })).toHaveValue(text);
  await expect(page.getByRole("log").locator("p", { hasText: text })).toHaveCount(0);

  // Kept as Contact me's draft: still there after a reload.
  await page.reload();
  await expect(aside.getByRole("textbox", { name: "Message" })).toHaveValue(text);
  expect(posted).toEqual([]);
});
