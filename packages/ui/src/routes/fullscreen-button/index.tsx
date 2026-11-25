import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, Layout } from "../../index";

/**
 * FullscreenButton's playground: `Layout.PaneHeader fullscreen` puts this pane in full screen
 * (where the browser allows it; the button is absent otherwise, as on iPhone). Below, the
 * external-link mark on a Button.
 */
export default component$(() => (
  <>
    <Layout.PaneHeader title="Fullscreen button" fullscreen />
    <div class="grid content-start gap-4">
      <p class="text-body-medium text-on-surface-variant">
        The button at the end of the header puts this pane in full screen;
        Escape or the button again leaves it.
      </p>
      <div class="flex flex-wrap gap-2">
        <Button
          look="outlined"
          type="link"
          href="https://m3.material.io/"
          reload
          rel="external"
          label="Material 3"
        />
      </div>
    </div>
  </>
));

export const head: DocumentHead = { title: "Fullscreen button: @seanperez/ui" };
