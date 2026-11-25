import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Avatar, IconButton, Layout, TitleBar } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

/**
 * TitleBar: the title row of a floating, non-modal window (a chat window, a compose window).
 * The frame around it here is only the demo's: the real window is `@seanperez/chat`'s
 * `ChatWindow`.
 */
export default component$(() => {
  const knobs = useKnobs({
    title: knob.text("Ada Lovelace"),
    size: knob.select(["sm", "md"] as const, "sm"),
    tone: knob.select(["surface", "container"] as const, "container"),
    headingLevel: knob.select(["2", "3", "4"] as const, "2"),
    avatar: knob.boolean(true),
    actions: knob.boolean(true),
  });
  const minimized = useSignal(false);

  return (
    <>
      <Layout.PaneHeader title="Title bar" />
      <Knobs knobs={knobs}>
        {/* The demo's window frame (placement only). */}
        <section
          aria-labelledby="title-bar-demo"
          class="w-90 max-w-full overflow-hidden rounded-t-xl bg-surface shadow-3"
        >
          <TitleBar
            title={knobs.values.title}
            headingId="title-bar-demo"
            headingLevel={
              knobs.values.headingLevel === "4"
                ? 4
                : knobs.values.headingLevel === "3"
                  ? 3
                  : 2
            }
            size={knobs.values.size}
            tone={knobs.values.tone}
          >
            {knobs.values.avatar && (
              <Avatar
                q:slot="leading"
                name={knobs.values.title}
                size={knobs.values.size === "sm" ? "xs" : "appbar"}
                decorative
              />
            )}
            {/* Each slotted child directly under the component: a Fragment around them does
                not project into a named slot. */}
            {knobs.values.actions && (
              <IconButton
                q:slot="trailing"
                size="xs"
                icon={minimized.value ? "expand_less" : "minimize"}
                label="Minimize"
                aria-expanded={minimized.value ? "false" : "true"}
                aria-controls="title-bar-demo-body"
                onClick$={() => (minimized.value = !minimized.value)}
              />
            )}
            {knobs.values.actions && (
              <IconButton q:slot="trailing" size="xs" icon="close" label="Close" />
            )}
          </TitleBar>
          <p
            id="title-bar-demo-body"
            hidden={minimized.value}
            class="p-4 text-body-medium text-on-surface-variant"
          >
            The window's content.
          </p>
        </section>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Title bar: @seanperez/ui" };
