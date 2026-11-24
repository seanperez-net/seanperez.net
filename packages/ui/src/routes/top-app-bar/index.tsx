import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import {
  AccountMenu,
  IconButton,
  Knobs,
  Layout,
  Search,
  TopAppBar,
  knob,
  useKnobs,
} from "../../index";

export default component$(() => {
  const knobs = useKnobs({
    title: knob.text("My app"),
    titleLink: knob.boolean(true),
    menuButton: knob.boolean(true),
    search: knob.boolean(true),
    avatar: knob.boolean(true),
  });

  return (
    <>
      <Layout.PaneHeader title="Top app bar" />
      <Knobs knobs={knobs}>
        <TopAppBar
          title={knobs.values.title}
          titleHref={knobs.values.titleLink ? "#" : undefined}
          headingLevel={2}
          class="w-full rounded-lg"
        >
          {knobs.values.menuButton && (
            <IconButton q:slot="leading" icon="menu" label="Menu" />
          )}
          {knobs.values.search && (
            <Search.Root q:slot="pane" layout="docked">
              <Search.Bar size="compact" />
            </Search.Root>
          )}
          {knobs.values.avatar && (
            <AccountMenu
              user={{ name: "Ada Lovelace", email: "ada@example.com" }}
              presence="online"
              signOutHref="#"
            />
          )}
        </TopAppBar>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Top app bar: @seanperez/ui" };
