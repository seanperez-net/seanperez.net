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
 * Material 3 theme controls: pick a source color (a swatch, or HCT sliders with a strip
 * showing each axis) and a color mode. After e-store's `ThemeChanger`.
 * https://m3.material.io/styles/color/dynamic/choosing-a-source
 *
 * Pure UI: it only writes the theme context's two signals (or the ones bound into it). The
 * theme provider (`Layout.Root`, or `ThemeRoot`) generates the colors, applies and saves them.
 */
export const themeChangerVariants = tv({
  slots: {
    // 16dp between blocks and between sliders (owner, 2026-11-24: "tighten the theme gaps", so the
    // side pane fits without scrolling). e-store's are 24 / 20 (`gap-6` / `gap-5`).
    root: ["grid", "content-start", "gap-4", "text-on-surface"],
    section: [
      "grid",
      "gap-4",
      "rounded-xl",
      "bg-surface-variant",
      "p-4",
      "text-on-surface-variant",
    ],
    hexRow: ["flex", "items-center", "gap-3"],
    // The label, with Reset colors as a small second line under it (owner, 2026-11-24: "put the
    // reset colors small ... in the Source color as a second line there its taking to much space
    // where it is now"). Was a full-size text button on its own row at the end.
    hexText: ["grid", "flex-1", "justify-items-start", "gap-1"],
    hexLabel: ["text-body-large"],
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
    sliderLabel: ["text-label-large"],
    gradient: ["h-6", "rounded-full", "border", "border-current"],
    // A text button's 12dp side padding, pulled back so its text lines up with the label.
    reset: ["-ms-3"],
  },
});

/**
 * The three mode buttons, in e-store's order, which is also the Material Web catalog's (dark,
 * auto, light; its auto icon `brightness_medium`, e-store's `computer`). Plain data: a CMS can
 * relabel them.
 */
export type ThemeModeOption = {
  value: ColorMode;
  label: string;
  icon: IconName;
};

export const DEFAULT_MODE_OPTIONS: ThemeModeOption[] = [
  { value: "dark", label: "Dark", icon: "dark_mode" },
  { value: "auto", label: "Device default", icon: "brightness_medium" },
  { value: "light", label: "Light", icon: "light_mode" },
];

export type ThemeChangerProps = Omit<PropsOf<"div">, "children"> & {
  /** The source color signal. Defaults to the theme context's. */
  "bind:color"?: Signal<string>;
  /** The color mode signal. Defaults to the theme context's. */
  "bind:mode"?: Signal<ColorMode>;
  /** The swatch row's words. */
  colorLabel?: string;
  hueLabel?: string;
  chromaLabel?: string;
  toneLabel?: string;
  /** The mode group's name for screen readers. */
  modeLabel?: string;
  modeOptions?: ThemeModeOption[];
  /** The button that goes back to the built-in colors. */
  resetLabel?: string;
  /** Show that button (e-store's). The Material Web catalog's theme menu has none. */
  reset?: boolean;
  /**
   * Show the color mode button (default). `false` where light / dark has its own control
   * elsewhere (the site: the rail and the drawer footer), so it is in one place only.
   */
  mode?: boolean;
};

export const ThemeChanger = component$<ThemeChangerProps>(
  ({
    "bind:color": givenColor,
    "bind:mode": givenMode,
    colorLabel = "Source color",
    hueLabel = "Hue",
    chromaLabel = "Chroma",
    toneLabel = "Tone",
    modeLabel = "Color mode",
    modeOptions = DEFAULT_MODE_OPTIONS,
    resetLabel = "Reset colors",
    reset = true,
    mode: showMode = true,
    class: className,
    ...rest
  }) => {
    const theme = useContext(themeContextId, null);
    const color = useBoundSignal(givenColor ?? theme?.sourceColor, "");
    const mode = useBoundSignal<ColorMode>(
      givenMode ?? theme?.colorMode,
      "auto",
    );

    // The sliders keep their own HCT values. Going hex -> HCT -> hex is not exact (a color
    // outside sRGB is clamped), so reading the sliders back from the hex on every move would
    // make them jump. `written` is the hex the sliders last produced: only a color that came
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

    // The Material Web catalog's theme menu, in its order (`catalog/src/components/
    // theme-changer.ts`, read 2026-11-24): the source color block, the HCT block (label, slider,
    // gradient; no numbers, the slider's value indicator shows the value while it is moved), the
    // mode segmented button across the full width with the selected check, outside any block.
    return (
      <div {...rest} class={[styles.root(), className]}>
        <div class={styles.section()}>
          {/* Not a wrapping <label>: Reset is a button, and a button inside the label of the
            color input would be an interactive element inside another one. */}
          <div class={styles.hexRow()}>
            <div class={styles.hexText()}>
              <label for={`${id}-color`} class={styles.hexLabel()}>
                {colorLabel}
              </label>
              {reset && (
                <Button
                  look="text"
                  size="xs"
                  label={resetLabel}
                  class={styles.reset()}
                  disabled={!color.value}
                  onClick$={() => (color.value = "")}
                />
              )}
            </div>
            <span
              class={styles.hexSwatch()}
              style={{ backgroundColor: color.value || DEFAULT_SOURCE_COLOR }}
            >
              <input
                id={`${id}-color`}
                type="color"
                class={styles.hexInput()}
                value={color.value || DEFAULT_SOURCE_COLOR}
                onInput$={(_, input) => (color.value = input.value)}
              />
            </span>
          </div>
        </div>
        <div class={styles.section()}>
          {sliders.map((slider) => (
            <div key={slider.axis} class={styles.sliderRow()}>
              <span id={`${id}-${slider.axis}`} class={styles.sliderLabel()}>
                {slider.label}
              </span>
              <Slider
                aria-labelledby={`${id}-${slider.axis}`}
                min={0}
                max={slider.max}
                step={1}
                value={Math.round(hct[slider.axis])}
                valueIndicator
                endStops={false}
                onValueChange$={(value) => setAxis$(slider.axis, value)}
              />
              <span
                class={styles.gradient()}
                style={{ background: slider.gradient.value }}
              />
            </div>
          ))}
        </div>
        {showMode && (
          <ToggleGroup.Root
            bind:value={mode}
            aria-label={modeLabel}
            fullWidth
            checkmark
          >
            {modeOptions.map((option) => (
              <ToggleGroup.Item
                key={option.value}
                value={option.value}
                icon={option.icon}
                aria-label={option.label}
                // The global plain tooltip (`TooltipProvider`), not `title`.
                data-tooltip=""
              />
            ))}
          </ToggleGroup.Root>
        )}
      </div>
    );
  },
);
