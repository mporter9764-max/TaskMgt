-- ============================================================================
-- TaskMgt v2: full schema
-- ----------------------------------------------------------------------------
-- Run ONCE in your NEW TaskMgt Supabase project:
--   SQL Editor > New query > paste everything > Run
-- Creates all tables for Tasks, Notes and Goals, plus a few starter rows.
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- TASKS
-- ----------------------------------------------------------------------------
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#cfe3f7',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists tasks (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  details             text not null default '',
  group_id            uuid references groups(id) on delete set null,
  start_date          date,
  end_date            date,
  completed           boolean not null default false,
  completed_at        timestamptz,
  recurrence          text not null default 'none'
                      check (recurrence in ('none','daily','weekly','monthly','yearly')),
  recurrence_interval int  not null default 1 check (recurrence_interval >= 1),
  recurrence_until    date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

-- one row per completed occurrence of a recurring task
create table if not exists occurrence_completions (
  task_id      uuid not null references tasks(id) on delete cascade,
  occ_date     date not null,
  completed_at timestamptz not null default now(),
  primary key (task_id, occ_date)
);

-- ----------------------------------------------------------------------------
-- NOTES
-- ----------------------------------------------------------------------------
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists notes_updated_at on notes;
create trigger notes_updated_at before update on notes
  for each row execute function set_updated_at();

create table if not exists note_tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#3987e5',
  sort_order  int  not null default 0,
  is_recap    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- one row per tagged snippet marked done (snippet identified by a text hash)
create table if not exists note_snippet_completions (
  note_id       uuid not null references notes(id) on delete cascade,
  snippet_hash  text not null,
  completed_at  timestamptz not null default now(),
  primary key (note_id, snippet_hash)
);

-- ----------------------------------------------------------------------------
-- GOALS
-- ----------------------------------------------------------------------------
create table if not exists goal_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#2a78d6',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists goal_subgroups (
  id          uuid primary key default gen_random_uuid(),
  role_id     uuid not null references goal_roles(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists goals (
  id           uuid primary key default gen_random_uuid(),
  role_id      uuid not null references goal_roles(id) on delete cascade,
  subgroup_id  uuid references goal_subgroups(id) on delete set null,
  name         text not null,
  start_date   date not null default current_date,
  archived_on  date,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

-- target history: changing a target adds a row, so past periods keep their old target
create table if not exists goal_targets (
  id              uuid primary key default gen_random_uuid(),
  goal_id         uuid not null references goals(id) on delete cascade,
  period          text not null check (period in ('day','week','month')),
  target          int  not null check (target >= 1),
  effective_from  date not null,
  unique (goal_id, effective_from)
);

-- a row means "yes, I did it that day"
create table if not exists goal_logs (
  goal_id     uuid not null references goals(id) on delete cascade,
  log_date    date not null,
  created_at  timestamptz not null default now(),
  primary key (goal_id, log_date)
);

-- ----------------------------------------------------------------------------
-- ACCESS (single-user personal app, same model as before)
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'groups','tasks','occurrence_completions',
    'notes','note_tags','note_snippet_completions',
    'goal_roles','goal_subgroups','goals','goal_targets','goal_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "personal app access" on %I', t);
    execute format('create policy "personal app access" on %I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to anon, authenticated', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- STARTER DATA (edit or delete any of it in the app)
-- ----------------------------------------------------------------------------
insert into groups (name, color, sort_order) values
  ('Brady',   '#f6d6e4', 0),
  ('Home',    '#d6ecd2', 1),
  ('Health',  '#cfe3f7', 2),
  ('Work',    '#e3dbf5', 3),
  ('Finance', '#fbe5c4', 4);

insert into note_tags (name, color, sort_order, is_recap) values
  ('action',   '#2a78d6', 0, true),
  ('followup', '#eb6834', 1, false),
  ('decision', '#1baf7a', 2, false),
  ('idea',     '#6250d6', 3, false);

do $$
declare
  r_father  uuid; r_husband uuid; r_health uuid;
  s_diet uuid; s_sleep uuid; s_activity uuid; s_hygiene uuid;
  g uuid;
begin
  insert into goal_roles (name, color, sort_order) values ('Father',  '#2a78d6', 0) returning id into r_father;
  insert into goal_roles (name, color, sort_order) values ('Husband', '#e87ba4', 1) returning id into r_husband;
  insert into goal_roles (name, color, sort_order) values ('Health',  '#1baf7a', 2) returning id into r_health;

  insert into goal_subgroups (role_id, name, sort_order) values (r_health, 'Diet', 0)     returning id into s_diet;
  insert into goal_subgroups (role_id, name, sort_order) values (r_health, 'Sleep', 1)    returning id into s_sleep;
  insert into goal_subgroups (role_id, name, sort_order) values (r_health, 'Activity', 2) returning id into s_activity;
  insert into goal_subgroups (role_id, name, sort_order) values (r_health, 'Hygiene', 3)  returning id into s_hygiene;

  insert into goals (role_id, name, sort_order) values (r_father, 'Phone away during play', 0) returning id into g;
  insert into goal_targets (goal_id, period, target, effective_from) values (g, 'day', 1, current_date);
  insert into goals (role_id, name, sort_order) values (r_father, 'Read to him', 1) returning id into g;
  insert into goal_targets (goal_id, period, target, effective_from) values (g, 'day', 1, current_date);
  insert into goals (role_id, name, sort_order) values (r_father, 'Up and to bed on time', 2) returning id into g;
  insert into goal_targets (goal_id, period, target, effective_from) values (g, 'day', 1, current_date);

  insert into goals (role_id, subgroup_id, name, sort_order) values (r_health, s_diet, 'No alcohol', 0) returning id into g;
  insert into goal_targets (goal_id, period, target, effective_from) values (g, 'day', 1, current_date);
  insert into goals (role_id, subgroup_id, name, sort_order) values (r_health, s_activity, 'Worked out', 1) returning id into g;
  insert into goal_targets (goal_id, period, target, effective_from) values (g, 'week', 5, current_date);
  insert into goals (role_id, subgroup_id, name, sort_order) values (r_health, s_hygiene, 'Brushed teeth 2x', 2) returning id into g;
  insert into goal_targets (goal_id, period, target, effective_from) values (g, 'day', 1, current_date);
end $$;
