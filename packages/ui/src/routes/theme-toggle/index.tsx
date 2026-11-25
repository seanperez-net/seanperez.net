import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout, ThemeToggle } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    size: knob.select(["md", "sm"] as const, "md"),
    outlined: knob.boolean(true),
    label: knob.text("Swap light and dark"),
  });

  return (
    <>
      <Layout.PaneHeader title="Theme toggle" />
      {/* It writes the theme context `Layout.Root` provides: the whole playground follows. */}
      <Knobs knobs={knobs}>
        <ThemeToggle
          size={knobs.values.size}
          outlined={knobs.values.outlined}
          label={knobs.values.label}
        />
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Theme toggle: @seanperez/ui" };
