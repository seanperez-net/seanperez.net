import type { RequestHandler } from "@qwik.dev/router";
import { devMail } from "@seanperez/data/mail/mail.server";

/**
 * `GET /api/dev-mail?to=<address>`: `pnpm dev` ONLY. The last mail the dev console sender
 * "sent" to that address (`mail/mail.server.ts`, no `RESEND_API_KEY`), so the e2e tests
 * (`e2e/contact-verify.spec.ts`) can read the code and link a real inbox would get. In every
 * other build `import.meta.env.DEV` is false: 404, and `devMail` keeps nothing.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const onGet: RequestHandler = ({
  url,
  platform,
  cacheControl,
  json,
  error,
}) => {
  // Belt and braces (second agent, RULE 2): `DEV` follows Vite's MODE, so a
  // `vite build --mode development` would keep this route; also require a loopback host and no
  // Resend key.
  if (
    !import.meta.env.DEV ||
    !LOOPBACK.has(url.hostname) ||
    platform.env.RESEND_API_KEY
  ) {
    throw error(404, "Not found");
  }
  cacheControl({ noStore: true });
  const mail = devMail(url.searchParams.get("to") ?? "");
  json(200, mail ? { subject: mail.subject, text: mail.text } : null);
};
