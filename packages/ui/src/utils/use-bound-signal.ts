import { createSignal, useConstant } from "@qwik.dev/core";
import type { Signal } from "@qwik.dev/core";

/**
 * State that the parent may own. With a signal from the parent (a `bind:` prop) the component
 * reads and writes that one, so the parent sees every change; without one it keeps its own,
 * starting at `initialValue`.
 */
export const useBoundSignal = <T>(
  givenSignal: Signal<T> | undefined,
  initialValue: T,
): Signal<T> => {
  return useConstant(() => givenSignal ?? createSignal(initialValue));
};
