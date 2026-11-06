-- ============================================================================
-- TaskMgt: Energy (TDEE) tab
-- Run once in Supabase: SQL Editor > New query > paste > Run. Additive only.
-- ============================================================================

create table if not exists energy_logs (
  log_date    date primary key,
  steps       int  not null default 0 check (steps >= 0),
  lifted      boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table energy_logs enable row level security;
alter table app_settings enable row level security;
drop policy if exists "personal app access" on energy_logs;
drop policy if exists "personal app access" on app_settings;
create policy "personal app access" on energy_logs for all to anon, authenticated using (true) with check (true);
create policy "personal app access" on app_settings for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on energy_logs to anon, authenticated;
grant select, insert, update, delete on app_settings to anon, authenticated;
