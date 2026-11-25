import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  FABMenu,
  Layout,
  fabMenuColors,
  fabMenuLayouts,
  fabSizes,
} from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    layout: knob.select(fabMenuLayouts, "menu"),
    color: knob.select(fabMenuColors, "primary"),
    size: knob.select(
      ["auto", ...fabSizes.filter((size) => size !== "small")] as const,
      "auto",
    ),
    extended: knob.boolean(false),
    placement: knob.select(
      ["above", "below"] as const,
      "above",
      "placement (menu layout)",
    ),
    // `disabled` on the last item.
    disabledItem: knob.boolean(false, "disabled (New favourite)"),
  });

  return (
    <>
      <Layout.PaneHeader title="FAB menu" />
      <Knobs knobs={knobs}>
        {/* Keyed: `layout` and `placement` decide the elements, fixed at the first render. */}
        <FABMenu.Root
          key={`${knobs.values.layout}-${knobs.values.placement}`}
          layout={knobs.values.layout}
          color={knobs.values.color}
          extended={knobs.values.extended}
          placement={knobs.values.placement}
        >
          <FABMenu.Trigger
            icon="edit"
            label="Create"
            size={knobs.values.size === "auto" ? undefined : knobs.values.size}
          />
          <FABMenu.Content>
            <FABMenu.Item icon="mail" label="New message" />
            <FABMenu.Item icon="notifications" label="New reminder" />
            <FABMenu.Item
              icon="star"
              label="New favourite"
              disabled={knobs.values.disabledItem}
            />
          </FABMenu.Content>
        </FABMenu.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "FAB menu: @seanperez/ui" };
