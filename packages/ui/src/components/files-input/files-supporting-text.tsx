import { component$, useContext } from "@qwik.dev/core";
import { filesContextId, filesDescriptionId } from "./files-context";

/**
 * The line under the field: supporting text, or the error that replaces it. New, not in e-store
 * (its input pointed `aria-errormessage` at `${id}-description` and left the caller to render
 * it). TextField's `TextFieldSupportingText`: body-small `on-surface-variant`, `error` when
 * invalid, `on-surface` 38% when disabled (an error stays shown, in the disabled color, as
 * TextField), 16dp from the sides and 4dp under the container
 * (m3.material.io text-fields specs); the line is reserved, so an error does not move what is
 * below; `aria-live="polite"` announces an error that appears.
 */
export const FilesSupportingText = component$(() => {
  const ctx = useContext(filesContextId);
  return (
    <div
      id={filesDescriptionId(ctx.id)}
      data-qds-files-supporting-text=""
      aria-live="polite"
      class={[
        "min-h-5 px-4 pt-1 text-body-small text-on-surface-variant",
        "group-has-disabled/files:text-on-surface/38",
        "group-has-aria-invalid/files:text-error",
      ]}
    >
      {ctx.error || ctx.supportingText}
    </div>
  );
});
