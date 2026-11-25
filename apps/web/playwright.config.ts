import { defineConfig, devices } from "@playwright/test";

/**
 * Safari-engine checks (2026-11-24, owner: "set up playwright webkit"). Chrome is checked by hand
 * through the browser tools; this runs the same checks on WebKit, desktop and an emulated iPhone.
 * Not real iOS Safari: the owner's phone / the iOS simulator stay the final check.
 *
 *   pnpm test:e2e                 # all projects
 *   pnpm test:e2e --project=iphone
 *
 * Pattern from e-store `packages/ui/playwright.config.ts`. The dev server is reused if it is
 * running; our Vite listens on IPv6 only, so the URL is `[::1]`, not `localhost`.
 */
const baseURL = process.env.E2E_URL ?? "http://[::1]:5173/";

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
    { name: "iphone", use: { ...devices["iPhone 17 Pro"] } },
  ],
  webServer: [
    {
      command: "pnpm dev",
      url: baseURL,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    // The admin app (2026-11-25): `contact-verify.spec.ts` reads the inbox there. Its dev server
    // shares this app's local D1 (`apps/admin/vite.config.ts`).
    {
      command: "pnpm --dir ../admin dev",
      url: process.env.E2E_ADMIN_URL ?? "http://[::1]:5180/",
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
