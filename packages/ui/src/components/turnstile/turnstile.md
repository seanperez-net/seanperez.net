# Turnstile

Cloudflare Turnstile bot check for a form, rendered in explicit mode. It produces a single-use
token only; the **server** decides whether the token is valid (Siteverify, then the hostname,
then the action). Not an M3 component: a third-party widget in an M3 frame, whose only M3 part is
the `error`-colored notice it shows when JavaScript is off.

Ported 2026-11-24 from e-store's `packages/ui/src/components/turnstile/` (it lives in an e-store
worktree, `.claude/worktrees/wf_c24f880d-3e6-1/`, not on e-store's main tree). PROOFED
2026-11-24 against the Cloudflare Turnstile docs (client-side rendering, widget configurations,
testing). A fresh agent's review (2026-11-24) independently recommended explicit rendering in a
`useVisibleTask$` for the same reason (implicit rendering only scans on a full page load).

- Without a `siteKey` the component renders **nothing**: no element, no script.
- Inside a `<form>`, the widget adds a hidden input named `cf-turnstile-response` (or
  `responseFieldName`). A Qwik `<Form action>` post then carries the token without extra wiring.
- api.js loads once per page, when the first widget scrolls into view (`useVisibleTask$`), or
  with `loadOn="interaction"` on the first use of its form (below).

## API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `siteKey` | `string \| null` | - | The widget's site key. Empty or absent: renders nothing. |
| `action` | `string` | - | Echoed back by Siteverify and checked on the server. One per form. At most 32 characters: letters, digits, `_` and `-`. |
| `theme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | `auto`: the page's mode (`dark` class on `<html>`) when the widget renders. |
| `size` | `'normal' \| 'flexible' \| 'compact'` | `'flexible'` | `flexible` fills the form's width. |
| `appearance` | `'always' \| 'execute' \| 'interaction-only'` | `'always'` | Cloudflare's appearance mode. `interaction-only`: visible only when the visitor must click (PROOFED 2026-11-24, developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/ "Appearance modes"). Only `always` reserves the 65px height. |
| `language` | `string` | `'auto'` | `auto`, an ISO 639-1 code, or a language-country code. |
| `responseFieldName` | `string` | `'cf-turnstile-response'` | The hidden input's name. |
| `pending` | `boolean` | `false` | The owning form's in-flight flag (`action.isRunning`). From `true` back to `false` the widget resets: that submit spent the token. |
| `noScriptMessage` | `string` | "This form uses a security check that needs JavaScript..." | Shown only without JavaScript. |
| `loadOn` | `'visible' \| 'interaction'` | `'visible'` | When api.js loads and the widget renders: on view, or on the first `focusin` / `pointerdown` / `input` / `submit` inside the widget's own `<form>`. NEW 2026-11-24, not in e-store. |
| `onSolve$` | `QRL<(token) => void>` | - | Turnstile's `callback`: the challenge was solved. |
| `onExpire$` | `QRL<() => void>` | - | `expired-callback`: the token expired before the form was sent (the widget refreshes it). |
| `onError$` | `QRL<(code) => void>` | - | `error-callback`, with Turnstile's error code. |
| `scriptUrl` | `string` | `TURNSTILE_SCRIPT_URL` | Tests only. Cloudflare requires the exact published URL. |
| `class` | `string` | - | Layout only. |

## Loading on interaction (`loadOn`, NEW 2026-11-24, not in e-store)

The site's Contact panel is open by default on every route, so loading on view fetched api.js
(about 87 KB) and Cloudflare's iframe for every visitor (perf audit 2026-11-24,
`.claude/notes/perf-audit-components-vs-css-2026-11-24.md`). `loadOn="interaction"` waits for
the visitor to use the form:

- A `useOnDocument` listener for `focusin`, `pointerdown`, `input` and `submit` (on the
  document: focus on the fields never reaches this component's element, they are its siblings)
  arms the widget when the event's target is inside `host.closest("form")`. `pointerdown`
  covers Safari, which does not focus a clicked button: with a restored draft, Send can be the
  first thing pressed. The listener's small chunk loads on the first such event on the page.
- The existing `useVisibleTask$` tracks the armed flag, so it renders once the widget is both
  visible and armed. Explicit rendering is the mode Cloudflare documents for widgets rendered
  after page load (client-side rendering docs, PROOFED 2026-11-24 above).
- A quick submit can come before the token. `waitForTurnstileToken(form, { fieldName,
  timeoutMs = 10000 })` resolves with the token once the hidden input holds one, or `""` at
  once when the form has no widget or the widget reported an error (`data-error` on the root,
  set by `error-callback`), or after the timeout. Use it in the form's ASYNC `onSubmit$`: the
  router's `<Form action>` awaits async submit handlers and only then builds `FormData` and
  posts (`@qwik.dev/router` rc.5 `Form` and `submit`, read 2026-11-24), so the token written
  meanwhile is sent, and a second click during the wait is dropped by the router. Show a busy
  state yourself: `action.isRunning` is still false while the handler waits. The 10 s allow an
  `interaction-only` challenge that appears late; past it the server's own "complete the
  security check" message shows.

```tsx
const checking = useSignal(false);
<Form
  action={send}
  onSubmit$={async (_, form: HTMLFormElement) => {
    checking.value = true;
    try {
      await waitForTurnstileToken(form);
    } finally {
      checking.value = false;
    }
  }}
>
  ...
  <Turnstile siteKey={siteKey} action="contact" loadOn="interaction" pending={send.isRunning} />
  <Button type="submit" label="Send" isLoading={checking.value || send.isRunning} />
</Form>
```

Considered and not taken: Cloudflare's `execution: "execute"` with `turnstile.execute()` defers
the challenge to submit time but still loads api.js on render, so it saves none of the 87 KB.

## The Qwik packages that exist, and why this is a port instead (2026-11-24)

Read 2026-11-24, both Qwik v1 (`@builder.io/qwik`), so neither is installed here:

- `qwikifiers/qwik-turnstile` 0.0.3 (`src/use-turnstile.tsx`, `reset.ts`, `verify.ts`): IMPLICIT
  rendering (a `.cf-turnstile` div and the plain api.js), a `useVisibleTask$` that appends the
  script and watches the hidden input with `MutationObserver`s for the token; `resetTurnstile()`
  resets the global widget without an id; `verifyTurnstile()` checks `success` only (no
  hostname or action). Implicit rendering scans the page once on load, so after a client-side
  navigation to the form no widget is drawn: the reason we render explicitly.
- `LuggaPugga/better-captcha` `packages/qwik` 0.8.0 (`base-captcha.tsx`,
  `use-captcha-lifecycle.ts`): EXPLICIT, through its `@better-captcha/core` controller, in a
  `useVisibleTask$` that tracks the host element and props, with `onReady$` / `onSolve$` /
  `onError$` QRL callbacks and a cleanup that removes the widget. Our `onSolve$` / `onError$`
  names follow it; `onExpire$` is Turnstile's `expired-callback`.

Pattern PROOFED 2026-11-24 against Cloudflare's client-side rendering docs (explicit render with
`?render=explicit`, `callback`, `expired-callback`, `error-callback`, `reset(id)`, `remove(id)`)
and the two packages above; the structure is e-store's.

## ARIA

The challenge is Cloudflare's iframe; Cloudflare is responsible for its accessibility. This
component adds no role. The `<noscript>` notice is static text in a paragraph.

## Usage

```tsx
<Form action={send}>
  <TextField name="message" type="textarea" label="Message" />
  <Turnstile siteKey={siteKey} action="contact" pending={send.isRunning} />
  <Button type="submit" label="Send" />
</Form>
```

Test keys (Cloudflare "Testing"): site key `1x00000000000000000000AA` (always passes),
`2x00000000000000000000AB` (always fails), `3x00000000000000000000FF` (forces an interactive
challenge); secret `1x0000000000000000000000000000000AA` (pass) /
`2x0000000000000000000000000000000AA` (fail). A test secret answers `hostname: "example.com"`
and no `action`.

## Content Security Policy

Allow `script-src` and `frame-src` `https://challenges.cloudflare.com`. The script is created
with the page's own nonce when a `script[nonce]` exists.

## Where it differs from e-store

- `theme="auto"` resolves to the PAGE's mode (our dark mode is the `dark` class on `<html>`, not
  only the OS preference); e-store passes `auto` to Turnstile, which follows the OS, so a dark
  site in a light OS showed a light widget. The widget does not follow a later light / dark
  switch (Turnstile has no theme setter; it would need a re-render).
- Formatting only otherwise (double quotes, US spelling in comments).
- The reset on `pending` is a `useTask$` (it reruns in the browser when `pending` changes); e-store uses a second `useVisibleTask$`, which the Qwik lint flags as eager.
