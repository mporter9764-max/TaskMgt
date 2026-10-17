import type { Goal, GoalTarget, Period } from "./types";
import {
  addDays,
  daysInMonth,
  diffDays,
  dow,
  maxStr,
  minStr,
  monthEnd,
  monthStart,
  weekEnd,
  weekStart,
  fmtMonthDay,
  MONTHS,
  monthIndex,
} from "./dates";

/*
 * Goal scoring
 * ------------
 * Logs are yes/no per day. Each goal has a target history (period + target, effective from a date).
 * A goal is judged period by period:
 *   - day goals:   each day is a period with target 1
 *   - week goals:  Monday to Sunday, target = N days
 *   - month goals: calendar month, target = N days
 * Partial periods (goal started mid-week, target changed mid-month, goal archived) get a prorated
 * target, rounded up, so a short first week is neither free nor impossible.
 * A period is "hit" once done >= target, "miss" once it has ended short, otherwise "open".
 */

export interface PeriodResult {
  period: Period;
  /** effective window actually judged */
  start: string;
  end: string;
  /** the full calendar period it belongs to */
  fullStart: string;
  fullEnd: string;
  /** target for this window (prorated if partial) */
  target: number;
  /** the goal's configured target at the time */
  baseTarget: number;
  done: number;
  closed: boolean;
  status: "hit" | "miss" | "open";
  /** for open periods: can the target still be reached? */
  reachable: boolean;
}

export interface GoalData {
  goal: Goal;
  targets: GoalTarget[];
  logs: Set<string>;
  periods: PeriodResult[];
}

export function periodBounds(d: string, p: Period): [string, string] {
  if (p === "day") return [d, d];
  if (p === "week") return [weekStart(d), weekEnd(d)];
  return [monthStart(d), monthEnd(d)];
}

export function sortTargets(ts: GoalTarget[]): GoalTarget[] {
  return [...ts].sort((a, b) => (a.effective_from < b.effective_from ? -1 : a.effective_from > b.effective_from ? 1 : 0));
}

/** The target version in force on a date (falls back to the earliest version). */
export function versionAt(sorted: GoalTarget[], d: string): GoalTarget | null {
  let v: GoalTarget | null = sorted[0] ?? null;
  for (const t of sorted) {
    if (t.effective_from <= d) v = t;
    else break;
  }
  return v;
}

export function lastActiveDay(goal: Goal): string | null {
  return goal.archived_on ? addDays(goal.archived_on, -1) : null;
}

export function isActiveOn(goal: Goal, d: string): boolean {
  return d >= goal.start_date && (!goal.archived_on || d < goal.archived_on);
}

export function computePeriods(goal: Goal, sorted: GoalTarget[], logs: Set<string>, today: string): PeriodResult[] {
  const out: PeriodResult[] = [];
  if (!sorted.length) return out;
  const archEnd = lastActiveDay(goal);
  const stop = archEnd ? minStr(archEnd, today) : today;
  let cursor = goal.start_date;
  let guard = 0;
  while (cursor <= stop && guard++ < 50000) {
    const v = versionAt(sorted, cursor) as GoalTarget;
    const [ps, pe] = periodBounds(cursor, v.period);
    let end = pe;
    const next = sorted.find((t) => t.effective_from > cursor);
    if (next) end = minStr(end, addDays(next.effective_from, -1));
    if (archEnd) end = minStr(end, archEnd);

    const full = diffDays(ps, pe) + 1;
    const avail = diffDays(cursor, end) + 1;
    const base = v.period === "day" ? 1 : v.target;
    let target = avail >= full ? base : Math.max(1, Math.ceil((base * avail) / full));
    target = Math.min(target, avail);

    let done = 0;
    const countEnd = minStr(end, today);
    for (let d = cursor; d <= countEnd; d = addDays(d, 1)) if (logs.has(d)) done++;

    const closed = end < today;
    const status: PeriodResult["status"] = done >= target ? "hit" : closed ? "miss" : "open";
    const openDays = closed ? 0 : diffDays(today, end) + 1 - (logs.has(today) ? 1 : 0);
    out.push({
      period: v.period,
      start: cursor,
      end,
      fullStart: ps,
      fullEnd: pe,
      target,
      baseTarget: base,
      done,
      closed,
      status,
      reachable: done + openDays >= target,
    });
    cursor = addDays(end, 1);
  }
  return out;
}

export function buildGoalData(goal: Goal, targets: GoalTarget[], logDates: string[], today: string): GoalData {
  const sorted = sortTargets(targets);
  const logs = new Set(logDates);
  return { goal, targets: sorted, logs, periods: computePeriods(goal, sorted, logs, today) };
}

export function periodAt(periods: PeriodResult[], d: string): PeriodResult | null {
  // periods are in date order; scan from the end since callers usually ask about recent dates
  for (let i = periods.length - 1; i >= 0; i--) {
    const p = periods[i];
    if (p.start <= d && d <= p.end) return p;
    if (p.end < d) break;
  }
  return null;
}

export interface GoalStats {
  currentStreak: number;
  bestStreak: number;
  /** hits / closed periods since `since` (null when there are no closed periods yet) */
  hitRate: number | null;
  hits: number;
  closedCount: number;
  /** sum(min(done, target)) / sum(target) across closed periods since `since` */
  consistency: number | null;
  current: PeriodResult | null;
}

export function goalStats(periods: PeriodResult[], since?: string): GoalStats {
  const n = periods.length;
  let i = n - 1;
  let current: PeriodResult | null = null;
  let streak = 0;
  if (i >= 0 && !periods[i].closed) {
    current = periods[i];
    if (current.status === "hit") streak++;
    i--;
  }
  while (i >= 0 && periods[i].status === "hit") {
    streak++;
    i--;
  }

  let best = 0;
  let run = 0;
  for (const p of periods) {
    if (p.status === "hit") {
      run++;
      best = Math.max(best, run);
    } else if (p.closed) run = 0;
  }

  let hits = 0;
  let closedCount = 0;
  let num = 0;
  let den = 0;
  for (const p of periods) {
    if (!p.closed) continue;
    if (since && p.end < since) continue;
    closedCount++;
    if (p.status === "hit") hits++;
    num += Math.min(p.done, p.target);
    den += p.target;
  }
  return {
    currentStreak: streak,
    bestStreak: best,
    hitRate: closedCount ? hits / closedCount : null,
    hits,
    closedCount,
    consistency: den ? num / den : null,
    current,
  };
}

export function describeTarget(v: Pick<GoalTarget, "period" | "target"> | null): string {
  if (!v) return "No target";
  if (v.period === "day") return "Every day";
  if (v.period === "week") return v.target >= 7 ? "7 days per week" : `${v.target} ${v.target === 1 ? "day" : "days"} per week`;
  return `${v.target} ${v.target === 1 ? "day" : "days"} per month`;
}

export function periodNoun(p: Period, plural = false): string {
  const w = p === "day" ? "day" : p === "week" ? "week" : "month";
  return plural ? w + "s" : w;
}

/* ------------------------------------------------------------------------------------------ */
/* Aggregates for Trends                                                                        */
/* ------------------------------------------------------------------------------------------ */

export interface DayCell {
  active: number;
  done: number;
}

/** Per day: how many goals were active and how many were checked off. */
export function dayActivity(data: GoalData[], from: string, to: string, today: string): Map<string, DayCell> {
  const map = new Map<string, DayCell>();
  for (const gd of data) {
    const g = gd.goal;
    const archEnd = lastActiveDay(g);
    const a = maxStr(from, g.start_date);
    let b = minStr(to, today);
    if (archEnd) b = minStr(b, archEnd);
    for (let d = a; d <= b; d = addDays(d, 1)) {
      let c = map.get(d);
      if (!c) {
        c = { active: 0, done: 0 };
        map.set(d, c);
      }
      c.active++;
      if (gd.logs.has(d)) c.done++;
    }
  }
  return map;
}

export interface TrendPoint {
  key: string;
  label: string;
  value: number | null;
  num: number;
  den: number;
}

/**
 * Consistency over time. Each closed period contributes min(done, target) / target to the bucket
 * its end date falls in. Weekly mode leaves out month goals (they only resolve monthly).
 */
export function trendSeries(data: GoalData[], mode: "week" | "month", from: string, today: string): TrendPoint[] {
  const keyOf = (d: string) => (mode === "week" ? weekStart(d) : monthStart(d));
  const buckets = new Map<string, { num: number; den: number }>();
  for (const gd of data) {
    for (const p of gd.periods) {
      if (!p.closed || p.end < from) continue;
      if (mode === "week" && p.period === "month") continue;
      const k = keyOf(p.end);
      const b = buckets.get(k) ?? { num: 0, den: 0 };
      b.num += Math.min(p.done, p.target);
      b.den += p.target;
      buckets.set(k, b);
    }
  }
  const out: TrendPoint[] = [];
  const last = keyOf(today);
  for (let k = keyOf(from); k <= last; ) {
    const b = buckets.get(k);
    out.push({
      key: k,
      label: mode === "week" ? fmtMonthDay(k) : `${MONTHS[monthIndex(k)]} ${k.slice(2, 4)}`,
      value: b && b.den ? b.num / b.den : null,
      num: b?.num ?? 0,
      den: b?.den ?? 0,
    });
    k = mode === "week" ? addDays(k, 7) : addDays(monthEnd(k), 1);
  }
  return out;
}

export interface MatrixCell {
  /** 0..1 shading, null when the goal wasn't active that week */
  ratio: number | null;
  label: string;
  hit: boolean | null;
  open: boolean;
}

export function matrixCell(gd: GoalData, ws: string, today: string): MatrixCell {
  const we = addDays(ws, 6);
  const g = gd.goal;
  const archEnd = lastActiveDay(g);
  const a = maxStr(ws, g.start_date);
  let b = minStr(we, today);
  if (archEnd) b = minStr(b, archEnd);
  if (a > b) return { ratio: null, label: "Not active", hit: null, open: false };
  const open = we >= today;
  const v = versionAt(gd.targets, a);
  let done = 0;
  let activeDays = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) {
    activeDays++;
    if (gd.logs.has(d)) done++;
  }
  if (!v || v.period === "day") {
    const hit = open ? null : done === activeDays;
    return { ratio: done / activeDays, label: `${done} of ${activeDays} days`, hit, open };
  }
  if (v.period === "week") {
    const ps = gd.periods.filter((p) => p.start >= ws && p.start <= we && p.period === "week");
    const target = ps.reduce((s, p) => s + p.target, 0) || v.target;
    const doneW = ps.reduce((s, p) => s + p.done, 0);
    const hit = ps.length ? ps.every((p) => p.status === "hit") : null;
    return {
      ratio: Math.min(1, doneW / target),
      label: `${doneW} of ${target} days`,
      hit: open && !hit ? null : hit,
      open,
    };
  }
  // month goal: show this week's check-ins against a weekly share of the monthly target
  const dim = daysInMonth(Number(a.slice(0, 4)), Number(a.slice(5, 7)));
  const share = Math.max(1, (v.target * activeDays) / dim);
  return { ratio: Math.min(1, done / share), label: `${done} ${done === 1 ? "day" : "days"} this week`, hit: null, open };
}

export interface DowBar {
  day: number;
  value: number | null;
  done: number;
  active: number;
}

/** Share of goal-days checked off, by weekday (Mon..Sun). */
export function dowPattern(data: GoalData[], from: string, today: string): DowBar[] {
  const bars: DowBar[] = Array.from({ length: 7 }, (_, i) => ({ day: i, value: null, done: 0, active: 0 }));
  const yesterday = addDays(today, -1);
  const act = dayActivity(data, from, yesterday, today);
  act.forEach((c, d) => {
    const bar = bars[dow(d)];
    bar.done += c.done;
    bar.active += c.active;
  });
  for (const b of bars) b.value = b.active ? b.done / b.active : null;
  return bars;
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  return `${Math.round(v * 100)}%`;
}
