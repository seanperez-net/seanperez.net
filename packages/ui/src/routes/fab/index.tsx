import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { FAB, Layout, fabColors, fabSizes } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    icon: knob.select(["edit", "add", "none"] as const, "edit"),
    label: knob.text("", "label (makes it extended)"),
    extended: knob.boolean(true, "extended (with a label)"),
    color: knob.select(fabColors, "primary"),
    size: knob.select(["auto", ...fabSizes] as const, "auto"),
    element: knob.select(["button", "link"] as const, "button"),
  });

  return (
    <>
      <Layout.PaneHeader title="FAB" />
      <Knobs knobs={knobs}>
        {knobs.values.element === "button" ? (
          <FAB
            icon={knobs.values.icon === "none" ? undefined : knobs.values.icon}
            label={knobs.values.label || undefined}
            aria-label={knobs.values.label ? undefined : "Compose"}
            extended={knobs.values.extended}
            color={knobs.values.color}
            size={knobs.values.size === "auto" ? undefined : knobs.values.size}
          />
        ) : (
          <FAB
            type="link"
            href="/button/"
            icon={knobs.values.icon === "none" ? undefined : knobs.values.icon}
            label={knobs.values.label || undefined}
            aria-label={knobs.values.label ? undefined : "Compose"}
            extended={knobs.values.extended}
            color={knobs.values.color}
            size={knobs.values.size === "auto" ? undefined : knobs.values.size}
          />
        )}
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "FAB: @seanperez/ui" };
