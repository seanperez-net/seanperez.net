import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, Layout, Snackbar, useSnackbar } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

/** The page's button: it must sit inside `Snackbar.Root` to reach `useSnackbar()`. */
const ShowButton = component$<{
  message: string;
  action: string;
  longerAction: boolean;
  showClose: boolean;
  duration: number;
}>((props) => {
  const { showSnackbar$ } = useSnackbar();
  return (
    <Button
      look="filled"
      label="Show snackbar"
      onClick$={() =>
        showSnackbar$({
          message: props.message,
          action: props.action || undefined,
          longerAction: props.longerAction,
          showClose: props.showClose,
          duration: props.duration,
        })
      }
    />
  );
});

export default component$(() => {
  const knobs = useKnobs({
    message: knob.text("Photo has been archived"),
    action: knob.text("Undo"),
    longerAction: knob.boolean(false),
    showClose: knob.boolean(false),
    duration: knob.number(5000, { min: 0, max: 10000, step: 1000 }),
    position: knob.select(["center", "start"] as const, "center"),
  });

  return (
    <>
      <Layout.PaneHeader title="Snackbar" />
      <Knobs knobs={knobs}>
        <Snackbar.Root position={knobs.values.position}>
          <div class="grid justify-items-center gap-2">
            <ShowButton
              message={knobs.values.message}
              action={knobs.values.action}
              longerAction={knobs.values.longerAction}
              showClose={knobs.values.showClose}
              duration={knobs.values.duration}
            />
            <p class="text-body-small text-on-surface-variant">
              Alt+G moves focus to it; Escape closes it.
            </p>
          </div>
        </Snackbar.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Snackbar: @seanperez/ui" };
