import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, Layout, TextField } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const email = useSignal("");
  const picker = useSignal(false);
  const knobs = useKnobs({
    variant: knob.select(["outlined", "filled", "plain", "tonal"], "outlined"),
    type: knob.select(
      ["email", "text", "password", "tel", "url", "search", "number"],
      "email",
    ),
    density: knob.select(["default", "compact"], "default"),
    textSize: knob.select(["auto", "title-large", "headline-small"], "auto"),
    dateType: knob.select(
      ["date", "datetime-local", "month", "time", "week", "color"],
      "date",
      "type (picker field)",
    ),
    resize: knob.select(["none", "vertical", "horizontal", "both"], "none"),
    label: knob.text("Email"),
    placeholder: knob.text("name@example.com"),
    supportingText: knob.text("We never share it"),
    error: knob.text(""),
    leadingIcon: knob.boolean(false),
    trailingIcon: knob.boolean(false),
    prefixText: knob.text(""),
    suffixText: knob.text(""),
    required: knob.boolean(false),
    disabled: knob.boolean(false),
  });

  return (
    <>
      <Layout.PaneHeader title="Text field" />
      <Knobs knobs={knobs}>
        <div class="grid w-full max-w-sm gap-2">
          <TextField
            name="email"
            type={knobs.values.type}
            variant={knobs.values.variant}
            density={knobs.values.density}
            textSize={knobs.values.textSize}
            label={knobs.values.label}
            placeholder={knobs.values.placeholder}
            supportingText={knobs.values.supportingText}
            error={knobs.values.error || undefined}
            leadingIcon={knobs.values.leadingIcon ? "search" : undefined}
            trailingIcon={knobs.values.trailingIcon ? "error" : undefined}
            prefixText={knobs.values.prefixText || undefined}
            suffixText={knobs.values.suffixText || undefined}
            required={knobs.values.required}
            disabled={knobs.values.disabled}
            bind:value={email}
          />
          <TextField
            name="bio"
            type="textarea"
            rows={3}
            variant={knobs.values.variant}
            density={knobs.values.density}
            resize={knobs.values.resize}
            label="Bio"
            disabled={knobs.values.disabled}
          />
          <TextField
            name="when"
            variant={knobs.values.variant}
            density={knobs.values.density}
            type={knobs.values.dateType}
            label="Date"
            showPicker={picker}
            disabled={knobs.values.disabled}
          />
          <Button
            look="text"
            label="Open the date picker"
            onClick$={() => {
              // A new `true` each press: the task runs on a change.
              picker.value = false;
              picker.value = true;
            }}
          />
          <p class="text-body-medium text-on-surface-variant">
            bind:value is "{email.value}"
          </p>
        </div>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Text field: @seanperez/ui" };
