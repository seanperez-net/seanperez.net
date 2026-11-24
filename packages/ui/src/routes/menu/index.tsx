import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Icon, Knobs, Layout, Menu, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    label: knob.text("Options"),
    rows: knob.number(3, { min: 1, max: 6 }),
    align: knob.select(["start", "end"] as const, "start"),
    radio: knob.boolean(true, "Radio rows"),
  });
  const sort = useSignal("name");

  return (
    <>
      <Layout.PaneHeader title="Menu" />
      <Knobs knobs={knobs}>
        <Menu.Root>
          <Menu.Trigger look="outlined">
            <Icon name="palette" size="sm" />
            {knobs.values.label}
          </Menu.Trigger>
          <Menu.Content align={knobs.values.align}>
            {Array.from({ length: knobs.values.rows }, (_, index) => (
              <Menu.Item key={index}>Row {index + 1}</Menu.Item>
            ))}
            <Menu.Item href="#">A link row</Menu.Item>
            <Menu.Item disabled>A disabled row</Menu.Item>
            {knobs.values.radio && (
              <>
                <Menu.Separator />
                <Menu.RadioGroup value={sort} aria-label="Sort by">
                  <Menu.RadioItem value="name">Name</Menu.RadioItem>
                  <Menu.RadioItem value="date">Date</Menu.RadioItem>
                </Menu.RadioGroup>
              </>
            )}
          </Menu.Content>
        </Menu.Root>
        <p class="text-body-medium">Sorted by: {sort.value}</p>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Menu: @seanperez/ui" };
