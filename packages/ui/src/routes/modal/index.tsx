import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, Knobs, Layout, Modal, knob, useKnobs } from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    position: knob.select(
      ["center", "fullScreen", "bottom", "left", "right"] as const,
      "center",
    ),
    title: knob.text("Delete this page?"),
    paragraphs: knob.number(1, { min: 1, max: 30 }),
    closeOnOutsideClick: knob.boolean(true),
    icon: knob.select(
      ["none", "info", "mail"] as const,
      "none",
      "icon (center)",
    ),
    dividers: knob.boolean(false),
    actionLabel: knob.text("Save", "actionLabel (bar)"),
    dragHandle: knob.boolean(true, "dragHandle (bottom)"),
  });
  const open = useSignal(false);

  return (
    <>
      <Layout.PaneHeader title="Modal" />
      <Knobs knobs={knobs}>
        <Modal.Root
          bind:open={open}
          position={knobs.values.position}
          closeOnOutsideClick={knobs.values.closeOnOutsideClick}
        >
          <Modal.Trigger>Open</Modal.Trigger>
          <Modal.Content>
            {knobs.values.position === "bottom" && knobs.values.dragHandle && (
              <Modal.DragHandle />
            )}
            {knobs.values.position === "center" ? (
              <Modal.Header
                icon={
                  knobs.values.icon === "none" ? undefined : knobs.values.icon
                }
              >
                <Modal.Title>{knobs.values.title}</Modal.Title>
                <Modal.Description>
                  A basic dialog. Escape, the scrim and both buttons close it.
                </Modal.Description>
              </Modal.Header>
            ) : (
              <Modal.CloseTitleAction
                title={knobs.values.title}
                namesDialog
                actionLabel={
                  knobs.values.position === "fullScreen"
                    ? knobs.values.actionLabel || undefined
                    : undefined
                }
                onAction$={() => (open.value = false)}
              />
            )}
            <Modal.Section dividers={knobs.values.dividers}>
              {Array.from({ length: knobs.values.paragraphs }, (_, index) => (
                <p key={index} class="pb-4 text-body-medium">
                  Paragraph {index + 1}. With enough of these the section
                  scrolls and the bar and the buttons stay where they are.
                </p>
              ))}
            </Modal.Section>
            <Modal.Footer>
              <Modal.Close>Cancel</Modal.Close>
              <Button label="Delete" onClick$={() => (open.value = false)} />
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Modal: @seanperez/ui" };
