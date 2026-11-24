import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Knobs, Layout, LoadingIndicator, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    contained: knob.boolean(false),
    size: knob.number(48, { min: 24, max: 240, step: 4 }),
    label: knob.text("Loading news article"),
  });

  return (
    <>
      <Layout.PaneHeader title="Loading indicator" />
      <Knobs knobs={knobs}>
        <LoadingIndicator
          contained={knobs.values.contained}
          size={knobs.values.size}
          aria-label={knobs.values.label}
        />
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Loading indicator: @seanperez/ui" };
