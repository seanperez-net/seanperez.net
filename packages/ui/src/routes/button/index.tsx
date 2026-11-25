import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  Button,
  Layout,
  buttonLooks,
  buttonShapes,
  buttonSizes,
  buttonTones,
} from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    label: knob.text("Button"),
    look: knob.select(buttonLooks, "filled"),
    size: knob.select(buttonSizes, "sm"),
    shape: knob.select(buttonShapes, "rounded"),
    tone: knob.select(buttonTones, "default", "tone (text look)"),
    toggle: knob.boolean(false, "toggle (not text look)"),
    selected: knob.boolean(false),
    leadingIcon: knob.select(["none", "add", "star", "check"] as const, "add"),
    trailingIcon: knob.select(
      ["none", "arrow_drop_down", "chevron_right", "expand_more"] as const,
      "none",
    ),
    isLoading: knob.boolean(false),
    disabled: knob.boolean(false),
    // What it renders: a <button>, the router's <Link>, a plain <a> (reload), a new tab.
    element: knob.select(
      ["button", "link", "link reload", "link new tab"] as const,
      "button",
    ),
  });

  return (
    <>
      <Layout.PaneHeader title="Button" />
      <Knobs knobs={knobs}>
        {knobs.values.element === "button" ? (
          <Button
            label={knobs.values.label}
            look={knobs.values.look}
            size={knobs.values.size}
            leadingIcon={
              knobs.values.leadingIcon === "none"
                ? undefined
                : knobs.values.leadingIcon
            }
            trailingIcon={
              knobs.values.trailingIcon === "none"
                ? undefined
                : knobs.values.trailingIcon
            }
            isLoading={knobs.values.isLoading}
            disabled={knobs.values.disabled}
            shape={knobs.values.shape}
            tone={knobs.values.tone}
            toggle={knobs.values.toggle}
            selected={knobs.values.selected}
            onSelectedChange$={(value) => {
              knobs.values.selected = value;
            }}
          />
        ) : (
          <Button
            type="link"
            href="/modal/"
            reload={knobs.values.element === "link reload"}
            target={
              knobs.values.element === "link new tab" ? "_blank" : undefined
            }
            label={knobs.values.label}
            look={knobs.values.look}
            size={knobs.values.size}
            leadingIcon={
              knobs.values.leadingIcon === "none"
                ? undefined
                : knobs.values.leadingIcon
            }
            trailingIcon={
              knobs.values.trailingIcon === "none"
                ? undefined
                : knobs.values.trailingIcon
            }
            isLoading={knobs.values.isLoading}
            shape={knobs.values.shape}
            tone={knobs.values.tone}
          />
        )}
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Button: @seanperez/ui" };
