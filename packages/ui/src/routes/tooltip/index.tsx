import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, IconButton, Layout, Tooltip } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    variant: knob.select(["plain", "rich"] as const, "plain"),
    // `default`: no `side` prop (M3: plain above, rich below).
    side: knob.select(
      ["default", "top", "bottom", "left", "right"] as const,
      "default",
    ),
    text: knob.text("Grants access to the shared folder"),
    subhead: knob.text("Rich tooltip"),
    actions: knob.select(["none", "one", "two"] as const, "one"),
    persistent: knob.boolean(false, "persistent (rich, opens on click)"),
    type: knob.select(["description", "label"] as const, "description"),
    delay: knob.number(700, { min: 0, max: 2000, step: 100 }, "delay (ms)"),
  });

  return (
    <>
      <Layout.PaneHeader title="Tooltip" />
      <div class="grid gap-8">
        <section class="grid gap-2">
          <h2 class="text-title-medium">Plain label tooltips (no component)</h2>
          <p class="text-body-medium text-on-surface-variant">
            Every icon button shows its name as a plain tooltip on hover and
            keyboard focus, from one provider in Layout.Root.
          </p>
          <div class="flex gap-2">
            <IconButton icon="edit" label="Edit" />
            <IconButton icon="star" label="Add to favourites" />
            <IconButton icon="mail" label="Send by email" />
          </div>
        </section>
        <Knobs knobs={knobs}>
          {/* Every option applies live: no remount key. */}
          <Tooltip.Root
            id="tooltip-demo"
            type={knobs.values.type}
            delay={knobs.values.delay}
            persistent={
              knobs.values.variant === "rich" && knobs.values.persistent
            }
          >
            <Tooltip.Trigger>
              {/* `label`: the tip repeats the control's name, so the control is not
                  described by it. */}
              <Button
                look="outlined"
                label="Share"
                aria-describedby={
                  knobs.values.type === "description"
                    ? "tooltip-demo"
                    : undefined
                }
              />
            </Tooltip.Trigger>
            <Tooltip.Content
              variant={knobs.values.variant}
              side={
                knobs.values.side === "default" ? undefined : knobs.values.side
              }
              subhead={knobs.values.subhead || undefined}
            >
              {knobs.values.text}
              {knobs.values.variant === "rich" &&
                knobs.values.actions !== "none" && (
                  <>
                    <Button q:slot="actions" look="text" label="Learn more" />
                    {knobs.values.actions === "two" && (
                      <Button q:slot="actions" look="text" label="Dismiss" />
                    )}
                  </>
                )}
            </Tooltip.Content>
          </Tooltip.Root>
        </Knobs>
      </div>
    </>
  );
});

export const head: DocumentHead = { title: "Tooltip: @seanperez/ui" };
