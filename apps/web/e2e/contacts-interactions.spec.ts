import { expect, test } from "@playwright/test";

/**
 * Recent interactions with Sean (owner 2026-11-25): a message the visitor writes in a
 * conversation Sean is in lands in `messages.local` (`storeMessage`, the same call Contact me
 * makes after a successful Send, `contact-panel.tsx`) and shows on his contact page. Contact me's
 * own Send needs Turnstile and the mail round trip (and Sean's direct thread hands its composer
 * to Contact me), so the message is written in "Site updates", a space he is a member of: the
 * stored record and the card are the same code path.
 */
test("a message in a conversation with Sean shows in his Recent interactions", async ({
  page,
}) => {
  const text = `interaction test ${Date.now()}`;
  await page.goto("/messages/site-updates/");
  const composer = page.getByRole("textbox", { name: "Write a message" });
  await composer.fill(text);
  await composer.press("Enter");
  await expect(page.locator("p", { hasText: text })).toHaveCount(1);

  await page.goto("/contacts/sean-perez/");
  const card = page.getByRole("list", { name: "Recent interactions" });
  await expect(
    card.getByRole("link", { name: new RegExp(`You: ${text} Site updates`) }),
  ).toHaveAttribute("href", "/messages/site-updates/");
});
