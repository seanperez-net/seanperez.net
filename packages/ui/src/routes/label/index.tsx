import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Knobs, Label, Layout, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({ text: knob.text("Email address") });

  return (
    <>
      <Layout.PaneHeader title="Label" />
      <Knobs knobs={knobs}>
        <div class="grid gap-6">
          <div class="grid gap-1">
            <Label for="label-demo-email" class="text-body-medium">
              {knobs.values.text}
            </Label>
            <input
              id="label-demo-email"
              type="email"
              class="h-10 rounded-xs border border-outline px-3 text-body-large"
            />
          </div>
          <Label class="flex items-center gap-2 text-body-large">
            <input type="checkbox" />
            Double-click me: the box toggles twice, no text is selected
          </Label>
          <Label class="grid gap-1 text-body-medium">
            Wrapped field (double-click a word in it)
            <input
              type="text"
              value="select this word"
              class="h-10 rounded-xs border border-outline px-3 text-body-large"
            />
          </Label>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Label: @seanperez/ui" };
