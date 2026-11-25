import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout, Radio } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

const options = [
  { value: "standard", label: "Standard", hint: "3 to 5 days" },
  { value: "express", label: "Express", hint: "Next day" },
  { value: "pickup", label: "Pick up", hint: "Not available here" },
];

export default component$(() => {
  const knobs = useKnobs({
    orientation: knob.select(["vertical", "horizontal"] as const, "vertical"),
    disabled: knob.boolean(false, "Group disabled"),
    itemDisabled: knob.boolean(true, "Pick up disabled"),
    descriptions: knob.boolean(true),
  });
  const value = useSignal("standard");
  const empty = useSignal("");

  return (
    <>
      <Layout.PaneHeader title="Radio" />
      <Knobs knobs={knobs}>
        <form class="grid gap-8" preventdefault:submit>
          <fieldset class="grid gap-2">
            <legend class="mb-2 text-title-small">Delivery</legend>
            <Radio.Group
              bind:value={value}
              name="delivery"
              orientation={knobs.values.orientation}
              disabled={knobs.values.disabled}
              aria-label="Delivery"
            >
              {options.map((option) => (
                <Radio.Item
                  key={option.value}
                  value={option.value}
                  disabled={
                    option.value === "pickup" && knobs.values.itemDisabled
                  }
                >
                  <Radio.Indicator />
                  <span class="grid">
                    <Radio.Label>{option.label}</Radio.Label>
                    {knobs.values.descriptions && (
                      <Radio.Description>{option.hint}</Radio.Description>
                    )}
                  </span>
                </Radio.Item>
              ))}
            </Radio.Group>
            <p class="text-body-medium text-on-surface-variant">
              bind:value is "{value.value}"
            </p>
          </fieldset>
          <fieldset class="grid gap-2">
            <legend class="mb-2 text-title-small">
              Nothing chosen yet (one Tab stop)
            </legend>
            <Radio.Group bind:value={empty} aria-label="Size" required>
              {["Small", "Medium", "Large"].map((size) => (
                <Radio.Item key={size} value={size.toLowerCase()}>
                  <Radio.Indicator />
                  <Radio.Label>{size}</Radio.Label>
                </Radio.Item>
              ))}
            </Radio.Group>
          </fieldset>
        </form>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Radio: @seanperez/ui" };
