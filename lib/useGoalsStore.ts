"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { fetchAll, saveOrder } from "./db";
import { reportError, toast } from "./toast";
import { maxStr, todayStr } from "./dates";
import type { Goal, GoalLog, GoalRole, GoalSubgroup, GoalTarget, Period } from "./types";

export interface GoalInput {
  name: string;
  role_id: string;
  subgroup_id: string | null;
  start_date: string;
  period: Period;
  target: number;
}

export interface GoalsStore {
  loading: boolean;
  error: string | null;
  roles: GoalRole[];
  subgroups: GoalSubgroup[];
  goals: Goal[];
  targets: GoalTarget[];
  logs: Map<string, Set<string>>;
  reload: () => Promise<void>;
  toggleLog: (goalId: string, date: string) => Promise<void>;
  addRole: (name: string, color: string) => Promise<void>;
  updateRole: (id: string, patch: Partial<Pick<GoalRole, "name" | "color">>) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
  reorderRoles: (ordered: GoalRole[]) => Promise<void>;
  addSubgroup: (roleId: string, name: string) => Promise<void>;
  updateSubgroup: (id: string, name: string) => Promise<void>;
  deleteSubgroup: (id: string) => Promise<void>;
  reorderSubgroups: (ordered: GoalSubgroup[]) => Promise<void>;
  createGoal: (input: GoalInput) => Promise<void>;
  updateGoal: (goal: Goal, input: GoalInput) => Promise<void>;
  setArchived: (goal: Goal, archived: boolean) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  reorderGoals: (ordered: Goal[]) => Promise<void>;
}

export function useGoalsStore(enabled: boolean): GoalsStore {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<GoalRole[]>([]);
  const [subgroups, setSubgroups] = useState<GoalSubgroup[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [targets, setTargets] = useState<GoalTarget[]>([]);
  const [logs, setLogs] = useState<Map<string, Set<string>>>(new Map());
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const reload = useCallback(async () => {
    try {
      const [r, s, g, t, l] = await Promise.all([
        fetchAll<GoalRole>("goal_roles", "sort_order"),
        fetchAll<GoalSubgroup>("goal_subgroups", "sort_order"),
        fetchAll<Goal>("goals", "sort_order"),
        fetchAll<GoalTarget>("goal_targets", "effective_from"),
        fetchAll<GoalLog>("goal_logs", "log_date"),
      ]);
      const map = new Map<string, Set<string>>();
      for (const row of l) {
        let set = map.get(row.goal_id);
        if (!set) {
          set = new Set();
          map.set(row.goal_id, set);
        }
        set.add(row.log_date);
      }
      setRoles(r);
      setSubgroups(s);
      setGoals(g);
      setTargets(t);
      setLogs(map);
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

  const toggleLog = useCallback(async (goalId: string, date: string) => {
    const wasDone = logsRef.current.get(goalId)?.has(date) ?? false;
    setLogs((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(goalId) ?? []);
      if (wasDone) set.delete(date);
      else set.add(date);
      next.set(goalId, set);
      return next;
    });
    if (!wasDone && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        /* not supported */
      }
    }
    const { error } = wasDone
      ? await supabase.from("goal_logs").delete().eq("goal_id", goalId).eq("log_date", date)
      : await supabase.from("goal_logs").upsert({ goal_id: goalId, log_date: date }, { onConflict: "goal_id,log_date", ignoreDuplicates: true });
    if (reportError(error, "save the check-in")) reload();
  }, [reload]);

  /* roles ----------------------------------------------------------------- */
  const addRole = useCallback(async (name: string, color: string) => {
    const sort_order = roles.length ? Math.max(...roles.map((r) => r.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from("goal_roles").insert({ name, color, sort_order }).select().single();
    if (reportError(error, "add the role")) return;
    setRoles((prev) => [...prev, data as GoalRole]);
  }, [roles]);

  const updateRole = useCallback(async (id: string, patch: Partial<Pick<GoalRole, "name" | "color">>) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("goal_roles").update(patch).eq("id", id);
    if (reportError(error, "update the role")) reload();
  }, [reload]);

  const deleteRole = useCallback(async (id: string) => {
    const { error } = await supabase.from("goal_roles").delete().eq("id", id);
    if (reportError(error, "delete the role")) return;
    await reload();
  }, [reload]);

  const reorderRoles = useCallback(async (ordered: GoalRole[]) => {
    setRoles(ordered.map((r, i) => ({ ...r, sort_order: i })));
    const err = await saveOrder("goal_roles", ordered.map((r) => r.id));
    if (err) {
      toast(`Couldn't save the order: ${err}`);
      reload();
    }
  }, [reload]);

  /* subgroups ------------------------------------------------------------- */
  const addSubgroup = useCallback(async (roleId: string, name: string) => {
    const siblings = subgroups.filter((s) => s.role_id === roleId);
    const sort_order = siblings.length ? Math.max(...siblings.map((s) => s.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from("goal_subgroups").insert({ role_id: roleId, name, sort_order }).select().single();
    if (reportError(error, "add the subgroup")) return;
    setSubgroups((prev) => [...prev, data as GoalSubgroup]);
  }, [subgroups]);

  const updateSubgroup = useCallback(async (id: string, name: string) => {
    setSubgroups((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    const { error } = await supabase.from("goal_subgroups").update({ name }).eq("id", id);
    if (reportError(error, "rename the subgroup")) reload();
  }, [reload]);

  const deleteSubgroup = useCallback(async (id: string) => {
    setSubgroups((prev) => prev.filter((s) => s.id !== id));
    setGoals((prev) => prev.map((g) => (g.subgroup_id === id ? { ...g, subgroup_id: null } : g)));
    const { error } = await supabase.from("goal_subgroups").delete().eq("id", id);
    if (reportError(error, "delete the subgroup")) reload();
  }, [reload]);

  const reorderSubgroups = useCallback(async (ordered: GoalSubgroup[]) => {
    const pos = new Map(ordered.map((s, i) => [s.id, i]));
    setSubgroups((prev) => prev.map((s) => (pos.has(s.id) ? { ...s, sort_order: pos.get(s.id) as number } : s)));
    const err = await saveOrder("goal_subgroups", ordered.map((s) => s.id));
    if (err) {
      toast(`Couldn't save the order: ${err}`);
      reload();
    }
  }, [reload]);

  /* goals ----------------------------------------------------------------- */
  const createGoal = useCallback(async (input: GoalInput) => {
    const siblings = goals.filter((g) => g.role_id === input.role_id);
    const sort_order = siblings.length ? Math.max(...siblings.map((g) => g.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from("goals")
      .insert({ name: input.name, role_id: input.role_id, subgroup_id: input.subgroup_id, start_date: input.start_date, sort_order })
      .select()
      .single();
    if (reportError(error, "add the goal")) return;
    const goal = data as Goal;
    const { data: t, error: e2 } = await supabase
      .from("goal_targets")
      .insert({ goal_id: goal.id, period: input.period, target: input.period === "day" ? 1 : input.target, effective_from: input.start_date })
      .select()
      .single();
    if (reportError(e2, "save the goal's target")) return;
    setGoals((prev) => [...prev, goal]);
    setTargets((prev) => [...prev, t as GoalTarget]);
  }, [goals]);

  /**
   * Name, role, subgroup and start date are edited in place. A changed period or target is added as a
   * new target version effective today, so periods already judged keep the target they had.
   */
  const updateGoal = useCallback(async (goal: Goal, input: GoalInput) => {
    const fields = { name: input.name, role_id: input.role_id, subgroup_id: input.subgroup_id, start_date: input.start_date };
    const { error } = await supabase.from("goals").update(fields).eq("id", goal.id);
    if (reportError(error, "save the goal")) return;

    const versions = targetsRef.current
      .filter((t) => t.goal_id === goal.id)
      .sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1));
    const latest = versions[versions.length - 1];
    const target = input.period === "day" ? 1 : input.target;
    if (!latest || latest.period !== input.period || latest.target !== target) {
      const effective = maxStr(todayStr(), input.start_date);
      const same = versions.find((v) => v.effective_from === effective);
      const res = same
        ? await supabase.from("goal_targets").update({ period: input.period, target }).eq("id", same.id)
        : await supabase.from("goal_targets").insert({ goal_id: goal.id, period: input.period, target, effective_from: effective });
      if (reportError(res.error, "save the new target")) return;
    } else if (versions.length === 1 && latest.effective_from !== input.start_date && input.start_date < latest.effective_from) {
      // start date moved earlier: let the only version cover it
      await supabase.from("goal_targets").update({ effective_from: input.start_date }).eq("id", latest.id);
    }
    await reload();
  }, [reload]);

  const setArchived = useCallback(async (goal: Goal, archived: boolean) => {
    const archived_on = archived ? todayStr() : null;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, archived_on } : g)));
    const { error } = await supabase.from("goals").update({ archived_on }).eq("id", goal.id);
    if (reportError(error, archived ? "archive the goal" : "restore the goal")) reload();
  }, [reload]);

  const deleteGoal = useCallback(async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (reportError(error, "delete the goal")) reload();
  }, [reload]);

  const reorderGoals = useCallback(async (ordered: Goal[]) => {
    const pos = new Map(ordered.map((g, i) => [g.id, i]));
    setGoals((prev) => prev.map((g) => (pos.has(g.id) ? { ...g, sort_order: pos.get(g.id) as number } : g)));
    const err = await saveOrder("goals", ordered.map((g) => g.id));
    if (err) {
      toast(`Couldn't save the order: ${err}`);
      reload();
    }
  }, [reload]);

  return {
    loading, error, roles, subgroups, goals, targets, logs, reload,
    toggleLog,
    addRole, updateRole, deleteRole, reorderRoles,
    addSubgroup, updateSubgroup, deleteSubgroup, reorderSubgroups,
    createGoal, updateGoal, setArchived, deleteGoal, reorderGoals,
  };
}
