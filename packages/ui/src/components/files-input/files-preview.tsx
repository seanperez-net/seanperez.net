import { component$, sync$, useContext } from "@qwik.dev/core";
import { Icon } from "../icon";
import type { IconName } from "../icon";
import { IconButton } from "../icon-button";
import { filesContextId, filesPromptId } from "./files-context";

/** The default strings of `Files.Preview` (CMS rule: every string is a prop with a default). */

/**
 * Cancels `dragover` and `drop` on the file row, which sits above the input: a file dropped there
 * must not open in the tab. A `sync$` handler, not bare `preventdefault:dragover` /
 * `preventdefault:drop` attributes: qwikloader (installed `@qwik.dev/core` 2.0.0-rc.5,
 * `qwikloader.debug.js` `dispatch` / `addEventOrRoot`) only reads those attributes while handling
 * an event type some element has a handler for. `drop` was registered (the input's `onDrop$`),
 * `dragover` never was, so the row was not a drop target and a drop on it opened the file.
 */
const refuseDrop = sync$((event: DragEvent) => {
  event.preventDefault();
});

export const DEFAULT_FILES_PREVIEW_LABELS = {
  prompt: "Click or drag and drop file",
  promptMultiple: "Click or drag and drop files",
  previewAlt: "Preview of {name}",
  unknownFileName: "Unknown file",
  removeLabel: "Remove {name}",
} as const;

export interface FilesPreviewProps {
  imageHeight?: number;
  imageWidth?: number;
  /** Shown while no file is chosen, for a single-file field. */
  prompt?: string;
  /** Shown while no file is chosen, for a `multiple` field. */
  promptMultiple?: string;
  /** Each preview image's alt; `{name}` is the file's name (or `unknownFileName`). */
  previewAlt?: string;
  /** The name shown (and put in `previewAlt`) for a value that is not a `File`. */
  unknownFileName?: string;
  /** Above the prompt; `null` for none. */
  promptIcon?: IconName | null;
  /** In place of a thumbnail: a file that is not an image, or previews off. */
  fileIcon?: IconName;
  /** The remove button's icon. */
  removeIcon?: IconName;
  /** The remove button's name; `{name}` is the file's name. */
  removeLabel?: string;
  /** Show a remove button per file. */
  removable?: boolean;
}

/**
 * The prompt, then the chosen files. From e-store's `components/files-input/files-preview.tsx`
 * (2026-11-23): the same props and defaults, the three-column grid, 64dp thumbnails.
 *
 * Changed from e-store:
 * - Every chosen file is listed (`<ul>`), with a thumbnail for an image and `fileIcon` otherwise;
 *   e-store drew the grid only when at least one file was an image, so a chosen PDF showed
 *   nothing at all. `showPreview={false}` drops the thumbnails, not the names.
 * - A remove button per file (new, not in e-store; `removable`, `removeIcon`, `removeLabel`):
 *   our `IconButton`, above the transparent input (`z-20`) so it gets its own clicks.
 * - `promptIcon` above the prompt (new, default `upload_file`); the prompt has an id the input's
 *   `aria-describedby` names (the zone is no longer a `<label>` that named the input with it).
 * - The name is body-small `on-surface` (e-store `text-sm`, not an M3 type token).
 */
export const FilesPreview = component$<FilesPreviewProps>(
  ({
    imageHeight = 64,
    imageWidth = 64,
    prompt = DEFAULT_FILES_PREVIEW_LABELS.prompt,
    promptMultiple = DEFAULT_FILES_PREVIEW_LABELS.promptMultiple,
    previewAlt = DEFAULT_FILES_PREVIEW_LABELS.previewAlt,
    unknownFileName = DEFAULT_FILES_PREVIEW_LABELS.unknownFileName,
    promptIcon = "upload_file",
    fileIcon = "draft",
    removeIcon = "close",
    removeLabel = DEFAULT_FILES_PREVIEW_LABELS.removeLabel,
    removable = true,
  }) => {
    const ctx = useContext(filesContextId);
    const { files, previewUrls, remove$ } = ctx;

    return (
      <div data-qds-files-preview="" class="w-full">
        {files.value.length === 0 ? (
          <p
            id={filesPromptId(ctx.id)}
            class="m-auto flex flex-col items-center gap-2 px-4 text-center text-body-large"
          >
            {promptIcon && <Icon name={promptIcon} />}
            {ctx.multiple ? promptMultiple : prompt}
          </p>
        ) : (
          <ul class="grid grid-cols-3 gap-4 px-4">
            {files.value.map((file, i) => {
              const name = file instanceof File ? file.name : unknownFileName;
              const url = previewUrls.value[i];
              return (
                <li
                  key={`${i}-${name}`}
                  class="flex min-w-0 flex-col items-center gap-1"
                >
                  {url ? (
                    <img
                      height={imageHeight}
                      width={imageWidth}
                      src={url}
                      // A replacer function: a file name is never read as a `$&` pattern.
                      alt={previewAlt.replace("{name}", () => name)}
                      class="size-16 rounded-sm object-cover"
                    />
                  ) : (
                    <span class="flex size-16 items-center justify-center rounded-sm bg-surface-container-high text-on-surface-variant">
                      <Icon name={fileIcon} />
                    </span>
                  )}
                  <span
                    class="flex w-full min-w-0 items-center justify-center"
                    // The remove button sits above the input: a file dropped on it must not
                    // make the browser open the file (it is not a drop target).
                    onDragOver$={refuseDrop}
                    onDrop$={refuseDrop}
                  >
                    <span class="truncate text-body-small text-on-surface group-has-disabled/files:text-on-surface/38">
                      {name}
                    </span>
                    {removable && (
                      <IconButton
                        icon={removeIcon}
                        label={removeLabel.replace("{name}", () => name)}
                        disabled={ctx.disabled}
                        class="relative z-20 shrink-0"
                        onClick$={() => remove$(i)}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  },
);
