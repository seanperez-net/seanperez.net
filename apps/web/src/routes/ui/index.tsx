import type { DocumentHead } from "@qwik.dev/router";
import { component$ } from "@qwik.dev/core";
import { Knobs, knob, useKnobs } from "@seanperez/ui";

const VARIANTS = {
  filled: "bg-neutral-900 text-white hover:bg-neutral-700",
  outlined: "border border-neutral-400 text-neutral-900 hover:bg-neutral-100",
  text: "text-neutral-900 underline underline-offset-4",
} as const;

const SIZES = {
  small: "px-3 py-1 text-sm",
  medium: "px-4 py-2 text-base",
  large: "px-6 py-3 text-lg",
} as const;

export default component$(() => {
  const knobs = useKnobs({
    label: knob.text("Get in touch"),
    variant: knob.select(["filled", "outlined", "text"], "filled"),
    size: knob.select(["small", "medium", "large"], "medium"),
    rounded: knob.boolean(true),
    disabled: knob.boolean(false),
  });

  return (
    <main class="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6 py-12">
      <h1 class="text-2xl font-semibold tracking-tight">@seanperez/ui</h1>
      <p class="text-neutral-600">
        The workspace component library, imported by the app. Change the knobs
        to see the props applied live.
      </p>
      <Knobs knobs={knobs}>
        <button
          type="button"
          disabled={knobs.values.disabled}
          class={[
            "font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
            VARIANTS[knobs.values.variant],
            SIZES[knobs.values.size],
            knobs.values.rounded ? "rounded-full" : "rounded-none",
          ]}
        >
          {knobs.values.label}
        </button>
      </Knobs>
    </main>
  );
});

export const head: DocumentHead = {
  title: "UI library: Sean Perez",
};
