# Files input

A file picker drawn as a Material Design 3 field: a drop zone with a floating label, the chosen
files (thumbnails for images), a remove button per file, supporting text and an error. Outlined
(default) or filled. From e-store's `components/files-input/` (2026-11-23).

- M3: there is NO file-input component in Material 3 (m3.material.io components list, read
  2026-11-23). The field follows the M3 TEXT FIELD
  (https://m3.material.io/components/text-fields/specs) through our `TextField`, whose colors were
  checked against material-web `tokens/versions/v0_192/_md-comp-{outlined,filled}-text-field.scss`.
- MDN: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/file

## Parts

| Part                   | Element                    | What                                                                    |
| ---------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `Files.Root`           | `<div>` (`group/files`)    | State and context; `data-dragging` while a drag is over the field       |
| `Files.Label`          | `<label for>`              | Floating label (always floated), from Root's `label`; `*` when required |
| `Files.Dropzone`       | `<div>`                    | The container: outline / fill, state layer, active indicator            |
| `Files.Input`          | `<input type="file">`      | Transparent, covering the drop zone: clicks and drops land on it        |
| `Files.Preview`        | `<p>` prompt or `<ul>`     | The prompt, or the chosen files with thumbnails and remove buttons      |
| `Files.SupportingText` | `<div aria-live="polite">` | Supporting text, or the error that replaces it (`${id}-description`)    |

## API: `Files.Root`

| Prop                               | Type                                            | Default              | Description                                                                |
| ---------------------------------- | ----------------------------------------------- | -------------------- | -------------------------------------------------------------------------- |
| `name`                             | `string`                                        | required             | Form field name only (never an id)                                         |
| `id`                               | `string`                                        | `${name}-${useId()}` | The input's id; Label and the description follow it                        |
| `value`                            | `NoSerialize<File \| Blob>` or an array, `null` | -                    | Files set from outside; in the browser also put INTO the input (so posted) |
| `variant`                          | `"outlined" \| "filled"`                        | `"outlined"`         | M3 text-field style                                                        |
| `label`                            | `string`                                        | -                    | Floating label, and the input's accessible name                            |
| `aria-label`                       | `string`                                        | -                    | The input's name when there is no `label`                                  |
| `supportingText`                   | `string`                                        | -                    | The line under the field                                                   |
| `error`                            | `string`                                        | -                    | Replaces the supporting text; `aria-invalid` (not while disabled)          |
| `multiple`                         | `boolean`                                       | `false`              | Native `multiple`                                                          |
| `accept`                           | `string`                                        | -                    | Native `accept` (`"image/*,.pdf"`)                                         |
| `required`                         | `boolean`                                       | -                    | Native `required`; the label shows `*` (`aria-hidden`)                     |
| `disabled`                         | `boolean`                                       | -                    | Native `disabled` (a disabled input is not posted, HTML)                   |
| `showPreview`                      | `boolean`                                       | `true`               | Image thumbnails (file names are always listed)                            |
| `ref`                              | `QRL<(el: HTMLInputElement) => void>`           | -                    | The input element                                                          |
| `onInput$`, `onChange$`, `onBlur$` | `QRL<(event, el: HTMLInputElement) => void>`    | -                    | Native events on the input (`el.files`); also fired by a remove            |
| `class`, `style`                   | -                                               | -                    | On Root, for layout                                                        |

## API: `Files.Preview`

Every string and icon is a prop with a default (CMS rule); the strings are exported as
`DEFAULT_FILES_PREVIEW_LABELS`.

| Prop                         | Type               | Default                          | Description                                             |
| ---------------------------- | ------------------ | -------------------------------- | ------------------------------------------------------- |
| `prompt`                     | `string`           | `"Click or drag and drop file"`  | Shown while no file is chosen (single-file field)       |
| `promptMultiple`             | `string`           | `"Click or drag and drop files"` | Shown while no file is chosen (`multiple` field)        |
| `promptIcon`                 | `IconName \| null` | `"upload_file"`                  | Above the prompt; `null` for none                       |
| `previewAlt`                 | `string`           | `"Preview of {name}"`            | Each thumbnail's alt; `{name}` is the file name         |
| `unknownFileName`            | `string`           | `"Unknown file"`                 | Name for a value that is a `Blob`, not a `File`         |
| `fileIcon`                   | `IconName`         | `"draft"`                        | In place of a thumbnail (not an image, or previews off) |
| `removable`                  | `boolean`          | `true`                           | A remove button per file                                |
| `removeIcon`                 | `IconName`         | `"close"`                        | The remove button's icon                                |
| `removeLabel`                | `string`           | `"Remove {name}"`                | The remove button's name                                |
| `imageWidth` / `imageHeight` | `number`           | `64`                             | Intrinsic size of each thumbnail                        |

## States (M3 text-field tokens, as `TextField`)

| State     | Outlined                                     | Filled                                                     |
| --------- | -------------------------------------------- | ---------------------------------------------------------- |
| Rest      | 1dp dashed `outline`                         | `surface-container-highest`, 1dp `on-surface-variant` line |
| Hover     | `on-surface` outline, label `on-surface`     | `on-surface` line, `on-surface` 8% state layer             |
| Focus     | 3dp `primary` outline, label `primary`       | 3dp `primary` line, label `primary`                        |
| Drag over | as focus, plus the 8% state layer (HOUSE)    | as focus, plus the 8% state layer (HOUSE)                  |
| Error     | `error` (hover `on-error-container`)         | same, on the line                                          |
| Disabled  | outline `on-surface` 12%, text and label 38% | container `on-surface` 4%, line 38%, text 38%              |

## Behaviour

- Pick: a click anywhere on the zone, or Enter / Space on the focused input (native; checked in
  Chrome: both fire the input's activation `click`).
- Drop: native. The transparent input covers the zone, and a file input takes dropped files
  itself (fills `files`, fires `input` and `change`); no `dragover` / `drop` handlers, nothing to
  `preventDefault`. The remove buttons sit ABOVE the input, so their wrapper cancels `dragover`
  and `drop` with a `sync$` `onDragOver$` / `onDrop$` (else a file dropped on one opens in the
  tab). FIXED 2026-11-24: these were bare `preventdefault:` attributes, which qwikloader (rc.5)
  reads only for event types some element has a handler for; `dragover` had none, so the row was
  not a drop target (found by reading `qwikloader.debug.js`, not by a drop in Chrome).
- `accept` is a hint to the picker; a DROPPED file is not filtered by it (MDN, "accept"). Check
  type and size in `onChange$` and on the server.
- Remove: the input's `files` rebuilt from a `DataTransfer` without that file (MDN: the only way
  to build a `FileList`), then `input` and `change` are dispatched, then focus goes to the input.
- `form.reset()` empties the list (Root listens for `reset`; the reset fires no `change`).
- Files are `noSerialize`d (Qwik cannot serialise `File` / `Blob`: `core.mjs` serializer has no
  case for them; `NoSerialize` values come back `undefined` on resume). They only ever exist in the
  browser, so nothing is lost.
- Thumbnails are `URL.createObjectURL` URLs, revoked when the files change or Root unmounts.

## ARIA

- Native `<input type="file">` named by `<label for>` (or `aria-label`).
- `aria-describedby`: the prompt (while no file is chosen) and the supporting-text line (while it
  has text). `aria-invalid="true"` and `aria-errormessage` only while `error` is set and the field
  is enabled.
- Each remove button is an `IconButton` named "Remove {name}"; thumbnails have `alt`; icons are
  `aria-hidden`. The supporting-text line is `aria-live="polite"`.
- No focus ring: focus is the active indicator (`data-focus-indicator="active-indicator"`).

## Usage

```tsx
<Files.Root
  name="photos"
  label="Photos"
  multiple
  accept="image/*"
  supportingText="Up to 5 MB each"
>
  <Files.Label />
  <Files.Dropzone>
    <Files.Input />
    <Files.Preview />
  </Files.Dropzone>
  <Files.SupportingText />
</Files.Root>
```

## Where it differs from e-store

From e-store: the parts and their names, Root's props and context (a shallow store kept in step
with the props), the `useId` id, the named `group/files`, the drop zone as the field, the
transparent input over it, Preview's props and defaults, the three-column grid, 64dp thumbnails.

Changed (PROOFED 2026-11-23 against the sources named; reviewed by a second agent):

- The drop zone is a `<div>`, not a `<label>`: a label's content is phrasing content with no
  labelable element but its control (HTML spec, `label` content model); it holds a list and
  buttons. The input covering it keeps click-to-pick.
- Root follows the input's `change`: e-store showed only what the `value` prop held, so without a
  parent writing `value` back nothing chosen was ever shown. `value` is put into the input too, so
  it is posted and satisfies `required` (e-store: shown, never posted).
- `Files.SupportingText` (new): renders the `${id}-description` element that e-store's
  `aria-errormessage` pointed at with nothing rendering it.
- Every file is listed (e-store drew the grid only if some file was an image: a PDF showed
  nothing); `fileIcon` for non-images; Blob thumbnails too.
- New: remove buttons (`removable`, `removeIcon`, `removeLabel`), `promptIcon`, drag state
  (`data-dragging`), form reset, `aria-label` on Root.
- Colors from the text-field tokens (as `TextField`): outlined 1dp (e-store 2dp `::before`
  border), disabled outline 12% (e-store 38%), filled line `on-surface-variant` and hover layer.
  The dash itself is HOUSE (marks a drop target; no M3 token).
- No `aria-disabled` on Root's `<div>` (ARIA in HTML); a disabled field is not marked invalid.
- Logical insets, reduced-motion guards, the `--field-bg` patch as a class (e-store inline style).
- Left out: `hasLeadingIcon` (no part draws a leading icon), e-store's `Render` wrapper.

NOT PROOFED: the drag-over look (no M3 drop-target state); a real OS drag-and-drop was not run
(Chrome tests used synthetic drag events; the native drop onto a file input is browser
behaviour, MDN); `value` into the input was not run in Chrome.
