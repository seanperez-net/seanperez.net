import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  Button,
  IconButton,
  Knobs,
  Layout,
  Tooltip,
  knob,
  useKnobs,
} from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    variant: knob.select(["plain", "rich"] as const, "plain"),
    side: knob.select(["top", "bottom", "left", "right"] as const, "top"),
    text: knob.text("Grants access to the shared folder"),
    subhead: knob.text("Rich tooltip"),
    actions: knob.select(["none", "one", "two"] as const, "one"),
    persistent: knob.boolean(false, "persistent (rich, opens on click)"),
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
          {/* Remounted per variant, so `persistent` (read once by the Root) applies. */}
          <Tooltip.Root
            key={`${knobs.values.variant}-${knobs.values.persistent}`}
            id="tooltip-demo"
            persistent={
              knobs.values.variant === "rich" && knobs.values.persistent
            }
          >
            <Tooltip.Trigger>
              <Button
                look="outlined"
                label="Share"
                aria-describedby="tooltip-demo"
              />
            </Tooltip.Trigger>
            <Tooltip.Content
              variant={knobs.values.variant}
              side={knobs.values.side}
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
