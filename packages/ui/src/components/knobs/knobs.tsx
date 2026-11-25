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
 * `Separator`. Only the two-column grid is the frame's own.
 *
 * The grid answers to the FRAME's width, not the window's (owner, 2026-11-24: the knobs column
 * was squeezed when the supporting pane was open or the window small). The `<section>` is a
 * Tailwind v4 `@container` (`container-type: inline-size`) and the grid inside it uses container
 * variants: knobs beside the demo from `@2xl` (Tailwind's `--container-2xl`, 42rem = 672px; rule
 * L13: container sizes are Tailwind's, not our M3 window breakpoints), under it below that. 42rem
 * leaves the demo about 24rem beside an 18rem panel, enough for a 56dp text field or select. Was
 * `min-[40rem]:`, a viewport media query, which kept two columns in a ~530px frame.
 */
/*
 * Side by side (owner, 2026-11-24: "the main pane in the knobs should stay one size and not
 * overflow what should overflow is the knobs pane"): the frame fills the pane's body and the
 * knobs panel scrolls inside it, so a long list of knobs no longer makes the whole pane (and the
 * preview) scroll. How: the card's one row is `minmax(0,1fr)` (it fills the card, which the pane
 * stretches to its body row), the frame and grid are `h-full`, and the panel is `h-0 min-h-full`
 * so its content adds nothing to the frame's height and it scrolls in the row it is given
 * (`overflow-y-auto`, `overscroll-contain` so the end of the knobs does not scroll the page).
 * Stacked (below `@2xl`) nothing changes: the frame is as tall as its content and the pane scrolls.
 */
const knobsVariants = tv({
  slots: {
    frame: "@container h-full",
    grid: "grid h-full grid-cols-1 @2xl:grid-cols-[minmax(0,1fr)_auto_minmax(14rem,18rem)]",
    preview: "grid min-h-48 place-items-center p-8",
    panel:
      "flex flex-col gap-3 p-4 @2xl:h-0 @2xl:min-h-full @2xl:overflow-y-auto @2xl:overscroll-contain",
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
    // `class` here is placement the Card API does not cover (rule U6): one row that fills the
    // card, so the frame can fill the pane and the knobs panel scroll (see `knobsVariants`).
    <Card.Root variant="outlined" class="grid-rows-[minmax(0,1fr)]">
      <section class={cls.frame()}>
        <div class={cls.grid()}>
          <div class={cls.preview()}>
            <Slot />
          </div>
          {/* Wide: a vertical line beside the panel; stacked: a horizontal one above it. The panel
            is already a named landmark, so the lines are decorative. */}
          <Separator
            decorative
            orientation="vertical"
            class="@max-2xl:hidden"
          />
          <Separator decorative class="@2xl:hidden" />
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
                // No M3 color field exists: the browser's color input, as before.
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
        </div>
      </section>
    </Card.Root>
  );
});
