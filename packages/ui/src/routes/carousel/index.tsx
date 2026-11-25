import { component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Carousel, Layout, carouselVariantNames } from "../../index";
import { Knobs, knob, useKnobs } from "../../components/knobs";

/** A plain picture for the demo (no image files in the playground). */
const picture = (hue: number, w: number, h: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="hsl(${hue} 45% 60%)"/><circle cx="${w * 0.7}" cy="${h * 0.3}" r="${Math.min(w, h) * 0.15}" fill="hsl(${hue} 60% 82%)"/><path d="M0 ${h} ${w * 0.35} ${h * 0.45} ${w * 0.6} ${h * 0.8} ${w * 0.75} ${h * 0.65} ${w} ${h}Z" fill="hsl(${hue} 40% 34%)"/></svg>`,
  )}`;

const items = [
  { hue: 10, label: "Coast", w: 16, h: 9, width: "w-[398px]" },
  { hue: 40, label: "Dunes", w: 9, h: 16, width: "w-[126px]" },
  { hue: 90, label: "Forest", w: 1, h: 1, width: "w-56" },
  { hue: 150, label: "Lake", w: 3, h: 4, width: "w-42" },
  { hue: 200, label: "Glacier", w: 16, h: 9, width: "w-[398px]" },
  { hue: 250, label: "Night", w: 1, h: 1, width: "w-56" },
  { hue: 300, label: "Bloom", w: 3, h: 4, width: "w-42" },
  { hue: 340, label: "Canyon", w: 9, h: 16, width: "w-[126px]" },
];

/** The item box per layout: size is placement, the one thing a page sets with `class`. */
const itemClass = {
  "multi-browse": "h-56",
  hero: "h-64",
  "center-aligned-hero": "h-64",
  uncontained: "h-56 w-48",
  "full-screen": "",
} as const;

export default component$(() => {
  const activated = useSignal("none yet");
  const current = useSignal(0);
  const knobs = useKnobs({
    variant: knob.select(carouselVariantNames, "multi-browse"),
    maxItemWidth: knob.number(
      0,
      { min: 0, max: 800, step: 20 },
      "maxItemWidth (px, 0 = none)",
    ),
    snap: knob.boolean(false, "snap (uncontained)"),
    outlined: knob.boolean(false),
    itemLabel: knob.text("{index} of {count}"),
    disableThird: knob.boolean(false, "third item disabled"),
    header: knob.boolean(true, "header with show-all arrow"),
    showAll: knob.boolean(false, "Show all button below"),
  });

  return (
    <>
      <Layout.PaneHeader title="Carousel" />
      <Knobs knobs={knobs}>
        <div
          class={
            knobs.values.variant === "full-screen" ? "h-120 w-full" : "w-full"
          }
        >
          <Carousel.Root
            aria-label="Places"
            variant={knobs.values.variant}
            maxItemWidth={knobs.values.maxItemWidth}
            snap={knobs.values.snap}
            itemLabel={knobs.values.itemLabel}
            onIndexChange$={(i) => (current.value = i)}
          >
            {knobs.values.header && (
              <Carousel.Header q:slot="header" showAllHref="/carousel/">
                Places
              </Carousel.Header>
            )}
            {items.map((item, i) => (
              <Carousel.Item
                key={item.label}
                index={i}
                outlined={knobs.values.outlined}
                disabled={knobs.values.disableThird && i === 2}
                onClick$={() => (activated.value = item.label)}
                class={
                  knobs.values.variant === "uncontained-multi"
                    ? ["h-56", item.width]
                    : itemClass[knobs.values.variant]
                }
              >
                <img
                  src={picture(item.hue, item.w * 60, item.h * 60)}
                  alt={item.label}
                  width={item.w * 60}
                  height={item.h * 60}
                />
              </Carousel.Item>
            ))}
            {knobs.values.showAll && (
              <Carousel.ShowAll q:slot="footer" href="/carousel/" />
            )}
          </Carousel.Root>
        </div>
        <p class="text-body-medium text-on-surface-variant">
          Current item {current.value + 1}; last activated: {activated.value}
        </p>
      </Knobs>
    </>
  );
});

export const head: DocumentHead = { title: "Carousel: @seanperez/ui" };
