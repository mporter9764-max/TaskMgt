export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface Group {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface Task {
  id: string;
  title: string;
  details: string;
  group_id: string | null;
  start_date: string | null;
  end_date: string | null;
  completed: boolean;
  completed_at: string | null;
  recurrence: Recurrence;
  recurrence_interval: number;
  recurrence_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface OccCompletion {
  task_id: string;
  occ_date: string;
}

/** One rendered instance of a task on a date range (recurring tasks yield many). */
export interface Occurrence {
  key: string;
  task: Task;
  start: string;
  end: string;
  recurring: boolean;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NoteTag {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_recap: boolean;
}

export interface SnippetCompletion {
  note_id: string;
  snippet_hash: string;
}

export type Period = "day" | "week" | "month";

export interface GoalRole {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface GoalSubgroup {
  id: string;
  role_id: string;
  name: string;
  sort_order: number;
}

export interface Goal {
  id: string;
  role_id: string;
  subgroup_id: string | null;
  name: string;
  start_date: string;
  archived_on: string | null;
  sort_order: number;
}

export interface GoalTarget {
  id: string;
  goal_id: string;
  period: Period;
  target: number;
  effective_from: string;
}

export interface GoalLog {
  goal_id: string;
  log_date: string;
}
