import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Badge, Layout, Tabs } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";
import type { IconName } from "../../index";

const fixed: { value: string; label: string; icon: IconName }[] = [
  { value: "flights", label: "Flights", icon: "flight" },
  { value: "trips", label: "Trips", icon: "luggage" },
  { value: "explore", label: "Explore", icon: "explore" },
];

const many = [
  "Overview",
  "Departures",
  "Arrivals",
  "Baggage allowance",
  "Seat selection",
  "Lounges",
  "Frequent flyer programme",
  "Help",
];

export default component$(() => {
  const knobs = useKnobs({
    look: knob.select(["primary", "secondary"] as const, "primary"),
    tabs: knob.select(["fixed", "scrollable"] as const, "fixed"),
    align: knob.select(["fill", "center", "start"] as const, "fill"),
    icons: knob.select(["none", "top", "start", "only"] as const, "none"),
    badge: knob.boolean(false),
    selectOnFocus: knob.boolean(false, "select on focus"),
  });
  const value = useSignal("flights");
  const scrollValue = useSignal("Overview");

  return (
    <>
      <Layout.PaneHeader title="Tabs" />
      <Knobs knobs={knobs}>
        {knobs.values.tabs === "fixed" ? (
          <Tabs.Root
            bind:value={value}
            look={knobs.values.look}
            selectOnFocus={knobs.values.selectOnFocus}
          >
            <Tabs.List aria-label="Travel" align={knobs.values.align}>
              {fixed.map((tab, i) => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  label={tab.label}
                  icon={knobs.values.icons === "none" ? undefined : tab.icon}
                  iconPosition={
                    knobs.values.icons === "start" ? "start" : "top"
                  }
                  labelHidden={knobs.values.icons === "only"}
                >
                  {knobs.values.badge && i === 1 && (
                    <Badge.Badge q:slot="badge" value={3} />
                  )}
                  {knobs.values.badge && i === 2 && (
                    <Badge.Badge q:slot="badge" />
                  )}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {fixed.map((tab) => (
              <Tabs.Content key={tab.value} value={tab.value}>
                {tab.label} panel.
              </Tabs.Content>
            ))}
          </Tabs.Root>
        ) : (
          <Tabs.Root
            bind:value={scrollValue}
            look={knobs.values.look}
            selectOnFocus={knobs.values.selectOnFocus}
          >
            <Tabs.List aria-label="Flight information" scrollable>
              {many.map((label) => (
                <Tabs.Trigger key={label} value={label} label={label} />
              ))}
            </Tabs.List>
            {many.map((label) => (
              <Tabs.Content key={label} value={label}>
                {label} panel.
              </Tabs.Content>
            ))}
          </Tabs.Root>
        )}
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Tabs: @seanperez/ui" };
