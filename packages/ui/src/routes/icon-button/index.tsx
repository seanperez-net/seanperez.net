import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  IconButton,
  Knobs,
  Layout,
  iconNames,
  knob,
  useKnobs,
} from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    icon: knob.select(iconNames, "palette"),
    label: knob.text("Theme colour"),
    disabled: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Icon button" />
      <Knobs knobs={knobs}>
        <IconButton
          icon={knobs.values.icon}
          label={knobs.values.label}
          disabled={knobs.values.disabled}
        />
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Icon button: @seanperez/ui" };
