// The demo route's data (e-store chat's `routes/_data/mock-chat.ts` pattern). Made-up people
// only; no email, no phone.
import type { ChatConversation, ChatMessage, ChatPerson } from "../../types";

export const ME: ChatPerson = {
  id: "me",
  name: "Demo user",
  presence: "online",
};
export const ALEX: ChatPerson = {
  id: "alex",
  name: "Alex Rivera",
  presence: "away",
};
export const BOT: ChatPerson = {
  id: "bot",
  name: "Assistant",
  icon: "smart_toy",
};

export const MESSAGES: ChatMessage[] = [
  {
    id: "1",
    author: ALEX,
    mine: false,
    createdAt: "2026-11-23T10:00:00Z",
    body: "Morning! Is the build green?",
  },
  {
    id: "2",
    author: ME,
    mine: true,
    status: "read",
    createdAt: "2026-11-23T10:02:00Z",
    body: "Yes, all three packages.",
  },
  {
    id: "3",
    author: ME,
    mine: true,
    status: "read",
    createdAt: "2026-11-23T10:02:30Z",
    body: "Chat goes after ui,\nthen the web app.",
  },
  {
    id: "4",
    author: ALEX,
    mine: false,
    createdAt: "2026-11-24T09:15:00Z",
    body: "Nice. A long message wraps inside its bubble and keeps its line breaks, and a very long word like pneumonoultramicroscopicsilicovolcanoconiosis breaks too.",
  },
  {
    id: "5",
    author: ME,
    mine: true,
    status: "delivered",
    createdAt: "2026-11-24T09:20:00Z",
    body: "Delivered, not read yet.",
  },
  {
    id: "6",
    author: ME,
    mine: true,
    status: "failed",
    createdAt: "2026-11-24T09:21:00Z",
    body: "This one failed.",
  },
  // Embeds (2026-11-24): a person chip, a place chip, an off-site link, a person chip that is
  // not a link, an unknown token, and a link card with and without a picture.
  {
    id: "7",
    author: ALEX,
    mine: false,
    createdAt: "2026-11-24T09:30:00Z",
    body: "Ask <@me> or <@sam> about it, we meet at <#cafe>. Notes: https://example.com/notes/(draft). and <@ghost>",
    refs: [
      { kind: "person", id: "me", person: ME, href: "/#me" },
      { kind: "person", id: "sam", person: { id: "sam", name: "Sam Lee" } },
      { kind: "place", id: "cafe", label: "Corner café", href: "/#cafe" },
    ],
    embeds: [
      {
        kind: "link",
        url: "https://example.com/notes/",
        title: "Meeting notes",
        description:
          "A link card: one link, the title, the host, two lines of description at most, and no picture.",
      },
    ],
  },
  {
    id: "8",
    author: ME,
    mine: true,
    status: "read",
    createdAt: "2026-11-24T09:31:00Z",
    body: "Thanks <@alex>! https://www.iana.org/help/example-domains",
    refs: [{ kind: "person", id: "alex", person: ALEX, href: "/#alex" }],
    embeds: [
      {
        kind: "link",
        url: "https://www.iana.org/help/example-domains",
        title: "Example Domains",
        siteName: "IANA",
        imageUrl:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 2'%3E%3Crect width='3' height='2' fill='%23889'/%3E%3C/svg%3E",
      },
    ],
  },
];

export const CONVERSATIONS: ChatConversation[] = [
  {
    id: "alex",
    kind: "direct",
    person: ALEX,
    unread: 2,
    lastMessageAt: "2026-11-24T09:21:00Z",
    lastMessage: {
      body: "This one failed.",
      createdAt: "2026-11-24T09:21:00Z",
      mine: true,
    },
  },
  {
    id: "bot",
    kind: "assistant",
    person: BOT,
    unread: 0,
    lastMessageAt: "2026-11-22T08:00:00Z",
    lastMessage: {
      body: "Ask me anything.",
      createdAt: "2026-11-22T08:00:00Z",
      mine: false,
    },
  },
];
