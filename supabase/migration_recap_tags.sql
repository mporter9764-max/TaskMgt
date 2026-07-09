-- ============================================================================
-- Migration: recap tags
-- ----------------------------------------------------------------------------
-- Safe and additive. Run once in Supabase → SQL Editor → New query → Run.
-- Adds one column; every existing tag defaults to false (no behavior change
-- until you flip a tag on in Manage Tags).
-- ============================================================================

alter table note_tags
  add column if not exists show_in_recap boolean not null default false;

-- Done.
