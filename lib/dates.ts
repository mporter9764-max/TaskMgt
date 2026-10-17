/** All dates are local calendar dates as "YYYY-MM-DD" strings. String order == date order. */

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Index 0 = Monday. Weeks run Monday to Sunday throughout the app. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function toStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): string {
  return toStr(new Date());
}

function parts(s: string): [number, number, number] {
  return [Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10))];
}

function utc(s: string): number {
  const [y, m, d] = parts(s);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** b minus a, in days. */
export function diffDays(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

export function addDays(s: string, n: number): string {
  return fromUtc(utc(s) + n * 86400000);
}

/** 0 = Monday ... 6 = Sunday */
export function dow(s: string): number {
  return (new Date(utc(s)).getUTCDay() + 6) % 7;
}

export function weekStart(s: string): string {
  return addDays(s, -dow(s));
}

export function weekEnd(s: string): string {
  return addDays(weekStart(s), 6);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthStart(s: string): string {
  return s.slice(0, 8) + "01";
}

export function monthEnd(s: string): string {
  const [y, m] = parts(s);
  return s.slice(0, 8) + pad(daysInMonth(y, m));
}

/** Same day-of-month n months later, clamped to the month's last day. */
export function addMonths(s: string, n: number, anchorDay?: number): string {
  const [y, m, d] = parts(s);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(anchorDay ?? d, daysInMonth(ny, nm));
  return `${ny}-${pad(nm)}-${pad(day)}`;
}

export function monthsBetween(a: string, b: string): number {
  const [ya, ma] = parts(a);
  const [yb, mb] = parts(b);
  return (yb - ya) * 12 + (mb - ma);
}

export function minStr(a: string, b: string): string {
  return a < b ? a : b;
}

export function maxStr(a: string, b: string): string {
  return a > b ? a : b;
}

export function eachDay(a: string, b: string): string[] {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
}

export function dayOfMonth(s: string): number {
  return Number(s.slice(8, 10));
}

export function monthIndex(s: string): number {
  return Number(s.slice(5, 7)) - 1;
}

export function fmtMonthDay(s: string): string {
  return `${MONTHS[monthIndex(s)]} ${dayOfMonth(s)}`;
}

export function fmtShort(s: string): string {
  return `${WEEKDAYS[dow(s)]}, ${fmtMonthDay(s)}`;
}

export function fmtLong(s: string): string {
  return `${WEEKDAYS_LONG[dow(s)]}, ${MONTHS_LONG[monthIndex(s)]} ${dayOfMonth(s)}`;
}

export function fmtRange(a: string, b: string): string {
  if (a === b) return fmtMonthDay(a);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${fmtMonthDay(a)}–${dayOfMonth(b)}`;
  return `${fmtMonthDay(a)} – ${fmtMonthDay(b)}`;
}

/** "Today", "Yesterday", "Tomorrow" or "Sat, Oct 17". */
export function fmtRelative(s: string, today: string = todayStr()): string {
  const d = diffDays(today, s);
  if (d === 0) return "Today";
  if (d === -1) return "Yesterday";
  if (d === 1) return "Tomorrow";
  return fmtShort(s);
}

export function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  return fmtMonthDay(toStr(d));
}
