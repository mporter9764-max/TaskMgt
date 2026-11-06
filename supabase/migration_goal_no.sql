-- ============================================================================
-- TaskMgt: explicit "no" for goals
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Existing check-ins stay as "done". Nothing is deleted.
-- ============================================================================

alter table goal_logs
  add column if not exists status text not null default 'done';

alter table goal_logs drop constraint if exists goal_logs_status_check;
alter table goal_logs
  add constraint goal_logs_status_check check (status in ('done', 'missed'));
