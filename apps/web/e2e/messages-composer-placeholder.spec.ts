import { expect, test } from "@playwright/test";

/**
 * A long placeholder stays on ONE line (owner 2026-11-25: "Message Sean Perez" overflowed the
 * composer at 390px). The fix is the library TextField's `::placeholder` (nowrap, overflow
 * hidden, ellipsis where the browser draws one), so this checks the composer at 390px.
 */
test.use({ viewport: { width: 390, height: 800 } });

test("the composer's placeholder does not wrap at 390px", async ({ page }, info) => {
  await page.goto("/messages/sean-perez/");
  const composer = page.getByRole("textbox", { name: "Write a message" });
  await expect(composer).toHaveAttribute("placeholder", /Message Sean Perez/);
  const m = await composer.evaluate((el: HTMLTextAreaElement) => {
    el.placeholder = "Message Sean Perez with a much longer name than this field can hold";
    const ph = getComputedStyle(el, "::placeholder");
    return { ws: ph.whiteSpace, overflow: el.scrollHeight - el.clientHeight };
  });
  await composer.screenshot({ path: info.outputPath("composer.png") });
  expect(m.ws).toBe("nowrap");
  expect(m.overflow).toBeLessThanOrEqual(1);
});
