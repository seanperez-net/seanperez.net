import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/**
 * Contact accounts and email verification (2026-11-25, `.claude/notes/contact-verify-email-plan-
 * 2026-11-25.md`), end to end on `pnpm dev`: no `RESEND_API_KEY`, so mail goes to the dev console
 * sender, and `/api/dev-mail` (dev only) hands the test what the inbox would get. Turnstile runs
 * with Cloudflare's always-pass TEST keys (`.dev.vars`). Expiry, the 5th wrong code and the send
 * caps are also covered with a moved clock in `scripts/account-test.ts`.
 *
 * Wide only: below 840px Contact me is a sheet. Every address is `e2e-...@example.com`, and those
 * rows are deleted from the LOCAL D1 first, so runs never fill the site-wide daily caps.
 */
test.beforeAll(() => {
  execFileSync(
    "pnpm",
    [
      "wrangler",
      "d1",
      "execute",
      "seanperez-net",
      "--local",
      "--command",
      "DELETE FROM message WHERE email LIKE 'e2e-%@example.com'; " +
        "DELETE FROM verify_token WHERE account_id IN (SELECT id FROM contact_account WHERE email LIKE 'e2e-%@example.com'); " +
        "DELETE FROM contact_session WHERE account_id IN (SELECT id FROM contact_account WHERE email LIKE 'e2e-%@example.com'); " +
        "DELETE FROM contact_account WHERE email LIKE 'e2e-%@example.com';",
    ],
    { cwd: new URL("..", import.meta.url), stdio: "ignore" },
  );
});

const address = (tag: string) => `e2e-${tag}-${Date.now()}@example.com`;

/** `/api/me` as the page's own browser sees it (Playwright's API request context does not send
 * the page's cookies to the `[::1]` host). */
async function me(page: Page) {
  return page.evaluate(async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!/no-store/.test(res.headers.get("cache-control") ?? "")) throw new Error("not no-store");
    return (await res.json()) as { name: string; verified: boolean } | null;
  });
}

async function mail(page: Page, to: string) {
  const res = await page.request.get(`/api/dev-mail?to=${encodeURIComponent(to)}`);
  const body = (await res.json()) as { text: string } | null;
  expect(body).not.toBeNull();
  const code = /code: (\d{6})/.exec(body!.text)?.[1];
  const link = /link: (\S+)/.exec(body!.text)?.[1];
  expect(code).toBeTruthy();
  expect(link).toContain("/verify/?t=");
  return { code: code!, link: link!, text: body!.text };
}

/** Contact me (open on the first load from 840px): fill and send. */
async function sendContact(page: Page, email: string, text: string) {
  await page.goto("/privacy/");
  const aside = page.locator("aside");
  const name = aside.getByRole("textbox", { name: "Name" });
  await expect(async () => {
    await name.fill("E2E Visitor");
    await expect(name).toHaveValue("E2E Visitor", { timeout: 500 });
  }).toPass();
  await aside.getByRole("textbox", { name: "Email" }).fill(email);
  await aside.getByRole("textbox", { name: "Message" }).fill(text);
  await aside.getByRole("button", { name: "Send" }).click();
  await expect(aside.getByRole("textbox", { name: "Code" })).toBeVisible();
  return aside;
}

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, "Contact me is a sheet below 840px");
});

test("first send makes an unverified session; a wrong code fails; the right code verifies", async ({
  page,
}) => {
  const email = address("code");
  const aside = await sendContact(page, email, `hello ${Date.now()}`);
  expect(await me(page)).toEqual({ name: "E2E Visitor", verified: false });
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "spn_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");

  const { code, text } = await mail(page, email);
  // The email never carries the visitor's name or message.
  expect(text).not.toContain("E2E Visitor");
  expect(text).not.toContain("hello");

  const field = aside.getByRole("textbox", { name: "Code" });
  await field.fill(code === "000000" ? "111111" : "000000");
  await aside.getByRole("button", { name: "Confirm" }).click();
  await expect(aside.getByText("That code did not work")).toBeVisible();
  expect((await me(page))?.verified).toBe(false);

  await field.fill(code);
  await aside.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Email confirmed").first()).toBeVisible();
  expect(await me(page)).toEqual({ name: "E2E Visitor", verified: true });
  await expect(aside.getByRole("textbox", { name: "Code" })).toHaveCount(0);

  // A verified send in Sean's thread posts directly: no Contact me, delivered, in /admin.
  const later = `straight to Sean ${Date.now()}`;
  await page.goto("/messages/sean-perez/");
  const composer = page.getByRole("main").getByRole("textbox", { name: "Write a message" });
  await expect(async () => {
    await composer.fill(later);
    await expect(composer).toHaveValue(later, { timeout: 500 });
  }).toPass();
  await composer.press("Enter");
  await expect(page.getByRole("log").getByText(later)).toBeVisible();
  await expect(page.locator("aside").getByRole("textbox", { name: "Message" })).not.toHaveValue(later);
  await page.goto("/admin/messages/?show=verified");
  await expect(page.getByRole("main").getByText(later)).toBeVisible();
});

test("five wrong codes lock the code", async ({ page }) => {
  const email = address("locked");
  const aside = await sendContact(page, email, "locked test");
  const { code } = await mail(page, email);
  const wrong = code === "000000" ? "111111" : "000000";
  const field = aside.getByRole("textbox", { name: "Code" });
  for (let i = 0; i < 5; i++) {
    await field.fill(wrong);
    await aside.getByRole("button", { name: "Confirm" }).click();
    await expect(aside.getByText(i < 4 ? "That code did not work" : "Too many tries")).toBeVisible();
  }
  await field.fill(code);
  await aside.getByRole("button", { name: "Confirm" }).click();
  await expect(aside.getByText("Too many tries")).toBeVisible();
  expect((await me(page))?.verified).toBe(false);
});

test("/verify GET does not verify; Confirm (POST) does, for the sending browser too", async ({
  page,
  browser,
}) => {
  const email = address("link");
  await sendContact(page, email, "link test");
  const { link } = await mail(page, email);

  // Opened in another browser (no session there), as from a phone.
  const other = await browser.newContext();
  const phone = await other.newPage();
  await phone.goto(link);
  await expect(phone.getByText("e***@e***.com")).toBeVisible();
  expect((await me(page))?.verified).toBe(false);
  await phone.reload();
  expect((await me(page))?.verified).toBe(false);

  await phone.getByRole("button", { name: "Confirm" }).click();
  await expect(phone.getByText("Confirmed.")).toBeVisible();
  expect((await me(phone))?.verified).toBe(true);
  expect((await me(page))?.verified).toBe(true);
  await other.close();
});

test("a known address gets the same answer as a new one (no enumeration)", async ({
  page,
  browser,
}) => {
  const email = address("enum");
  const aside = await sendContact(page, email, "first");
  const first = await aside.getByRole("status").first().textContent();

  const other = await browser.newContext();
  const page2 = await other.newPage();
  const aside2 = await sendContact(page2, email, "second, same address");
  const second = await aside2.getByRole("status").first().textContent();
  expect(second).toBe(first);
  // The second browser is NOT signed in as the first: its own unverified session.
  expect((await me(page2))?.verified).toBe(false);
  await other.close();
});

test("an unverified session posts in Sean's thread directly, marked Unverified in /admin", async ({
  page,
}) => {
  const email = address("unverified-thread");
  await sendContact(page, email, "first, from Contact me");
  const later = `unverified to Sean ${Date.now()}`;
  await page.goto("/messages/sean-perez/");
  const composer = page.getByRole("main").getByRole("textbox", { name: "Write a message" });
  await expect(async () => {
    await composer.fill(later);
    await expect(composer).toHaveValue(later, { timeout: 500 });
  }).toPass();
  await composer.press("Enter");
  await expect(page.getByText("Confirm your email so Sean knows it's you.").first()).toBeVisible();
  await page.goto("/admin/messages/?show=unverified");
  await expect(page.getByRole("main").getByText(later)).toBeVisible();
});
