import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Layout, Turnstile } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

/** Cloudflare's published TEST site keys (turnstile.md): no real challenge, safe anywhere. */
const TEST_KEYS = {
  passes: "1x00000000000000000000AA",
  fails: "2x00000000000000000000AB",
  interactive: "3x00000000000000000000FF",
} as const;

export default component$(() => {
  const knobs = useKnobs({
    key: knob.select(["passes", "fails", "interactive"] as const, "passes"),
    size: knob.select(["flexible", "normal", "compact"] as const, "flexible"),
  });

  return (
    <>
      <Layout.PaneHeader title="Turnstile" />
      <Knobs knobs={knobs}>
        {/* Keyed so a knob change renders a fresh widget (Turnstile reads its options once). */}
        <Turnstile
          key={`${knobs.values.key}-${knobs.values.size}`}
          siteKey={TEST_KEYS[knobs.values.key]}
          size={knobs.values.size}
          action="demo"
        />
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Turnstile: @seanperez/ui" };
