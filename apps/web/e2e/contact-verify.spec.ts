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

/** The dev outbox's last mail to `to`. Polled: since 2026-11-25 the verification email goes out
 * AFTER the response (`waitUntil`), so it can land a moment later. `after`: a mail other than
 * this text (a resend). */
async function mail(page: Page, to: string, after?: string) {
  let body: { text: string } | null = null;
  await expect
    .poll(async () => {
      const res = await page.request.get(`/api/dev-mail?to=${encodeURIComponent(to)}`);
      body = (await res.json()) as { text: string } | null;
      return !!body && body.text !== after;
    })
    .toBe(true);
  body = body as { text: string } | null;
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
  // Unverified: no name from the server (the account may be someone else's, RULE 2 2026-11-25).
  expect(await me(page)).toEqual({ name: "", verified: false });
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
  // Verified: no security check is drawn.
  await expect(page.getByRole("form", { name: "Security check" })).toHaveCount(0);
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

test("/verify GET does not verify; Confirm (POST) confirms the opening browser only", async ({
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
  // The browser that ASKED is not upgraded by the link (it may be a stranger's): it types the code.
  expect((await me(page))?.verified).toBe(false);
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

test("an unverified session posts in Sean's thread after the security check, marked Unverified in /admin", async ({
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
  // Unverified: the security check is drawn (Turnstile's always-pass TEST key) and its token
  // goes with the send.
  await expect(page.getByRole("form", { name: "Security check" })).toHaveCount(1);
  await composer.press("Enter");
  await expect(page.getByText("Confirm your email so Sean knows it's you.").first()).toBeVisible();
  await page.goto("/admin/messages/?show=unverified");
  await expect(page.getByRole("main").getByText(later)).toBeVisible();
});

test("an unverified session's send in Sean's thread without a security-check token is refused", async ({
  page,
}) => {
  const email = address("unverified-no-token");
  await sendContact(page, email, "first, from Contact me");
  await page.goto("/messages/sean-perez/");
  const check = page.getByRole("form", { name: "Security check" });
  await expect(check).toHaveCount(1);
  // As a script posting without the widget would: no widget, no token.
  await check.evaluate((form) => {
    form.querySelector("[data-qds-turnstile]")?.remove();
    form.querySelector('[name="cf-turnstile-response"]')?.remove();
  });
  const text = `no token ${Date.now()}`;
  const composer = page.getByRole("main").getByRole("textbox", { name: "Write a message" });
  await expect(async () => {
    await composer.fill(text);
    await expect(composer).toHaveValue(text, { timeout: 500 });
  }).toPass();
  await composer.press("Enter");
  await expect(page.getByText("Please complete the security check").first()).toBeVisible();
  await page.goto("/admin/messages/?show=unverified");
  await expect(page.getByRole("main").getByText(text)).toHaveCount(0);
});

test("Send the email again: a new code arrives (in the background) and the newest one works", async ({
  page,
}) => {
  const email = address("resend");
  const aside = await sendContact(page, email, "resend test");
  const first = await mail(page, email);
  // The send gap is 60 s (`SEND_GAP_MS`): move the first token back instead of waiting.
  execFileSync(
    "pnpm",
    [
      "wrangler",
      "d1",
      "execute",
      "seanperez-net",
      "--local",
      "--command",
      `UPDATE verify_token SET created_at = '2000-01-01T00:00:00.000Z' WHERE account_id = (SELECT id FROM contact_account WHERE email = '${email}');`,
    ],
    { cwd: new URL("..", import.meta.url), stdio: "ignore" },
  );
  await aside.getByRole("button", { name: "Send the email again" }).click();
  await expect(aside.getByText("A new email is on its way.")).toBeVisible();
  const second = await mail(page, email, first.text);
  expect(second.code === first.code && second.link === first.link).toBe(false);
  await aside.getByRole("textbox", { name: "Code" }).fill(second.code);
  await aside.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Email confirmed").first()).toBeVisible();
});

test("Delete my account on /profile/: confirm, signed out, its messages gone from /admin", async ({
  page,
}) => {
  const email = address("self-delete");
  const text = `delete me ${Date.now()}`;
  const aside = await sendContact(page, email, text);
  const { code } = await mail(page, email);
  await aside.getByRole("textbox", { name: "Code" }).fill(code);
  await aside.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Email confirmed").first()).toBeVisible();

  await page.goto("/profile/");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Your account" })).toBeVisible();
  await main.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete your account?" });
  await expect(dialog).toBeVisible();
  // Cancel keeps it.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect((await me(page))?.verified).toBe(true);

  await main.getByRole("button", { name: "Delete my account" }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Account deleted").first()).toBeVisible();
  await expect(main.getByRole("heading", { name: "Your account" })).toHaveCount(0);
  expect(await me(page)).toBeNull();
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "spn_session")).toBeUndefined();

  await page.goto("/admin/messages/");
  await expect(page.getByRole("main").getByText(text)).toHaveCount(0);
  await page.goto("/admin/accounts/");
  await expect(page.getByRole("main").getByText(email)).toHaveCount(0);
});

test("Delete my account: an unverified browser gets no Delete and no name (the server refusal: account-test.ts)", async ({
  page,
  browser,
}) => {
  const email = address("delete-verified");
  const aside = await sendContact(page, email, "the real owner");
  const { code } = await mail(page, email);
  await aside.getByRole("textbox", { name: "Code" }).fill(code);
  await aside.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Email confirmed").first()).toBeVisible();

  // A stranger types the same address in another browser: an unverified session on it. It is
  // not told the owner's name, and it cannot delete.
  const other = await browser.newContext();
  const stranger = await other.newPage();
  await sendContact(stranger, email, "a stranger");
  expect(await me(stranger)).toEqual({ name: "", verified: false });
  await stranger.goto("/profile/");
  const main = stranger.getByRole("main");
  await expect(main.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(main.getByText("Email not confirmed yet.")).toBeVisible();
  await expect(main.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
  await other.close();
  expect((await me(page))?.verified).toBe(true);
  await page.goto("/admin/accounts/");
  await expect(page.getByRole("main").getByText(email)).toBeVisible();
});

test("/privacy/ explains self-delete with a link to Profile", async ({ page }) => {
  await page.goto("/privacy/");
  const main = page.getByRole("main");
  await expect(main.getByText("Delete my account")).toBeVisible();
  await expect(main.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile/");
});

// --- 2026-11-25 security review gaps -------------------------------------------------------------

/** One SQL statement on the LOCAL D1 (test setup only). */
function localSql(command: string) {
  execFileSync("pnpm", ["wrangler", "d1", "execute", "seanperez-net", "--local", "--command", command], {
    cwd: new URL("..", import.meta.url),
    stdio: "ignore",
  });
}

test("confirming confirms only this browser's messages: a stranger's, same address, stays unverified", async ({
  page,
  browser,
}) => {
  const email = address("stranger-wait");
  const mine = `owner's own ${Date.now()}`;
  const theirs = `stranger's ${Date.now()}`;
  const aside = await sendContact(page, email, mine);
  const { code } = await mail(page, email);

  // A stranger types the same address in another browser (its email is held back by the 60 s
  // gap, so the owner's code stays the latest).
  const other = await browser.newContext();
  const stranger = await other.newPage();
  await sendContact(stranger, email, theirs);

  await aside.getByRole("textbox", { name: "Code" }).fill(code);
  await aside.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Email confirmed").first()).toBeVisible();
  expect((await me(stranger))?.verified).toBe(false);
  await other.close();

  await page.goto("/admin/messages/?show=verified");
  await expect(page.getByRole("main").getByText(mine)).toBeVisible();
  await expect(page.getByRole("main").getByText(theirs)).toHaveCount(0);
  await page.goto("/admin/messages/?show=unverified");
  await expect(page.getByRole("main").getByText(theirs)).toBeVisible();
});

test("Send the email again without a security-check token is refused (Turnstile is on here)", async ({
  page,
}) => {
  const email = address("resend-no-token");
  const aside = await sendContact(page, email, "resend without a token");
  const first = await mail(page, email);
  localSql(
    `UPDATE verify_token SET created_at = '2000-01-01T00:00:00.000Z' WHERE account_id = (SELECT id FROM contact_account WHERE email = '${email}');`,
  );
  // As a script posting without the widget would: no widget, no token.
  const resendForm = aside.locator('form:has([data-action="resend"])');
  await expect(resendForm).toHaveCount(1);
  await resendForm.evaluate((form) => {
    form.querySelector("[data-qds-turnstile]")?.remove();
    form.querySelector('[name="cf-turnstile-response"]')?.remove();
  });
  await aside.getByRole("button", { name: "Send the email again" }).click();
  await expect(aside.getByText("Please complete the security check")).toBeVisible();
  await expect(aside.getByText("A new email is on its way.")).toHaveCount(0);
  // No second email: the last one is still the first.
  const last = await page.request.get(`/api/dev-mail?to=${encodeURIComponent(email)}`);
  expect(((await last.json()) as { text: string }).text).toBe(first.text);
});

test("each form's security check has its own Turnstile action (the server-side mismatch: account-test.ts)", async ({
  page,
}) => {
  // Cloudflare's TEST secret returns no `action`, so a mismatch can only be refused end to end
  // with real keys; here the widgets are checked to ask for their own action.
  const aside = await sendContact(page, address("actions"), "actions");
  await expect(aside.locator('[data-qds-turnstile][data-action="resend"]')).toHaveCount(1);
  // The form closes after a send (owner, 2026-11-25); "Write another message" brings it back.
  await expect(aside.getByRole("textbox", { name: "Message" })).toHaveCount(0);
  await aside.getByRole("button", { name: "Write another message" }).click();
  await expect(aside.locator('[data-qds-turnstile][data-action="contact"]')).toHaveCount(1);
  await expect(aside.getByRole("textbox", { name: "Name" })).toBeFocused();
  await page.goto("/messages/sean-perez/");
  await expect(
    page.getByRole("form", { name: "Security check" }).locator('[data-qds-turnstile][data-action="message"]'),
  ).toHaveCount(1);
});

test("Delete my account also deletes the address's messages from before accounts", async ({ page }) => {
  const email = address("pre-account");
  const old = `before accounts ${Date.now()}`;
  // A row as the contact form stored it before accounts: no account, the address as typed.
  localSql(
    `INSERT INTO message (name, email, body, created_at, confirmed_at) VALUES ('Old', '${email.toUpperCase()}', '${old}', '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');`,
  );
  await page.goto("/admin/messages/");
  await expect(page.getByRole("main").getByText(old)).toBeVisible();

  const aside = await sendContact(page, email, "now with an account");
  const { code } = await mail(page, email);
  await aside.getByRole("textbox", { name: "Code" }).fill(code);
  await aside.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Email confirmed").first()).toBeVisible();

  await page.goto("/profile/");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Delete my account" }).click();
  await page
    .getByRole("alertdialog", { name: "Delete your account?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText("Account deleted").first()).toBeVisible();
  await page.goto("/admin/messages/");
  await expect(page.getByRole("main").getByText(old)).toHaveCount(0);
});
