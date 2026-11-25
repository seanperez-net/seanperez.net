import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout, ToggleGroup } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    look: knob.select(["outlined", "tonal"] as const, "outlined"),
    size: knob.select(["xs", "sm", "md"] as const, "sm"),
    // `icon` on the items: an 18dp icon before each label.
    icons: knob.boolean(false),
    // `disabled` on the last item.
    disabledItem: knob.boolean(false, "disabled (Month)"),
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
          <ToggleGroup.Item
            value="day"
            label="Day"
            icon={knobs.values.icons ? "calendar_today" : undefined}
          />
          <ToggleGroup.Item
            value="week"
            label="Week"
            icon={knobs.values.icons ? "schedule" : undefined}
          />
          <ToggleGroup.Item
            value="month"
            label="Month"
            icon={knobs.values.icons ? "star" : undefined}
            disabled={knobs.values.disabledItem}
          />
        </ToggleGroup.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Toggle group: @seanperez/ui" };
