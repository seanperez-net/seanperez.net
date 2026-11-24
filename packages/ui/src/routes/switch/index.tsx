import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Knobs, Layout, Switch, knob, useKnobs } from "../../index";

export default component$(() => {
  const checked = useSignal(true);
  const knobs = useKnobs({
    label: knob.text("Notifications"),
    icons: knob.select(["none", "selected", "both"] as const, "none"),
    disabled: knob.boolean(false),
    size: knob.select(["md", "sm"] as const, "md"),
    description: knob.text("Sent to your phone"),
    error: knob.text(""),
  });

  return (
    <>
      <Layout.PaneHeader title="Switch" />
      <Knobs knobs={knobs}>
        <div class="grid justify-items-center gap-4">
          <Switch
            label={knobs.values.label}
            icons={knobs.values.icons}
            size={knobs.values.size}
            description={knobs.values.description || undefined}
            error={knobs.values.error || undefined}
            disabled={knobs.values.disabled}
            bind:checked={checked}
          />
          <Switch
            label="Off by default"
            icons={knobs.values.icons}
            size={knobs.values.size}
            disabled={knobs.values.disabled}
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
