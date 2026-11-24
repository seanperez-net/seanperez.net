import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { FAB, Knobs, Layout, Toolbar, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    variant: knob.select(["docked", "floating"] as const, "floating"),
    colorScheme: knob.select(["standard", "vibrant"] as const, "standard"),
    orientation: knob.select(["horizontal", "vertical"] as const, "horizontal"),
    fab: knob.boolean(false, "FAB (floating)"),
    divider: knob.boolean(true),
    filled: knob.boolean(true, "filled action"),
    disabled: knob.boolean(false, "redo disabled"),
  });

  return (
    <>
      <Layout.PaneHeader title="Toolbar" />
      <Knobs knobs={knobs}>
        <Toolbar.Root
          aria-label="Text formatting"
          variant={knobs.values.variant}
          colorScheme={knobs.values.colorScheme}
          orientation={knobs.values.orientation}
        >
          <Toolbar.Item icon="undo" label="Undo" />
          <Toolbar.Item
            icon="redo"
            label="Redo"
            disabled={knobs.values.disabled}
          />
          {knobs.values.divider && <Toolbar.Divider />}
          <Toolbar.Item icon="format_bold" label="Bold" toggle selected />
          <Toolbar.Item icon="format_italic" label="Italic" toggle />
          <Toolbar.Item icon="format_underlined" label="Underline" toggle />
          <Toolbar.Item
            icon="link"
            label="Insert link"
            itemStyle={knobs.values.filled ? "filled" : "standard"}
          />
          {knobs.values.fab && knobs.values.variant === "floating" && (
            <FAB
              q:slot="fab"
              icon="add"
              aria-label="New document"
              color={
                knobs.values.colorScheme === "vibrant"
                  ? "tertiary"
                  : "secondary"
              }
            />
          )}
        </Toolbar.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Toolbar: @seanperez/ui" };
