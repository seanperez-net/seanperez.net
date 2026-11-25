import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { IconButton, Layout, ScrollField } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";
import type { ScrollFieldMode, ScrollFieldValue } from "../../index";

const units = ["oz", "L", "mL", "cup"] as const;

export default component$(() => {
  const knobs = useKnobs({
    size: knob.select(["sm", "md", "lg"] as const, "sm"),
    list: knob.select(["range", "strings"] as const, "range"),
    min: knob.number(0),
    max: knob.number(99),
    step: knob.number(1, { min: 0 }),
    pad: knob.number(0, { min: 0 }),
    loop: knob.boolean(false),
    mode: knob.select(["scroll", "input"] as const, "scroll"),
    disabled: knob.boolean(false),
    error: knob.text(""),
    reserveMessage: knob.boolean(true),
    label: knob.text("Amount"),
  });
  const value = useSignal<ScrollFieldValue>(7);
  // One keyboard toggle for the paired fields (M3: "place this button near the scroll field").
  const tempMode = useSignal<ScrollFieldMode>("scroll");
  const whole = useSignal<ScrollFieldValue>(72);
  const tenth = useSignal<ScrollFieldValue>(5);
  const waterMode = useSignal<ScrollFieldMode>("scroll");
  const amount = useSignal<ScrollFieldValue>(0.8);
  const unit = useSignal<ScrollFieldValue>("L");

  return (
    <>
      <Layout.PaneHeader title="Scroll field" />
      <div class="grid gap-8">
        <Knobs knobs={knobs}>
          <div class="grid justify-items-center gap-4">
            <ScrollField
              data-demo="knobs"
              size={knobs.values.size}
              options={knobs.values.list === "strings" ? units : undefined}
              min={knobs.values.min}
              max={knobs.values.max}
              step={knobs.values.step}
              pad={knobs.values.pad || undefined}
              reserveMessage={knobs.values.reserveMessage}
              loop={knobs.values.loop}
              mode={knobs.values.mode}
              disabled={knobs.values.disabled}
              error={knobs.values.error || undefined}
              label={knobs.values.label}
              bind:value={value}
            />
            <p class="text-body-medium text-on-surface-variant">
              value {String(value.value)}
            </p>
          </div>
        </Knobs>

        <section class="grid gap-6">
          <h2 class="text-title-large">Sizes</h2>
          <div class="flex flex-wrap items-start gap-6">
            <ScrollField data-demo="sm" size="sm" label="Small" value={7} />
            <ScrollField
              data-demo="md"
              size="md"
              label="Medium"
              min={100}
              max={300}
              value={107}
            />
            <ScrollField
              data-demo="lg"
              size="lg"
              label="Large"
              min={1000}
              max={1100}
              value={1007}
            />
          </div>

          <h2 class="text-title-large">
            Paired fields with labels and a keyboard toggle
          </h2>
          <div class="grid w-fit gap-2">
            <div class="flex items-center justify-between gap-4">
              <span id="temp-label" class="text-title-medium">
                Temperature
              </span>
              <IconButton
                toggle
                icon="keyboard"
                label="Type the values"
                selected={tempMode.value === "input"}
                onSelectedChange$={(on) =>
                  (tempMode.value = on ? "input" : "scroll")
                }
              />
            </div>
            <div class="flex items-start gap-2">
              <ScrollField
                data-demo="degrees"
                label="Degrees"
                min={60}
                max={90}
                bind:value={whole}
                bind:mode={tempMode}
              />
              <span class="self-center text-display-medium text-on-surface">
                .
              </span>
              <ScrollField
                data-demo="tenths"
                label="Tenths of a degree"
                min={0}
                max={9}
                loop
                bind:value={tenth}
                bind:mode={tempMode}
              />
              <span class="self-center text-display-medium text-on-surface">
                °F
              </span>
            </div>
            <p class="text-body-medium text-on-surface-variant">
              {String(whole.value)}.{String(tenth.value)} °F
            </p>
          </div>

          <h2 class="text-title-large">Numbers and strings</h2>
          <div class="grid w-fit gap-2">
            <div class="flex items-center justify-between gap-4">
              <span class="text-title-medium">Custom amount</span>
              <IconButton
                toggle
                icon="keyboard"
                label="Type the amount"
                selected={waterMode.value === "input"}
                onSelectedChange$={(on) =>
                  (waterMode.value = on ? "input" : "scroll")
                }
              />
            </div>
            <div class="flex items-start gap-2">
              <ScrollField
                data-demo="amount"
                size="md"
                label="Amount"
                min={0}
                max={5}
                step={0.1}
                bind:value={amount}
                bind:mode={waterMode}
              />
              <ScrollField
                data-demo="unit"
                label="Unit"
                options={units}
                bind:value={unit}
                bind:mode={waterMode}
              />
            </div>
          </div>

          <h2 class="text-title-large">Looping, disabled, error</h2>
          <div class="flex flex-wrap items-start gap-6">
            <ScrollField
              data-demo="loop"
              label="Minutes"
              options={Array.from({ length: 60 }, (_, i) =>
                String(i).padStart(2, "0"),
              )}
              loop
              value="07"
            />
            <ScrollField
              data-demo="disabled"
              label="Disabled"
              disabled
              value={7}
            />
            <ScrollField
              data-demo="disabled-input"
              label="Disabled, input mode"
              disabled
              mode="input"
              value={7}
            />
            <ScrollField
              data-demo="error"
              label="With an error"
              value={95}
              error="Above 90"
            />
            <ScrollField
              data-demo="input"
              label="Input mode"
              mode="input"
              value={7}
            />
            <ScrollField
              data-demo="short"
              label="Short (120dp)"
              class="h-[140px]"
              value={7}
            />
          </div>
        </section>
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "Scroll field: @seanperez/ui",
};
