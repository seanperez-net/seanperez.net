/**
 * TextField's placeholder classes (`textFieldInputVariants`) and what the field renders. Rendered
 * with `createDOM` (`@qwik.dev/core/testing`), as the Qwik docs show. Whether the placeholder is
 * actually seen on focus (`:placeholder-shown`, `focus:`) is CSS in a browser: Playwright's.
 */
import { createDOM } from "@qwik.dev/core/testing";
import { describe, expect, it } from "vitest";
import { TextField } from "./text-field";
import { textFieldInputVariants } from "./text-field-input";

const classes = (props: Parameters<typeof textFieldInputVariants>[0]) =>
  textFieldInputVariants(props).split(/\s+/);

describe("textFieldInputVariants placeholder", () => {
  it("keeps the placeholder on one line, cut with an ellipsis", () => {
    expect(classes({})).toEqual(
      expect.arrayContaining([
        "placeholder:whitespace-nowrap",
        "placeholder:overflow-hidden",
        "placeholder:text-ellipsis",
      ]),
    );
  });

  it("hides a labelled field's placeholder until focus", () => {
    const labelled = classes({ labelled: true });
    expect(labelled).toEqual(
      expect.arrayContaining([
        "placeholder:opacity-0",
        "focus:placeholder:opacity-100",
      ]),
    );
    expect(classes({ labelled: false })).not.toContain("placeholder:opacity-0");
  });

  it("shows plain and tonal placeholders at 60%", () => {
    expect(classes({ variant: "plain", labelled: false })).toContain(
      "placeholder:text-on-surface-variant/60",
    );
    expect(classes({ variant: "tonal", labelled: false })).toContain(
      "placeholder:text-on-surface-variant/60",
    );
  });
});

describe("TextField render", () => {
  it("labels the input and keeps a placeholder for :placeholder-shown", async () => {
    const { screen, render } = await createDOM();
    await render(<TextField label="Name" />);
    const input = screen.querySelector("input")!;
    const label = screen.querySelector("label")!;
    expect(label.textContent).toContain("Name");
    expect(label.getAttribute("for")).toBe(input.id);
    // No placeholder given: a space, so the floating label still reads `:placeholder-shown`.
    expect(input.getAttribute("placeholder")).toBe(" ");
    expect(input.getAttribute("class")).toContain("placeholder:opacity-0");
  });

  it("passes the placeholder through and marks an error", async () => {
    const { screen, render } = await createDOM();
    await render(
      <TextField
        label="Email"
        placeholder="you@example.com"
        error="Required"
      />,
    );
    const input = screen.querySelector("input")!;
    expect(input.getAttribute("placeholder")).toBe("you@example.com");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby")!;
    expect(
      screen.querySelector(`[id="${describedBy}"]`)!.textContent,
    ).toContain("Required");
  });

  it("names a plain field with aria-label and no floating label", async () => {
    const { screen, render } = await createDOM();
    await render(
      <TextField variant="plain" label="Search" placeholder="Search" />,
    );
    const input = screen.querySelector("input")!;
    expect(input.getAttribute("aria-label")).toBe("Search");
    expect(input.getAttribute("class")).not.toContain("placeholder:opacity-0");
  });
});
