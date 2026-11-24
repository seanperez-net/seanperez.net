# ThemeChanger

Pick the theme: a source colour (a swatch, or Hue / Chroma / Tone sliders in Material's HCT
colour space, each with a strip showing its axis) and a colour mode (a `ToggleGroup`: dark,
device default, light). After e-store's `ThemeChanger`.

Pure UI. It writes two signals: the theme context's (from `Layout.Root` or `ThemeRoot`), or the
ones bound into it. The provider generates the Material 3 roles from the colour
(`paletteCss`, Google's Material Color Utilities), puts them in `<style id="theme-palette">`,
and saves colour, mode and the generated CSS in `localStorage`. `ThemeModeScript` in `<head>`
repaints a saved theme before first paint, without the colour library.

## API

| Prop                                   | Type                | Default                 |
| -------------------------------------- | ------------------- | ----------------------- |
| `bind:color`                           | `Signal<string>`    | the theme context       |
| `bind:mode`                            | `Signal<ColorMode>` | the theme context       |
| `colorLabel`                           | `string`            | `Source colour`         |
| `hueLabel`, `chromaLabel`, `toneLabel` | `string`            | `Hue`, `Chroma`, `Tone` |
| `modeLabel`                            | `string`            | `Colour mode`           |
| `modeOptions`                          | `ThemeModeOption[]` | dark, auto, light       |
| `resetLabel`                           | `string`            | `Reset colours`         |

An empty colour means the built-in colours of the token files ("Reset colours").

Also exported from `src/theme`: `ThemeRoot`, `useThemeProvider`, `themeContextId`,
`hctFromHex`, `hexFromHct`, `hctGradient`, `paletteCss`, the storage key names.

## ARIA

Native `<input type="color">` and `<input type="range">` inside `<label>`s; the mode group is
`role="group"` with pressed buttons.

## Styles

`themeChangerVariants` (tv) slots: `root`, `section`, `hexRow`, `hexLabel`, `hexSwatch`,
`hexInput`, `sliderRow`, `sliderLabel`, `slider`, `gradient`, `modeRow`, `reset`.

## Usage

```tsx
<Layout.Root sourceColor="#415f91">
  <Layout.SupportingPane>
    <ThemeChanger />
  </Layout.SupportingPane>
</Layout.Root>
```
