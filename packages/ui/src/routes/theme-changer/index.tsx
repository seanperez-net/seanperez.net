import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout, ThemeChanger } from "../../index";

export default component$(() => {
  return (
    <>
      <Layout.PaneHeader title="Theme changer" />
      {/* It writes the theme context `Layout.Root` provides: the whole playground follows. */}
      <ThemeChanger class="max-w-md" />
    </>
  );
});

export const head: DocumentHead = { title: "Theme changer: @seanperez/ui" };
