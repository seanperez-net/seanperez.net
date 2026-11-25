import { component$, useComputed$ } from "@qwik.dev/core";
import { useLocation } from "@qwik.dev/router";
import { EmptyState, List, type LayoutCompanion } from "@seanperez/ui";
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
} from "../content/conversations";

/**
 * The Messages app's "Conversation details" side panel (2026-11-24): Google Chat's Members panel
 * (measured: a 40dp header button opening a panel beside the thread). NEW, not in e-store, whose
 * details are a Modal (`ChatConversationInfo`); here a COMPANION of the supporting pane (rule L5:
 * companion content uses `Layout.SupportingPane`, which already does the compact sheet, motion,
 * inert and focus return), only on a conversation's route (`isMessagesThreadPath`). Second agent,
 * 2026-11-24: a Modal is not M3's supporting pane, and the pane has no width for a third column.
 *
 * Content: what the conversation is, then its members; a member with a Contacts page links to
 * it. (Device members, linked to their map node, went with the demo devices on 2026-11-25.)
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
    // The panel's ONE body (m3-hierarchy H6): the conversation as a list row, then its members as a
    // list (m3-hierarchy B1, B10). Spacing between the two parts only; no library part restyled.
    <div class="grid gap-4">
      {thread.value ? (
        <>
          {/* The record this companion is about: ONE non-interactive row (M3 lists anatomy:
              leading avatar, label, supporting text). It was a hand-built avatar + heading block
              (e-store's `ChatConversationInfo` markup); the panel's header already names it. */}
          <List.Root padding="none" aria-label="Conversation">
            <List.Item
              lines="two-line"
              start={
                <ChatAvatar
                  person={withOwnAccount(
                    thread.value.person,
                    presence.shown,
                    own.fields,
                  )}
                />
              }
              headline={ownThreadTitle(thread.value, own.fields)}
              supportingText={thread.value.subtitle}
            />
          </List.Root>
          <section aria-labelledby="messages-members-title">
            {/* A section heading over a list, not a card (m3-hierarchy B5, B10). */}
            <h3
              id="messages-members-title"
              class="px-4 pb-1 text-title-small text-on-surface-variant"
            >
              Members ({thread.value.members.length})
            </h3>
            <List.Root padding="none" aria-labelledby="messages-members-title">
              {thread.value.members.map((person) => {
                // An app's account has a Contacts page (accounts, 2026-11-24); the viewer's own
                // row stays plain.
                const contact = person.id === ME.id ? null : contactOf(person);
                return (
                  <List.Item
                    key={person.id}
                    start={
                      <ChatAvatar
                        person={withOwnAccount(
                          person,
                          presence.shown,
                          own.fields,
                        )}
                      />
                    }
                    headline={
                      // The visitor: "Ada (you)", or "You" while unnamed.
                      person.id === ME.id ? ownLabel(own.fields) : person.name
                    }
                    supportingText={
                      contact
                        ? findAccount(person.id)?.isApp
                          ? "App · view contact"
                          : "View contact"
                        : undefined
                    }
                    href={contact ? `/contacts/${contact}/` : undefined}
                  />
                );
              })}
            </List.Root>
          </section>
        </>
      ) : (
        // Nothing chosen: the library's EmptyState (m3-hierarchy B9), as the list's empty views.
        <EmptyState
          size="sm"
          icon={MESSAGES_DETAILS_COMPANION.icon}
          headline="Open a conversation to see its details."
          live={false}
        />
      )}
    </div>
  );
});
