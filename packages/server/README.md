# @seanperez/server

Server-only helpers shared by the site (`apps/web`) and the admin (`apps/admin`) that are not SQL:
the Cloudflare Access check, rate limits, Turnstile, the contact form's session cookie and
verification mail, mail sending (Resend, `send_email`) and the inbound mail handler, the site and
admin origins, and the feed's date and markdown helpers. The database code is in
[`@seanperez/db`](../db), which this package depends on. Source-only: the apps' Vite builds
compile it. `pnpm test` runs its unit tests.
