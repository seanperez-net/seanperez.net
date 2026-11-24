import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  Avatar,
  Checkbox,
  Item,
  Knobs,
  Layout,
  Switch,
  knob,
  useKnobs,
} from "../../index";

const heading = "text-title-small text-on-surface-variant";

/** A 56dp leading image (M3 "leading image"): a tinted block stands in for a photo. */
const Thumb = component$(() => (
  <span class="block size-14 bg-tertiary-container" aria-hidden="true" />
));

export default component$(() => {
  const wifi = useSignal(true);
  const expanded = useSignal(false);
  const knobs = useKnobs({
    headline: knob.text("Headline"),
    overline: knob.text(""),
    supportingText: knob.text(
      "Supporting text that is long enough to wrap onto a second line in a narrow pane",
    ),
    trailingSupportingText: knob.text("100+"),
    lines: knob.select(["auto", "one-line", "two-line", "three-line"], "auto"),
    start: knob.select(["none", "icon", "avatar", "image", "checkbox"], "icon"),
    end: knob.select(["none", "icon", "switch"], "icon"),
    density: knob.select(["default", "compact"], "default"),
    inset: knob.select(["default", "none"], "default"),
    align: knob.select(["auto", "top"], "auto"),
    indicator: knob.select(["primary", "secondary"], "primary"),
    supportingLines: knob.select(["auto", "one"], "auto"),
    headlineLines: knob.select(["one", "auto"], "one"),
    selected: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Item" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-xl gap-8">
          <section class="grid gap-2">
            <h2 class={heading}>With the knobs</h2>
            <div class="bg-surface">
              <Item
                headline={knobs.values.headline || undefined}
                overline={knobs.values.overline || undefined}
                supportingText={knobs.values.supportingText || undefined}
                trailingSupportingText={
                  knobs.values.trailingSupportingText || undefined
                }
                lines={
                  knobs.values.lines === "auto" ? undefined : knobs.values.lines
                }
                startIcon={knobs.values.start === "icon" ? "star" : undefined}
                start={
                  knobs.values.start === "avatar" ? (
                    <Avatar name="Ada Lovelace" decorative />
                  ) : knobs.values.start === "image" ? (
                    <Thumb />
                  ) : knobs.values.start === "checkbox" ? (
                    <Checkbox aria-label="Choose this row" />
                  ) : undefined
                }
                endIcon={
                  knobs.values.end === "icon" ? "chevron_right" : undefined
                }
                end={
                  knobs.values.end === "switch" ? (
                    <Switch aria-label="Turn on" bind:checked={wifi} />
                  ) : undefined
                }
                density={knobs.values.density}
                inset={knobs.values.inset}
                align={knobs.values.align}
                indicator={knobs.values.indicator}
                supportingLines={knobs.values.supportingLines}
                headlineLines={knobs.values.headlineLines}
                selected={knobs.values.selected}
              />
            </div>
          </section>

          <section class="grid gap-2">
            <h2 class={heading}>Lines (computed from the text props)</h2>
            <div class="bg-surface">
              <Item headline="One line" startIcon="person" />
              <Item
                headline="Two lines"
                supportingText="Supporting text"
                startIcon="person"
              />
              <Item
                overline="Overline"
                headline="Three lines"
                supportingText="Supporting text that is long enough to wrap onto a second line and then be clamped at two lines, as M3 says"
                startIcon="person"
                trailingSupportingText="9:41"
              />
            </div>
          </section>

          <section class="grid gap-2">
            <h2 class={heading}>M3 configurations</h2>
            <div class="bg-surface">
              <Item
                headline="Leading avatar"
                supportingText="40dp"
                start={<Avatar name="Grace Hopper" decorative />}
              />
              <Item
                headline="Leading image"
                supportingText="56dp"
                start={<Thumb />}
              />
              <Item headline="Leading icon" startIcon="home" />
              <Item headline="Text only" trailingSupportingText="100+" />
              <Item
                headline="Leading checkbox"
                start={<Checkbox aria-label="Leading checkbox" />}
                trailingSupportingText="Trailing text"
              />
              <Item
                headline="Trailing switch"
                startIcon="volume_up"
                end={<Switch aria-label="Sound" bind:checked={wifi} />}
              />
              <Item headline="Trailing icon" endIcon="chevron_right" selected />
            </div>
          </section>

          <section class="grid gap-2">
            <h2 class={heading}>As one button (as="button")</h2>
            <div class="bg-surface">
              <Item
                as="button"
                aria-expanded={expanded.value}
                start={<Avatar name="Ada Lovelace" decorative />}
                headline="Ada Lovelace"
                supportingText={
                  expanded.value
                    ? "Expanded: the whole message would show here."
                    : "A collapsed message: one line of its text, then an ellipsis when it is long"
                }
                supportingLines="one"
                trailingSupportingText="Nov 23"
                onClick$={() => (expanded.value = !expanded.value)}
              />
              <Item as="button" headline="Disabled button row" disabled />
            </div>
          </section>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Item: @seanperez/ui" };
