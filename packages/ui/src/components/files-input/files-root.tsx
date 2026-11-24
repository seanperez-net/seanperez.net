import {
  $,
  Slot,
  component$,
  useContextProvider,
  useId,
  useSignal,
  useStore,
  useOnDocument,
  useTask$,
} from "@qwik.dev/core";
import type {
  ClassList,
  CSSProperties,
  NoSerialize,
  QRL,
} from "@qwik.dev/core";
import { filesContextId } from "./files-context";
import type {
  FilesContextValue,
  FilesValue,
  FilesVariant,
} from "./files-context";

/**
 * Material Design 3 style file field: a drop zone with a floating label, previews, supporting
 * text and an error. From e-store's `components/files-input/files-root.tsx` (2026-11-23). M3 has no
 * file-input component; the field follows the M3 text-field tokens (see `files-input.md`).
 *
 * Changed from e-store (see `files-input.md` "Where it differs"):
 * - Root keeps `files` in step with the input itself (its `change` event), so previews show with
 *   no wiring; `value` still sets them from outside. e-store showed only what `value` held, so a
 *   field without a parent writing `value` back never showed what was chosen.
 * - A plain `<div>`: no `aria-disabled` on it (ARIA in HTML: a generic element takes none).
 * - `supportingText` and `Files.SupportingText`, which renders the `${id}-description` line the
 *   input's `aria-errormessage` points at (e-store pointed at an id nothing rendered).
 * - `data-dragging` while files are dragged over the field; `remove$` for `Files.Preview`.
 * - A disabled field is not marked invalid (as TextField).
 */
export type FilesRootProps = {
  class?: ClassList;
  style?: CSSProperties;
  /**
   * Id of the file input, which `Files.Label` points at. Defaults to `${name}-${useId()}`, unique
   * per instance, so two fields with one `name` never collide.
   */
  id?: string;
  /** The form field name. */
  name: string;
  /** Files to show from outside (a draft being edited). Picking or dropping replaces them. */
  value?:
    | NoSerialize<Blob>
    | NoSerialize<Blob>[]
    | NoSerialize<File>
    | NoSerialize<File>[]
    | null;
  variant?: FilesVariant;
  required?: boolean;
  multiple?: boolean;
  disabled?: boolean;
  /** The floating label, and the input's accessible name. */
  label?: string;
  /** The line under the field. */
  supportingText?: string;
  /** An error message: replaces the supporting text and marks the input invalid. */
  error?: string;
  /** Image thumbnails in `Files.Preview` (file names are always listed). */
  showPreview?: boolean;
  /** The input's `accept`: MIME types or extensions (`"image/*,.pdf"`). */
  accept?: string;
  /** Names the input when there is no `label`. */
  "aria-label"?: string;
  ref?: QRL<(element: HTMLInputElement) => void>;
  onInput$?: QRL<(event: Event, element: HTMLInputElement) => void>;
  onChange$?: QRL<(event: Event, element: HTMLInputElement) => void>;
  onBlur$?: QRL<(event: Event, element: HTMLInputElement) => void>;
};

const toArray = (value: FilesRootProps["value"]): FilesValue[] =>
  value ? (Array.isArray(value) ? value : [value]) : [];

export const FilesRoot = component$<FilesRootProps>(
  ({
    class: className,
    style,
    value,
    variant = "outlined",
    id: idProp,
    name,
    required,
    multiple,
    disabled,
    label,
    supportingText,
    error,
    showPreview = true,
    accept,
    "aria-label": ariaLabel,
    ref,
    onInput$,
    onChange$,
    onBlur$,
  }) => {
    const files = useSignal<FilesValue[]>([]);
    const previewUrls = useSignal<string[]>([]);
    const dragging = useSignal(false);
    const generatedId = useId();
    const id = idProp ?? `${name}-${generatedId}`;

    // Takes one file out of the input. `input.files` is set from a `DataTransfer` (the only way to
    // build a `FileList`, MDN), then `input` and `change` are dispatched as a pick would, so the
    // parent's handlers and Root's own `files` see the new list.
    const remove$ = $((index: number) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (!input?.files) return;
      const transfer = new DataTransfer();
      Array.from(input.files).forEach((file, i) => {
        if (i !== index) transfer.items.add(file);
      });
      input.files = transfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      // The removed file's button is gone: focus goes back to the field.
      input.focus();
    });

    // `form.reset()` empties the input without a `change` event (HTML): clear the list with it.
    useOnDocument(
      "reset",
      $((event: Event) => {
        const input = document.getElementById(id) as HTMLInputElement | null;
        if (
          input &&
          event.target instanceof HTMLFormElement &&
          event.target.contains(input)
        ) {
          // The reset itself runs after the event: read the input after it.
          queueMicrotask(() => {
            files.value = [];
          });
        }
      }),
    );

    // A shallow store, not a plain object: the parts read `error`, `disabled`, `label`, ... at
    // render, and a plain context object is bound once (e-store's fix of 2026-11-19).
    const context = useStore<FilesContextValue>(
      {
        files,
        previewUrls,
        dragging,
        showPreview,
        variant,
        id,
        name,
        required,
        multiple,
        disabled,
        label,
        supportingText,
        error,
        accept,
        ariaLabel,
        ref,
        onInput$,
        onChange$,
        onBlur$,
        remove$,
      },
      { deep: false },
    );

    useContextProvider(filesContextId, context);

    useTask$(({ track }) => {
      context.error = track(() => error);
      context.supportingText = track(() => supportingText);
      context.disabled = track(() => disabled);
      context.required = track(() => required);
      context.label = track(() => label);
      context.accept = track(() => accept);
      context.multiple = track(() => multiple);
      context.variant = track(() => variant);
      context.showPreview = track(() => showPreview);
      context.ariaLabel = track(() => ariaLabel);
    });

    // Files set from outside. In the browser they are also put INTO the input (a Blob wrapped as
    // a `File`), so the form posts them and `required` sees them.
    useTask$(({ track }) => {
      const next = toArray(track(() => value));
      if (!next.length && !files.value.length) return;
      files.value = next;
      if (typeof document === "undefined") return;
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (!input) return;
      const transfer = new DataTransfer();
      next.forEach((file) => {
        if (file instanceof File) transfer.items.add(file);
        else if (file instanceof Blob)
          transfer.items.add(new File([file], "file", { type: file.type }));
      });
      input.files = transfer.files;
    });

    // One object URL per image while previews are on, revoked when the files change.
    useTask$(({ track, cleanup }) => {
      const list = track(() => files.value);
      const on = track(() => context.showPreview);
      if (typeof URL.createObjectURL !== "function") return;
      const urls = list.map((file) =>
        on && file instanceof Blob && file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : "",
      );
      previewUrls.value = urls;
      cleanup(() => urls.forEach((url) => url && URL.revokeObjectURL(url)));
    });

    return (
      <div
        data-qds-files-input=""
        // M3 field: focus is the drop zone's active indicator (3dp `primary`), not a ring.
        data-focus-indicator="active-indicator"
        data-dragging={dragging.value ? "" : undefined}
        class={["group/files relative", className]}
        style={style}
      >
        <Slot />
      </div>
    );
  },
);
