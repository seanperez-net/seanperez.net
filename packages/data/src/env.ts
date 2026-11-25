/**
 * The bindings and secrets this package reads, as a structural type: each app's generated `Env`
 * (`worker-configuration.d.ts`, `pnpm cf-typegen`) is assignable to it, and a module asks only for
 * what it uses (`Pick<DataEnv, ...>`). Secrets are optional here: unset means "off" (the callers
 * fail closed or say so), never a crash.
 */
export interface DataEnv {
  /** D1 `seanperez-net` (both apps). */
  DB: D1Database;
  /** apps/web only: the `send_email` binding for the owner's notices. */
  EMAIL?: SendEmail;
  /** HMAC key for the 6-digit codes; the SAME value on both Workers. */
  AUTH_SECRET?: string;
  RESEND_API_KEY?: string;
  OWNER_NOTIFY_TO?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_HOSTNAMES?: string;
}
