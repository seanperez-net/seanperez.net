import { component$, type PropsOf } from "@qwik.dev/core";
import { tv } from "tailwind-variants/lite";
import { CHAT_LOCALE, CHAT_TIME_ZONE, formatDay } from "../../utils";

/**
 * The day above a day's first message: a list row of the transcript holding a heading, so the
 * days are a heading level a screen reader can jump between, and the `<ol>` keeps only `<li>`
 * children. NEW, not in e-store (its list prints the date in each message's time). Centred
 * label text in `on-surface-variant`, no line (M3 has no chat date chip; a divider would repeat
 * what the heading says).
 */
export const daySeparatorVariants = tv({
  slots: {
    root: "flex justify-center pt-4 pb-1",
    heading: "text-label-medium text-on-surface-variant",
  },
});

export type ChatDaySeparatorProps = Omit<PropsOf<"li">, "children"> & {
  /** Any ISO time on that day. */
  date: string;
  /** The heading's level; default 3 (under the conversation's h2). */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  locale?: string;
  timeZone?: string;
};

export const ChatDaySeparator = component$<ChatDaySeparatorProps>(
  ({
    date,
    headingLevel = 3,
    locale = CHAT_LOCALE,
    timeZone = CHAT_TIME_ZONE,
    class: className,
    ...rest
  }) => {
    const s = daySeparatorVariants();
    const H = `h${headingLevel}` as const;
    return (
      <li {...rest} data-chat-day="" class={[s.root(), className]}>
        <H class={s.heading()}>
          <time dateTime={date.slice(0, 10)}>
            {formatDay(date, locale, timeZone)}
          </time>
        </H>
      </li>
    );
  },
);
