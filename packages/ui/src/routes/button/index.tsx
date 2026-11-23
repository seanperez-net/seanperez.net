import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  Button,
  Knobs,
  Layout,
  buttonLooks,
  knob,
  useKnobs,
} from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    label: knob.text("Button"),
    look: knob.select(buttonLooks, "filled"),
    disabled: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Button" />
      <Knobs knobs={knobs}>
        <Button
          label={knobs.values.label}
          look={knobs.values.look}
          disabled={knobs.values.disabled}
        />
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Button: @seanperez/ui" };
