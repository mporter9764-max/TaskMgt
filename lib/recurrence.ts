import type { Task, DisplayTask, OccurrenceCompletion, Recurrence } from "./types";
import { parseYMD, formatYMD, addDays, daysBetween } from "./dates";

// How far back and forward we generate occurrences for recurring tasks.
// Bounds the data: recurring items only render inside this horizon.
const PAST_DAYS = 31; // catch recently-missed recurring items
const FUTURE_DAYS = 420; // ~14 months ahead, covers the Upcoming window

/** Step one interval from a 'YYYY-MM-DD', clamping day-of-month where needed. */
function step(dateStr: string, rec: Recurrence): string {
  const d = parseYMD(dateStr);
  switch (rec) {
    case "daily":
      d.setDate(d.getDate() + 1);
      return formatYMD(d);
    case "weekly":
      d.setDate(d.getDate() + 7);
      return formatYMD(d);
    case "monthly":
      return addMonthsClamped(dateStr, 1);
    case "yearly":
      return addMonthsClamped(dateStr, 12);
    default:
      return dateStr;
  }
}

/** Add whole months to a date, clamping to the last valid day (e.g. Jan 31 + 1mo -> Feb 28/29). */
function addMonthsClamped(dateStr: string, months: number): string {
  const d = parseYMD(dateStr);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return formatYMD(target);
}

/**
 * Generate the occurrence start-dates for a recurring task within [horizonStart, horizonEnd].
 * Returns [] for non-recurring tasks.
 */
export function occurrenceDates(
  task: Task,
  horizonStart: string,
  horizonEnd: string
): string[] {
  if (task.recurrence === "none") return [];
  const rec = task.recurrence;
  const out: string[] = [];
  let guard = 0;

  // Daily/weekly are fixed intervals — step from the last occurrence.
  if (rec === "daily" || rec === "weekly") {
    let cur = task.start_date;
    while (daysBetween(cur, horizonStart) > 0 && guard < 40000) {
      cur = step(cur, rec);
      guard++;
    }
    while (daysBetween(cur, horizonEnd) >= 0 && guard < 40000) {
      if (daysBetween(horizonStart, cur) >= 0) out.push(cur);
      cur = step(cur, rec);
      guard++;
    }
    return out;
  }

  // Monthly/yearly: compute each occurrence as anchor + k intervals from the
  // ORIGINAL start date, so the day-of-month doesn't degrade (Jan 31 stays 31
  // in months that have it, rather than sticking at 28 after February).
  const months = rec === "monthly" ? 1 : 12;
  let k = 0;
  let cur = task.start_date;
  while (daysBetween(cur, horizonStart) > 0 && guard < 40000) {
    k++;
    cur = addMonthsClamped(task.start_date, k * months);
    guard++;
  }
  while (daysBetween(cur, horizonEnd) >= 0 && guard < 40000) {
    if (daysBetween(horizonStart, cur) >= 0) out.push(cur);
    k++;
    cur = addMonthsClamped(task.start_date, k * months);
    guard++;
  }
  return out;
}

/**
 * Expand a set of tasks into what the views should render:
 *  - non-recurring tasks pass through unchanged
 *  - recurring tasks are replaced by their generated occurrences (the template itself is hidden)
 * Occurrence completion is looked up from `completions`.
 */
export function expandTasks(
  tasks: Task[],
  completions: OccurrenceCompletion[],
  today: string
): DisplayTask[] {
  const horizonStart = addDays(today, -PAST_DAYS);
  const horizonEnd = addDays(today, FUTURE_DAYS);

  const doneSet = new Set(completions.map((c) => `${c.task_id}|${c.occurrence_date}`));
  const doneAt = new Map(completions.map((c) => [`${c.task_id}|${c.occurrence_date}`, c.completed_at]));

  const out: DisplayTask[] = [];

  for (const t of tasks) {
    if (t.recurrence === "none") {
      out.push(t);
      continue;
    }

    // Duration and reminder offset carry to each occurrence.
    const durationDays = t.end_date ? daysBetween(t.start_date, t.end_date) : 0;
    const reminderOffset = t.reminder_date ? daysBetween(t.start_date, t.reminder_date) : null;

    for (const occStart of occurrenceDates(t, horizonStart, horizonEnd)) {
      const key = `${t.id}|${occStart}`;
      const isDone = doneSet.has(key);
      out.push({
        ...t,
        id: `${t.id}::${occStart}`, // synthetic, stable per occurrence
        start_date: occStart,
        end_date: durationDays > 0 ? addDays(occStart, durationDays) : null,
        reminder_date: reminderOffset === null ? null : addDays(occStart, reminderOffset),
        is_complete: isDone,
        completed_at: isDone ? doneAt.get(key) ?? null : null,
        recurring: true,
        templateId: t.id,
        occDate: occStart,
      });
    }
  }

  return out;
}

/** Human label for a recurrence value. */
export function recurrenceLabel(rec: Recurrence): string {
  switch (rec) {
    case "daily":
      return "Repeats daily";
    case "weekly":
      return "Repeats weekly";
    case "monthly":
      return "Repeats monthly";
    case "yearly":
      return "Repeats yearly";
    default:
      return "Does not repeat";
  }
}
