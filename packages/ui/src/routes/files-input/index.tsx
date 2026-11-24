import { $, component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, Files, Knobs, Layout, knob, useKnobs } from "../../index";

export default component$(() => {
  const submitted = useSignal<string[]>([]);
  const knobs = useKnobs({
    variant: knob.select(["outlined", "filled"], "outlined"),
    label: knob.text("Attachments"),
    supportingText: knob.text("Images or PDF, up to 5 MB"),
    error: knob.text(""),
    accept: knob.select(["", "image/*", "image/*,.pdf"], ""),
    multiple: knob.boolean(false),
    required: knob.boolean(false),
    disabled: knob.boolean(false),
    showPreview: knob.boolean(true),
    removable: knob.boolean(true),
    promptIcon: knob.boolean(true),
    prompt: knob.text("Click or drag and drop file"),
    promptMultiple: knob.text("Click or drag and drop files"),
  });

  // What the form would post: the browser's own FormData of the form.
  const showFormData$ = $((_: SubmitEvent, form: HTMLFormElement) => {
    const lines: string[] = [];
    new FormData(form).forEach((v, key) =>
      lines.push(
        v instanceof File
          ? `${key}: ${v.name} (${v.size} bytes)`
          : `${key}: ${v}`,
      ),
    );
    submitted.value = lines;
  });

  return (
    <>
      <Layout.PaneHeader title="Files input" />
      <Knobs knobs={knobs}>
        <form
          class="grid w-full max-w-md gap-4"
          preventdefault:submit
          onSubmit$={showFormData$}
        >
          <Files.Root
            name="attachments"
            variant={knobs.values.variant}
            label={knobs.values.label || undefined}
            aria-label={knobs.values.label ? undefined : "Attachments"}
            supportingText={knobs.values.supportingText || undefined}
            error={knobs.values.error || undefined}
            accept={knobs.values.accept || undefined}
            multiple={knobs.values.multiple}
            required={knobs.values.required}
            disabled={knobs.values.disabled}
            showPreview={knobs.values.showPreview}
          >
            <Files.Label />
            <Files.Dropzone>
              <Files.Input />
              <Files.Preview
                removable={knobs.values.removable}
                promptIcon={knobs.values.promptIcon ? "upload_file" : null}
                prompt={knobs.values.prompt}
                promptMultiple={knobs.values.promptMultiple}
              />
            </Files.Dropzone>
            <Files.SupportingText />
          </Files.Root>
          <Button
            type="submit"
            look="filled"
            label="Submit"
            class="justify-self-start"
          />
          <output class="text-body-medium text-on-surface-variant">
            {submitted.value.length
              ? submitted.value.map((line) => <div key={line}>{line}</div>)
              : "Submit to see what the form posts."}
          </output>
        </form>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Files input: @seanperez/ui" };
