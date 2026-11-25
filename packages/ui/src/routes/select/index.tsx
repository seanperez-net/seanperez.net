import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, Layout, Select } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";
import type { SelectOption } from "../../index";

const fruits: SelectOption[] = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "blueberry", label: "Blueberry" },
  { value: "cherry", label: "Cherry" },
  { value: "grape", label: "Grape" },
  { value: "lemon", label: "Lemon", disabled: true },
  { value: "mango", label: "Mango" },
  { value: "orange", label: "Orange" },
];

export default component$(() => {
  const fruit = useSignal("");
  const knobs = useKnobs({
    variant: knob.select(["outlined", "filled", "plain", "tonal"], "outlined"),
    density: knob.select(
      ["default", "compact"],
      "default",
      "density (plain, tonal)",
    ),
    label: knob.text("Fruit"),
    placeholder: knob.text(""),
    supportingText: knob.text("Lemon is out of stock"),
    error: knob.text(""),
    required: knob.boolean(false),
    disabled: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Select" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-sm gap-2">
          <Select.Root
            name="fruit"
            variant={knobs.values.variant}
            density={knobs.values.density}
            options={fruits}
            required={knobs.values.required}
            disabled={knobs.values.disabled}
            error={knobs.values.error || undefined}
            bind:value={fruit}
          >
            <Select.Label label={knobs.values.label} />
            <Select.Trigger>
              <Select.Value
                placeholder={knobs.values.placeholder || undefined}
              />
            </Select.Trigger>
            <Select.Content>
              {fruits.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Content>
            <Select.HiddenSelect />
            <Select.SupportingText
              supportingText={knobs.values.supportingText}
            />
          </Select.Root>
          {/* Groups, and the error line on its own (no SupportingText). */}
          <Select.Root
            name="food"
            variant={knobs.values.variant}
            density={knobs.values.density}
            required={knobs.values.required}
            disabled={knobs.values.disabled}
            error={knobs.values.error || undefined}
          >
            <Select.Label label="Food" />
            <Select.Trigger>
              <Select.Value placeholder="Pick one" />
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                <Select.GroupLabel>Fruit</Select.GroupLabel>
                <Select.Item value="apple">
                  Apple
                  <Select.ItemIndicator />
                </Select.Item>
                <Select.Item value="pear">
                  Pear
                  <Select.ItemIndicator />
                </Select.Item>
              </Select.Group>
              <Select.Group>
                <Select.GroupLabel>Vegetables</Select.GroupLabel>
                <Select.Item value="carrot">
                  Carrot
                  <Select.ItemIndicator />
                </Select.Item>
                <Select.Item value="leek">
                  Leek
                  <Select.ItemIndicator />
                </Select.Item>
              </Select.Group>
            </Select.Content>
            <Select.ErrorMessage />
          </Select.Root>
          <p class="text-body-medium text-on-surface-variant">
            bind:value is "{fruit.value}"
          </p>
          <Button
            look="text"
            label="Set the value to mango from outside"
            class="justify-self-start"
            onClick$={() => (fruit.value = "mango")}
          />
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Select: @seanperez/ui" };
