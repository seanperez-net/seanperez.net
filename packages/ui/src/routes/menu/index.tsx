import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Icon, Layout, Menu } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    label: knob.text("Options"),
    look: knob.select(["outlined", "plain", "bare"] as const, "outlined"),
    triggerSize: knob.select(["xs", "sm"] as const, "sm"),
    rows: knob.number(3, { min: 1, max: 6 }),
    align: knob.select(["start", "end"] as const, "start"),
    side: knob.select(["bottom", "top"] as const, "bottom"),
    floating: knob.boolean(false),
    size: knob.select(["default", "dense"] as const, "default", "Item size"),
    closeOnSelect: knob.boolean(true),
    radio: knob.boolean(true, "Radio rows"),
    checkedHighlight: knob.boolean(true),
  });
  const sort = useSignal("name");

  return (
    <>
      <Layout.PaneHeader title="Menu" />
      <Knobs knobs={knobs}>
        <Menu.Root>
          <Menu.Trigger
            look={knobs.values.look}
            size={knobs.values.triggerSize}
          >
            <Icon name="palette" size="sm" />
            {knobs.values.label}
          </Menu.Trigger>
          <Menu.Content
            align={knobs.values.align}
            side={knobs.values.side}
            floating={knobs.values.floating}
          >
            {Array.from({ length: knobs.values.rows }, (_, index) => (
              <Menu.Item
                key={index}
                size={knobs.values.size}
                closeOnSelect={knobs.values.closeOnSelect}
              >
                Row {index + 1}
              </Menu.Item>
            ))}
            <Menu.Item href="#" size={knobs.values.size}>
              A link row
            </Menu.Item>
            <Menu.Item disabled size={knobs.values.size}>
              A disabled row
            </Menu.Item>
            {knobs.values.radio && (
              <>
                <Menu.Separator />
                <Menu.RadioGroup value={sort} aria-label="Sort by">
                  <Menu.RadioItem
                    value="name"
                    size={knobs.values.size}
                    closeOnSelect={knobs.values.closeOnSelect}
                    checkedHighlight={knobs.values.checkedHighlight}
                  >
                    Name
                  </Menu.RadioItem>
                  <Menu.RadioItem
                    value="date"
                    size={knobs.values.size}
                    closeOnSelect={knobs.values.closeOnSelect}
                    checkedHighlight={knobs.values.checkedHighlight}
                  >
                    Date
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </>
            )}
            <Menu.Separator />
            {/* A submenu (e-store's `Menu.Sub`, 2026-11-24). */}
            <Menu.Sub>
              <Menu.SubTrigger size={knobs.values.size}>Share</Menu.SubTrigger>
              <Menu.SubContent>
                <Menu.Item size={knobs.values.size}>Copy link</Menu.Item>
                <Menu.Item size={knobs.values.size}>Email</Menu.Item>
              </Menu.SubContent>
            </Menu.Sub>
          </Menu.Content>
        </Menu.Root>
        <p class="text-body-medium">Sorted by: {sort.value}</p>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Menu: @seanperez/ui" };
