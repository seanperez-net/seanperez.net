import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Knobs, Layout, ToggleGroup, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    look: knob.select(["outlined", "tonal"] as const, "outlined"),
    size: knob.select(["xs", "sm", "md"] as const, "sm"),
  });
  const value = useSignal("week");

  return (
    <>
      <Layout.PaneHeader title="Toggle group" />
      <Knobs knobs={knobs}>
        <ToggleGroup.Root
          bind:value={value}
          look={knobs.values.look}
          size={knobs.values.size}
          aria-label="View"
        >
          <ToggleGroup.Item value="day" label="Day" />
          <ToggleGroup.Item value="week" label="Week" />
          <ToggleGroup.Item value="month" label="Month" />
        </ToggleGroup.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Toggle group: @seanperez/ui" };
