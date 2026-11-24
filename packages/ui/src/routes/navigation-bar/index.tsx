import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  Badge,
  Knobs,
  Layout,
  NavigationBar,
  knob,
  useKnobs,
} from "../../index";
import type { IconName } from "../../index";

const destinations: {
  id: string;
  label: string;
  icon: IconName;
  iconSelected: IconName;
}[] = [
  { id: "home", label: "Home", icon: "home", iconSelected: "home_filled" },
  {
    id: "explore",
    label: "Explore",
    icon: "explore",
    iconSelected: "explore_filled",
  },
  { id: "saved", label: "Saved", icon: "star", iconSelected: "star_filled" },
  {
    id: "inbox",
    label: "Inbox",
    icon: "notifications",
    iconSelected: "notifications_filled",
  },
  {
    id: "profile",
    label: "Profile",
    icon: "person",
    iconSelected: "person_filled",
  },
];

export default component$(() => {
  const knobs = useKnobs({
    layout: knob.select(
      ["adaptive", "vertical", "horizontal"] as const,
      "adaptive",
    ),
    destinations: knob.select(["3", "4", "5"] as const, "4"),
    badges: knob.boolean(true),
  });
  const current = useSignal("home");

  return (
    <>
      <Layout.PaneHeader title="Navigation bar" />
      <Knobs knobs={knobs}>
        <NavigationBar.Root aria-label="Demo" layout={knobs.values.layout}>
          {destinations.slice(0, Number(knobs.values.destinations)).map((d) => (
            <NavigationBar.Item
              key={d.id}
              href={`#${d.id}`}
              icon={d.icon}
              iconSelected={d.iconSelected}
              label={d.label}
              current={current.value === d.id}
              onClick$={() => (current.value = d.id)}
            >
              {knobs.values.badges && d.id === "inbox" && (
                <Badge.Badge q:slot="badge" value={3} label="3 new messages" />
              )}
              {knobs.values.badges && d.id === "saved" && (
                <Badge.Badge q:slot="badge" label="New saved items" />
              )}
            </NavigationBar.Item>
          ))}
        </NavigationBar.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Navigation bar: @seanperez/ui" };
