import type { DocumentHead } from "@qwik.dev/router";
import { component$ } from "@qwik.dev/core";

export default component$(() => {
  return (
    <main class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 class="text-4xl font-semibold tracking-tight">Sean Perez</h1>
      <p class="text-lg text-neutral-600">
        Personal site and resume. Coming soon.
      </p>
      <a
        class="w-fit text-sm font-medium underline underline-offset-4"
        href="https://github.com/seanperez-net"
      >
        github.com/seanperez-net
      </a>
    </main>
  );
});

export const head: DocumentHead = {
  title: "Sean Perez",
  meta: [
    {
      name: "description",
      content: "Sean Perez: personal site and resume.",
    },
  ],
};
