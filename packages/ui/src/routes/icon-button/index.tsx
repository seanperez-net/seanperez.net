import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  IconButton,
  Knobs,
  Layout,
  iconButtonLooks,
  iconButtonShapes,
  iconButtonSizes,
  iconButtonWidths,
  iconNames,
  knob,
  useKnobs,
} from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    icon: knob.select(iconNames, "star"),
    label: knob.text("Add to favourites"),
    look: knob.select(iconButtonLooks, "standard"),
    size: knob.select(iconButtonSizes, "sm"),
    width: knob.select(iconButtonWidths, "default"),
    shape: knob.select(iconButtonShapes, "rounded"),
    toggle: knob.boolean(false),
    selected: knob.boolean(false),
    iconSelected: knob.select(["none", ...iconNames] as const, "star_filled"),
    labelSelected: knob.text("Remove from favourites"),
    flipIconInRtl: knob.boolean(false),
    disabled: knob.boolean(false),
    softDisabled: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Icon button" />
      <Knobs knobs={knobs}>
        {/* `inverse` is drawn for an inverse surface, so the demo puts one behind it. */}
        <div
          class={[
            "inline-flex rounded-md p-4",
            knobs.values.look === "inverse" ? "bg-inverse-surface" : "",
          ]}
        >
          <IconButton
            icon={knobs.values.icon}
            label={knobs.values.label}
            look={knobs.values.look}
            size={knobs.values.size}
            width={knobs.values.width}
            shape={knobs.values.shape}
            toggle={knobs.values.toggle}
            selected={knobs.values.selected}
            onSelectedChange$={(value) => {
              knobs.values.selected = value;
            }}
            iconSelected={
              knobs.values.iconSelected === "none"
                ? undefined
                : knobs.values.iconSelected
            }
            labelSelected={knobs.values.labelSelected}
            flipIconInRtl={knobs.values.flipIconInRtl}
            disabled={knobs.values.disabled}
            softDisabled={knobs.values.softDisabled}
          />
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Icon button: @seanperez/ui" };
