import { expect, test } from "@playwright/test";

/**
 * This device (2026-11-25, owner: "there should be no dummy device the only device that should be
 * there is this device"): `/api/here` is never cached and rounds to 2 decimals; Devices shows ONE
 * device, marked default, that stays the same record across visits; precise location only on the
 * button press (granted here through Playwright, never a real prompt); no made-up device ids
 * anywhere.
 */

const FLEET_IDS = ["truck-4", "sensor-7", "gw-1", "wifi-2", "drone-a", "boat-1", "printer-1", "printer3d-1", "cnc-1"];
const KEY = "spn.v1.devices.this";

test("/api/here: no-store, rounded, nothing else", async ({ request }) => {
  const response = await request.get("/api/here");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = (await response.json()) as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(["city", "country", "lngLat", "region", "timezone"]);
  const point = body.lngLat as [number, number] | null;
  if (point) {
    for (const n of point) expect(Math.round(n * 100) / 100).toBe(n);
  }
});

test("one device, the default, kept across visits; precise on and off", async ({ page, context }) => {
  // Before anything: no geolocation was asked on load (it is denied unless granted below).
  await page.goto("/devices/");
  const card = page.locator('[data-device="this-device"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Default device/);
  await expect(card.locator('[data-field="Location"]')).toContainText(/Approximate \(from your network\)|Location unknown/);
  // Exactly one device and no made-up ones.
  await expect(page.locator("[data-device]")).toHaveCount(1);
  const html = await page.content();
  for (const id of FLEET_IDS) expect(html).not.toContain(`data-device="${id}"`);

  const first = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), KEY);
  expect(first).toMatchObject({ isDefault: true, name: "This device", precise: null });
  await page.reload();
  await expect(card).toContainText(/Default device/);
  const again = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), KEY);
  expect(again.id).toBe(first.id);
  expect(again.firstSeenAt).toBe(first.firstSeenAt);

  // Precise: granted geolocation at a known point.
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 48.85837, longitude: 2.29448, accuracy: 12 });
  await page.getByRole("button", { name: "Use precise location" }).click();
  await expect(card.locator('[data-field="Location"]')).toHaveText("Precise · within 12 m");
  const precise = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), KEY);
  expect(precise.precise.lngLat).toEqual([2.29448, 48.85837]);
  expect(precise.isDefault).toBe(true);

  // Off again: back to approximate.
  await page.getByRole("button", { name: "Use approximate location" }).click();
  await expect(card.locator('[data-field="Location"]')).not.toContainText("Precise");
  await expect(page.getByRole("button", { name: "Use precise location" })).toBeVisible();
});

test("denied precise location: a snackbar, still approximate", async ({ page, context }) => {
  await context.clearPermissions();
  await page.goto("/devices/");
  const button = page.getByRole("button", { name: "Use precise location" });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByText(/Location permission was not given|precise location is not available/).first()).toBeVisible();
  await expect(page.locator('[data-device="this-device"] [data-field="Location"]')).not.toContainText("Precise");
});

test("Maps lists this device only, no made-up devices", async ({ page }) => {
  await page.goto("/maps/?node=this-device");
  // Compact (iPhone): the side panel is a sheet that `?node=` does not open by itself.
  const open = page.getByRole("button", { name: "Show side panel" });
  if (await open.isVisible()) await open.click();
  const list = page.getByRole("listbox", { name: "Devices" });
  await expect(list.getByRole("option")).toHaveCount(1, { timeout: 30_000 });
  await expect(list.getByRole("option").first()).toContainText("This device");
  const html = await page.content();
  for (const id of FLEET_IDS) expect(html).not.toContain(id);
});

test.describe("no location", () => {
  // `page.route` does not see requests from a page a service worker controls (Playwright docs).
  test.use({ serviceWorkers: "block" });
test("no location from Cloudflare: world view and Location unknown", async ({ page }) => {
  await page.route("**/api/here", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({ city: null, region: null, country: null, timezone: null, lngLat: null }),
    }),
  );
  await page.goto("/devices/");
  await expect(page.locator('[data-device="this-device"] [data-field="Location"]')).toHaveText("Location unknown");
  await page.goto("/maps/?node=this-device");
  const open = page.getByRole("button", { name: "Show side panel" });
  if (await open.isVisible()) await open.click();
  await expect(page.getByText("This device: Location unknown.")).toBeVisible({ timeout: 30_000 });
  // The world, fitted: a low zoom in the URL once the camera is written.
  await expect(page).toHaveURL(/at=[-\d.]+,[-\d.]+,[0-3](\.\d+)?z/, { timeout: 15_000 });
});
});
