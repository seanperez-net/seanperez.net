/**
 * The visitor's contact account as `/api/me` tells THIS browser (client side). `null`: no
 * session. Never the email address (no-email rule, plan 1.5). Read with `cache: "no-store"`: the
 * answer is private and changes on sign-in; the endpoint also says `no-store`, which the service
 * worker never keeps (`routes/service-worker.ts` `storable`).
 */
export interface Me {
  name: string;
  /** This browser confirmed the address (link or code). */
  verified: boolean;
}

export const ME_PATH = "/api/me";

/** Fired on `document` after this tab's session changed (sent, verified, signed out). */
export const ME_CHANGED_EVENT = "spn:me-changed";

export async function fetchMe(): Promise<Me | null> {
  try {
    const res = await fetch(ME_PATH, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Me | null;
    return body && typeof body.name === "string"
      ? { name: body.name, verified: body.verified === true }
      : null;
  } catch {
    // Offline: no session as far as this page knows.
    return null;
  }
}

export async function signOutMe(): Promise<void> {
  await fetch(ME_PATH, { method: "POST", credentials: "same-origin" });
  document.dispatchEvent(new CustomEvent(ME_CHANGED_EVENT));
}
