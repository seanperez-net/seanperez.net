import {
  $,
  component$,
  useComputed$,
  useContext,
  useId,
  useStore,
  useTask$,
} from "@qwik.dev/core";
import type { PropsOf, Signal } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { hctFromHex, hctGradient, hexFromHct } from "../../theme/hct";
import { themeContextId } from "../../theme/theme-context";
import { DEFAULT_SOURCE_COLOR } from "../../theme/theme-storage";
import type { ColorMode } from "../../theme/theme-storage";
import { useBoundSignal } from "../../utils/use-bound-signal";
import { Button } from "../button";
import { Slider } from "../slider";
import type { IconName } from "../icon";
import { ToggleGroup } from "../toggle-group";

/**
 * Material 3 theme controls: pick a source colour (a swatch, or HCT sliders with a strip
 * showing each axis) and a colour mode. After e-store's `ThemeChanger`.
 * https://m3.material.io/styles/color/dynamic/choosing-a-source
 *
 * Pure UI: it only writes the theme context's two signals (or the ones bound into it). The
 * theme provider (`Layout.Root`, or `ThemeRoot`) generates the colours, applies and saves them.
 */
export const themeChangerVariants = tv({
  slots: {
    root: ["grid", "content-start", "gap-6", "text-on-surface"],
    section: [
      "grid",
      "gap-5",
      "rounded-xl",
      "bg-surface-variant",
      "p-4",
      "text-on-surface-variant",
    ],
    hexRow: ["flex", "items-center", "gap-3"],
    hexLabel: ["flex-1", "text-body-large"],
    hexSwatch: [
      "relative",
      "size-12",
      "shrink-0",
      "rounded-full",
      "border-2",
      "border-on-surface-variant",
      "cursor-pointer",
    ],
    hexInput: [
      "absolute",
      "inset-0",
      "size-full",
      "rounded-full",
      "opacity-0",
      "cursor-pointer",
    ],
    sliderRow: ["grid", "gap-1"],
    sliderLabel: ["flex", "justify-between", "text-label-large"],
    gradient: ["h-6", "rounded-full", "border", "border-current"],
    modeRow: ["flex", "justify-center"],
    reset: ["justify-self-start"],
  },
});

/** The three mode buttons, in e-store's order. Plain data: a CMS can relabel them. */
export type ThemeModeOption = {
  value: ColorMode;
  label: string;
  icon: IconName;
};

export const DEFAULT_MODE_OPTIONS: ThemeModeOption[] = [
  { value: "dark", label: "Dark", icon: "dark_mode" },
  { value: "auto", label: "Device default", icon: "computer" },
  { value: "light", label: "Light", icon: "light_mode" },
];

export type ThemeChangerProps = Omit<PropsOf<"div">, "children"> & {
  /** The source colour signal. Defaults to the theme context's. */
  "bind:color"?: Signal<string>;
  /** The colour mode signal. Defaults to the theme context's. */
  "bind:mode"?: Signal<ColorMode>;
  /** The swatch row's words. */
  colorLabel?: string;
  hueLabel?: string;
  chromaLabel?: string;
  toneLabel?: string;
  /** The mode group's name for screen readers. */
  modeLabel?: string;
  modeOptions?: ThemeModeOption[];
  /** The button that goes back to the built-in colours. */
  resetLabel?: string;
};

export const ThemeChanger = component$<ThemeChangerProps>(
  ({
    "bind:color": givenColor,
    "bind:mode": givenMode,
    colorLabel = "Source colour",
    hueLabel = "Hue",
    chromaLabel = "Chroma",
    toneLabel = "Tone",
    modeLabel = "Colour mode",
    modeOptions = DEFAULT_MODE_OPTIONS,
    resetLabel = "Reset colours",
    class: className,
    ...rest
  }) => {
    const theme = useContext(themeContextId, null);
    const color = useBoundSignal(givenColor ?? theme?.sourceColor, "");
    const mode = useBoundSignal<ColorMode>(
      givenMode ?? theme?.colorMode,
      "auto",
    );

    // The sliders keep their own HCT values. Going hex -> HCT -> hex is not exact (a colour
    // outside sRGB is clamped), so reading the sliders back from the hex on every move would
    // make them jump. `written` is the hex the sliders last produced: only a colour that came
    // from somewhere else (the swatch, a saved theme, reset) moves them.
    const hct = useStore({ hue: 0, chroma: 0, tone: 0, written: "" });
    useTask$(({ track }) => {
      const hex = track(color) || DEFAULT_SOURCE_COLOR;
      if (hex === hct.written) return;
      const next = hctFromHex(hex);
      hct.hue = next.hue;
      hct.chroma = next.chroma;
      hct.tone = next.tone;
      hct.written = hex;
    });

    const setAxis$ = $((axis: "hue" | "chroma" | "tone", value: number) => {
      hct[axis] = value;
      const hex = hexFromHct(hct.hue, hct.chroma, hct.tone);
      hct.written = hex;
      color.value = hex;
    });

    const hueGradient = useComputed$(() => hctGradient("hue"));
    const chromaGradient = useComputed$(() => hctGradient("chroma", hct.hue));
    const toneGradient = useComputed$(() => hctGradient("tone"));

    const id = useId();
    const styles = themeChangerVariants();
    const sliders = [
      { axis: "hue", label: hueLabel, max: 360, gradient: hueGradient },
      {
        axis: "chroma",
        label: chromaLabel,
        max: 150,
        gradient: chromaGradient,
      },
      { axis: "tone", label: toneLabel, max: 100, gradient: toneGradient },
    ] as const;

    return (
      <div {...rest} class={[styles.root(), className]}>
        <div class={styles.section()}>
          <label class={styles.hexRow()}>
            <span class={styles.hexLabel()}>{colorLabel}</span>
            <span
              class={styles.hexSwatch()}
              style={{ backgroundColor: color.value || DEFAULT_SOURCE_COLOR }}
            >
              <input
                type="color"
                class={styles.hexInput()}
                value={color.value || DEFAULT_SOURCE_COLOR}
                onInput$={(_, input) => (color.value = input.value)}
              />
            </span>
          </label>
          {sliders.map((slider) => (
            <div key={slider.axis} class={styles.sliderRow()}>
              <span class={styles.sliderLabel()}>
                <span id={`${id}-${slider.axis}`}>{slider.label}</span>
                <span aria-hidden="true">{Math.round(hct[slider.axis])}</span>
              </span>
              {/* M3 slider, standard xs; the number above stands in for a value indicator. */}
              <Slider
                aria-labelledby={`${id}-${slider.axis}`}
                min={0}
                max={slider.max}
                step={1}
                value={Math.round(hct[slider.axis])}
                onValueChange$={(value) => setAxis$(slider.axis, value)}
              />
              <span
                class={styles.gradient()}
                style={{ background: slider.gradient.value }}
              />
            </div>
          ))}
        </div>
        <div class={styles.section()}>
          <div class={styles.modeRow()}>
            <ToggleGroup.Root bind:value={mode} aria-label={modeLabel}>
              {modeOptions.map((option) => (
                <ToggleGroup.Item
                  key={option.value}
                  value={option.value}
                  icon={option.icon}
                  aria-label={option.label}
                  title={option.label}
                />
              ))}
            </ToggleGroup.Root>
          </div>
        </div>
        <Button
          look="text"
          label={resetLabel}
          class={styles.reset()}
          disabled={!color.value}
          onClick$={() => (color.value = "")}
        />
      </div>
    );
  },
);
