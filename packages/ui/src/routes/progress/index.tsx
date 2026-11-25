import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout, Progress } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    type: knob.select(["linear", "circular"] as const, "linear"),
    indeterminate: knob.boolean(false),
    // The knob is the fraction done; the component gets `fraction * max`.
    value: knob.number(0.4, { min: 0, max: 1, step: 0.05 }),
    max: knob.number(1, { min: 1, max: 100, step: 1 }),
    wavy: knob.boolean(false),
    thickness: knob.select(["default", "thick"] as const, "default"),
    stopIndicator: knob.boolean(true, "stopIndicator (linear)"),
    label: knob.text("Loading news article"),
    valueText: knob.text("", "valueText (aria-valuetext)"),
  });

  return (
    <>
      <Layout.PaneHeader title="Progress indicators" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-md justify-items-center gap-4">
          {knobs.values.type === "linear" ? (
            <Progress.Linear
              value={
                knobs.values.indeterminate
                  ? undefined
                  : knobs.values.value * knobs.values.max
              }
              max={knobs.values.max}
              valueText={knobs.values.valueText || undefined}
              wavy={knobs.values.wavy}
              thickness={knobs.values.thickness}
              stopIndicator={knobs.values.stopIndicator}
              aria-label={knobs.values.label}
            />
          ) : (
            <Progress.Circular
              value={
                knobs.values.indeterminate
                  ? undefined
                  : knobs.values.value * knobs.values.max
              }
              max={knobs.values.max}
              valueText={knobs.values.valueText || undefined}
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
