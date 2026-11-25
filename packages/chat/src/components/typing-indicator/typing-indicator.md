# ChatTypingIndicator

"Ada is typing…" / "Assistant is replying…" under the transcript. e-store's typing line
(`chat-workspace.tsx`: an `aria-live="polite"` paragraph), plus three decorative dots (new).

Props: `name` (`string | null`: nothing shows or is announced without it), `kind`
(`"typing"` | `"replying"`), `labels` (`isTyping`, `isReplying`), p attributes.

ARIA: `role="status"` + `aria-live="polite"`, ALWAYS rendered (a live region must exist before
its text changes). The dots are `aria-hidden` and stop under `prefers-reduced-motion`.
