import { createSignal, useConstant, useTask$ } from "@qwik.dev/core";
import type { Signal } from "@qwik.dev/core";

/**
 * State that the parent may own. From e-store's `utils/use-bound-signal.ts`.
 *
 * The three arguments do three DIFFERENT jobs:
 *
 * 1. `givenSignal` decides IDENTITY: when a consumer passes `bind:value`, that signal IS the
 *    returned signal, so writes here are writes there. Captured by `useConstant`: the FIRST
 *    signal passed is kept for the component's lifetime. A context signal goes here too
 *    (`bindValue ?? ctx?.value`): this argument is for things that already ARE signals.
 * 2. `initialValue` is a SEED: read exactly once, and only when there is no `givenSignal`. So a
 *    two-argument call is WRITE-ONCE: a later value of this argument is discarded.
 * 3. `valueBasedSignal` is the reactive CHANNEL, for a plain value prop (which is NOT a signal):
 *    a signal whose later values a `useTask$` pushes into the returned one. Pass
 *    `useComputed$(() => props.x)`: the function closes over the live `props` proxy, not a
 *    destructured snapshot, so a parent's re-render reaches it. `undefined` means "the consumer
 *    did not pass this prop" and is skipped.
 *
 * Keep the third argument lexically constant per call site (always passed or always omitted): it
 * decides whether a `useTask$` is registered, so a runtime condition would shift hook order.
 *
 * `useComputed$(() => props.x)` can trip `qwik/valid-lexical-scope` ("props.children is not
 * serializable"): the rule walks every property of the captured object's TYPE. Give the closure
 * a reference whose type names only the fields it reads; it is the same proxy:
 *
 *   const reactiveProps: Pick<ChipProps, "selected"> = props;
 *   const selected = useBoundSignal(bind, initial, useComputed$(() => reactiveProps.selected));
 *
 * Do NOT fix that report by destructuring (`const { x } = props`): that is the frozen snapshot
 * again.
 *
 * @example
 * // The component declares only `bind:open`: nothing to sync in.
 * const open = useBoundSignal(bindOpen, false);
 *
 * @see useBindings - does all of this for a whole `{ x, "bind:x" }` prop family at once.
 */
export const useBoundSignal = <T>(
  givenSignal?: Signal<T>,
  initialValue?: T,
  valueBasedSignal?: Signal<T | undefined>,
): Signal<T> => {
  const signal = useConstant(
    () => givenSignal || (createSignal(initialValue) as Signal<T>),
  );

  if (!valueBasedSignal) return signal;

  useTask$(({ track }) => {
    const value = track(() => valueBasedSignal.value);
    if (value === undefined) return;
    signal.value = value;
  });

  return signal;
};
