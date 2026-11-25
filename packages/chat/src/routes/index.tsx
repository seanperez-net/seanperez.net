import { $, component$, useSignal } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";
import { Button, List } from "@seanperez/ui";
import { ChatConversationItem } from "../components/conversation-item";
import { MessageComposer } from "../components/message-composer";
import { MessageList } from "../components/message-list";
import { ChatTypingIndicator } from "../components/typing-indicator";
import type { ChatMessage } from "../types";
import { ALEX, BOT, CONVERSATIONS, ME, MESSAGES } from "./_data/mock-chat";

/**
 * The package's demo route (owner, 2026-11-24: "use the demo route to dev it"): `pnpm dev:chat`
 * at the monorepo root (port 5175). Every part on one page: the list rows, the transcript with
 * day separators and each status, the composer (a local echo), the typing line and a streamed
 * reply. Not part of the library's output (`tsconfig.types.json` excludes `src/routes`).
 */
export default component$(() => {
  const messages = useSignal<ChatMessage[]>(MESSAGES);
  const streaming = useSignal<ChatMessage | null>(null);
  const typing = useSignal(false);

  const send$ = $((text: string) => {
    messages.value = [
      ...messages.value,
      {
        id: `m${Date.now()}`,
        author: ME,
        mine: true,
        status: "sent",
        body: text,
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const stream$ = $(() => {
    const words =
      "This reply arrives word by word, outside the log, then lands in it whole.".split(
        " ",
      );
    const base = {
      id: `r${Date.now()}`,
      author: BOT,
      mine: false,
      body: "",
      createdAt: new Date().toISOString(),
    };
    let n = 0;
    const tick = () => {
      n++;
      if (n <= words.length) {
        streaming.value = { ...base, body: words.slice(0, n).join(" ") };
        setTimeout(tick, 120);
      } else {
        streaming.value = null;
        messages.value = [
          ...messages.value,
          { ...base, body: words.join(" ") },
        ];
      }
    };
    tick();
  });

  return (
    <main class="mx-auto grid max-w-5xl gap-6 p-6 md:grid-cols-[360px_minmax(0,1fr)]">
      <section aria-labelledby="demo-list" class="grid content-start gap-2">
        <h1 id="demo-list" class="text-title-large text-on-surface">
          @seanperez/chat
        </h1>
        <List.Root rovingFocus aria-labelledby="demo-list">
          {CONVERSATIONS.map((c, i) => (
            <ChatConversationItem
              key={c.id}
              conversation={c}
              href={`/#${c.id}`}
              selected={i === 0}
            />
          ))}
        </List.Root>
        <div class="flex flex-wrap gap-2">
          <Button
            look="outlined"
            label={typing.value ? "Stop typing" : "Alex types"}
            onClick$={() => (typing.value = !typing.value)}
          />
          <Button look="outlined" label="Stream a reply" onClick$={stream$} />
        </div>
      </section>
      <section
        aria-label="Conversation"
        class="bg-surface flex h-[80vh] min-h-0 flex-col gap-2 rounded-lg p-4"
      >
        <MessageList
          messages={messages.value}
          streaming={streaming.value}
          label={`Messages with ${ALEX.name}`}
        />
        <ChatTypingIndicator
          name={streaming.value ? BOT.name : typing.value ? ALEX.name : null}
          kind={streaming.value ? "replying" : "typing"}
        />
        <MessageComposer onSend$={send$} />
      </section>
    </main>
  );
});

export const head: DocumentHead = { title: "@seanperez/chat" };
