-- ============================================================================
-- TaskMgt: workout Blocks
-- Run once in Supabase: SQL Editor > New query > paste everything > Run.
--
-- Workouts become templates (exercises only). A block holds the dates and the
-- weekly layout. Your current workouts' days are converted into a first block,
-- so your schedule stays exactly as it is. Logged workouts are untouched.
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
