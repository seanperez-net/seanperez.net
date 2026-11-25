import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Combobox, Layout } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

const fruits = {
  Citrus: ["Orange", "Lemon", "Lime", "Grapefruit"],
  Berries: ["Strawberry", "Blueberry", "Raspberry"],
};

export default component$(() => {
  const knobs = useKnobs({
    variant: knob.select(["outlined", "tonal"] as const, "outlined"),
    label: knob.text("Fruit"),
    disabled: knob.boolean(false),
    error: knob.text(""),
  });
  const value = useSignal("");

  return (
    <>
      <Layout.PaneHeader title="Combobox" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-sm gap-4">
          <Combobox.Root
            bind:value={value}
            name="fruit"
            variant={knobs.values.variant}
            disabled={knobs.values.disabled}
            error={knobs.values.error}
          >
            <Combobox.Input
              label={knobs.values.label}
              placeholder="Type to search"
            />
            <Combobox.Content>
              <Combobox.Empty>No matching fruit</Combobox.Empty>
              {Object.entries(fruits).map(([group, items]) => (
                <Combobox.Group key={group}>
                  <Combobox.GroupLabel>{group}</Combobox.GroupLabel>
                  {items.map((item) => (
                    <Combobox.Item
                      key={item}
                      value={item.toLowerCase()}
                      label={item}
                      disabled={item === "Lime"}
                    />
                  ))}
                </Combobox.Group>
              ))}
              <Combobox.Item
                value="kiwi"
                label="Kiwi"
                keywords={["chinese gooseberry"]}
              />
            </Combobox.Content>
          </Combobox.Root>
          <p class="text-body-medium text-on-surface-variant">
            bind:value is "{value.value}"
          </p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Combobox: @seanperez/ui" };
