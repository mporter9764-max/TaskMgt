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

-- one row per logged day: status "done" (yes) or "missed" (a conscious no); no row = not logged
create table if not exists goal_logs (
  goal_id     uuid not null references goals(id) on delete cascade,
  log_date    date not null,
  status      text not null default 'done' check (status in ('done', 'missed')),
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

-- ============================================================================
-- WORKOUTS (same as migration_workouts.sql)
-- ============================================================================


create table if not exists wo_exercises (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  kind               text not null default 'weight_reps'
                     check (kind in ('weight_reps','bodyweight','hold','carry','cardio')),
  primary_muscle     text,
  secondary_muscles  text[] not null default '{}',
  equipment          text,
  intensity          text check (intensity in ('low','high')),
  archived           boolean not null default false,
  created_at         timestamptz not null default now()
);

create table if not exists wo_plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  days        int[] not null default '{}',          -- 0 = Monday ... 6 = Sunday
  start_date  date not null default current_date,
  end_date    date,
  color       text not null default '#2a78d6',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists wo_plan_items (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references wo_plans(id) on delete cascade,
  exercise_id     uuid not null references wo_exercises(id) on delete restrict,
  sort_order      int  not null default 0,
  target_sets     int  not null default 3 check (target_sets >= 1),
  target_reps     int,
  target_weight   numeric,
  target_seconds  int,
  target_minutes  numeric
);

create table if not exists wo_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_date  date not null,
  plan_id       uuid references wo_plans(id) on delete set null,
  name          text not null default 'Workout',
  notes         text not null default '',
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists wo_sessions_plan_day on wo_sessions (session_date, plan_id) where plan_id is not null;

create table if not exists wo_session_items (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references wo_sessions(id) on delete cascade,
  exercise_id  uuid not null references wo_exercises(id) on delete restrict,
  sort_order   int  not null default 0
);

create table if not exists wo_sets (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references wo_session_items(id) on delete cascade,
  set_no      int  not null default 1,
  weight      numeric,
  reps        int,
  seconds     int,
  minutes     numeric,
  hard        boolean not null default true,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- settings store (also created by the old TDEE migration; safe to repeat)
create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['wo_exercises','wo_plans','wo_plan_items','wo_sessions','wo_session_items','wo_sets','app_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "personal app access" on %I', t);
    execute format('create policy "personal app access" on %I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to anon, authenticated', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Seed from the spreadsheet
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from wo_exercises) then
    return;
  end if;

  insert into wo_exercises (name, kind, primary_muscle, secondary_muscles, equipment, intensity) values
    ('Trap Bar DL',            'weight_reps', 'glutes',      '{quads,hamstrings,upper_back}',   'Barbell',    null),
    ('Romanian DL',            'weight_reps', 'hamstrings',  '{glutes,forearms}',               'Barbell',    null),
    ('Squat',                  'weight_reps', 'quads',       '{glutes,core}',                   'Barbell',    null),
    ('Glute Bridge',           'weight_reps', 'glutes',      '{hamstrings}',                    'Barbell',    null),
    ('Weighted Hip Thrust',    'weight_reps', 'glutes',      '{hamstrings}',                    'Barbell',    null),
    ('Clamshells',             'bodyweight',  'glutes',      '{}',                              'Band',       null),
    ('Kettlebell Swings',      'weight_reps', 'glutes',      '{hamstrings,core}',               'Kettlebell', null),
    ('Lunges',                 'weight_reps', 'quads',       '{glutes}',                        'Dumbbell',   null),
    ('Pushup',                 'bodyweight',  'chest',       '{triceps,front_delts}',           'Bodyweight', null),
    ('Incline Press',          'weight_reps', 'chest',       '{front_delts,triceps}',           'Dumbbell',   null),
    ('Chest Flies',            'weight_reps', 'chest',       '{front_delts}',                   'Dumbbell',   null),
    ('Pullup',                 'bodyweight',  'lats',        '{biceps,upper_back}',             'Bodyweight', null),
    ('Rows',                   'weight_reps', 'upper_back',  '{lats,biceps,rear_delts}',        'Dumbbell',   null),
    ('Reverse Flies',          'weight_reps', 'rear_delts',  '{upper_back}',                    'Dumbbell',   null),
    ('Overhead Press',         'weight_reps', 'front_delts', '{side_delts,triceps}',            'Dumbbell',   null),
    ('Lateral Raise',          'weight_reps', 'side_delts',  '{}',                              'Dumbbell',   null),
    ('Shrugs',                 'weight_reps', 'upper_back',  '{forearms}',                      'Dumbbell',   null),
    ('EZ Bar Curls',           'weight_reps', 'biceps',      '{forearms}',                      'Barbell',    null),
    ('Straight Bar Curls',     'weight_reps', 'biceps',      '{forearms}',                      'Barbell',    null),
    ('Dumbbell Curls',         'weight_reps', 'biceps',      '{forearms}',                      'Dumbbell',   null),
    ('Hammer Curls',           'weight_reps', 'biceps',      '{forearms}',                      'Dumbbell',   null),
    ('Overhead Ext (Kettle)',  'weight_reps', 'triceps',     '{}',                              'Kettlebell', null),
    ('Plank',                  'hold',        'core',        '{}',                              'Bodyweight', null),
    ('Side Plank',             'hold',        'core',        '{}',                              'Bodyweight', null),
    ('Crunches',               'bodyweight',  'core',        '{}',                              'Bodyweight', null),
    ('V Ups',                  'bodyweight',  'core',        '{}',                              'Bodyweight', null),
    ('Cleans (Kettle)',        'weight_reps', 'glutes',      '{hamstrings,quads,upper_back}',   'Kettlebell', null),
    ('Cleans (Barbell)',       'weight_reps', 'glutes',      '{hamstrings,quads,upper_back}',   'Barbell',    null),
    ('Thrusters',              'weight_reps', 'quads',       '{glutes,front_delts,triceps}',    'Barbell',    null),
    ('Farmers Walks',          'carry',       'forearms',    '{upper_back,core}',               'Dumbbell',   null),
    ('Walk / Ruck',            'carry',       null,          '{}',                              'Other',      'low'),
    ('Air Bike',               'cardio',      null,          '{}',                              'Machine',    'high');

  insert into wo_plans (name, days, start_date, color, sort_order) values
    ('Workout A',          '{1,5}',   date_trunc('week', current_date)::date, '#2a78d6', 0),
    ('Workout B',          '{3}',     date_trunc('week', current_date)::date, '#6250d6', 1),
    ('Saturday Finisher',  '{5}',     date_trunc('week', current_date)::date, '#eb6834', 2),
    ('Walk / Ruck',        '{0,2,4}', date_trunc('week', current_date)::date, '#1baf7a', 3);

  insert into wo_plan_items (plan_id, exercise_id, sort_order, target_sets, target_minutes)
  select p.id, e.id, v.ord, v.sets, v.mins
  from (values
    ('Workout A', 'Trap Bar DL',        0, 2, null),
    ('Workout A', 'Squat',              1, 2, null),
    ('Workout A', 'Glute Bridge',       2, 2, null),
    ('Workout A', 'Clamshells',         3, 2, null),
    ('Workout A', 'Pushup',             4, 2, null),
    ('Workout A', 'Incline Press',      5, 2, null),
    ('Workout A', 'Pullup',             6, 2, null),
    ('Workout A', 'Rows',               7, 2, null),
    ('Workout A', 'Overhead Press',     8, 2, null),
    ('Workout A', 'EZ Bar Curls',       9, 2, null),
    ('Workout A', 'Plank',             10, 1, null),
    ('Workout A', 'Side Plank',        11, 1, null),
    ('Workout B', 'Kettlebell Swings',  0, 2, null),
    ('Workout B', 'Lunges',             1, 2, null),
    ('Workout B', 'Cleans (Barbell)',   2, 2, null),
    ('Workout B', 'Pushup',             3, 2, null),
    ('Workout B', 'Incline Press',      4, 2, null),
    ('Workout B', 'Reverse Flies',      5, 2, null),
    ('Workout B', 'Lateral Raise',      6, 2, null),
    ('Workout B', 'Shrugs',             7, 2, null),
    ('Workout B', 'Dumbbell Curls',     8, 2, null),
    ('Workout B', 'Hammer Curls',       9, 2, null),
    ('Workout B', 'V Ups',             10, 3, null),
    ('Saturday Finisher', 'Farmers Walks', 0, 1, null),
    ('Saturday Finisher', 'Air Bike',      1, 1, 10),
    ('Walk / Ruck',       'Walk / Ruck',   0, 1, 45)
  ) as v(plan, ex, ord, sets, mins)
  join wo_plans p on p.name = v.plan
  join wo_exercises e on e.name = v.ex;
end $$;

-- ============================================================================
-- WORKOUT BLOCKS (same as migration_blocks.sql)
-- ============================================================================

create table if not exists wo_blocks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date not null,
  end_date    date,
  created_at  timestamptz not null default now()
);

create table if not exists wo_block_slots (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references wo_blocks(id) on delete cascade,
  day         int  not null check (day between 0 and 6),   -- 0 = Monday ... 6 = Sunday
  plan_id     uuid not null references wo_plans(id) on delete cascade,
  sort_order  int  not null default 0
);

do $$
declare t text;
begin
  foreach t in array array['wo_blocks','wo_block_slots'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "personal app access" on %I', t);
    execute format('create policy "personal app access" on %I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to anon, authenticated', t);
  end loop;
end $$;

-- Convert each workout's days into one starting block (only if no blocks exist yet).
do $$
declare b uuid;
begin
  if exists (select 1 from wo_blocks) then
    return;
  end if;
  if not exists (select 1 from wo_plans where coalesce(array_length(days, 1), 0) > 0) then
    return;
  end if;

  insert into wo_blocks (name, start_date, end_date)
  select 'Current block', min(start_date), null
  from wo_plans
  where coalesce(array_length(days, 1), 0) > 0 and (end_date is null or end_date >= current_date)
  returning id into b;

  if b is null then
    return;
  end if;

  insert into wo_block_slots (block_id, day, plan_id, sort_order)
  select b, d.day, p.id, p.sort_order
  from wo_plans p
  cross join lateral unnest(p.days) as d(day)
  where (p.end_date is null or p.end_date >= current_date);
end $$;
