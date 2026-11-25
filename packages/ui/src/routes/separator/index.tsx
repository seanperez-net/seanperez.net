import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout, Separator } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    orientation: knob.select(["horizontal", "vertical"] as const, "horizontal"),
    variant: knob.select(
      ["fullWidth", "inset", "middleInset"] as const,
      "fullWidth",
    ),
    decorative: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Separator (divider)" />
      <Knobs knobs={knobs}>
        {/* A horizontal divider spans the column; a vertical one the row's height. */}
        <div
          class={
            knobs.values.orientation === "vertical"
              ? "flex h-32 w-full max-w-md items-stretch"
              : "flex w-full max-w-md flex-col"
          }
        >
          <p class="flex-1 p-4 text-body-medium">First section</p>
          <Separator
            orientation={knobs.values.orientation}
            variant={knobs.values.variant}
            decorative={knobs.values.decorative}
          />
          <p class="flex-1 p-4 text-body-medium">Second section</p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Separator: @seanperez/ui" };
