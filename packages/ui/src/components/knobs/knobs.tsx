import { Slot, component$, useStylesScoped$ } from "@qwik.dev/core";
import type { KnobDefs, KnobsState } from "./knob";
import styles from "./knobs.css?inline";

export type KnobsProps = {
  // Any knob set: the panel only needs the definitions and a place to write values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  knobs: KnobsState<any>;
  /** Heading of the controls panel. Defaults to "Knobs". */
  title?: string;
};

type Values = Record<string, string | number | boolean>;

/**
 * A demo frame in the style of the Material Web catalog: the component under test goes in the
 * default slot, and a panel of controls ("knobs") changes its props live.
 */
export const Knobs = component$<KnobsProps>((props) => {
  useStylesScoped$(styles);

  const defs = props.knobs.defs as KnobDefs;
  const values = props.knobs.values as Values;

  return (
    <section class="knobs">
      <div class="preview">
        <Slot />
      </div>
      <aside class="panel" aria-label="Component controls">
        <div class="header">
          <h3 class="title">{props.title ?? "Knobs"}</h3>
          <button
            type="button"
            class="reset"
            onClick$={() => {
              for (const name in defs) {
                values[name] = defs[name].value;
              }
            }}
          >
            Reset
          </button>
        </div>
        {Object.entries(defs).map(([name, def]) => {
          const label = def.label ?? name;
          switch (def.type) {
            case "boolean":
              return (
                <label key={name} class="knob inline">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    class="check"
                    checked={values[name] as boolean}
                    onChange$={(_, el) => (values[name] = el.checked)}
                  />
                </label>
              );
            case "number":
              return (
                <label key={name} class="knob">
                  <span>{label}</span>
                  <input
                    type="number"
                    class="control"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={values[name] as number}
                    onInput$={(_, el) => {
                      if (!Number.isNaN(el.valueAsNumber)) {
                        values[name] = el.valueAsNumber;
                      }
                    }}
                  />
                </label>
              );
            case "select":
              return (
                <label key={name} class="knob">
                  <span>{label}</span>
                  <select
                    class="control"
                    onChange$={(_, el) => (values[name] = el.value)}
                  >
                    {def.options.map((option) => (
                      <option
                        key={option}
                        value={option}
                        selected={values[name] === option}
                      >
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              );
            case "color":
              return (
                <label key={name} class="knob">
                  <span>{label}</span>
                  <input
                    type="color"
                    class="control"
                    value={values[name] as string}
                    onInput$={(_, el) => (values[name] = el.value)}
                  />
                </label>
              );
            default:
              return (
                <label key={name} class="knob">
                  <span>{label}</span>
                  <input
                    type="text"
                    class="control"
                    value={values[name] as string}
                    onInput$={(_, el) => (values[name] = el.value)}
                  />
                </label>
              );
          }
        })}
      </aside>
    </section>
  );
});
