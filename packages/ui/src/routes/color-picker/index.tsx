import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { ColorPicker, Layout } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const color = useSignal("#6750a4");
  const knobs = useKnobs({
    label: knob.text("Pick color"),
    size: knob.select(["md", "sm"] as const, "md"),
  });

  return (
    <>
      <Layout.PaneHeader title="Color picker" />
      <Knobs knobs={knobs}>
        <div class="grid justify-items-center gap-4">
          <ColorPicker.Swatch
            label={knobs.values.label}
            size={knobs.values.size}
            bind:value={color}
          />
          <p class="text-body-medium text-on-surface-variant">
            bind:value is {color.value}
          </p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Color picker: @seanperez/ui" };
