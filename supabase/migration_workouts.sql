-- ============================================================================
-- TaskMgt: Workouts tab
-- Run once in Supabase: SQL Editor > New query > paste everything > Run.
-- Additive only. Seeds your exercises and plans from the spreadsheet
-- (seeding is skipped if exercises already exist).
-- ============================================================================

create extension if not exists pgcrypto;

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
