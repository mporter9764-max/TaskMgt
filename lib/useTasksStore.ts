"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { fetchAll, saveOrder } from "./db";
import { reportError, toast } from "./toast";
import type { Group, OccCompletion, Task } from "./types";

export type TaskDraft = Omit<Task, "id" | "created_at" | "updated_at" | "completed_at"> & {
  id?: string;
  completed_at?: string | null;
};

export interface TasksStore {
  loading: boolean;
  error: string | null;
  groups: Group[];
  tasks: Task[];
  occDone: Set<string>;
  reload: () => Promise<void>;
  saveTask: (draft: TaskDraft) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (task: Task) => Promise<void>;
  toggleOccurrence: (taskId: string, date: string) => Promise<void>;
  moveTask: (id: string, start: string, end: string) => Promise<void>;
  addGroup: (name: string, color: string) => Promise<void>;
  updateGroup: (id: string, patch: Partial<Pick<Group, "name" | "color">>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  reorderGroups: (ordered: Group[]) => Promise<void>;
}

export function useTasksStore(enabled: boolean): TasksStore {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [occDone, setOccDone] = useState<Set<string>>(new Set());
  const occRef = useRef(occDone);
  occRef.current = occDone;

  const reload = useCallback(async () => {
    try {
      const [g, t, o] = await Promise.all([
        fetchAll<Group>("groups", "sort_order"),
        fetchAll<Task>("tasks", "created_at"),
        fetchAll<OccCompletion>("occurrence_completions", "occ_date"),
      ]);
      setGroups(g);
      setTasks(t);
      setOccDone(new Set(o.map((c) => `${c.task_id}:${c.occ_date}`)));
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

  const saveTask = useCallback(async (draft: TaskDraft): Promise<Task | null> => {
    const { id, ...fields } = draft;
    if (fields.start_date && fields.end_date && fields.end_date < fields.start_date) {
      fields.end_date = fields.start_date;
    }
    if (id) {
      const { data, error } = await supabase.from("tasks").update(fields).eq("id", id).select().single();
      if (reportError(error, "save the task")) return null;
      setTasks((prev) => prev.map((t) => (t.id === id ? (data as Task) : t)));
      return data as Task;
    }
    const { data, error } = await supabase.from("tasks").insert(fields).select().single();
    if (reportError(error, "add the task")) return null;
    setTasks((prev) => [...prev, data as Task]);
    return data as Task;
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (reportError(error, "delete the task")) reload();
  }, [reload]);

  const toggleTask = useCallback(async (task: Task) => {
    const completed = !task.completed;
    const completed_at = completed ? new Date().toISOString() : null;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed, completed_at } : t)));
    const { error } = await supabase.from("tasks").update({ completed, completed_at }).eq("id", task.id);
    if (reportError(error, "update the task")) reload();
  }, [reload]);

  const toggleOccurrence = useCallback(async (taskId: string, date: string) => {
    const key = `${taskId}:${date}`;
    const wasDone = occRef.current.has(key);
    setOccDone((prev) => {
      const next = new Set(prev);
      if (wasDone) next.delete(key);
      else next.add(key);
      return next;
    });
    const { error } = wasDone
      ? await supabase.from("occurrence_completions").delete().eq("task_id", taskId).eq("occ_date", date)
      : await supabase.from("occurrence_completions").insert({ task_id: taskId, occ_date: date });
    if (reportError(error, "update the occurrence")) reload();
  }, [reload]);

  const moveTask = useCallback(async (id: string, start: string, end: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, start_date: start, end_date: end } : t)));
    const { error } = await supabase.from("tasks").update({ start_date: start, end_date: end }).eq("id", id);
    if (reportError(error, "move the task")) reload();
  }, [reload]);

  const addGroup = useCallback(async (name: string, color: string) => {
    const sort_order = groups.length ? Math.max(...groups.map((g) => g.sort_order)) + 1 : 0;
    const { data, error } = await supabase.from("groups").insert({ name, color, sort_order }).select().single();
    if (reportError(error, "add the group")) return;
    setGroups((prev) => [...prev, data as Group]);
  }, [groups]);

  const updateGroup = useCallback(async (id: string, patch: Partial<Pick<Group, "name" | "color">>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    const { error } = await supabase.from("groups").update(patch).eq("id", id);
    if (reportError(error, "update the group")) reload();
  }, [reload]);

  const deleteGroup = useCallback(async (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setTasks((prev) => prev.map((t) => (t.group_id === id ? { ...t, group_id: null } : t)));
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (reportError(error, "delete the group")) reload();
  }, [reload]);

  const reorderGroups = useCallback(async (ordered: Group[]) => {
    setGroups(ordered.map((g, i) => ({ ...g, sort_order: i })));
    const err = await saveOrder("groups", ordered.map((g) => g.id));
    if (err) {
      toast(`Couldn't save the order: ${err}`);
      reload();
    }
  }, [reload]);

  return {
    loading, error, groups, tasks, occDone, reload,
    saveTask, deleteTask, toggleTask, toggleOccurrence, moveTask,
    addGroup, updateGroup, deleteGroup, reorderGroups,
  };
}
