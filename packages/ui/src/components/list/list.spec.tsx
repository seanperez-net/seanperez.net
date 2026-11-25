/**
 * `List.Item actions` (NEW 2026-11-25): the row's controls render BESIDE its link, as a sibling in
 * the `<li>`, never inside the `<a>`. Rendered with `createDOM` (`@qwik.dev/core/testing`) inside
 * `QwikRouterMockProvider` (the row uses the router's `useNavigate` and `Link`), as the Qwik docs
 * show. Arrow keys, the per-row Tab stops and the hover / focus reveal are Playwright's.
 */
import { createDOM } from "@qwik.dev/core/testing";
import { QwikRouterMockProvider } from "@qwik.dev/router";
import { describe, expect, it } from "vitest";
import { List } from "./list";

describe("List.Item actions", () => {
  it("renders the actions beside the link, not inside it", async () => {
    const { screen, render } = await createDOM();
    await render(
      <QwikRouterMockProvider>
        <List.Root rovingFocus aria-label="People">
          <List.Item
            href="/contacts/ada/"
            headline="Ada Lovelace"
            actions={
              <button type="button" aria-label="Edit Ada">
                Edit
              </button>
            }
          />
          <List.Item href="/contacts/alan/" headline="Alan Turing" />
        </List.Root>
      </QwikRouterMockProvider>,
    );

    const [withActions, plain] = Array.from(screen.querySelectorAll("li"));
    const link = withActions.querySelector("a")!;
    const actions = withActions.querySelector("[data-list-item-actions]")!;

    expect(link.getAttribute("href")).toBe("/contacts/ada/");
    expect(link.textContent).toContain("Ada Lovelace");
    expect(actions).toBeTruthy();
    // A sibling of the link in the <li>, and the control is not inside the <a>.
    expect(actions.parentElement).toBe(withActions);
    expect(link.contains(actions)).toBe(false);
    expect(actions.querySelector('button[aria-label="Edit Ada"]')).toBeTruthy();
    // The <li> becomes the two-column grid only when it has actions.
    expect(withActions.getAttribute("class")).toContain(
      "grid-cols-[minmax(0,1fr)_auto]",
    );
    // Qwik's emulated document answers `undefined`, not `null`, for no match.
    expect(plain.querySelector("[data-list-item-actions]")).toBeFalsy();
    expect(plain.getAttribute("class")).not.toContain(
      "grid-cols-[minmax(0,1fr)_auto]",
    );
    // In a rovingFocus list the <ul> is the Tab stop: the link leaves the tab order.
    expect(link.getAttribute("tabindex")).toBe("-1");
  });
});
