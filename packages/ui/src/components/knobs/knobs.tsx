import { Slot, component$ } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { Button } from "../button";
import { Card } from "../card";
import { Checkbox } from "../checkbox";
import { Select } from "../select";
import { Separator } from "../separator";
import { TextField } from "../text-field";
import type { KnobDefs, KnobsState } from "./knob";

/**
 * The frame is our outlined `Card` (M3: 1dp `outline-variant`, 12dp corners, `surface`, and the
 * `--field-bg` a floated field label paints), the line between preview and panel our
 * `Separator`. Only the two-column grid, stacked below 40rem, is the frame's own.
 */
const knobsVariants = tv({
  slots: {
    grid: "grid grid-cols-1 min-[40rem]:grid-cols-[minmax(0,1fr)_auto_minmax(14rem,18rem)]",
    preview: "grid min-h-48 place-items-center p-8",
    panel: "flex flex-col gap-3 p-4",
    header: "flex items-baseline justify-between gap-2",
    title: "text-title-small text-on-surface-variant",
    colorKnob: "flex flex-col gap-1 text-body-medium",
    colorInput:
      "block h-10 w-full cursor-pointer rounded-xs border border-outline bg-transparent p-1",
  },
});

export type KnobsProps = {
  // Any knob set: the panel only needs the definitions and a place to write values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  knobs: KnobsState<any>;
  /** Heading of the controls panel. Defaults to "Knobs". */
  title?: string;
};

type Values = Record<string, string | number | boolean>;

/**
 * A demo frame in the style of the Material Web catalog: the component under test goes in the
 * default slot, and a panel of controls ("knobs") changes its props live.
 */
export const Knobs = component$<KnobsProps>((props) => {
  const cls = knobsVariants();
  const defs = props.knobs.defs as KnobDefs;
  const values = props.knobs.values as Values;

  return (
    <Card.Root variant="outlined">
      <section class={cls.grid()}>
        <div class={cls.preview()}>
          <Slot />
        </div>
        {/* Wide: a vertical line beside the panel; stacked: a horizontal one above it. The panel
            is already a named landmark, so the lines are decorative. */}
        <Separator
          decorative
          orientation="vertical"
          class="max-[40rem]:hidden"
        />
        <Separator decorative class="min-[40rem]:hidden" />
        <aside class={cls.panel()} aria-label="Component controls">
          <div class={cls.header()}>
            <h3 class={cls.title()}>{props.title ?? "Knobs"}</h3>
            {/* Our `Button` (text look, extra small), not a bare <button>. */}
            <Button
              look="text"
              size="xs"
              label="Reset"
              onClick$={() => {
                for (const name in defs) {
                  values[name] = defs[name].value;
                }
              }}
            />
          </div>
          {Object.entries(defs).map(([name, def]) => {
            const label = def.label ?? name;
            switch (def.type) {
              case "boolean":
                return (
                  <Checkbox
                    key={name}
                    label={label}
                    checked={values[name] as boolean}
                    onChange$={(checked) => (values[name] = checked)}
                  />
                );
              case "number":
                return (
                  <TextField
                    key={name}
                    type="number"
                    label={label}
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={String(values[name])}
                    onInput$={(_, el) => {
                      // A field may be a textarea; this one is `type="number"`.
                      const number = Number((el as HTMLInputElement).value);
                      if (el.value !== "" && !Number.isNaN(number)) {
                        values[name] = number;
                      }
                    }}
                  />
                );
              case "select":
                return (
                  <Select.Root
                    key={name}
                    value={values[name] as string}
                    options={def.options.map((option) => ({
                      value: option,
                      label: option,
                    }))}
                    onValueChange$={(value) => (values[name] = value)}
                  >
                    <Select.Label label={label} />
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {def.options.map((option) => (
                        <Select.Item key={option} value={option}>
                          {option}
                        </Select.Item>
                      ))}
                    </Select.Content>
                    <Select.SupportingText />
                  </Select.Root>
                );
              // No M3 colour field exists: the browser's colour input, as before.
              case "color":
                return (
                  <label key={name} class={cls.colorKnob()}>
                    <span>{label}</span>
                    <input
                      type="color"
                      class={cls.colorInput()}
                      value={values[name] as string}
                      onInput$={(_, el) => (values[name] = el.value)}
                    />
                  </label>
                );
              default:
                return (
                  <TextField
                    key={name}
                    label={label}
                    value={values[name] as string}
                    onInput$={(_, el) => (values[name] = el.value)}
                  />
                );
            }
          })}
        </aside>
      </section>
    </Card.Root>
  );
});
