import { $, component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, Chip, ChipGroup, Layout } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    elevated: knob.boolean(false),
    size: knob.select(["md", "sm"] as const, "md"),
    shape: knob.select(["default", "pill"] as const, "default"),
    tone: knob.select(
      ["default", "primary", "error"] as const,
      "default",
      "tone (assist)",
    ),
    appearance: knob.select(
      ["outlined", "tonal", "text"] as const,
      "outlined",
      "appearance (filter)",
    ),
    disabled: knob.boolean(false),
    label: knob.text("Add to calendar"),
    overflow: knob.select(
      ["wrap", "scroll"] as const,
      "wrap",
      "overflow (group)",
    ),
    orientation: knob.select(
      ["horizontal", "vertical"] as const,
      "horizontal",
      "orientation (group)",
    ),
  });
  const vegan = useSignal(true);
  const recipients = useSignal(["Ada", "Grace", "Linus", "Margaret"]);
  const remove$ = $((name: string) => {
    recipients.value = recipients.value.filter((n) => n !== name);
  });
  const reset$ = $(() => {
    recipients.value = ["Ada", "Grace", "Linus", "Margaret"];
  });

  return (
    <>
      <Layout.PaneHeader title="Chip" />
      <Knobs knobs={knobs}>
        <div class="grid gap-8">
          <section class="grid gap-2">
            <h2 class="text-title-small">Assist</h2>
            <ChipGroup
              label="Actions"
              overflow={knobs.values.overflow}
              orientation={knobs.values.orientation}
            >
              <Chip
                label={knobs.values.label}
                leadingIcon="add"
                elevated={knobs.values.elevated}
                disabled={knobs.values.disabled}
                size={knobs.values.size}
                shape={knobs.values.shape}
                tone={knobs.values.tone}
              />
              <Chip
                label="Share"
                elevated={knobs.values.elevated}
                disabled={knobs.values.disabled}
                size={knobs.values.size}
                shape={knobs.values.shape}
                tone={knobs.values.tone}
              />
            </ChipGroup>
          </section>
          <section class="grid gap-2">
            <h2 class="text-title-small">Filter</h2>
            <ChipGroup
              label="Filter by diet"
              overflow={knobs.values.overflow}
              orientation={knobs.values.orientation}
            >
              <Chip
                type="filter"
                label="Vegan"
                bind:selected={vegan}
                elevated={knobs.values.elevated}
                disabled={knobs.values.disabled}
                size={knobs.values.size}
                shape={knobs.values.shape}
                appearance={knobs.values.appearance}
              />
              <Chip
                type="filter"
                label="Gluten free"
                elevated={knobs.values.elevated}
                disabled={knobs.values.disabled}
                size={knobs.values.size}
                shape={knobs.values.shape}
                appearance={knobs.values.appearance}
              />
              <Chip
                type="filter"
                label="With icon"
                leadingIcon="star"
                elevated={knobs.values.elevated}
                disabled={knobs.values.disabled}
                size={knobs.values.size}
                shape={knobs.values.shape}
                appearance={knobs.values.appearance}
              />
            </ChipGroup>
            <p class="text-body-medium text-on-surface-variant">
              Vegan is {vegan.value ? "on" : "off"}
            </p>
          </section>
          <section class="grid gap-2">
            <h2 class="text-title-small">Input (Backspace removes)</h2>
            <ChipGroup
              label="Recipients"
              overflow={knobs.values.overflow}
              orientation={knobs.values.orientation}
            >
              {recipients.value.map((name) => (
                <Chip
                  key={name}
                  type="input"
                  label={name}
                  leadingIcon="person"
                  disabled={knobs.values.disabled}
                  size={knobs.values.size}
                  shape={knobs.values.shape}
                  onRemove$={() => remove$(name)}
                />
              ))}
            </ChipGroup>
            <Button
              look="text"
              label="Reset recipients"
              class="justify-self-start"
              onClick$={reset$}
            />
          </section>
          <section class="grid gap-2">
            <h2 class="text-title-small">Suggestion</h2>
            <ChipGroup
              label="Suggested replies"
              overflow={knobs.values.overflow}
              orientation={knobs.values.orientation}
            >
              <Chip
                type="suggestion"
                label="Sounds good"
                elevated={knobs.values.elevated}
                disabled={knobs.values.disabled}
                size={knobs.values.size}
                shape={knobs.values.shape}
              />
              <Chip
                type="suggestion"
                label="See you then"
                elevated={knobs.values.elevated}
                disabled={knobs.values.disabled}
                size={knobs.values.size}
                shape={knobs.values.shape}
              />
            </ChipGroup>
          </section>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Chip: @seanperez/ui" };
