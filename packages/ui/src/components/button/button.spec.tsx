/**
 * Button: its `tv()` classes, and what it renders. Rendered with `createDOM` from
 * `@qwik.dev/core/testing`, as the Qwik docs show (`/docs/integrations/vitest/`, rc.5).
 * Focus, keyboard and the pressed / hover states are in Playwright (`apps/web/e2e`).
 */
import { createDOM } from "@qwik.dev/core/testing";
import { QwikRouterMockProvider } from "@qwik.dev/router";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";

const classes = (props: Parameters<typeof buttonVariants>[0]) =>
  buttonVariants(props).split(/\s+/);

describe("buttonVariants", () => {
  it("defaults to a filled, small, rounded button", () => {
    expect(buttonVariants()).toBe(
      buttonVariants({
        look: "filled",
        size: "sm",
        shape: "rounded",
        tone: "default",
      }),
    );
    const c = classes({});
    expect(c).toEqual(
      expect.arrayContaining(["bg-primary", "text-on-primary", "h-10"]),
    );
    expect(c).toContain("rounded-full");
  });

  it("gives each M3 size its height", () => {
    expect(classes({ size: "xs" })).toContain("h-8");
    expect(classes({ size: "md" })).toContain("h-14");
    expect(classes({ size: "lg" })).toContain("h-24");
    expect(classes({ size: "xl" })).toContain("h-34");
  });

  it("colors a text button by tone", () => {
    expect(classes({ look: "text" })).toContain("text-primary");
    expect(classes({ look: "text", tone: "muted" })).toContain(
      "text-on-surface-variant",
    );
    expect(classes({ look: "text", tone: "inverse" })).toContain(
      "text-inverse-primary",
    );
    // `tone` is for text buttons only.
    expect(classes({ look: "filled", tone: "muted" })).not.toContain(
      "text-on-surface-variant",
    );
  });

  it("widens the outline with the size", () => {
    expect(classes({ look: "outlined", size: "sm" })).toContain("inset-ring");
    expect(classes({ look: "outlined", size: "lg" })).toContain("inset-ring-2");
    expect(classes({ look: "outlined", size: "xl" })).toContain("inset-ring-3");
  });

  it("squares the corners per size", () => {
    expect(classes({ shape: "squared", size: "sm" })).toContain("rounded-md");
    expect(classes({ shape: "squared", size: "md" })).toContain("rounded-lg");
    expect(classes({ shape: "squared" })).not.toContain("rounded-full");
  });
});

describe("Button render", () => {
  it("renders a <button> with its label and variant classes", async () => {
    const { screen, render } = await createDOM();
    await render(<Button label="Save" look="tonal" size="md" />);
    const button = screen.querySelector("button")!;
    expect(button).toBeTruthy();
    expect(button.textContent).toContain("Save");
    const cls = button.getAttribute("class")!.split(/\s+/);
    expect(cls).toEqual(
      expect.arrayContaining(["bg-secondary-container", "h-14"]),
    );
    expect(button.hasAttribute("aria-busy")).toBe(false);
  });

  it("marks a loading button busy and keeps it focusable", async () => {
    const { screen, render } = await createDOM();
    await render(<Button label="Send" isLoading />);
    const button = screen.querySelector("button")!;
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.querySelector("svg.animate-spin")).toBeTruthy();
  });

  it("renders a toggle with aria-pressed", async () => {
    const { screen, render } = await createDOM();
    await render(<Button label="Bold" toggle selected />);
    expect(screen.querySelector("button")!.getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it('renders type="link" as an <a> and drops an unsafe href', async () => {
    // The unsafe href a CMS row could hold (`safeHref` drops it).
    const unsafe = "javascript:alert(1)";
    const { screen, render } = await createDOM();
    await render(
      <QwikRouterMockProvider>
        <Button type="link" href="/about/" label="About" />
        {/* eslint-disable-next-line qwik/jsx-no-script-url -- the case under test */}
        <Button type="link" href={unsafe} reload label="Bad" />
      </QwikRouterMockProvider>,
    );
    const links = Array.from(screen.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/about/", null]);
    expect(links[0].textContent).toContain("About");
  });
});
