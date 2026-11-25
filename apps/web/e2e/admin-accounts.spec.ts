import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/**
 * /admin/accounts/ (2026-11-25): the list loads and the owner's Delete removes an account, keeping
 * its CONFIRMED messages in the inbox, unlinked (`deleteAccount`). The row's Delete is a Button
 * calling the action (a router `<Form>` inside `List.Item`'s `end` prop threw Qwik Q34 and crashed
 * `pnpm dev`), so this also proves the page renders. Locally `/admin` is open (`.dev.vars`, as
 * `contact-verify.spec.ts` uses it). The test account is written straight into the LOCAL D1.
 */
const d1 = (sql: string) =>
  execFileSync(
    "pnpm",
    ["wrangler", "d1", "execute", "seanperez-net", "--local", "--command", sql],
    { cwd: new URL("..", import.meta.url), stdio: "ignore" },
  );

test("lists a test account and deletes it; its confirmed message stays", async ({
  page,
}) => {
  const id = randomUUID();
  const tag = Date.now();
  const name = `E2E Admin ${tag}`;
  const email = `e2e-admin-${tag}@example.com`;
  const body = `admin accounts e2e ${tag}`;
  const now = new Date().toISOString();
  d1(
    `INSERT INTO contact_account (id, email, name, created_at, verified_at) VALUES ('${id}', '${email}', '${name}', '${now}', '${now}'); ` +
      `INSERT INTO message (name, email, body, created_at, account_id, confirmed_at) VALUES ('${name}', '${email}', '${body}', '${now}', '${id}', '${now}');`,
  );

  await page.goto("/admin/accounts/");
  const main = page.getByRole("main");
  const row = main.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText(`${email} · Verified · 1 message`);
  await main.getByRole("button", { name: `Delete ${name}'s account` }).click();
  await expect(main.getByText(name)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("main").getByText(name)).toHaveCount(0);
  // Delivered before the delete: kept in the inbox.
  await page.goto("/admin/messages/");
  await expect(page.getByRole("main").getByText(body)).toBeVisible();
  d1(`DELETE FROM message WHERE email = '${email}';`);
});
