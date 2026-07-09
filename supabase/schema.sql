-- ============================================================================
-- Lightweight Task Management & Timeline App — Supabase schema
-- ----------------------------------------------------------------------------
-- HOW TO RUN:
--   1. Supabase dashboard → your project → SQL Editor → New query
--   2. Paste this entire file, click Run
--   3. Check Table Editor — you should see: groups, tasks, checklist_items, settings
--
-- DESIGN NOTES (baked into the schema, not just the app):
--   • Dates are DATE type, not TIMESTAMP — day-level only, no time can sneak in (#10)
--   • completed_at is auto-managed by a trigger (flips on/off with is_complete) (#14)
--   • updated_at auto-updates on every task edit
--   • settings is a locked single-row table (holds the Upcoming window slider) (#13)
--   • No-login shared-by-link: RLS is ON with permissive anon policies
-- ============================================================================

-- Needed for gen_random_uuid() (Supabase has this available)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- GROUPS  —  your headers (Brady, Finance, Health, Work, ...)
-- ----------------------------------------------------------------------------
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null,                 -- pastel hex, e.g. '#AEDFF7'
  sort_order  integer not null default 0,    -- lane order (desktop) + list order
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- TASKS
-- ----------------------------------------------------------------------------
create table if not exists tasks (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references groups(id) on delete restrict,
  title          text not null,
  notes          text,                        -- #7  (nullable)
  start_date     date not null,               -- #4
  end_date       date,                        -- #4  (null = single-day task)
  reminder_date  date,                        -- #12 (independent of start/end)
  recurrence     text not null default 'none' -- none|daily|weekly|monthly|yearly
                 check (recurrence in ('none','daily','weekly','monthly','yearly')),
  is_complete    boolean not null default false,
  completed_at   timestamptz,                 -- #14 auto-set by trigger
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- guardrail: end can't be before start
  constraint end_after_start check (end_date is null or end_date >= start_date)
);

-- ----------------------------------------------------------------------------
-- CHECKLIST_ITEMS  —  #3  (deletes with parent task)
-- ----------------------------------------------------------------------------
create table if not exists checklist_items (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  label       text not null,
  is_checked  boolean not null default false,
  sort_order  integer not null default 0
);

-- ----------------------------------------------------------------------------
-- OCCURRENCE_COMPLETIONS  —  per-occurrence completion for recurring tasks
-- ----------------------------------------------------------------------------
create table if not exists occurrence_completions (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references tasks(id) on delete cascade,
  occurrence_date  date not null,
  completed_at     timestamptz not null default now(),
  unique (task_id, occurrence_date)
);

create index if not exists idx_occ_task on occurrence_completions(task_id);

-- ----------------------------------------------------------------------------
-- SETTINGS  —  single locked row (the Upcoming window)  #13
-- The boolean-PK + check trick makes it physically impossible to have >1 row.
-- ----------------------------------------------------------------------------
create table if not exists settings (
  id                    boolean primary key default true,
  upcoming_window_days  integer not null default 14,
  constraint singleton  check (id),
  constraint window_positive check (upcoming_window_days between 1 and 365)
);

insert into settings (id) values (true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- NOTES  —  free-form notes with inline #tags (parsed client-side, not stored
-- as structured data — the tag registry below just tracks names + colors)
-- ----------------------------------------------------------------------------
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_notes_updated on notes(updated_at desc);

create table if not exists note_tags (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,   -- lowercase, no leading '#'
  color          text not null,
  sort_order     integer not null default 0,
  show_in_recap  boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists note_snippet_completions (
  id             uuid primary key default gen_random_uuid(),
  note_id        uuid not null references notes(id) on delete cascade,
  tag            text not null,
  snippet_hash   text not null,
  completed_at   timestamptz not null default now(),
  unique (note_id, tag, snippet_hash)
);

create index if not exists idx_note_snippet_note on note_snippet_completions(note_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Keep tasks.updated_at fresh on every edit
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

drop trigger if exists notes_set_updated_at on notes;
create trigger notes_set_updated_at
  before update on notes
  for each row execute function set_updated_at();

-- Auto-manage completed_at so it can never drift out of sync with is_complete
create or replace function sync_completed_at()
returns trigger as $$
begin
  if new.is_complete and not old.is_complete then
    new.completed_at = now();          -- just marked complete
  elsif not new.is_complete and old.is_complete then
    new.completed_at = null;           -- un-completed
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_sync_completed_at on tasks;
create trigger tasks_sync_completed_at
  before update on tasks
  for each row execute function sync_completed_at();

-- ============================================================================
-- INDEXES  (small app, but these keep the timeline + upcoming queries snappy)
-- ============================================================================
create index if not exists idx_tasks_group        on tasks(group_id);
create index if not exists idx_tasks_start_date    on tasks(start_date);
create index if not exists idx_tasks_reminder_date on tasks(reminder_date);
create index if not exists idx_tasks_incomplete    on tasks(is_complete) where is_complete = false;
create index if not exists idx_checklist_task      on checklist_items(task_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- No-login app: RLS is ON, with permissive policies so the anon key can
-- read/write. This is the standard Supabase pattern for a public shared app.
-- (Reminder: anyone with the URL + anon key can read/write — don't store
--  anything sensitive here.)
-- ============================================================================
alter table groups          enable row level security;
alter table tasks           enable row level security;
alter table checklist_items enable row level security;
alter table occurrence_completions enable row level security;
alter table notes           enable row level security;
alter table note_tags       enable row level security;
alter table note_snippet_completions enable row level security;
alter table settings        enable row level security;

drop policy if exists "public all" on groups;
create policy "public all" on groups
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public all" on tasks;
create policy "public all" on tasks
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public all" on checklist_items;
create policy "public all" on checklist_items
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public all" on occurrence_completions;
create policy "public all" on occurrence_completions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public all" on notes;
create policy "public all" on notes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public all" on note_tags;
create policy "public all" on note_tags
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public all" on note_snippet_completions;
create policy "public all" on note_snippet_completions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public all" on settings;
create policy "public all" on settings
  for all to anon, authenticated using (true) with check (true);

-- ============================================================================
-- SEED DATA  —  a starter set of pastel groups (rename / delete freely)
-- ============================================================================
insert into groups (name, color, sort_order) values
  ('Brady',   '#AEDFF7', 1),   -- soft sky blue
  ('Finance', '#C3E8C9', 2),   -- soft mint
  ('Health',  '#FFD9C0', 3),   -- soft peach
  ('Work',    '#E4C7F5', 4)    -- soft lavender
on conflict do nothing;

-- Done. Next: the Next.js app scaffold wired to this schema.
