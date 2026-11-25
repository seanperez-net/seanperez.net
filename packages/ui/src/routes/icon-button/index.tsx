import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  IconButton,
  Layout,
  iconButtonLooks,
  iconButtonShapes,
  iconButtonSizes,
  iconButtonWidths,
  iconNames,
} from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

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
    // What it renders: a <button>, or the router's <Link> drawn as an icon button.
    element: knob.select(["button", "link"] as const, "button"),
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
          {knobs.values.element === "link" ? (
            <IconButton
              type="link"
              href="/button/"
              icon={knobs.values.icon}
              label={knobs.values.label}
              look={knobs.values.look}
              size={knobs.values.size}
              width={knobs.values.width}
              shape={knobs.values.shape}
              flipIconInRtl={knobs.values.flipIconInRtl}
              softDisabled={knobs.values.softDisabled}
            />
          ) : (
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
          )}
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Icon button: @seanperez/ui" };
