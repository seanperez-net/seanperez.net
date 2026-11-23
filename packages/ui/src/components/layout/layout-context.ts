import { createContextId } from "@qwik.dev/core";
import type { Signal } from "@qwik.dev/core";

/**
 * Layout context. Provided by `Layout.Root` and by nothing else; every `Layout.*` part reads
 * it. State goes UP: it lives in `Layout.Root` (or in the app, bound into the root with a
 * `bind:` prop) and comes down through here, so parts never keep their own copy and never need
 * props passed through each other.
 */
export type LayoutContextValue = {
  /** The id of the primary pane: what the skip link jumps to. */
  mainId: string;
  /** Whether the supporting pane is shown. `Layout.Root bind:supportExpanded`. */
  supportExpanded: Signal<boolean>;
};

export const layoutContextId = createContextId<LayoutContextValue>(
  "net.seanperez.ui.layout",
);
