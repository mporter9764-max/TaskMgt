-- ============================================================================
-- Migration: recurring tasks
-- ----------------------------------------------------------------------------
-- Safe and additive. Run once in Supabase → SQL Editor → New query → Run.
-- Adds a `recurrence` column to tasks (defaults to 'none', so every existing
-- task is unaffected) and a small table to track per-occurrence completion.
-- ============================================================================

-- 1. Recurrence rule on each task.
alter table tasks
  add column if not exists recurrence text not null default 'none';

-- Guardrail: only allow the known values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_recurrence_valid'
  ) then
    alter table tasks
      add constraint tasks_recurrence_valid
      check (recurrence in ('none','daily','weekly','monthly','yearly'));
  end if;
end $$;

-- 2. Per-occurrence completion for recurring tasks.
--    Completing one occurrence doesn't touch the others.
create table if not exists occurrence_completions (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references tasks(id) on delete cascade,
  occurrence_date  date not null,
  completed_at     timestamptz not null default now(),
  unique (task_id, occurrence_date)
);

create index if not exists idx_occ_task on occurrence_completions(task_id);

alter table occurrence_completions enable row level security;

drop policy if exists "public all" on occurrence_completions;
create policy "public all" on occurrence_completions
  for all to anon, authenticated using (true) with check (true);

-- Done.
