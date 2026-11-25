/**
 * TimePicker: the hidden input that posts the time is disabled with the picker (a disabled
 * control is left out of the form data: HTML "constructing the entry list").
 */
import { createDOM } from "@qwik.dev/core/testing";
import { describe, expect, it } from "vitest";
import { TimePicker } from "./time-picker";

const hiddenInput = async (
  jsx: Parameters<Awaited<ReturnType<typeof createDOM>>["render"]>[0],
) => {
  const { screen, render } = await createDOM();
  await render(jsx);
  return screen.querySelector('input[type="hidden"][name="at"]') as
    | HTMLInputElement
    | undefined;
};

describe("TimePicker hidden input", () => {
  it("posts the value while enabled", async () => {
    const input = await hiddenInput(
      <TimePicker.Inline name="at" value="09:30" />,
    );
    expect(input).toBeTruthy();
    expect(input?.getAttribute("value")).toBe("09:30");
    expect(input?.hasAttribute("disabled")).toBe(false);
  });

  it("is disabled with the inline picker", async () => {
    const input = await hiddenInput(
      <TimePicker.Inline name="at" value="09:30" disabled />,
    );
    expect(input?.hasAttribute("disabled")).toBe(true);
  });

  it("is disabled with the modal picker", async () => {
    const input = await hiddenInput(
      <TimePicker.Modal name="at" value="09:30" disabled />,
    );
    expect(input?.hasAttribute("disabled")).toBe(true);
  });
});
