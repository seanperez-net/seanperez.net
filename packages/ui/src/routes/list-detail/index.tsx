import { component$, useComputed$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { useLocation } from "@qwik.dev/router";
import { Avatar, EmptyState, FAB, IconButton, Layout, List } from "../../index";

const PEOPLE = [
  { id: "ada", name: "Ada Lovelace", line: "Mathematician" },
  { id: "alan", name: "Alan Turing", line: "Computer scientist" },
  { id: "grace", name: "Grace Hopper", line: "Rear admiral" },
];

/**
 * `Layout.ListDetail`, `Layout.ListPane`, `Layout.DetailPane` (NEW 2026-11-24): M3 list-detail
 * as two panes. The selection is in the URL (`?item=`), so which pane shows in single-pane comes
 * from the URL (rule L19). Narrow the window (or open the Theme panel) to see one pane.
 */
export default component$(() => {
  const loc = useLocation();
  const selected = useComputed$(() => loc.url.searchParams.get("item") ?? "");
  const person = useComputed$(() =>
    PEOPLE.find((p) => p.id === selected.value),
  );
  return (
    <Layout.ListDetail
      view={person.value ? "detail" : "list"}
      fab={<FAB icon="person_add" aria-label="Create contact" />}
    >
      <Layout.ListPane aria-labelledby="ld-title">
        <Layout.PaneHeader title="List-detail panes" titleId="ld-title" />
        <List.Root rovingFocus padding="none" aria-labelledby="ld-title">
          {PEOPLE.map((p) => (
            <List.Item
              key={p.id}
              href={`/list-detail/?item=${p.id}`}
              // M3: a selection state in two-pane only. On the list view nothing is selected.
              selected={selected.value === p.id}
              start={<Avatar name={p.name} seed={p.id} size="md" decorative />}
              headline={p.name}
              supportingText={p.line}
            />
          ))}
        </List.Root>
      </Layout.ListPane>
      <Layout.DetailPane>
        {person.value ? (
          <>
            {/* `leading` and `subtitle` (NEW 2026-11-25, M3 app bar subtitle): the avatar after
                Back, the line under the name. Narrow the pane: the title keeps 6rem and ends in
                an ellipsis. */}
            <Layout.PaneHeader
              title={person.value.name}
              subtitle={person.value.line}
              leading={
                <Avatar
                  name={person.value.name}
                  seed={person.value.id}
                  size="md"
                  decorative
                />
              }
              backHref="/list-detail/"
              backLabel="Back to the list"
            >
              <IconButton icon="star" label="Star" />
              <IconButton icon="edit" label="Edit" />
            </Layout.PaneHeader>
            <p class="text-body-large text-on-surface-variant">
              {person.value.line}
            </p>
          </>
        ) : (
          <EmptyState size="sm" icon="person" headline="Select a person" />
        )}
      </Layout.DetailPane>
    </Layout.ListDetail>
  );
});

export const head: DocumentHead = { title: "List-detail: @seanperez/ui" };
