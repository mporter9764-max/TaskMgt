// Types mirror the Supabase schema exactly.
// Dates are day-level strings in 'YYYY-MM-DD' form (never timestamps).

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
  is_complete: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
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
};

export type ChecklistDraft = {
  id?: string; // present if it already exists in the DB
  label: string;
  is_checked: boolean;
};
