import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Knobs, Layout, Slider, knob, useKnobs } from "../../index";

const sizes = ["xs", "sm", "md", "lg", "xl"] as const;

export default component$(() => {
  const knobs = useKnobs({
    variant: knob.select(
      ["standard", "centered", "range"] as const,
      "standard",
    ),
    orientation: knob.select(["horizontal", "vertical"] as const, "horizontal"),
    size: knob.select(sizes, "md"),
    min: knob.number(0),
    max: knob.number(100),
    step: knob.number(1, { min: 0 }),
    stops: knob.boolean(false),
    icon: knob.select(["none", "volume_up"] as const, "volume_up"),
    iconAtMin: knob.select(["none", "volume_off"] as const, "volume_off"),
    valueIndicator: knob.boolean(true),
    disabled: knob.boolean(false),
    label: knob.text("Volume"),
  });
  const value = useSignal(40);
  const start = useSignal(20);
  const end = useSignal(70);

  return (
    <>
      <Layout.PaneHeader title="Slider" />
      <div class="grid gap-8">
        <Knobs knobs={knobs}>
          <div class="grid w-full max-w-md justify-items-center gap-4">
            <Slider
              variant={knobs.values.variant}
              orientation={knobs.values.orientation}
              size={knobs.values.size}
              min={knobs.values.min}
              max={knobs.values.max}
              step={knobs.values.step}
              stops={knobs.values.stops}
              icon={
                knobs.values.icon === "none" ? undefined : knobs.values.icon
              }
              iconAtMin={
                knobs.values.iconAtMin === "none"
                  ? undefined
                  : knobs.values.iconAtMin
              }
              valueIndicator={knobs.values.valueIndicator}
              disabled={knobs.values.disabled}
              label={knobs.values.label}
              bind:value={value}
              bind:start={start}
              bind:end={end}
            />
            <p class="text-body-medium text-on-surface-variant">
              value {value.value}, start {start.value}, end {end.value}
            </p>
          </div>
        </Knobs>

        <section class="grid gap-8" id="all">
          <h2 class="text-title-large">Every variant and size</h2>
          {(["standard", "centered", "range"] as const).map((variant) => (
            <div key={variant} class="grid gap-6">
              <h3 class="text-title-medium">{variant}</h3>
              {sizes.map((size) => (
                <Slider
                  key={size}
                  data-demo={`${variant}-${size}`}
                  variant={variant}
                  size={size}
                  label={`${variant} ${size}`}
                  value={variant === "centered" ? 70 : 30}
                  start={20}
                  end={60}
                  icon={variant === "standard" ? "volume_up" : undefined}
                  valueIndicator
                />
              ))}
            </div>
          ))}
          <h3 class="text-title-medium">Stops (step 10)</h3>
          <Slider data-demo="stops" label="Stops" step={10} stops value={40} />
          <Slider
            data-demo="stops-range"
            variant="range"
            label="Stops, range"
            step={10}
            stops
            start={20}
            end={60}
          />
          <h3 class="text-title-medium">Vertical</h3>
          <div class="flex gap-10 ps-16">
            <Slider
              data-demo="vertical"
              orientation="vertical"
              size="md"
              label="Standard"
              value={60}
              icon="volume_up"
              valueIndicator
            />
            <Slider
              data-demo="vertical-centered"
              orientation="vertical"
              variant="centered"
              label="Centered"
              value={30}
              valueIndicator
            />
          </div>
          <h3 class="text-title-medium">Disabled</h3>
          <Slider data-demo="disabled" label="Disabled" disabled value={40} />
          <Slider
            data-demo="disabled-range"
            variant="range"
            label="Disabled range"
            disabled
            step={10}
            stops
          />
        </section>
      </div>
    </>
  );
});

export const head: DocumentHead = { title: "Slider: @seanperez/ui" };
