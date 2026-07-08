// Types mirror the Supabase schema exactly.
// Dates are day-level strings in 'YYYY-MM-DD' form (never timestamps).

export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type Group = {
  id: string;
  name: string;
  color: string; // pastel hex, e.g. '#AEDFF7'
  sort_order: number;
  created_at: string;
};

export type Task = {
  id: string;
  group_id: string;
  title: string;
  notes: string | null;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string | null; // null = single-day task
  reminder_date: string | null;
  recurrence: Recurrence;
  is_complete: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

// A single generated occurrence of a task, shaped like a Task so the views can
// render it directly. Recurring templates are shown ONLY through these.
export type DisplayTask = Task & {
  recurring?: boolean; // true if this row is a generated occurrence
  templateId?: string; // the real tasks.id it was generated from
  occDate?: string; // the occurrence's start date (its identity within a series)
};

export type OccurrenceCompletion = {
  id: string;
  task_id: string;
  occurrence_date: string;
  completed_at: string;
};

export type ChecklistItem = {
  id: string;
  task_id: string;
  label: string;
  is_checked: boolean;
  sort_order: number;
};

export type Settings = {
  id: boolean;
  upcoming_window_days: number;
};

// Convenience shape used in the editor before an id exists.
export type TaskDraft = {
  id?: string;
  group_id: string;
  title: string;
  notes: string | null;
  start_date: string;
  end_date: string | null;
  reminder_date: string | null;
  recurrence: Recurrence;
};

export type ChecklistDraft = {
  id?: string; // present if it already exists in the DB
  label: string;
  is_checked: boolean;
};

// ---- Notes ------------------------------------------------------------

export type Note = {
  id: string;
  title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

export type NoteTag = {
  id: string;
  name: string; // lowercase, no leading '#'
  color: string;
  sort_order: number;
  created_at: string;
};

export type NoteDraft = {
  id?: string;
  title: string | null;
  content: string;
};

