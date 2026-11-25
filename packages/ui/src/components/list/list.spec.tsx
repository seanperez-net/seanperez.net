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

/**
 * `List.Group` as a native disclosure (2026-11-25): `<details>` / `<summary>`, so a closed group
 * opens with JavaScript off and its rows are in the HTML; the open state is the `open`
 * attribute, never `hidden` on the rows.
 */
describe("List.Group", () => {
  it("renders details / summary with the start state as the open attribute", async () => {
    const { screen, render } = await createDOM();
    await render(
      <QwikRouterMockProvider>
        <List.Root aria-label="Résumé">
          <List.Group value="dev">
            <List.GroupHeader label="Experience" />
            <List.GroupContent>
              <List.Item headline="Developer" />
            </List.GroupContent>
          </List.Group>
          <List.Group value="food" open={false}>
            <List.GroupHeader label="Hospitality" />
            <List.GroupContent>
              <List.Item headline="Server" />
            </List.GroupContent>
          </List.Group>
        </List.Root>
      </QwikRouterMockProvider>,
    );
    const [open, closed] = Array.from(screen.querySelectorAll("details"));
    expect(open.hasAttribute("open")).toBe(true);
    expect(closed.hasAttribute("open")).toBe(false);
    for (const details of [open, closed]) {
      const summary = details.querySelector("summary")!;
      expect(summary.parentElement).toBe(details);
      expect(summary.getAttribute("role")).toBeNull();
      const rows = details.querySelector("[data-qds-list-group-content]")!;
      expect(rows.hasAttribute("hidden")).toBe(false);
      expect(summary.getAttribute("aria-controls")).toBe(rows.id);
    }
    // The closed group's rows are in the markup (readable without JavaScript, printable).
    expect(closed.textContent).toContain("Server");
    // Several may be open: no shared name.
    expect(open.hasAttribute("name")).toBe(false);
  });

  it("one open at a time shares a details name", async () => {
    const { screen, render } = await createDOM();
    await render(
      <QwikRouterMockProvider>
        <List.Root aria-label="Pick" multipleGroups={false}>
          <List.Group value="a">
            <List.GroupHeader label="A" />
            <List.GroupContent />
          </List.Group>
          <List.Group value="b" open={false}>
            <List.GroupHeader label="B" />
            <List.GroupContent />
          </List.Group>
        </List.Root>
      </QwikRouterMockProvider>,
    );
    const names = Array.from(screen.querySelectorAll("details")).map((d) =>
      d.getAttribute("name"),
    );
    expect(names[0]).toBeTruthy();
    expect(names[0]).toBe(names[1]);
  });
});
