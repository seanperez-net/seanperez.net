import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Knobs, Layout, Progress, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    type: knob.select(["linear", "circular"] as const, "linear"),
    indeterminate: knob.boolean(false),
    value: knob.number(0.4, { min: 0, max: 1, step: 0.05 }),
    wavy: knob.boolean(false),
    thickness: knob.select(["default", "thick"] as const, "default"),
    stopIndicator: knob.boolean(true, "stopIndicator (linear)"),
    label: knob.text("Loading news article"),
  });

  return (
    <>
      <Layout.PaneHeader title="Progress indicators" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-md justify-items-center gap-4">
          {knobs.values.type === "linear" ? (
            <Progress.Linear
              value={
                knobs.values.indeterminate ? undefined : knobs.values.value
              }
              wavy={knobs.values.wavy}
              thickness={knobs.values.thickness}
              stopIndicator={knobs.values.stopIndicator}
              aria-label={knobs.values.label}
            />
          ) : (
            <Progress.Circular
              value={
                knobs.values.indeterminate ? undefined : knobs.values.value
              }
              wavy={knobs.values.wavy}
              thickness={knobs.values.thickness}
              aria-label={knobs.values.label}
            />
          )}
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Progress: @seanperez/ui" };
