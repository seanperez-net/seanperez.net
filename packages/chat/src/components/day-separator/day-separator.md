# ChatDaySeparator

The day above a day's first message: "Monday, November 23, 2026". NEW, not in e-store (it puts
the date in each message's time). An `<li>` holding a heading (default `h3`) with a `<time>`,
so the transcript's `<ol>` keeps only `<li>` children and the days are headings a screen reader
can jump between. Centred `label-medium` `on-surface-variant`, no line (M3 has no chat date chip).

Props: `date` (ISO), `headingLevel` (`2`-`6`, default 3), `locale`, `timeZone`, li attributes.
Dates are absolute in a fixed zone (no "Today"): the Worker renders in UTC, so a relative
word could differ between the server's HTML and the browser.
