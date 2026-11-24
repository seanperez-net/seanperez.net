import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  IconButton,
  Knobs,
  Layout,
  NavigationRail,
  ThemeToggle,
  iconNames,
  knob,
  useKnobs,
} from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    label: knob.text("Home"),
    icon: knob.select(iconNames, "home"),
    current: knob.boolean(true),
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
            current={knobs.values.current}
          />
          <NavigationRail.Item href="#" icon="widgets" label="Components" />
          <ThemeToggle q:slot="footer" />
        </NavigationRail.Root>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Navigation rail: @seanperez/ui" };
