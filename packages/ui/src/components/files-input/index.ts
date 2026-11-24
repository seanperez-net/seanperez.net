import { FilesDropzone } from "./files-dropzone";
import { FilesInput } from "./files-input";
import { FilesLabel } from "./files-label";
import { FilesPreview } from "./files-preview";
import { FilesRoot } from "./files-root";
import { FilesSupportingText } from "./files-supporting-text";

export const Files = {
  Root: FilesRoot,
  Dropzone: FilesDropzone,
  Label: FilesLabel,
  Input: FilesInput,
  Preview: FilesPreview,
  SupportingText: FilesSupportingText,
};

export { filesContextId } from "./files-context";
export type {
  FilesContextValue,
  FilesValue,
  FilesVariant,
} from "./files-context";
export { filesDropZoneVariants } from "./files-dropzone";
export type { FilesDropzoneProps } from "./files-dropzone";
export { filesInputVariants } from "./files-input";
export { filesInputLabelVariants } from "./files-label";
export { DEFAULT_FILES_PREVIEW_LABELS } from "./files-preview";
export type { FilesPreviewProps } from "./files-preview";
export type { FilesRootProps } from "./files-root";
