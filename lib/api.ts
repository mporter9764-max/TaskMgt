import { supabase } from "./supabase";
import type {
  Group,
  Task,
  ChecklistItem,
  Settings,
  TaskDraft,
  ChecklistDraft,
  OccurrenceCompletion,
  Note,
  NoteTag,
  NoteDraft,
  NoteSnippetCompletion,
} from "./types";
import { PASTEL_PALETTE } from "./colors";

// ---- Groups ---------------------------------------------------------------

export async function fetchGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(name: string, color: string, sortOrder: number): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, color, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGroup(id: string, patch: Partial<Pick<Group, "name" | "color" | "sort_order">>): Promise<void> {
  const { error } = await supabase.from("groups").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteGroup(id: string): Promise<void> {
  // DB blocks this (on delete restrict) if the group still has tasks.
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) throw error;
}

/** Persist a new top-to-bottom order by rewriting sort_order for each group. */
export async function reorderGroups(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => supabase.from("groups").update({ sort_order: i + 1 }).eq("id", id))
  );
}

// ---- Tasks ----------------------------------------------------------------

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(draft: TaskDraft): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      group_id: draft.group_id,
      title: draft.title,
      notes: draft.notes,
      start_date: draft.start_date,
      end_date: draft.end_date,
      reminder_date: draft.reminder_date,
      recurrence: draft.recurrence,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, draft: TaskDraft): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      group_id: draft.group_id,
      title: draft.title,
      notes: draft.notes,
      start_date: draft.start_date,
      end_date: draft.end_date,
      reminder_date: draft.reminder_date,
      recurrence: draft.recurrence,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setTaskComplete(id: string, complete: boolean): Promise<void> {
  // completed_at is auto-managed by the DB trigger.
  const { error } = await supabase
    .from("tasks")
    .update({ is_complete: complete })
    .eq("id", id);
  if (error) throw error;
}

// ---- Recurring occurrence completions -------------------------------------

export async function fetchOccurrenceCompletions(): Promise<OccurrenceCompletion[]> {
  const { data, error } = await supabase.from("occurrence_completions").select("*");
  if (error) throw error;
  return data ?? [];
}

/** Mark a single occurrence of a recurring task complete. */
export async function completeOccurrence(taskId: string, occurrenceDate: string): Promise<void> {
  const { error } = await supabase
    .from("occurrence_completions")
    .upsert(
      { task_id: taskId, occurrence_date: occurrenceDate },
      { onConflict: "task_id,occurrence_date" }
    );
  if (error) throw error;
}

/** Restore (un-complete) a single occurrence. */
export async function uncompleteOccurrence(taskId: string, occurrenceDate: string): Promise<void> {
  const { error } = await supabase
    .from("occurrence_completions")
    .delete()
    .eq("task_id", taskId)
    .eq("occurrence_date", occurrenceDate);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---- Checklist ------------------------------------------------------------

export async function fetchChecklist(taskId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** All checklist items across every task, for computing per-task progress on cards. */
export async function fetchAllChecklistItems(): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Replace the whole checklist for a task with the given drafts (simplest reliable sync). */
export async function saveChecklist(taskId: string, items: ChecklistDraft[]): Promise<void> {
  // Wipe then re-insert. Small lists, no ordering headaches.
  const del = await supabase.from("checklist_items").delete().eq("task_id", taskId);
  if (del.error) throw del.error;
  if (items.length === 0) return;
  const rows = items.map((it, i) => ({
    task_id: taskId,
    label: it.label,
    is_checked: it.is_checked,
    sort_order: i,
  }));
  const { error } = await supabase.from("checklist_items").insert(rows);
  if (error) throw error;
}

/** Toggle a single checklist item in place (used from cards without opening the editor). */
export async function toggleChecklistItem(id: string, checked: boolean): Promise<void> {
  const { error } = await supabase
    .from("checklist_items")
    .update({ is_checked: checked })
    .eq("id", id);
  if (error) throw error;
}

// ---- Settings -------------------------------------------------------------

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data;
}

export async function updateWindowDays(days: number): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .update({ upcoming_window_days: days })
    .eq("id", true);
  if (error) throw error;
}

// ---- Notes ------------------------------------------------------------

export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createNote(draft: NoteDraft): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({ title: draft.title, content: draft.content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, draft: NoteDraft): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .update({ title: draft.title, content: draft.content })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

// ---- Note tags (a small color registry, auto-populated as you type #tags) --

export async function fetchNoteTags(): Promise<NoteTag[]> {
  const { data, error } = await supabase
    .from("note_tags")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateNoteTag(
  id: string,
  patch: Partial<Pick<NoteTag, "name" | "color" | "sort_order">>
): Promise<void> {
  const { error } = await supabase.from("note_tags").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteNoteTag(id: string): Promise<void> {
  const { error } = await supabase.from("note_tags").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderNoteTags(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => supabase.from("note_tags").update({ sort_order: i + 1 }).eq("id", id))
  );
}

/**
 * Make sure every tag name in `names` exists in the registry, auto-creating
 * any that are new (cycling through the pastel palette for their color).
 * Safe to call on every note save — existing tags are left untouched.
 */
export async function ensureNoteTagsExist(names: string[], existing: NoteTag[]): Promise<NoteTag[]> {
  const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));
  const toCreate = names.filter((n) => !existingNames.has(n.toLowerCase()));
  if (toCreate.length === 0) return existing;

  const startIdx = existing.length;
  const rows = toCreate.map((n, i) => ({
    name: n.toLowerCase(),
    color: PASTEL_PALETTE[(startIdx + i) % PASTEL_PALETTE.length],
    sort_order: startIdx + i + 1,
  }));

  const { data, error } = await supabase
    .from("note_tags")
    .upsert(rows, { onConflict: "name", ignoreDuplicates: true })
    .select();
  if (error) throw error;
  return [...existing, ...(data ?? [])];
}

// ---- Note snippet completions (mark a tagged line "done" in the review panel) --

export async function fetchNoteSnippetCompletions(): Promise<NoteSnippetCompletion[]> {
  const { data, error } = await supabase.from("note_snippet_completions").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function completeSnippet(noteId: string, tag: string, hash: string): Promise<void> {
  const { error } = await supabase
    .from("note_snippet_completions")
    .upsert(
      { note_id: noteId, tag, snippet_hash: hash },
      { onConflict: "note_id,tag,snippet_hash" }
    );
  if (error) throw error;
}

export async function uncompleteSnippet(noteId: string, tag: string, hash: string): Promise<void> {
  const { error } = await supabase
    .from("note_snippet_completions")
    .delete()
    .eq("note_id", noteId)
    .eq("tag", tag)
    .eq("snippet_hash", hash);
  if (error) throw error;
}
