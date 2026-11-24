import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Dropdown, Icon, Knobs, Layout, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    look: knob.select(["outlined", "plain"] as const, "outlined"),
    size: knob.select(["default", "dense"] as const, "default"),
  });
  const hidden = useSignal(false);
  const sort = useSignal("name");
  const last = useSignal("");

  return (
    <>
      <Layout.PaneHeader title="Dropdown" />
      <Knobs knobs={knobs}>
        <div class="grid justify-items-center gap-4">
          <Dropdown.Root>
            <Dropdown.Trigger look={knobs.values.look}>
              View
              <Icon name="expand_more" size="sm" />
            </Dropdown.Trigger>
            <Dropdown.Content>
              <Dropdown.Group>
                <Dropdown.GroupLabel>Actions</Dropdown.GroupLabel>
                <Dropdown.Item
                  size={knobs.values.size}
                  onClick$={() => (last.value = "Edit")}
                >
                  Edit
                </Dropdown.Item>
                <Dropdown.Item
                  size={knobs.values.size}
                  onClick$={() => (last.value = "Duplicate")}
                >
                  Duplicate
                </Dropdown.Item>
                <Dropdown.Item size={knobs.values.size} disabled>
                  Archive (disabled)
                </Dropdown.Item>
              </Dropdown.Group>
              <Dropdown.Separator />
              <Dropdown.CheckboxItem
                size={knobs.values.size}
                bind:checked={hidden}
              >
                Show hidden files
                <Dropdown.ItemIndicator>
                  {hidden.value && <Icon name="check" size="sm" />}
                </Dropdown.ItemIndicator>
              </Dropdown.CheckboxItem>
              <Dropdown.Separator />
              <Dropdown.RadioGroup value={sort} aria-label="Sort by">
                <Dropdown.RadioItem size={knobs.values.size} value="name">
                  Sort by name
                </Dropdown.RadioItem>
                <Dropdown.RadioItem size={knobs.values.size} value="date">
                  Sort by date
                </Dropdown.RadioItem>
              </Dropdown.RadioGroup>
            </Dropdown.Content>
          </Dropdown.Root>
          <p class="text-body-medium text-on-surface-variant">
            last: "{last.value}", hidden: {hidden.value ? "shown" : "off"},
            sort: {sort.value}
          </p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Dropdown: @seanperez/ui" };
