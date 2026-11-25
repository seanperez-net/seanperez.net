import { component$, useComputed$ } from "@qwik.dev/core";
import { useLocation } from "@qwik.dev/router";
import { List, type LayoutCompanion } from "@seanperez/ui";
import { ChatAvatar } from "@seanperez/chat";
import { usePresence } from "../presence/use-presence";
import {
  ownLabel,
  ownThreadTitle,
  useProfileOverride,
  withOwnAccount,
} from "../profile/use-profile";
import { findAccount } from "../content/accounts";
import {
  ME,
  contactOf,
  findThread,
  isShortcut,
  nodeOf,
} from "../content/conversations";

/**
 * The Messages app's "Conversation details" side panel (2026-11-24): Google Chat's Members panel
 * (measured: a 40dp header button opening a panel beside the thread). NEW, not in e-store, whose
 * details are a Modal (`ChatConversationInfo`); here a COMPANION of the supporting pane (rule L5:
 * companion content uses `Layout.SupportingPane`, which already does the compact sheet, motion,
 * inert and focus return), only on a conversation's route (`isMessagesThreadPath`). Second agent,
 * 2026-11-24: a Modal is not M3's supporting pane, and the pane has no width for a third column.
 *
 * Content: what the conversation is, then its members; a device member is a link to its node on
 * the map (`/maps/?node=<id>`; this replaces the old per-device "Show on map" header button,
 * which a space with two devices cannot have).
 */
export const MESSAGES_DETAILS_COMPANION = {
  id: "messages-details",
  label: "Conversation details",
  icon: "info",
} satisfies LayoutCompanion;

/** `/messages/<id>/` for a conversation (not Home, not a Shortcuts view). */
export const isMessagesThreadPath = (pathname: string) => {
  const slug = /^\/messages\/([^/]+)\/?$/.exec(pathname)?.[1];
  return !!slug && !isShortcut(slug) && !!findThread(slug);
};

export const MessagesDetailsPanel = component$(() => {
  const loc = useLocation();
  const presence = usePresence();
  const own = useProfileOverride();
  const thread = useComputed$(() => {
    const slug = /^\/messages\/([^/]+)\/?$/.exec(loc.url.pathname)?.[1];
    return slug ? (findThread(slug) ?? null) : null;
  });
  return (
    // Spacing between the panel's parts (placement only; no library component is restyled).
    <div class="grid gap-4">
      {thread.value ? (
        <>
          <div class="flex items-center gap-3">
            <ChatAvatar
              person={withOwnAccount(
                thread.value.person,
                presence.shown,
                own.fields,
              )}
              size="lg"
            />
            <div class="min-w-0">
              <h3 class="text-title-medium text-on-surface">
                {ownThreadTitle(thread.value, own.fields)}
              </h3>
              <p class="text-body-medium text-on-surface-variant">
                {thread.value.subtitle}
              </p>
            </div>
          </div>
          <section aria-labelledby="messages-members-title">
            <h3
              id="messages-members-title"
              class="pb-1 text-title-small text-on-surface-variant"
            >
              Members ({thread.value.members.length})
            </h3>
            <List.Root padding="none">
              {thread.value.members.map((person) => {
                const node = nodeOf(person);
                // An app's account has a Contacts page (accounts, 2026-11-24); the viewer's own
                // row stays plain.
                const contact = person.id === ME.id ? null : contactOf(person);
                return (
                  <List.Item
                    key={person.id}
                    start={
                      <ChatAvatar
                        person={withOwnAccount(person, presence.shown, own.fields)}
                      />
                    }
                    headline={
                      // The visitor: "Ada (you)", or "You" while unnamed.
                      person.id === ME.id ? ownLabel(own.fields) : person.name
                    }
                    supportingText={
                      node
                        ? "Device · show on map"
                        : contact
                          ? findAccount(person.id)?.isApp
                            ? "App · view contact"
                            : "View contact"
                          : undefined
                    }
                    href={
                      node
                        ? `/maps/?node=${node}`
                        : contact
                          ? `/contacts/${contact}/`
                          : undefined
                    }
                    // Not on sight: the Maps route carries MapLibre (perf audit, 2026-11-24).
                    prefetchBundles="intent"
                  />
                );
              })}
            </List.Root>
          </section>
        </>
      ) : (
        <p class="text-body-medium text-on-surface-variant">
          Open a conversation to see its details.
        </p>
      )}
    </div>
  );
});
