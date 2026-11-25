import { defineConfig, devices } from "@playwright/test";

/**
 * The admin's WebKit checks (2026-11-25, moved from apps/web with its `/admin` pages). Same
 * pattern as `apps/web/playwright.config.ts`. `pnpm dev:admin` is reused if it is running; Vite
 * listens on IPv6 only, so the URL is `[::1]`. Its local D1 is apps/web's (`vite.config.ts`).
 *
 *   pnpm --filter @seanperez/admin test:e2e --project=webkit
 */
const baseURL = process.env.E2E_ADMIN_URL ?? "http://[::1]:5180/";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
