// All dates in this app are day-level 'YYYY-MM-DD' strings.
// We deliberately AVOID `new Date('2026-07-08')` because that parses as UTC
// midnight and can shift a day depending on timezone. Everything here treats
// a date string as a local calendar day.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Parse 'YYYY-MM-DD' into a local Date at midnight. */
export function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a local Date as 'YYYY-MM-DD'. */
export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today as 'YYYY-MM-DD' in local time. */
export function todayStr(): string {
  return formatYMD(new Date());
}

/** Add n days to a 'YYYY-MM-DD' string, returns a new 'YYYY-MM-DD'. */
export function addDays(s: string, n: number): string {
  const d = parseYMD(s);
  d.setDate(d.getDate() + n);
  return formatYMD(d);
}

/** Whole days from a -> b (b - a). Same day = 0, tomorrow = 1, yesterday = -1. */
export function daysBetween(a: string, b: string): number {
  const ms = parseYMD(b).getTime() - parseYMD(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Inclusive list of every 'YYYY-MM-DD' from start..end. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  // guard against reversed ranges
  if (daysBetween(start, end) < 0) return [start];
  while (daysBetween(cur, end) >= 0) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** 'Wed' */
export function weekday(s: string): string {
  return WEEKDAYS[parseYMD(s).getDay()];
}

/** 'Jul 8' */
export function monthDay(s: string): string {
  const d = parseYMD(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 'Jul' */
export function monthShort(s: string): string {
  return MONTHS[parseYMD(s).getMonth()];
}

/** 'July' — full month name. */
export function monthName(s: string): string {
  return MONTHS_FULL[parseYMD(s).getMonth()];
}

/** 'Jul 2026' — month + year, handy when a range crosses years. */
export function monthYear(s: string): string {
  const d = parseYMD(s);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** True when this date is the 1st of its month. */
export function isMonthStart(s: string): boolean {
  return parseYMD(s).getDate() === 1;
}

/** 'Wed · Jul 8' */
export function longLabel(s: string): string {
  return `${weekday(s)} · ${monthDay(s)}`;
}

/** 'Jul 8, 2026' */
export function fullLabel(s: string): string {
  const d = parseYMD(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function isToday(s: string): boolean {
  return s === todayStr();
}

export function isWeekend(s: string): boolean {
  const day = parseYMD(s).getDay();
  return day === 0 || day === 6;
}

/** Is date string strictly before today? */
export function isPast(s: string): boolean {
  return daysBetween(todayStr(), s) < 0;
}

/** Human relative label for a date: 'Today', 'Tomorrow', 'in 5 days', '3 days ago'. */
export function relativeLabel(s: string): string {
  const n = daysBetween(todayStr(), s);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1) return `in ${n} days`;
  return `${Math.abs(n)} days ago`;
}
