import { $, component$, noSerialize, useContext } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import {
  filesContextId,
  filesDescriptionId,
  filesPromptId,
} from "./files-context";

/**
 * The native `<input type="file">`, laid transparent over the whole drop zone. From e-store's
 * `components/files-input/files-input.tsx` (2026-11-23).
 *
 * Because the input itself covers the zone, a click anywhere opens the picker and a file dropped
 * anywhere lands on the input: the browser's own drop handling for file inputs fills `files` and
 * fires `input` and `change` (no `dragover` / `drop` handlers, nothing to `preventDefault`). Enter
 * and Space on the focused input open the picker (native).
 *
 * Changed from e-store: Root's `files` follow the input's `change`; `dragenter` / `dragleave` /
 * `drop` set the drag state (no default prevented); `aria-describedby` names the prompt and the
 * supporting text; `aria-invalid` only while an error is shown and the field is enabled; no
 * `caret-*` / `text-*` classes (an invisible file input shows neither); `cursor-default` when
 * disabled (e-store `not-allowed`, as TextField).
 */
export const filesInputVariants = tv({
  base: [
    "peer",
    "absolute",
    "inset-0",
    "z-10",
    "m-0",
    "size-full",
    "cursor-pointer",
    "p-0",
    "opacity-0",
    "outline-none",
    "disabled:cursor-default",
    "-webkit-tap-highlight-color-transparent",
  ],
});

export const FilesInput = component$(() => {
  const ctx = useContext(filesContextId);
  const { id, name, files, dragging, onInput$, onChange$, onBlur$, ref } = ctx;

  const handleChange$ = $((event: Event, element: HTMLInputElement) => {
    files.value = Array.from(element.files ?? [], (file) => noSerialize(file));
    dragging.value = false;
    return onChange$?.(event, element);
  });

  // Any drag over the zone lights it. Not filtered on `dataTransfer.types`: a `$()` handler may run
  // after the event has finished dispatching (qwikloader loads it first), when the drag data store
  // is no longer readable (HTML drag-and-drop, "protected mode").
  const handleDragEnter$ = $(() => {
    dragging.value = true;
  });
  const handleDragEnd$ = $(() => {
    dragging.value = false;
  });

  return (
    <input
      ref={ref}
      type="file"
      id={id}
      name={name}
      data-qds-files-input-control=""
      accept={ctx.accept}
      required={ctx.required}
      multiple={ctx.multiple}
      disabled={ctx.disabled}
      aria-label={ctx.label ? undefined : ctx.ariaLabel}
      aria-invalid={ctx.error && !ctx.disabled ? "true" : undefined}
      aria-errormessage={
        ctx.error && !ctx.disabled ? filesDescriptionId(id) : undefined
      }
      // The prompt exists only while no file is chosen.
      aria-describedby={
        [
          files.value.length === 0 ? filesPromptId(id) : "",
          ctx.error || ctx.supportingText ? filesDescriptionId(id) : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
      onInput$={onInput$}
      onChange$={handleChange$}
      onBlur$={onBlur$}
      onDragEnter$={handleDragEnter$}
      onDragLeave$={handleDragEnd$}
      onDrop$={handleDragEnd$}
      class={filesInputVariants()}
    />
  );
});
