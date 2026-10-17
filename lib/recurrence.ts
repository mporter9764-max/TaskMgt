import type { Occurrence, Task } from "./types";
import { addDays, addMonths, dayOfMonth, diffDays, monthsBetween } from "./dates";

const MAX_ITER = 3000;

/** First date of a task (start, or end if only an end/due date was set). */
export function anchorOf(task: Task): string | null {
  return task.start_date ?? task.end_date ?? null;
}

export function durationOf(task: Task): number {
  const a = task.start_date ?? task.end_date;
  const b = task.end_date ?? task.start_date;
  if (!a || !b) return 0;
  return Math.max(0, diffDays(a, b));
}

/**
 * Start dates of a recurring task's occurrences that overlap [from, to].
 * Monthly and yearly patterns are always computed from the original anchor,
 * so a task on the 31st lands on the 30th in short months and returns to the 31st after.
 */
export function occurrenceStarts(task: Task, from: string, to: string): string[] {
  const anchor = anchorOf(task);
  if (!anchor || task.recurrence === "none") return [];
  const dur = durationOf(task);
  const step = Math.max(1, task.recurrence_interval || 1);
  const until = task.recurrence_until;
  const out: string[] = [];
  const push = (d: string): boolean => {
    if (d > to) return false;
    if (until && d > until) return false;
    if (addDays(d, dur) >= from) out.push(d);
    return true;
  };

  if (task.recurrence === "daily" || task.recurrence === "weekly") {
    const days = task.recurrence === "daily" ? step : step * 7;
    const behind = diffDays(anchor, from) - dur;
    let k = Math.max(0, Math.floor(behind / days));
    for (let i = 0; i < MAX_ITER; i++, k++) {
      if (!push(addDays(anchor, k * days))) break;
    }
    return out;
  }

  const anchorDay = dayOfMonth(anchor);
  const monthsPer = task.recurrence === "monthly" ? step : step * 12;
  let k = Math.max(0, Math.floor(monthsBetween(anchor, from) / monthsPer) - 1);
  for (let i = 0; i < MAX_ITER; i++, k++) {
    if (!push(addMonths(anchor, k * monthsPer, anchorDay))) break;
  }
  return out;
}

/** All occurrences of a set of tasks overlapping [from, to]. */
export function occurrencesInRange(
  tasks: Task[],
  completions: Set<string>,
  from: string,
  to: string
): Occurrence[] {
  const out: Occurrence[] = [];
  for (const t of tasks) {
    if (t.recurrence === "none") {
      const s = t.start_date ?? t.end_date;
      const e = t.end_date ?? t.start_date;
      if (!s || !e) continue;
      if (e < from || s > to) continue;
      out.push({ key: t.id, task: t, start: s, end: e, recurring: false, done: t.completed });
    } else {
      const dur = durationOf(t);
      for (const s of occurrenceStarts(t, from, to)) {
        out.push({
          key: `${t.id}:${s}`,
          task: t,
          start: s,
          end: addDays(s, dur),
          recurring: true,
          done: completions.has(`${t.id}:${s}`),
        });
      }
    }
  }
  return out;
}

export function describeRecurrence(task: Pick<Task, "recurrence" | "recurrence_interval">): string {
  const n = task.recurrence_interval || 1;
  switch (task.recurrence) {
    case "daily":
      return n === 1 ? "Every day" : `Every ${n} days`;
    case "weekly":
      return n === 1 ? "Every week" : `Every ${n} weeks`;
    case "monthly":
      return n === 1 ? "Every month" : `Every ${n} months`;
    case "yearly":
      return n === 1 ? "Every year" : `Every ${n} years`;
    default:
      return "Does not repeat";
  }
}
