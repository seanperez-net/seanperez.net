import { component$ } from "@qwik.dev/core";
import { useMessagesWindow } from "./messages-window-host";
import { IconButton, List } from "@seanperez/ui";
import type { LocalContact, SiteBase } from "../contacts/local-book";
import { SCOPE_WORDS, findAccount, type Account } from "../content/accounts";
import { ContactPerson } from "./contact-person";
import { SectionCard } from "./section-card";

/**
 * An APP's contact page, in Google Contacts' person page since 2026-11-24 (`ContactPerson`).
 * First built 2026-11-24, owner: "maybe add the assistant to the contacts? ... it
 * should be the same as a user that it gets permisions etc probably more tigheter but thats
 * later"): the same frame as a person's (`contact-profile.tsx`: Back in single-pane, the avatar
 * and name header, the actions, filled cards), with what an app has instead of a résumé: what it
 * is, its account (role, granted by) and its permissions. Its one action is "Message", its chat
 * in the Messages app.
 *
 * The permissions are PLACEHOLDERS (read-only words, nothing enforces them): the future model is
 * in PLAN.md ("Accounts and permissions"). NEW, not in e-store (whose contacts are people only).
 */
export const ContactAppProfile = component$<{
  account: Account;
  seed: string;
  /** The visitor's override of this contact, or its base (`ContactPerson record`). */
  record: LocalContact;
  base: SiteBase;
  overridden: boolean;
}>(({ account, seed, record, base, overridden }) => {
  const { open$: openMessages$ } = useMessagesWindow();
  const grantor = account.grantedBy ? findAccount(account.grantedBy) : null;
  return (
    <ContactPerson
      record={record}
      site={base}
      overridden={overridden}
      headline={
        [record.title, record.organization].filter(Boolean).join(", ") ||
        account.headline
      }
      seed={seed}
      fallbackIcon={account.icon}
      accountId={account.id}
    >
      {account.chatId && (
        <div
          q:slot="actions"
          class="flex flex-wrap items-center gap-1"
          aria-label="Actions"
          role="group"
        >
          {/* Its chat (the Messages app's Apps section): an in-site link; Google's captioned
              round button (`showLabel`). */}
          <IconButton
            look="tonal"
            icon="chat"
            label="Message"
            showLabel
            // The floating Messages window (its page below 600px).
            onClick$={(_: Event, el: HTMLElement) =>
              openMessages$(account.id, el)
            }
          />
        </div>
      )}

      {account.about && (
        <SectionCard id="contact-about" title="About" variant="filled">
          <p class="text-body-large whitespace-pre-line text-on-surface-variant">
            {account.about}
          </p>
        </SectionCard>
      )}

      <SectionCard id="contact-account" title="Account" full variant="filled">
        <List.Root aria-labelledby="contact-account">
          <List.Item
            startIcon="smart_toy"
            headline={account.isApp ? "App" : "Person"}
            supportingText="Type"
          />
          {grantor && (
            <List.Item
              startIcon="person"
              headline={grantor.name}
              supportingText="Added by"
            />
          )}
        </List.Root>
      </SectionCard>

      <SectionCard
        id="contact-permissions"
        title="Permissions"
        full
        variant="filled"
      >
        <List.Root aria-labelledby="contact-permissions">
          {account.scopes.map((scope) => (
            <List.Item
              key={scope}
              startIcon="check"
              headline={SCOPE_WORDS[scope]}
            />
          ))}
        </List.Root>
        <p class="px-4 pb-4 text-body-medium text-on-surface-variant">
          A preview: no permission is checked yet, and an app will only get what
          a person grants it.
        </p>
      </SectionCard>
    </ContactPerson>
  );
});
