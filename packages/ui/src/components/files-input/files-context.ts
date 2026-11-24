import { createContextId } from "@qwik.dev/core";
import type { NoSerialize, QRL, Signal } from "@qwik.dev/core";

export type FilesVariant = "outlined" | "filled";

/** A chosen file. `File` and `Blob` cannot be serialized by Qwik, so each is `noSerialize`d. */
export type FilesValue = NoSerialize<File> | NoSerialize<Blob>;

/**
 * The state `Files.Root` shares with its parts. From e-store's `files-context.ts` (2026-11-23).
 * A shallow store: the parts read `error`, `disabled`, ... at render, and Root keeps them in step
 * with its props (e-store's fix of 2026-11-19).
 *
 * Changed from e-store: `hasLeadingIcon` is left out (no part renders a leading icon); added
 * `supportingText`, `ariaLabel`, `dragging` and `remove$`.
 */
export interface FilesContextValue {
  /** The chosen files: the input's `files`, or the `value` prop when it changes. */
  files: Signal<FilesValue[]>;
  /** An object URL per file, `""` for a file that is not an image (or while previews are off). */
  previewUrls: Signal<string[]>;
  /** A drag with files is over the field (`data-dragging` on Root). */
  dragging: Signal<boolean>;
  showPreview: boolean;
  variant: FilesVariant;
  /** Links Label and Input (`for` / `id`): the `id` prop, else `${name}-${useId()}`. */
  id: string;
  /** The form field name only; never an id. */
  name: string;
  required?: boolean;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  supportingText?: string;
  error?: string;
  accept?: string;
  /** Names the input when there is no `label`. */
  ariaLabel?: string;
  ref?: QRL<(element: HTMLInputElement) => void>;
  onInput$?: QRL<(event: Event, element: HTMLInputElement) => void>;
  onChange$?: QRL<(event: Event, element: HTMLInputElement) => void>;
  onBlur$?: QRL<(event: Event, element: HTMLInputElement) => void>;
  /** Takes the file at `index` out of the input (and so out of the form) and refocuses it. */
  remove$: QRL<(index: number) => void>;
}

export const filesContextId =
  createContextId<FilesContextValue>("files-context");

/** The id of the supporting-text / error line. */
export const filesDescriptionId = (id: string) => `${id}-description`;
/** The id of `Files.Preview`'s prompt. */
export const filesPromptId = (id: string) => `${id}-prompt`;
