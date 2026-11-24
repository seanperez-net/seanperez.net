import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { DatePicker, Knobs, Layout, knob, useKnobs } from "../../index";

export default component$(() => {
  const date = useSignal("");
  const start = useSignal("");
  const end = useSignal("");
  const knobs = useKnobs({
    picker: knob.select(["docked", "modal", "modal input"], "docked", "picker"),
    mode: knob.select(["single", "range"], "single", "mode (modal)"),
    inputVariant: knob.select(
      ["outlined", "filled"],
      "outlined",
      "field (docked)",
    ),
    label: knob.text("Date"),
    min: knob.text("", "min (YYYY-MM-DD)"),
    max: knob.text("", "max (YYYY-MM-DD)"),
    clearable: knob.boolean(false),
    disabled: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Date picker" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-sm gap-4">
          {knobs.values.picker === "docked" ? (
            <DatePicker.Root
              label={knobs.values.label}
              inputVariant={knobs.values.inputVariant}
              min={knobs.values.min}
              max={knobs.values.max}
              clearable={knobs.values.clearable}
              disabled={knobs.values.disabled}
              bind:value={date}
            >
              <DatePicker.Input />
              <DatePicker.Content />
            </DatePicker.Root>
          ) : (
            <DatePicker.Modal
              key={`${knobs.values.picker}-${knobs.values.mode}`}
              mode={knobs.values.mode}
              initialView={
                knobs.values.picker === "modal input" ? "input" : "calendar"
              }
              dateLabel={knobs.values.label}
              min={knobs.values.min}
              max={knobs.values.max}
              clearable={knobs.values.clearable}
              disabled={knobs.values.disabled}
              bind:value={date}
              bind:startDate={start}
              bind:endDate={end}
            />
          )}
          <p class="text-body-medium text-on-surface-variant">
            {knobs.values.mode === "range" && knobs.values.picker !== "docked"
              ? `startDate: "${start.value}", endDate: "${end.value}"`
              : `value: "${date.value}"`}
          </p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Date picker" };
