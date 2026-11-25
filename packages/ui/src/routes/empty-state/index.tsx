import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, EmptyState, Layout } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    size: knob.select(["sm", "md", "lg"] as const, "md"),
    headline: knob.text("No contacts in Trash"),
    description: knob.text("Contacts you delete stay here for 30 days."),
    withIcon: knob.boolean(true, "icon"),
    withAction: knob.boolean(false, "action"),
  });

  return (
    <>
      <Layout.PaneHeader title="Empty state" />
      <Knobs knobs={knobs}>
        <EmptyState
          size={knobs.values.size}
          icon={knobs.values.withIcon ? "delete" : undefined}
          headline={knobs.values.headline || undefined}
          description={knobs.values.description || undefined}
        >
          {knobs.values.withAction && (
            <Button look="tonal" label="Import contacts" />
          )}
        </EmptyState>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Empty state: @seanperez/ui" };
