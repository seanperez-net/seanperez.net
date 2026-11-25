import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout, Search } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";
import type { IconName } from "../../index";

const fruits: { label: string; icon: IconName }[] = [
  { label: "Apple", icon: "star" },
  { label: "Apricot", icon: "star" },
  { label: "Banana", icon: "star" },
  { label: "Blueberry", icon: "star" },
  { label: "Cherry", icon: "star" },
  { label: "Grape", icon: "star" },
  { label: "Lemon", icon: "star" },
  { label: "Mango", icon: "star" },
];

export default component$(() => {
  const knobs = useKnobs({
    layout: knob.select(
      ["adaptive", "docked", "fullscreen"] as const,
      "adaptive",
    ),
    placeholder: knob.text("Search fruit"),
    size: knob.select(["default", "compact"] as const, "default"),
    trigger: knob.boolean(true, "Search.Trigger"),
    disabled: knob.boolean(false),
  });
  const query = useSignal("");
  const chosen = useSignal("");

  return (
    <>
      <Layout.PaneHeader title="Search" />
      <Knobs knobs={knobs}>
        {/* `layout` is read once by Root: the key remounts it when the knob changes. */}
        <Search.Root
          key={knobs.values.layout}
          layout={knobs.values.layout}
          bind:query={query}
          aria-label="Fruit"
        >
          {knobs.values.trigger && (
            <Search.Trigger label={knobs.values.placeholder} />
          )}
          <Search.Bar
            placeholder={knobs.values.placeholder}
            size={knobs.values.size}
            disabled={knobs.values.disabled}
          />
          <Search.View placeholder={knobs.values.placeholder}>
            {fruits
              .filter((fruit) =>
                fruit.label
                  .toLowerCase()
                  .includes(query.value.trim().toLowerCase()),
              )
              .map((fruit) => (
                <Search.Item
                  key={fruit.label}
                  label={fruit.label}
                  icon={fruit.icon}
                  onClick$={() => {
                    chosen.value = fruit.label;
                  }}
                />
              ))}
          </Search.View>
        </Search.Root>
        <p>Chosen: {chosen.value || "nothing yet"}</p>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Search: @seanperez/ui" };
