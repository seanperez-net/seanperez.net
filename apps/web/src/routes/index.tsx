import type { DocumentHead } from "@qwik.dev/router";
import { component$ } from "@qwik.dev/core";
import { Layout, ThemeToggle } from "@seanperez/ui";

export default component$(() => {
  return (
    <Layout.Root>
      <Layout.AppBar title="Sean Perez">
        <ThemeToggle />
      </Layout.AppBar>
      <Layout.Pane role="primary">
        <Layout.PaneHeader title="Projects and code" />
        <nav
          class="flex flex-wrap gap-x-5 gap-y-2 text-primary"
          aria-label="Links"
        >
          <a
            href="https://github.com/seanperez-net"
            rel="me external"
            class="underline underline-offset-4"
          >
            GitHub
          </a>
        </nav>
      </Layout.Pane>
      <Layout.Footer>
        <p>
          © Sean Perez ·{" "}
          <a
            href="https://github.com/seanperez-net/seanperez.net"
            rel="external"
            class="underline underline-offset-4"
          >
            Source
          </a>
        </p>
      </Layout.Footer>
    </Layout.Root>
  );
});

export const head: DocumentHead = {
  title: "Sean Perez",
  meta: [
    {
      name: "description",
      content: "Sean Perez: projects and code.",
    },
  ],
};
