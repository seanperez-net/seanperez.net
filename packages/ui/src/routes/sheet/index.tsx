import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Knobs, Layout, List, Sheet, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    show: knob.boolean(false, "show the standard sheet"),
    rows: knob.number(12, { min: 1, max: 40 }),
    label: knob.text("Places"),
  });
  const detent = useSignal("peek");

  return (
    <>
      <Layout.PaneHeader title="Bottom sheet" />
      <Knobs knobs={knobs}>
        <div class="grid max-w-md gap-2 text-body-medium">
          <p>
            The standard bottom sheet sits at the bottom of the window beside
            the page. Drag its handle, press it (Enter / Space) to cycle the
            heights, or use the arrow keys, Home and End on it.
          </p>
          <p class="text-on-surface-variant">Detent: {detent.value}</p>
          <p class="text-on-surface-variant">
            The modal bottom sheet is Modal with position bottom (see Modal).
          </p>
        </div>
      </Knobs>
      {knobs.values.show && (
        <Sheet label={knobs.values.label} bind:detent={detent}>
          <h2 q:slot="header" class="px-4 pb-2 text-title-medium">
            {knobs.values.label}
          </h2>
          <List.Root>
            {Array.from({ length: knobs.values.rows }, (_, i) => (
              <List.Item key={i} headline={`Place ${i + 1}`} />
            ))}
          </List.Root>
        </Sheet>
      )}
    </>
  );
});

export const head: DocumentHead = { title: "Bottom sheet: @seanperez/ui" };
