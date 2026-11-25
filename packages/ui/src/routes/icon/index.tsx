import { component$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Icon, Layout, iconNames } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";
import type { IconName, IconSize } from "../../index";

const sizes = [
  "xs",
  "dense",
  "sm",
  "md",
  "fabMd",
  "buttonLg",
  "fabLg",
  "lg",
  "xl",
] as const satisfies readonly IconSize[];

export default component$(() => {
  const knobs = useKnobs({
    name: knob.select(iconNames, "palette"),
    size: knob.select(sizes, "md"),
    label: knob.text("", "label (empty: decorative)"),
  });

  return (
    <>
      <Layout.PaneHeader title="Icon" />
      <div class="grid gap-8">
        <Knobs knobs={knobs}>
          <Icon
            name={knobs.values.name as IconName}
            size={knobs.values.size}
            label={knobs.values.label || undefined}
            class="text-on-surface"
          />
        </Knobs>

        <section class="grid gap-4">
          <h2 class="text-title-large">Every icon</h2>
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-4">
            {iconNames.map((name) => (
              <li
                key={name}
                class="flex min-w-0 flex-col items-center gap-2 text-body-small text-on-surface-variant"
              >
                <Icon name={name} class="text-on-surface" />
                {/* A name wider than its 8rem cell (`notifications_filled`) spilled past the
                    cell, and past the grid's edge in the last column. It now wraps inside the
                    cell: after an underscore (`<wbr>`), or anywhere as a last resort. */}
                <code class="max-w-full text-center wrap-anywhere">
                  {name
                    .split("_")
                    .flatMap((part, index) =>
                      index ? ["_", <wbr key={index} />, part] : [part],
                    )}
                </code>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
});

export const head: DocumentHead = { title: "Icon: @seanperez/ui" };
