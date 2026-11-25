import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  Layout,
  SplitButton,
  splitButtonLooks,
  splitButtonSizes,
} from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    look: knob.select(splitButtonLooks, "filled"),
    size: knob.select(splitButtonSizes, "sm"),
    label: knob.text("Save"),
    leadingIcon: knob.select(["none", "edit", "add"] as const, "edit"),
    disabled: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Split button" />
      <Knobs knobs={knobs}>
        <SplitButton.Root
          look={knobs.values.look}
          size={knobs.values.size}
          aria-label="Save"
        >
          <SplitButton.Action
            label={knobs.values.label || undefined}
            aria-label={knobs.values.label ? undefined : "Save"}
            leadingIcon={
              knobs.values.leadingIcon === "none"
                ? undefined
                : knobs.values.leadingIcon
            }
            disabled={knobs.values.disabled}
          />
          <SplitButton.Trigger
            label="More save options"
            disabled={knobs.values.disabled}
          />
          <SplitButton.Content align="end">
            <SplitButton.Item>Save as draft</SplitButton.Item>
            <SplitButton.Item>Save a copy</SplitButton.Item>
            <SplitButton.Separator />
            <SplitButton.Item>Save and close</SplitButton.Item>
          </SplitButton.Content>
        </SplitButton.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Split button: @seanperez/ui" };
