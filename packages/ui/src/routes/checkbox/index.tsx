import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Checkbox, Layout } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const checked = useSignal(true);
  const knobs = useKnobs({
    label: knob.text("Email me updates"),
    indeterminate: knob.boolean(false),
    disabled: knob.boolean(false),
    error: knob.boolean(false),
    touchStateLayer: knob.boolean(true, "touch-state-layer"),
    customColors: knob.boolean(false, "custom colors (below)"),
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
              knobs.values.customColors ? knobs.values.accentColor : undefined
            }
            checkmarkColor={knobs.values.checkmarkColor}
            uncheckedColor={
              knobs.values.customColors
                ? knobs.values.uncheckedColor
                : undefined
            }
            uncheckedBgColor={
              knobs.values.customColors
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
