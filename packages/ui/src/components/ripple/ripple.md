# Ripple

Material Design 3 ripple effect using global event delegation and the Web Animations API. No per-component JavaScript: one set of document listeners handles every ripple-enabled element. From e-store's `components/ripple` (PROOFED 2026-11-23 against Qwik 2.0.0-rc.5 `qwikloader.debug.js`). Mounted in `Layout.Root` since 2026-11-23, see "Status".

- **M3 spec**: https://m3.material.io/foundations/interaction/states/overview
- **MDN**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API

## Status

ON since 2026-11-23 (owner): `Layout.Root` wraps the scaffold in `<RippleProvider>`, as e-store's `Layout.Root` does, so every `data-ripple` host with a `<RippleSurface />` inside a `Layout.Root` ripples (today: `List` rows, `Carousel` items). Checked in Chrome on the playground's `/list/`: a row click runs the grow and fade animations. An app without `Layout.Root` mounts `RippleProvider` itself (below).

## Architecture

Two components work together:

1. **`RippleProvider`**: place once in the app layout. Registers document-level `pointerdown`, `pointerup`, `click`, `pointerleave`, `pointercancel` and `contextmenu` listeners with Qwik's `useOnDocument`. Handles ALL ripples on the page.
2. **`RippleSurface`**: place inside any interactive element. Its `::after` pseudo-element is the target of the ripple animation.

Interactive elements need the `data-ripple` attribute on the host element.

### Why global delegation?

| Approach          | Listeners for 50 buttons | JS on page load |
| ----------------- | ------------------------ | --------------- |
| Per component     | 350 (7 per instance)     | eager           |
| Global delegation | 6 (document level)       | 0 (lazy)        |

The handler JavaScript downloads only on the first interaction, as Qwik's resumability intends.

## Props: `RippleProviderProps`

| Prop    | Type        | Default | Description                            |
| ------- | ----------- | ------- | -------------------------------------- |
| `class` | `ClassList` |         | Declared, not used (it renders a Slot) |

## Props: `RippleSurfaceProps`

| Prop    | Type        | Default | Description                            |
| ------- | ----------- | ------- | -------------------------------------- |
| `class` | `ClassList` |         | Additional classes on the surface span |

## Usage

### Layout setup (once)

```tsx
import { RippleProvider } from "@seanperez/ui";

export default component$(() => (
  <RippleProvider>
    <Slot />
  </RippleProvider>
));
```

### Adding ripple to a component

```tsx
import { RippleSurface } from "@seanperez/ui";

// Any interactive element: add data-ripple and a RippleSurface
<button data-ripple class="relative overflow-hidden rounded-full">
  <RippleSurface />
  Click me
</button>;
```

### Requirements on the host element

The `data-ripple` element needs:

- `position: relative` (the surface is absolutely positioned)
- `overflow: hidden` (clips the ripple to the element)
- `border-radius` (the surface inherits it through `rounded-[inherit]`)

### Focus is not the ripple's job

The ripple is the PRESSED state layer only. A focusable host still needs the M3 focus indicator: add the `focus-ring` utility (outward, 3px `secondary`, animated like material-web `md-focus-ring`; `tokens/components/focus-ring.css`), or `focus-ring-inward` for a list-item-like host. `overflow-hidden` on the host does not clip its own outline.

## How it works

1. `RippleProvider` listens for `pointerdown` on `document` through `useOnDocument`
2. On an event it walks up the DOM with `closest('[data-ripple]')` to find the host
3. It finds the `[data-ripple-surface]` child within the host
4. It works out the ripple origin from the pointer coordinates
5. It runs two WAAPI animations on the surface's `::after` pseudo-element: grow (size and position) and fade-in (opacity 0 to 0.12 in 105ms)
6. On click it ends the press with a fade-out (opacity 0.12 to 0 in 375ms)
7. Touch waits 150ms to tell a scroll from a press
8. Keyboard clicks (Enter / Space) draw the ripple from the centre

`pointerleave` does not bubble, but Qwik's loader registers document listeners in the capture phase (`qwikloader.debug.js`: `addEventListener(root, eventName, ..., true, passive)`), so the document handler does see it, once for every element the pointer leaves.

## State machine (matches material-web)

```
Touch:      INACTIVE → TOUCH_DELAY → HOLDING → WAITING_FOR_CLICK → INACTIVE
Mouse/Pen:  INACTIVE → WAITING_FOR_CLICK → INACTIVE
Keyboard:   INACTIVE → (press+release) → INACTIVE
```

The ripple ends on **click**, not pointerup, so it stays visible long enough.

## Constants (matching material-web)

| Constant                    | Value | Purpose                            |
| --------------------------- | ----- | ---------------------------------- |
| `PRESS_GROW_MS`             | 450ms | Ripple expansion duration          |
| `MINIMUM_PRESS_MS`          | 225ms | Minimum visible time before cancel |
| `INITIAL_ORIGIN_SCALE`      | 0.2   | Starting size ratio                |
| `TOUCH_DELAY_MS`            | 150ms | Scroll or press                    |
| `SOFT_EDGE_CONTAINER_RATIO` | 0.35  | Soft edge sizing                   |
| `PADDING`                   | 10px  | Extra radius beyond the hypotenuse |

A surface smaller than 5px (the start size is floored, so it would be 0) draws no ripple: that is a surface measured while hidden, such as a button under `display: none` or one its own click removed before the lazy handler ran. Without the guard the end keyframe was `scale(Infinity)` and the browser warned "Invalid keyframe value". `rippleGeometry(width, height)` returns the sizes or `null`.

## ARIA

The surface is decorative: `aria-hidden="true"`. It takes no focus and no pointer events.

## Web standards

- **Web Animations API**: `Element.animate()` on the `::after` pseudo-element ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API))
- **Pointer Events**: one model for touch, mouse and pen ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events))
- **Event delegation**: document listeners, `closest()` to find the host
- **WeakMap**: per-element state without leaks ([MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap))

## Browser support

Web Animations API, Pointer Events and WeakMap: all modern evergreen browsers.

## Where it differs from e-store

- Reduced motion (new, not in e-store; e-store's ripple ignores it): with `prefers-reduced-motion: reduce` no ripple is drawn; the press state (`data-pressed`) still applies. The check is in `startPressAnimation` (`matchMedia`), because Web Animations do not follow CSS media queries; `fadeOutRipple` skips the fade when nothing was drawn. Checked in Chrome with `matchMedia` stubbed to report reduce: no animation on a row click.
- `:scope >` surface lookup and the host-only `pointerleave` (fixes, commented in the code).

e-store's test file (`ripple.test.ts`) was not ported: this package has no test runner.
