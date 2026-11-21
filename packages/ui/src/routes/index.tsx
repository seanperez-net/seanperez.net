import { component$ } from "@qwik.dev/core";
import { Knobs, knob, useKnobs } from "../index";

export default component$(() => {
  const knobs = useKnobs({
    label: knob.text("Hello"),
    disabled: knob.boolean(false),
    size: knob.select(["small", "medium", "large"], "medium"),
    radius: knob.number(8, { min: 0, max: 32 }),
    color: knob.color("#2563eb"),
  });

  return (
    <>
      <h1>@seanperez/ui</h1>
      <p>
        This is the library playground. Components are exported from
        `src/index.ts`; this page is not part of the published library.
      </p>
      <Knobs knobs={knobs}>
        <button
          disabled={knobs.values.disabled}
          style={{
            padding:
              knobs.values.size === "small"
                ? "4px 10px"
                : knobs.values.size === "large"
                  ? "14px 28px"
                  : "8px 18px",
            borderRadius: `${knobs.values.radius}px`,
            background: knobs.values.color,
            color: "white",
            border: "0",
            font: "inherit",
            opacity: knobs.values.disabled ? "0.5" : "1",
          }}
        >
          {knobs.values.label}
        </button>
      </Knobs>
    </>
  );
});
