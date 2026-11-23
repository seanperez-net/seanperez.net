import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Knobs, Layout, Switch, knob, useKnobs } from "../../index";

export default component$(() => {
  const checked = useSignal(true);
  const knobs = useKnobs({
    label: knob.text("Notifications"),
    disabled: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Switch" />
      <Knobs knobs={knobs}>
        <div class="grid justify-items-center gap-4">
          <Switch
            label={knobs.values.label}
            disabled={knobs.values.disabled}
            bind:checked={checked}
          />
          <p class="text-body-medium text-on-surface-variant">
            bind:checked is {checked.value ? "true" : "false"}
          </p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Switch: @seanperez/ui" };
