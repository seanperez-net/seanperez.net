import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

/**
 * Accounts (2026-11-25; moved from apps/web's /admin/accounts/ the same day): the list loads and
 * the owner's Delete removes an account, keeping its CONFIRMED messages in the inbox, unlinked
 * (`deleteAccount`). The row's Delete is a Button calling the action (a router `<Form>` inside
 * `List.Item`'s `end` prop threw Qwik Q34 and crashed `pnpm dev`), so this also proves the page
 * renders. Under `pnpm dev:admin` the gate is open (dev bypass). The test account is written
 * straight into apps/web's LOCAL D1, which this app's dev server shares (`vite.config.ts`), so
 * wrangler runs from apps/web.
 */
const d1 = (sql: string) =>
  execFileSync(
    "pnpm",
    ["wrangler", "d1", "execute", "seanperez-net", "--local", "--command", sql],
    { cwd: new URL("../../web/", import.meta.url), stdio: "ignore" },
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

  await page.goto("/accounts/");
  const main = page.getByRole("main");
  const row = main.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText(`${email} · Verified · 1 message`);
  await main.getByRole("button", { name: `Delete ${name}'s account` }).click();
  await expect(main.getByText(name)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("main").getByText(name)).toHaveCount(0);
  // Delivered before the delete: kept in the inbox.
  await page.goto("/messages/");
  await expect(page.getByRole("main").getByText(body)).toBeVisible();
  d1(`DELETE FROM message WHERE email = '${email}';`);
});
