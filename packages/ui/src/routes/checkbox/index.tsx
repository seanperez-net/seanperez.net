import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Checkbox, Knobs, Layout, knob, useKnobs } from "../../index";

export default component$(() => {
  const checked = useSignal(true);
  const knobs = useKnobs({
    label: knob.text("Email me updates"),
    indeterminate: knob.boolean(false),
    disabled: knob.boolean(false),
    error: knob.boolean(false),
    touchStateLayer: knob.boolean(true, "touch-state-layer"),
    customColours: knob.boolean(false, "custom colours (below)"),
    accentColor: knob.color("#0b8043"),
    checkmarkColor: knob.select(["auto", "white", "black"], "auto"),
    uncheckedColor: knob.color("#0b8043"),
    uncheckedBgColor: knob.color("#e6f4ea"),
  });

  return (
    <>
      <Layout.PaneHeader title="Checkbox" />
      <Knobs knobs={knobs}>
        <div class="grid justify-items-start gap-2">
          <Checkbox
            name="updates"
            label={knobs.values.label}
            indeterminate={knobs.values.indeterminate}
            disabled={knobs.values.disabled}
            error={knobs.values.error}
            touch-state-layer={knobs.values.touchStateLayer}
            accentColor={
              knobs.values.customColours ? knobs.values.accentColor : undefined
            }
            checkmarkColor={knobs.values.checkmarkColor}
            uncheckedColor={
              knobs.values.customColours
                ? knobs.values.uncheckedColor
                : undefined
            }
            uncheckedBgColor={
              knobs.values.customColours
                ? knobs.values.uncheckedBgColor
                : undefined
            }
            bind:checked={checked}
          />
          <Checkbox name="plain" aria-label="Without a label" />
          <Checkbox name="off" label="Disabled, checked" checked disabled />
          <Checkbox name="err" label="Error, unchecked" error />
          <Checkbox name="err2" label="Error, checked" error checked />
          <p class="text-body-medium text-on-surface-variant">
            bind:checked is {checked.value ? "true" : "false"}
          </p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Checkbox: @seanperez/ui" };
