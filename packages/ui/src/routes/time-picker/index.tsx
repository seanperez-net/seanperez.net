import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout, TimePicker } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const time = useSignal("07:30");
  const knobs = useKnobs({
    picker: knob.select(["modal", "inline"], "modal", "picker"),
    variant: knob.select(
      ["dial", "input", "scroll"],
      "dial",
      "variant (inline: input, scroll)",
    ),
    orientation: knob.select(
      ["vertical", "horizontal"],
      "vertical",
      "orientation (dial)",
    ),
    use24h: knob.boolean(false, "24-hour"),
    disabled: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Time picker" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-sm gap-4">
          {knobs.values.picker === "modal" ? (
            <TimePicker.Modal
              key={knobs.values.variant}
              variant={knobs.values.variant}
              orientation={knobs.values.orientation}
              use24h={knobs.values.use24h}
              disabled={knobs.values.disabled}
              bind:value={time}
            />
          ) : (
            <TimePicker.Inline
              key={knobs.values.variant}
              variant={knobs.values.variant === "input" ? "input" : "scroll"}
              use24h={knobs.values.use24h}
              disabled={knobs.values.disabled}
              bind:value={time}
            />
          )}
          <p class="text-body-medium text-on-surface-variant">
            value: "{time.value}"
          </p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Time picker: @seanperez/ui" };
