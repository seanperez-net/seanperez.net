# ThemeChanger

Pick the theme: a source color (a swatch, or Hue / Chroma / Tone sliders in Material's HCT
color space, each with a strip showing its axis) and a color mode (a `ToggleGroup`: dark,
device default, light). After e-store's `ThemeChanger`.

Pure UI. It writes two signals: the theme context's (from `Layout.Root` or `ThemeRoot`), or the
ones bound into it. The provider generates the Material 3 roles from the color
(`paletteCss`, Google's Material Color Utilities), puts them in `<style id="theme-palette">`,
and saves color, mode and the generated CSS in `localStorage`. `ThemeModeScript` in `<head>`
repaints a saved theme before first paint, without the color library.

## API

| Prop                                   | Type                | Default                 |
| -------------------------------------- | ------------------- | ----------------------- |
| `bind:color`                           | `Signal<string>`    | the theme context       |
| `bind:mode`                            | `Signal<ColorMode>` | the theme context       |
| `colorLabel`                           | `string`            | `Source color`          |
| `hueLabel`, `chromaLabel`, `toneLabel` | `string`            | `Hue`, `Chroma`, `Tone` |
| `modeLabel`                            | `string`            | `Color mode`            |
| `modeOptions`                          | `ThemeModeOption[]` | dark, auto, light       |
| `resetLabel`                           | `string`            | `Reset colors`          |
| `reset`                                | `boolean`           | `true` (e-store's)      |
| `mode`                                 | `boolean`           | `true`; `false` leaves the mode button out |

An empty color means the built-in colors of the token files ("Reset colors").

Also exported from `src/theme`: `ThemeRoot`, `useThemeProvider`, `themeContextId`,
`hctFromHex`, `hexFromHct`, `hctGradient`, `paletteCss`, the storage key names.

## ARIA

A native `<input type="color">` inside a `<label>`; each `Slider` (a native range input) is named
by its axis label (`aria-labelledby`); the mode group is a `ToggleGroup` (`role="group"`, named
by `modeLabel`) with pressed buttons; each icon-only button is named by its option label
(`aria-label`) and shows it as the global plain tooltip (`data-tooltip`, `TooltipProvider` in
`Layout.Root`; was `title` until 2026-11-23).

## Styles

`themeChangerVariants` (tv) slots: `root`, `section`, `hexRow`, `hexLabel`, `hexSwatch`,
`hexText`, `hexInput`, `sliderRow`, `sliderLabel`, `gradient`, `modeRow`, `reset`. The sliders are our
`Slider` (standard, xs), the mode group our `ToggleGroup`, Reset our `Button look="text" size="xs"`, a small second line under the Source color label
(owner, 2026-11-24: it took a whole row at the end)
(disabled while no color is picked).

## Usage

```tsx
<Layout.Root sourceColor="#415f91">
  <Layout.SupportingPane>
    <ThemeChanger />
  </Layout.SupportingPane>
</Layout.Root>
```

## Structure (2026-11-24, after the Material Web catalog)

Ordered as the catalog's theme menu (`catalog/src/components/theme-changer.ts` in
github.com/material-components/material-web, read 2026-11-24): a source-color block (label and a
round swatch), an HCT block (each slider: label, `Slider valueIndicator endStops={false}`, its
gradient bar; no numbers, no end dots), then the mode button OUTSIDE any block, full width with
the selected check (`ToggleGroup fullWidth checkmark`). The auto icon is the catalog's
`brightness_medium` (e-store's `computer`). Differs from the catalog: label "Source color" (the
catalog's "Hex Source Color"); `reset` (e-store's) stays on by default; the swatch is ours.
