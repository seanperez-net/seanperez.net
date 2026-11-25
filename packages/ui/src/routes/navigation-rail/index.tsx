import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  IconButton,
  Layout,
  NavigationRail,
  ThemeToggle,
  iconNames,
} from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

export default component$(() => {
  const knobs = useKnobs({
    label: knob.text("Home"),
    icon: knob.select(iconNames, "home"),
    // `page`: `aria-current="page"`; `section`: the page is in its sub-navigation.
    current: knob.select(["none", "page", "section"] as const, "page"),
    badge: knob.select(["none", "dot", "count"] as const, "none"),
    badgeCount: knob.number(3, { min: 0, max: 1200 }),
    badgeLabel: knob.text(""),
    menuButton: knob.boolean(true),
  });

  return (
    <>
      <Layout.PaneHeader title="Navigation rail" />
      <Knobs knobs={knobs}>
        <NavigationRail.Root aria-label="Demo" class="h-96 rounded-lg">
          {knobs.values.menuButton && (
            <IconButton q:slot="header" icon="menu" label="Menu" />
          )}
          <NavigationRail.Item
            href="#"
            icon={knobs.values.icon}
            label={knobs.values.label}
            current={
              knobs.values.current === "section"
                ? "section"
                : knobs.values.current === "page"
            }
            badge={
              knobs.values.badge === "dot"
                ? true
                : knobs.values.badge === "count"
                  ? knobs.values.badgeCount
                  : undefined
            }
            badgeLabel={knobs.values.badgeLabel || undefined}
          />
          <NavigationRail.Item href="#" icon="widgets" label="Components" />
          <ThemeToggle q:slot="footer" />
        </NavigationRail.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Navigation rail: @seanperez/ui" };
