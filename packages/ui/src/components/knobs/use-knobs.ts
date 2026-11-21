import { useStore } from "@qwik.dev/core";
import type { KnobDefs, KnobValues, KnobsState } from "./knob";

/**
 * Creates the reactive values for a set of knobs. Read `knobs.values.<name>` in JSX to render
 * the demo, and pass `knobs` to `<Knobs>` to get the controls.
 */
export function useKnobs<T extends KnobDefs>(defs: T): KnobsState<T> {
  const values = useStore(() => {
    const initial: Record<string, KnobDefs[string]["value"]> = {};
    for (const name in defs) {
      initial[name] = defs[name].value;
    }
    return initial as KnobValues<T>;
  });
  return { defs, values };
}
