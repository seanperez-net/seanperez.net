import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { IconButton, Knobs, Layout, Menu, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    label: knob.text("Options"),
    rows: knob.number(3, { min: 1, max: 6 }),
  });

  return (
    <>
      <Layout.PaneHeader title="Menu" />
      <Knobs knobs={knobs}>
        <IconButton
          icon="palette"
          label={knobs.values.label}
          popovertarget="demo-menu"
        />
        <Menu.Root id="demo-menu" aria-label={knobs.values.label}>
          {Array.from({ length: knobs.values.rows }, (_, index) => (
            <Menu.Item key={index}>Row {index + 1}</Menu.Item>
          ))}
        </Menu.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Menu: @seanperez/ui" };
