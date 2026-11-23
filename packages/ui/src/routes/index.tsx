import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout } from "../index";

export default component$(() => {
  return (
    <>
      <Layout.PaneHeader title="Overview" />
      <div class="grid max-w-2xl gap-4">
        <p>
          Material 3 components for Qwik, styled with Tailwind and
          tailwind-variants on the Material 3 design tokens. This page is built
          with the library itself: the app bar, both panes and the footer are{" "}
          <code>Layout</code> parts.
        </p>
        <p>
          Pick a component from the list. Each demo has knobs that change its
          props live.
        </p>
      </div>
    </>
  );
});

export const head: DocumentHead = { title: "@seanperez/ui" };
