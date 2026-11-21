/**
 * Knob definitions: one per value a demo lets you change. Plain serializable objects, so they
 * can cross Qwik's `$` boundaries and be resumed on the client.
 */
export type TextKnob = { type: "text"; value: string; label?: string };
export type BooleanKnob = { type: "boolean"; value: boolean; label?: string };
export type NumberKnob = {
  type: "number";
  value: number;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
};
export type SelectKnob<O extends string = string> = {
  type: "select";
  value: O;
  options: readonly O[];
  label?: string;
};
export type ColorKnob = { type: "color"; value: string; label?: string };

export type KnobDef =
  | TextKnob
  | BooleanKnob
  | NumberKnob
  | SelectKnob
  | ColorKnob;

export type KnobDefs = Record<string, KnobDef>;

/** The current value of every knob, typed from its definition. */
export type KnobValues<T extends KnobDefs> = { [K in keyof T]: T[K]["value"] };

/** What `useKnobs()` returns and `<Knobs>` takes. */
export type KnobsState<T extends KnobDefs = KnobDefs> = {
  defs: T;
  values: KnobValues<T>;
};

type NumberOptions = { min?: number; max?: number; step?: number };

/** Builders for knob definitions, e.g. `knob.select(["sm", "md"], "md")`. */
export const knob = {
  text: (value: string, label?: string): TextKnob => ({
    type: "text",
    value,
    label,
  }),
  boolean: (value: boolean, label?: string): BooleanKnob => ({
    type: "boolean",
    value,
    label,
  }),
  number: (
    value: number,
    options: NumberOptions = {},
    label?: string,
  ): NumberKnob => ({ type: "number", value, label, ...options }),
  select: <const O extends string>(
    options: readonly O[],
    value: NoInfer<O>,
    label?: string,
  ): SelectKnob<O> => ({ type: "select", value, options, label }),
  color: (value: string, label?: string): ColorKnob => ({
    type: "color",
    value,
    label,
  }),
};
