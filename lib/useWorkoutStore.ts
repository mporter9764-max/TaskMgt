"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { fetchAll } from "./db";
import { reportError, toast } from "./toast";
import { addDays, todayStr, weekStart } from "./dates";
import {
  buildIndex,
  hasMuscles,
  type Exercise,
  type Plan,
  type PlanItem,
  type Session,
  type SessionItem,
  type WSet,
  type WorkoutIndex,
} from "./workouts";

export interface WorkoutSettings {
  linkedGoalId: string | null;
  setRangeLow: number;
  setRangeHigh: number;
}

const DEFAULT_SETTINGS: WorkoutSettings = { linkedGoalId: null, setRangeLow: 10, setRangeHigh: 20 };
const SETTINGS_KEY = "workouts";

export type ExerciseInput = Omit<Exercise, "id" | "archived">;
export type PlanInput = Omit<Plan, "id" | "sort_order">;
export type PlanItemInput = Omit<PlanItem, "id" | "plan_id">;
export type SetPatch = Partial<Pick<WSet, "weight" | "reps" | "seconds" | "minutes" | "hard" | "done">>;

export interface WorkoutStore {
  loading: boolean;
  error: string | null;
  exercises: Exercise[];
  exById: Map<string, Exercise>;
  plans: Plan[];
  planItems: PlanItem[];
  sessions: Session[];
  sessionItems: SessionItem[];
  sets: WSet[];
  idx: WorkoutIndex;
  settings: WorkoutSettings;
  reload: () => Promise<void>;
  saveSettings: (s: WorkoutSettings) => Promise<void>;
  // exercises
  saveExercise: (input: ExerciseInput, id?: string) => Promise<Exercise | null>;
  removeExercise: (ex: Exercise) => Promise<void>;
  restoreExercise: (ex: Exercise) => Promise<void>;
  // plans
  savePlan: (input: PlanInput, items: PlanItemInput[], id?: string) => Promise<boolean>;
  duplicatePlan: (plan: Plan) => Promise<void>;
  deletePlan: (plan: Plan) => Promise<void>;
  // sessions
  startSession: (date: string, plan: Plan | null, name?: string) => Promise<Session | null>;
  copySession: (session: Session, toDate: string) => Promise<boolean>;
  deleteSession: (session: Session) => Promise<void>;
  updateSession: (session: Session, patch: Partial<Pick<Session, "notes" | "completed_at" | "name">>) => Promise<void>;
  addExercise: (session: Session, exerciseId: string) => Promise<void>;
  removeItem: (item: SessionItem) => Promise<void>;
  moveItem: (item: SessionItem, dir: -1 | 1) => Promise<void>;
  addSet: (item: SessionItem) => Promise<void>;
  updateSet: (set: WSet, patch: SetPatch) => Promise<void>;
  deleteSet: (set: WSet) => Promise<void>;
  /** most recent completed sets for an exercise, before a date (exclusive) */
  lastSets: (exerciseId: string, beforeDate: string, excludeSessionId?: string) => { date: string; sets: WSet[] } | null;
}

export function useWorkoutStore(enabled: boolean): WorkoutStore {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [sets, setSets] = useState<WSet[]>([]);
  const [settings, setSettings] = useState<WorkoutSettings>(DEFAULT_SETTINGS);

  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const idx = useMemo(() => buildIndex(sessions, sessionItems, sets), [sessions, sessionItems, sets]);
  const ref = useRef({ sessions, sessionItems, sets, idx, planItems, exById });
  ref.current = { sessions, sessionItems, sets, idx, planItems, exById };

  const reload = useCallback(async () => {
    try {
      const [ex, pl, pi, se, si, st, cfg] = await Promise.all([
        fetchAll<Exercise>("wo_exercises", "name"),
        fetchAll<Plan>("wo_plans", "sort_order"),
        fetchAll<PlanItem>("wo_plan_items", "sort_order"),
        fetchAll<Session>("wo_sessions", "session_date"),
        fetchAll<SessionItem>("wo_session_items", "sort_order"),
        fetchAll<WSet>("wo_sets", "created_at"),
        supabase.from("app_settings").select("*").eq("key", SETTINGS_KEY).maybeSingle(),
      ]);
      setExercises(ex.map((e) => ({ ...e, secondary_muscles: e.secondary_muscles ?? [] })));
      setPlans(pl);
      setPlanItems(
        pi.map((i) => ({
          ...i,
          target_weight: num(i.target_weight),
          target_minutes: num(i.target_minutes),
          target_reps: num(i.target_reps),
          target_seconds: num(i.target_seconds),
        }))
      );
      setSessions(se);
      setSessionItems(si);
      setSets(st.map(normSet));
      if (cfg.data?.value) setSettings({ ...DEFAULT_SETTINGS, ...(cfg.data.value as Partial<WorkoutSettings>) });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  const saveSettings = useCallback(async (s: WorkoutSettings) => {
    setSettings(s);
    const { error } = await supabase.from("app_settings").upsert({ key: SETTINGS_KEY, value: s, updated_at: new Date().toISOString() }, { onConflict: "key" });
    reportError(error, "save workout settings");
  }, []);

  /* exercises ------------------------------------------------------------- */

  const saveExercise = useCallback(async (input: ExerciseInput, id?: string) => {
    const res = id
      ? await supabase.from("wo_exercises").update(input).eq("id", id).select().single()
      : await supabase.from("wo_exercises").insert(input).select().single();
    if (reportError(res.error, "save the exercise")) return null;
    const ex = { ...(res.data as Exercise), secondary_muscles: (res.data as Exercise).secondary_muscles ?? [] };
    setExercises((prev) => (id ? prev.map((e) => (e.id === id ? ex : e)) : [...prev, ex]));
    return ex;
  }, []);

  const removeExercise = useCallback(async (ex: Exercise) => {
    // exercises with history are archived, not deleted, so past workouts keep their data
    const used = ref.current.planItems.some((p) => p.exercise_id === ex.id) || ref.current.sessionItems.some((s) => s.exercise_id === ex.id);
    if (used) {
      const { error } = await supabase.from("wo_exercises").update({ archived: true }).eq("id", ex.id);
      if (reportError(error, "archive the exercise")) return;
      setExercises((prev) => prev.map((e) => (e.id === ex.id ? { ...e, archived: true } : e)));
      toast(`${ex.name} is used in plans or history, so it was archived instead of deleted.`);
      return;
    }
    const { error } = await supabase.from("wo_exercises").delete().eq("id", ex.id);
    if (reportError(error, "delete the exercise")) return;
    setExercises((prev) => prev.filter((e) => e.id !== ex.id));
  }, []);

  const restoreExercise = useCallback(async (ex: Exercise) => {
    const { error } = await supabase.from("wo_exercises").update({ archived: false }).eq("id", ex.id);
    if (reportError(error, "restore the exercise")) return;
    setExercises((prev) => prev.map((e) => (e.id === ex.id ? { ...e, archived: false } : e)));
  }, []);

  /* plans ----------------------------------------------------------------- */

  const savePlan = useCallback(
    async (input: PlanInput, items: PlanItemInput[], id?: string) => {
      let planId = id;
      if (id) {
        const { error } = await supabase.from("wo_plans").update(input).eq("id", id);
        if (reportError(error, "save the plan")) return false;
        const del = await supabase.from("wo_plan_items").delete().eq("plan_id", id);
        if (reportError(del.error, "update the plan's exercises")) return false;
      } else {
        const sort_order = plans.length ? Math.max(...plans.map((p) => p.sort_order)) + 1 : 0;
        const { data, error } = await supabase.from("wo_plans").insert({ ...input, sort_order }).select().single();
        if (reportError(error, "create the plan")) return false;
        planId = (data as Plan).id;
      }
      if (items.length) {
        const rows = items.map((it, i) => ({ ...it, plan_id: planId, sort_order: i }));
        const { error } = await supabase.from("wo_plan_items").insert(rows);
        if (reportError(error, "save the plan's exercises")) {
          await reload();
          return false;
        }
      }
      await reload();
      return true;
    },
    [plans, reload]
  );

  const duplicatePlan = useCallback(
    async (plan: Plan) => {
      const items = ref.current.planItems.filter((i) => i.plan_id === plan.id).sort((a, b) => a.sort_order - b.sort_order);
      const { id: _id, sort_order: _s, ...rest } = plan;
      void _id;
      void _s;
      // the copy starts next Monday so it doesn't double up with the original this week
      const nextMonday = addDays(weekStart(todayStr()), 7);
      await savePlan(
        { ...rest, name: `${plan.name} (copy)`, start_date: nextMonday, end_date: rest.end_date && rest.end_date < nextMonday ? null : rest.end_date },
        items.map(({ id: _i, plan_id: _p, ...it }) => {
          void _i;
          void _p;
          return it;
        })
      );
    },
    [savePlan]
  );

  const deletePlan = useCallback(async (plan: Plan) => {
    const { error } = await supabase.from("wo_plans").delete().eq("id", plan.id);
    if (reportError(error, "delete the plan")) return;
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    setPlanItems((prev) => prev.filter((i) => i.plan_id !== plan.id));
    setSessions((prev) => prev.map((s) => (s.plan_id === plan.id ? { ...s, plan_id: null } : s)));
  }, []);

  /* sessions -------------------------------------------------------------- */

  const lastSets = useCallback((exerciseId: string, beforeDate: string, excludeSessionId?: string) => {
    const { sessionItems: items, idx: ix } = ref.current;
    let best: { date: string; created: string; sets: WSet[] } | null = null;
    for (const it of items) {
      if (it.exercise_id !== exerciseId || it.session_id === excludeSessionId) continue;
      const ses = ix.sessionById.get(it.session_id);
      if (!ses || ses.session_date > beforeDate) continue;
      const done = (ix.setsByItem.get(it.id) ?? []).filter((s) => s.done);
      if (!done.length) continue;
      if (!best || ses.session_date > best.date || (ses.session_date === best.date && ses.created_at > best.created)) {
        best = { date: ses.session_date, created: ses.created_at, sets: done };
      }
    }
    return best ? { date: best.date, sets: best.sets } : null;
  }, []);

  /** Build the starting sets for an exercise: last time's numbers, else the plan's targets. */
  const prefill = useCallback(
    (exerciseId: string, date: string, target: Partial<PlanItem> | null, excludeSessionId?: string) => {
      const ex = ref.current.exById.get(exerciseId);
      const last = lastSets(exerciseId, date, excludeSessionId);
      const count = target?.target_sets ?? last?.sets.length ?? (ex?.kind === "cardio" || ex?.kind === "carry" ? 1 : 3);
      const rows = [];
      for (let i = 0; i < count; i++) {
        const src = last ? last.sets[Math.min(i, last.sets.length - 1)] : null;
        rows.push({
          set_no: i + 1,
          weight: src?.weight ?? target?.target_weight ?? null,
          reps: src?.reps ?? target?.target_reps ?? null,
          seconds: src?.seconds ?? target?.target_seconds ?? null,
          minutes: target?.target_minutes ?? src?.minutes ?? null,
          hard: hasMuscles(ex),
          done: false,
        });
      }
      return rows;
    },
    [lastSets]
  );

  const insertItemWithSets = useCallback(
    async (sessionId: string, exerciseId: string, sortOrder: number, setRows: ReturnType<typeof prefill>) => {
      const { data, error } = await supabase
        .from("wo_session_items")
        .insert({ session_id: sessionId, exercise_id: exerciseId, sort_order: sortOrder })
        .select()
        .single();
      if (reportError(error, "add the exercise")) return null;
      const item = data as SessionItem;
      let created: WSet[] = [];
      if (setRows.length) {
        const res = await supabase.from("wo_sets").insert(setRows.map((r) => ({ ...r, item_id: item.id }))).select();
        if (reportError(res.error, "create the sets")) return { item, sets: [] };
        created = ((res.data ?? []) as WSet[]).map(normSet);
      }
      return { item, sets: created };
    },
    []
  );

  const startSession = useCallback(
    async (date: string, plan: Plan | null, name?: string) => {
      const { data, error } = await supabase
        .from("wo_sessions")
        .insert({ session_date: date, plan_id: plan?.id ?? null, name: plan?.name ?? name ?? "Workout" })
        .select()
        .single();
      if (reportError(error, "start the workout")) return null;
      const session = data as Session;
      const newItems: SessionItem[] = [];
      const newSets: WSet[] = [];
      if (plan) {
        const items = ref.current.planItems.filter((i) => i.plan_id === plan.id).sort((a, b) => a.sort_order - b.sort_order);
        for (let i = 0; i < items.length; i++) {
          const res = await insertItemWithSets(session.id, items[i].exercise_id, i, prefill(items[i].exercise_id, date, items[i], session.id));
          if (res) {
            newItems.push(res.item);
            newSets.push(...res.sets);
          }
        }
      }
      setSessions((p) => [...p, session]);
      setSessionItems((p) => [...p, ...newItems]);
      setSets((p) => [...p, ...newSets]);
      return session;
    },
    [insertItemWithSets, prefill]
  );

  const copySession = useCallback(
    async (session: Session, toDate: string) => {
      const { idx: ix } = ref.current;
      const { data, error } = await supabase
        .from("wo_sessions")
        .insert({ session_date: toDate, plan_id: null, name: session.name })
        .select()
        .single();
      if (reportError(error, "copy the workout")) return false;
      const copy = data as Session;
      const items = ix.itemsBySession.get(session.id) ?? [];
      const newItems: SessionItem[] = [];
      const newSets: WSet[] = [];
      for (let i = 0; i < items.length; i++) {
        const src = ix.setsByItem.get(items[i].id) ?? [];
        const rows = src.map((s, n) => ({ set_no: n + 1, weight: s.weight, reps: s.reps, seconds: s.seconds, minutes: s.minutes, hard: s.hard, done: false }));
        const res = await insertItemWithSets(copy.id, items[i].exercise_id, i, rows);
        if (res) {
          newItems.push(res.item);
          newSets.push(...res.sets);
        }
      }
      setSessions((p) => [...p, copy]);
      setSessionItems((p) => [...p, ...newItems]);
      setSets((p) => [...p, ...newSets]);
      return true;
    },
    [insertItemWithSets]
  );

  const deleteSession = useCallback(async (session: Session) => {
    const { error } = await supabase.from("wo_sessions").delete().eq("id", session.id);
    if (reportError(error, "delete the workout")) return;
    const itemIds = new Set(ref.current.sessionItems.filter((i) => i.session_id === session.id).map((i) => i.id));
    setSessions((p) => p.filter((s) => s.id !== session.id));
    setSessionItems((p) => p.filter((i) => i.session_id !== session.id));
    setSets((p) => p.filter((s) => !itemIds.has(s.item_id)));
  }, []);

  const updateSession = useCallback(async (session: Session, patch: Partial<Pick<Session, "notes" | "completed_at" | "name">>) => {
    setSessions((p) => p.map((s) => (s.id === session.id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from("wo_sessions").update(patch).eq("id", session.id);
    reportError(error, "save the workout");
  }, []);

  const addExercise = useCallback(
    async (session: Session, exerciseId: string) => {
      const items = ref.current.idx.itemsBySession.get(session.id) ?? [];
      const order = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
      const res = await insertItemWithSets(session.id, exerciseId, order, prefill(exerciseId, session.session_date, null, session.id));
      if (!res) return;
      setSessionItems((p) => [...p, res.item]);
      setSets((p) => [...p, ...res.sets]);
    },
    [insertItemWithSets, prefill]
  );

  const removeItem = useCallback(async (item: SessionItem) => {
    const { error } = await supabase.from("wo_session_items").delete().eq("id", item.id);
    if (reportError(error, "remove the exercise")) return;
    setSessionItems((p) => p.filter((i) => i.id !== item.id));
    setSets((p) => p.filter((s) => s.item_id !== item.id));
  }, []);

  const moveItem = useCallback(async (item: SessionItem, dir: -1 | 1) => {
    const list = [...(ref.current.idx.itemsBySession.get(item.session_id) ?? [])];
    const i = list.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const order = new Map(list.map((x, n) => [x.id, n]));
    setSessionItems((p) => p.map((x) => (order.has(x.id) ? { ...x, sort_order: order.get(x.id) as number } : x)));
    await Promise.all(list.map((x, n) => supabase.from("wo_session_items").update({ sort_order: n }).eq("id", x.id)));
  }, []);

  const addSet = useCallback(async (item: SessionItem) => {
    const existing = ref.current.idx.setsByItem.get(item.id) ?? [];
    const prev = existing[existing.length - 1];
    const ex = ref.current.exById.get(item.exercise_id);
    const row = {
      item_id: item.id,
      set_no: (prev?.set_no ?? 0) + 1,
      weight: prev?.weight ?? null,
      reps: prev?.reps ?? null,
      seconds: prev?.seconds ?? null,
      minutes: prev?.minutes ?? null,
      hard: prev?.hard ?? hasMuscles(ex),
      done: false,
    };
    const { data, error } = await supabase.from("wo_sets").insert(row).select().single();
    if (reportError(error, "add a set")) return;
    setSets((p) => [...p, normSet(data as WSet)]);
  }, []);

  const updateSet = useCallback(async (set: WSet, patch: SetPatch) => {
    setSets((p) => p.map((s) => (s.id === set.id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from("wo_sets").update(patch).eq("id", set.id);
    reportError(error, "save the set");
  }, []);

  const deleteSet = useCallback(async (set: WSet) => {
    setSets((p) => p.filter((s) => s.id !== set.id));
    const { error } = await supabase.from("wo_sets").delete().eq("id", set.id);
    reportError(error, "remove the set");
  }, []);

  return {
    loading, error, exercises, exById, plans, planItems, sessions, sessionItems, sets, idx, settings,
    reload, saveSettings, saveExercise, removeExercise, restoreExercise,
    savePlan, duplicatePlan, deletePlan,
    startSession, copySession, deleteSession, updateSession, addExercise, removeItem, moveItem,
    addSet, updateSet, deleteSet, lastSets,
  };
}

function num(v: unknown): number | null {
  return v === null || v === undefined || v === "" ? null : Number(v);
}

/** Postgres numeric columns can arrive as strings; convert to numbers. */
function normSet(s: WSet): WSet {
  return { ...s, weight: num(s.weight), reps: num(s.reps), seconds: num(s.seconds), minutes: num(s.minutes) };
}
