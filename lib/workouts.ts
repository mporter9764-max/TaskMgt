import { addDays, dow, maxStr, minStr, weekStart } from "./dates";

/* ---------------------------------------------------------------------------------------------- */
/* Types                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

export type ExerciseKind = "weight_reps" | "bodyweight" | "hold" | "carry" | "cardio";
export type Intensity = "low" | "high";

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  primary_muscle: string | null;
  secondary_muscles: string[];
  equipment: string | null;
  intensity: Intensity | null;
  archived: boolean;
}

/** A workout template: a named, ordered list of exercises. Scheduling lives on blocks. */
export interface Plan {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

/** A time period with a weekly layout of workouts. */
export interface Block {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
}

export interface BlockSlot {
  id: string;
  block_id: string;
  /** 0 = Monday ... 6 = Sunday */
  day: number;
  plan_id: string;
  sort_order: number;
}

export interface Schedule {
  blocks: Block[];
  slots: BlockSlot[];
  plans: Plan[];
}

export interface PlanItem {
  id: string;
  plan_id: string;
  exercise_id: string;
  sort_order: number;
  target_sets: number;
  target_reps: number | null;
  target_weight: number | null;
  target_seconds: number | null;
  target_minutes: number | null;
}

export interface Session {
  id: string;
  session_date: string;
  plan_id: string | null;
  name: string;
  notes: string;
  completed_at: string | null;
  created_at: string;
}

export interface SessionItem {
  id: string;
  session_id: string;
  exercise_id: string;
  sort_order: number;
}

export interface WSet {
  id: string;
  item_id: string;
  set_no: number;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  minutes: number | null;
  hard: boolean;
  done: boolean;
}

/* ---------------------------------------------------------------------------------------------- */
/* Reference lists (selections, not free text)                                                    */
/* ---------------------------------------------------------------------------------------------- */

export const MUSCLE_GROUPS: Array<{ id: string; label: string; muscles: Array<{ id: string; label: string }> }> = [
  {
    id: "legs",
    label: "Legs & Glutes",
    muscles: [
      { id: "quads", label: "Quads" },
      { id: "hamstrings", label: "Hamstrings" },
      { id: "glutes", label: "Glutes" },
      { id: "calves", label: "Calves" },
    ],
  },
  { id: "chest", label: "Chest", muscles: [{ id: "chest", label: "Chest" }] },
  {
    id: "back",
    label: "Back",
    muscles: [
      { id: "lats", label: "Lats" },
      { id: "upper_back", label: "Upper back / traps" },
    ],
  },
  {
    id: "shoulders",
    label: "Shoulders",
    muscles: [
      { id: "front_delts", label: "Front delts" },
      { id: "side_delts", label: "Side delts" },
      { id: "rear_delts", label: "Rear delts" },
    ],
  },
  {
    id: "arms",
    label: "Arms",
    muscles: [
      { id: "biceps", label: "Biceps" },
      { id: "triceps", label: "Triceps" },
      { id: "forearms", label: "Forearms / grip" },
    ],
  },
  { id: "core", label: "Core", muscles: [{ id: "core", label: "Core" }] },
];

export const MUSCLES = MUSCLE_GROUPS.flatMap((g) => g.muscles.map((m) => ({ ...m, group: g.id, groupLabel: g.label })));
export const MUSCLE_LABEL = new Map(MUSCLES.map((m) => [m.id, m.label]));
export const MUSCLE_GROUP_OF = new Map(MUSCLES.map((m) => [m.id, m.group]));
export const GROUP_LABEL = new Map(MUSCLE_GROUPS.map((g) => [g.id, g.label]));

export const KINDS: Array<{ id: ExerciseKind; label: string; hint: string }> = [
  { id: "weight_reps", label: "Weight × reps", hint: "Log lb and reps" },
  { id: "bodyweight", label: "Bodyweight reps", hint: "Log reps, optional added lb" },
  { id: "hold", label: "Timed hold", hint: "Log seconds" },
  { id: "carry", label: "Weight + minutes", hint: "Log lb and minutes (ruck, carries)" },
  { id: "cardio", label: "Cardio minutes", hint: "Log minutes" },
];
export const KIND_LABEL = new Map(KINDS.map((k) => [k.id, k.label]));

export const EQUIPMENT = ["Barbell", "Dumbbell", "Kettlebell", "Bodyweight", "Machine", "Cable", "Band", "Other"];

export const DEFAULT_SET_RANGE = { low: 10, high: 20 };

/* ---------------------------------------------------------------------------------------------- */
/* Helpers                                                                                        */
/* ---------------------------------------------------------------------------------------------- */

export function hasMuscles(ex: Exercise | undefined): boolean {
  return Boolean(ex?.primary_muscle);
}

/** Which inputs a set row shows for an exercise kind. */
export function fieldsFor(kind: ExerciseKind): { weight: boolean; reps: boolean; seconds: boolean; minutes: boolean } {
  switch (kind) {
    case "weight_reps":
      return { weight: true, reps: true, seconds: false, minutes: false };
    case "bodyweight":
      return { weight: true, reps: true, seconds: false, minutes: false };
    case "hold":
      return { weight: false, reps: false, seconds: true, minutes: false };
    case "carry":
      return { weight: true, reps: false, seconds: false, minutes: true };
    case "cardio":
      return { weight: false, reps: false, seconds: false, minutes: true };
  }
}

/** Hard-set credit per muscle: 1 for the primary, 0.5 for each secondary. */
export function muscleCredit(ex: Exercise): Array<[string, number]> {
  if (!ex.primary_muscle) return [];
  const out: Array<[string, number]> = [[ex.primary_muscle, 1]];
  for (const m of ex.secondary_muscles) if (m !== ex.primary_muscle) out.push([m, 0.5]);
  return out;
}

export function blockActiveOn(b: Block, d: string): boolean {
  return b.start_date <= d && (!b.end_date || d <= b.end_date);
}

/** The block in effect on a date (latest start wins if dates ever overlap). */
export function blockOn(blocks: Block[], d: string): Block | null {
  let best: Block | null = null;
  for (const b of blocks) if (blockActiveOn(b, d) && (!best || b.start_date > best.start_date)) best = b;
  return best;
}

/** Workouts scheduled for one weekday of a block, in slot order. */
export function plansForDay(blockId: string, day: number, sch: Schedule): Plan[] {
  const byId = new Map(sch.plans.map((p) => [p.id, p]));
  return sch.slots
    .filter((s) => s.block_id === blockId && s.day === day)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => byId.get(s.plan_id))
    .filter((p): p is Plan => Boolean(p));
}

/** Workouts scheduled on a date, from the block in effect that day. */
export function plansOn(sch: Schedule, d: string): Plan[] {
  const b = blockOn(sch.blocks, d);
  return b ? plansForDay(b.id, dow(d), sch) : [];
}

/** Hard-set credit per muscle for one session of a workout. */
export function setsForPlan(planId: string, items: PlanItem[], exById: Map<string, Exercise>): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    if (it.plan_id !== planId) continue;
    const ex = exById.get(it.exercise_id);
    if (!ex) continue;
    for (const [m, c] of muscleCredit(ex)) out.set(m, (out.get(m) ?? 0) + c * it.target_sets);
  }
  return out;
}

/** Working sets (primary-muscle sets counted once) in one session of a workout. */
export function workingSetsForPlan(planId: string, items: PlanItem[], exById: Map<string, Exercise>): number {
  return items.reduce((n, it) => n + (it.plan_id === planId && exById.get(it.exercise_id)?.primary_muscle ? it.target_sets : 0), 0);
}

/** Per muscle, planned sets for each weekday (Mon..Sun) of a block layout. */
export function blockGrid(blockId: string, sch: Schedule, items: PlanItem[], exById: Map<string, Exercise>): Map<string, number[]> {
  const grid = new Map<string, number[]>();
  for (let day = 0; day < 7; day++) {
    for (const p of plansForDay(blockId, day, sch)) {
      setsForPlan(p.id, items, exById).forEach((v, m) => {
        const row = grid.get(m) ?? [0, 0, 0, 0, 0, 0, 0];
        row[day] += v;
        grid.set(m, row);
      });
    }
  }
  return grid;
}

/** Describe a set as text, e.g. "135 × 10", "45 min", "60 s". */
export function describeSet(kind: ExerciseKind, s: Pick<WSet, "weight" | "reps" | "seconds" | "minutes">): string {
  const n = (v: number | null) => (v === null ? "–" : String(+v));
  switch (kind) {
    case "weight_reps":
      return `${n(s.weight)} × ${n(s.reps)}`;
    case "bodyweight":
      return s.weight ? `BW+${n(s.weight)} × ${n(s.reps)}` : `${n(s.reps)} reps`;
    case "hold":
      return `${n(s.seconds)} s`;
    case "carry":
      return s.weight ? `${n(s.weight)} lb · ${n(s.minutes)} min` : `${n(s.minutes)} min`;
    case "cardio":
      return `${n(s.minutes)} min`;
  }
}

export function describeTarget(kind: ExerciseKind, it: PlanItem): string {
  const sets = `${it.target_sets} ${it.target_sets === 1 ? "set" : "sets"}`;
  switch (kind) {
    case "weight_reps":
    case "bodyweight": {
      const reps = it.target_reps ? ` × ${it.target_reps}` : "";
      const w = it.target_weight ? ` @ ${+it.target_weight} lb` : "";
      return `${sets}${reps}${w}`;
    }
    case "hold":
      return `${sets}${it.target_seconds ? ` × ${it.target_seconds} s` : ""}`;
    case "carry":
      return `${it.target_minutes ? `${+it.target_minutes} min` : sets}${it.target_weight ? ` @ ${+it.target_weight} lb` : ""}`;
    case "cardio":
      return it.target_minutes ? `${+it.target_minutes} min` : sets;
  }
}

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export function fmtNum(v: number, digits = 1): string {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return Number.isInteger(r) ? String(r) : r.toFixed(digits);
}

/* ---------------------------------------------------------------------------------------------- */
/* Metrics                                                                                        */
/* ---------------------------------------------------------------------------------------------- */

/** Planned hard sets per muscle for the week starting `ws` (Monday). */
export function plannedSetsForWeek(ws: string, sch: Schedule, items: PlanItem[], exById: Map<string, Exercise>): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    for (const p of plansOn(sch, addDays(ws, i))) {
      setsForPlan(p.id, items, exById).forEach((v, m) => out.set(m, (out.get(m) ?? 0) + v));
    }
  }
  return out;
}

/** Working sets planned in the week starting ws (each set counted once, matching how done sets are counted). */
export function plannedWorkingSets(ws: string, sch: Schedule, items: PlanItem[], exById: Map<string, Exercise>): number {
  let n = 0;
  for (let i = 0; i < 7; i++) for (const p of plansOn(sch, addDays(ws, i))) n += workingSetsForPlan(p.id, items, exById);
  return n;
}

export interface WorkoutIndex {
  sessionById: Map<string, Session>;
  itemById: Map<string, SessionItem>;
  setsByItem: Map<string, WSet[]>;
  itemsBySession: Map<string, SessionItem[]>;
}

export function buildIndex(sessions: Session[], items: SessionItem[], sets: WSet[]): WorkoutIndex {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const setsByItem = new Map<string, WSet[]>();
  for (const s of sets) {
    const l = setsByItem.get(s.item_id) ?? [];
    l.push(s);
    setsByItem.set(s.item_id, l);
  }
  setsByItem.forEach((l) => l.sort((a, b) => a.set_no - b.set_no));
  const itemsBySession = new Map<string, SessionItem[]>();
  for (const i of items) {
    const l = itemsBySession.get(i.session_id) ?? [];
    l.push(i);
    itemsBySession.set(i.session_id, l);
  }
  itemsBySession.forEach((l) => l.sort((a, b) => a.sort_order - b.sort_order));
  return { sessionById, itemById, setsByItem, itemsBySession };
}

/** Actual hard sets (done + flagged hard) per muscle within [from, to]. */
export function actualSets(from: string, to: string, sets: WSet[], idx: WorkoutIndex, exById: Map<string, Exercise>): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sets) {
    if (!s.done || !s.hard) continue;
    const it = idx.itemById.get(s.item_id);
    const ses = it ? idx.sessionById.get(it.session_id) : undefined;
    if (!it || !ses || ses.session_date < from || ses.session_date > to) continue;
    const ex = exById.get(it.exercise_id);
    if (!ex) continue;
    for (const [m, c] of muscleCredit(ex)) out.set(m, (out.get(m) ?? 0) + c);
  }
  return out;
}

export interface WeekPoint {
  week: string;
  hardSets: number;
  cardioLow: number;
  cardioHigh: number;
}

/** Per-week totals for the last `n` weeks ending with the week containing `today`. */
export function weeklySeries(n: number, today: string, sets: WSet[], idx: WorkoutIndex, exById: Map<string, Exercise>): WeekPoint[] {
  const last = weekStart(today);
  const first = addDays(last, -7 * (n - 1));
  const map = new Map<string, WeekPoint>();
  for (let i = 0; i < n; i++) {
    const w = addDays(first, 7 * i);
    map.set(w, { week: w, hardSets: 0, cardioLow: 0, cardioHigh: 0 });
  }
  for (const s of sets) {
    if (!s.done) continue;
    const it = idx.itemById.get(s.item_id);
    const ses = it ? idx.sessionById.get(it.session_id) : undefined;
    if (!it || !ses) continue;
    const pt = map.get(weekStart(ses.session_date));
    if (!pt) continue;
    const ex = exById.get(it.exercise_id);
    if (!ex) continue;
    if (s.hard && ex.primary_muscle) pt.hardSets += 1;
    if ((ex.kind === "cardio" || ex.kind === "carry") && s.minutes) {
      if (ex.intensity === "high") pt.cardioHigh += +s.minutes;
      else if (ex.intensity === "low" || !ex.primary_muscle) pt.cardioLow += +s.minutes;
    }
  }
  return Array.from(map.values());
}

/** Planned sessions vs completed sessions between from and to (inclusive). */
export function adherence(from: string, to: string, sch: Schedule, sessions: Session[]): { planned: number; done: number } {
  let planned = 0;
  let done = 0;
  const completed = new Set(sessions.filter((s) => s.completed_at && s.plan_id).map((s) => `${s.plan_id}:${s.session_date}`));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const p of plansOn(sch, d)) {
      planned++;
      if (completed.has(`${p.id}:${d}`)) done++;
    }
  }
  return { planned, done };
}

export type BandStatus = "below" | "in" | "above" | "none";

export function bandStatus(v: number, low: number, high: number): BandStatus {
  if (v <= 0) return "none";
  if (v < low) return "below";
  if (v > high) return "above";
  return "in";
}

export interface ProgressPoint {
  date: string;
  top: number;
  e1rm: number | null;
  label: string;
}

/** Best set per session for one exercise, oldest first. */
export function progression(exercise: Exercise, sets: WSet[], idx: WorkoutIndex): ProgressPoint[] {
  const bySession = new Map<string, { date: string; best: WSet | null; score: number }>();
  for (const s of sets) {
    if (!s.done) continue;
    const it = idx.itemById.get(s.item_id);
    if (!it || it.exercise_id !== exercise.id) continue;
    const ses = idx.sessionById.get(it.session_id);
    if (!ses) continue;
    let score = 0;
    switch (exercise.kind) {
      case "weight_reps":
        score = s.weight && s.reps ? e1rm(+s.weight, s.reps) : +(s.weight ?? 0);
        break;
      case "bodyweight":
        score = s.reps ?? 0;
        break;
      case "hold":
        score = s.seconds ?? 0;
        break;
      case "carry":
        score = +(s.weight ?? 0) || +(s.minutes ?? 0);
        break;
      case "cardio":
        score = +(s.minutes ?? 0);
        break;
    }
    const cur = bySession.get(ses.id);
    if (!cur || score > cur.score) bySession.set(ses.id, { date: ses.session_date, best: s, score });
  }
  return Array.from(bySession.values())
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(({ date, best }) => {
      const b = best as WSet;
      let top = 0;
      let est: number | null = null;
      if (exercise.kind === "weight_reps") {
        top = +(b.weight ?? 0);
        est = b.weight && b.reps ? e1rm(+b.weight, b.reps) : null;
      } else if (exercise.kind === "bodyweight") top = b.reps ?? 0;
      else if (exercise.kind === "hold") top = b.seconds ?? 0;
      else if (exercise.kind === "carry") top = +(b.weight ?? 0) || +(b.minutes ?? 0);
      else top = +(b.minutes ?? 0);
      return { date, top, e1rm: est, label: describeSet(exercise.kind, b) };
    });
}

export function progressUnit(kind: ExerciseKind): string {
  return kind === "weight_reps" ? "lb" : kind === "bodyweight" ? "reps" : kind === "hold" ? "seconds" : kind === "carry" ? "lb" : "minutes";
}

export { maxStr, minStr };
