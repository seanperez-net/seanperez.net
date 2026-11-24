/**
 * Date math for the date pickers. Every date is a `YYYY-MM-DD` string: no `Date` object is ever
 * stored in a signal, context or QRL closure (Qwik serialises state). `Date` is used only for
 * arithmetic inside a call, in local time.
 *
 * From e-store's `components/calendar/calendar.tsx` (its module-level helpers: `toDateStr`,
 * `parseDateStr`, `isDateStr`, `daysInMonth`, `buildMonthGrid`, `moveFocusDate`, `nextTapRange`,
 * `checkDisabled`) and `components/date-picker/date-picker.tsx` (`parseInputToDateStr`,
 * `formatHeaderDate`, `formatRangeHeader`). Left out, with e-store's Calendar component: week
 * numbers, the compact (Google Calendar) size, the drag gesture, unavailable / no-start days,
 * day content and nights (a shop's stay picker). None of them is in the M3 date picker spec.
 */

/** `YYYY-MM-DD` from a year, a 0-based month and a day. */
export const toDateStr = (year: number, month: number, day: number): string =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Whether `s` has the `YYYY-MM-DD` shape. */
export const isDateStr = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** `{ year, month (0-based), day }` of a `YYYY-MM-DD` string. */
export const parseDateStr = (s: string) => {
  const [year, month, day] = s.split("-").map(Number);
  return { year, month: month - 1, day };
};

/** Today on the runtime's clock. */
export const todayStr = (): string => {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
};

/** A local `Date` for a `YYYY-MM-DD` string (for `Intl` only). */
export const toDate = (s: string): Date => {
  const { year, month, day } = parseDateStr(s);
  return new Date(year, month, day);
};

export const daysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

/** `{ year, month }` moved by `delta` months. */
export const addMonths = (year: number, month: number, delta: number) => {
  const m = month + delta;
  return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
};

/** One day of a month grid. `outside`: it belongs to the month before or after. */
export type CalendarDay = { date: string; day: number; outside: boolean };

/**
 * The weeks (Sunday first) of a month, padded with the neighbouring months' days. `sixWeeks`:
 * always six rows, so a picker that shows the outside days keeps one height (M3 docked: 456dp).
 */
export const buildMonthGrid = (
  year: number,
  month: number,
  sixWeeks = false,
): CalendarDay[][] => {
  const first = new Date(year, month, 1).getDay();
  const start = new Date(year, month, 1 - first);
  const total = sixWeeks
    ? 42
    : Math.ceil((first + daysInMonth(year, month)) / 7) * 7;
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
    );
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({
      date: toDateStr(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      outside: d.getMonth() !== month,
    });
  }
  return weeks;
};

/** Outside `min` / `max` (either may be empty). */
export const isOutOfRange = (
  date: string,
  min?: string,
  max?: string,
): boolean => (!!min && date < min) || (!!max && date > max);

/** `date` moved into [min, max]. */
export const clampDate = (date: string, min?: string, max?: string): string =>
  min && date < min ? min : max && date > max ? max : date;

/**
 * The day that is a month's one Tab stop: the first candidate (focused, selected, today) in the
 * month, else its first day, moved into [min, max]. Disabled days stay focusable (APG), so the
 * grid always has a Tab stop.
 */
export const tabDateFor = (
  year: number,
  month: number,
  candidates: string[],
  min?: string,
  max?: string,
): string => {
  const prefix = toDateStr(year, month, 1).slice(0, 8);
  const pick = candidates.find((d) => d.startsWith(prefix)) ?? `${prefix}01`;
  const clamped = clampDate(pick, min, max);
  return clamped.startsWith(prefix) ? clamped : pick;
};

/** The keys that move focus in a day grid. */
export const GRID_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
];

/**
 * The day focus moves to from `from` for a grid key (WAI-ARIA APG date picker dialog, "Date
 * Grid"): Left / Right one day, Up / Down a week, Home / End the first / last day of the week,
 * PageUp / PageDown a month and with Shift a year, the day clamped to the month's length
 * (Jan 31 to Feb 28). `rtl` swaps Left and Right. `null` for any other key. e-store's.
 */
export const moveFocusDate = (
  from: string,
  key: string,
  shift = false,
  rtl = false,
): string | null => {
  const { year, month, day } = parseDateStr(from);
  const d = new Date(year, month, day);
  const toMonth = (delta: number) => {
    const t = addMonths(year, month, delta);
    return toDateStr(
      t.year,
      t.month,
      Math.min(day, daysInMonth(t.year, t.month)),
    );
  };
  const k =
    rtl && key === "ArrowLeft"
      ? "ArrowRight"
      : rtl && key === "ArrowRight"
        ? "ArrowLeft"
        : key;
  switch (k) {
    case "ArrowLeft":
      d.setDate(day - 1);
      break;
    case "ArrowRight":
      d.setDate(day + 1);
      break;
    case "ArrowUp":
      d.setDate(day - 7);
      break;
    case "ArrowDown":
      d.setDate(day + 7);
      break;
    case "Home":
      d.setDate(day - d.getDay());
      break;
    case "End":
      d.setDate(day + 6 - d.getDay());
      break;
    case "PageUp":
      return toMonth(shift ? -12 : -1);
    case "PageDown":
      return toMonth(shift ? 12 : 1);
    default:
      return null;
  }
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * The range after tapping `day` (M3 range selection: "tap the start and end dates"): the first
 * tap starts a range, the second ends it, a second tap before the start swaps the two, and a tap
 * after a complete range starts a new one. e-store's.
 */
export const nextTapRange = (
  start: string,
  end: string,
  day: string,
): { start: string; end: string } => {
  if (!start || end) return { start: day, end: "" };
  return day < start ? { start: day, end: start } : { start, end: day };
};

/**
 * A typed date, month first (MM/DD/YYYY), or `""`. M3 date pickers accessibility: "accept a range
 * of formats including dashes, spaces, slashes, dots, and 0 to the left of a single digit
 * month/day". e-store accepted slashes and dashes only.
 */
export const parseTypedDate = (text: string): string => {
  const match = text
    .trim()
    .match(/^(\d{1,2})[\s/.-]+(\d{1,2})[\s/.-]+(\d{4})$/);
  if (!match) return "";
  const m = Number(match[1]);
  const d = Number(match[2]);
  const y = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || y < 1000) return "";
  if (d > daysInMonth(y, m - 1)) return "";
  return toDateStr(y, m - 1, d);
};

/** `MM/DD/YYYY` for a text field (M3's default format). */
export const toTypedDate = (date: string): string => {
  if (!isDateStr(date)) return "";
  const [y, m, d] = date.split("-");
  return `${m}/${d}/${y}`;
};

/** One `Intl.DateTimeFormat` per locale and options (a range view renders ~800 day labels). */
const formatters = new Map<string, Intl.DateTimeFormat>();
const fmt = (locale: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, f);
  }
  return f;
};

/** Twelve month names, long. */
export const monthNames = (locale: string): string[] =>
  Array.from({ length: 12 }, (_, i) =>
    fmt(locale, { month: "long" }).format(new Date(2024, i, 1)),
  );

/** Seven weekday names from Sunday, in `narrow` ("S") or `long` ("Sunday") form. */
export const weekdayNames = (
  locale: string,
  width: "narrow" | "long",
): string[] =>
  Array.from({ length: 7 }, (_, i) =>
    fmt(locale, { weekday: width }).format(new Date(2024, 0, 7 + i)),
  );

/** "August 2025". */
export const formatMonthYear = (
  year: number,
  month: number,
  locale: string,
): string =>
  fmt(locale, { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );

/** "Monday, August 17, 2025": a day's accessible name (M3 date pickers accessibility). */
export const formatFullDate = (date: string, locale: string): string =>
  fmt(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(toDate(date));

/** "Mon, Aug 17": the modal header (M3 modal date picker). */
export const formatHeaderDate = (date: string, locale: string): string =>
  fmt(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(toDate(date));

/** "Aug 17 – 23" (`formatRange`); with no end, "Aug 17 – {endLabel}". */
export const formatRangeHeader = (
  start: string,
  end: string,
  locale: string,
  startLabel: string,
  endLabel: string,
): string => {
  const range = fmt(locale, {
    month: "short",
    day: "numeric",
  });
  if (!start) return `${startLabel} – ${endLabel}`;
  if (!end) return `${range.format(toDate(start))} – ${endLabel}`;
  // `formatRange` is ES2021 Intl (every current browser); our TS lib predates its typing.
  return (
    range as Intl.DateTimeFormat & { formatRange(a: Date, b: Date): string }
  ).formatRange(toDate(start), toDate(end));
};
