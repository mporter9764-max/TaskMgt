-- ============================================================================
-- Migration: note snippet completions
-- ----------------------------------------------------------------------------
-- Safe and additive. Run once in Supabase → SQL Editor → New query → Run.
-- Lets you mark a tagged line in the Tagged Items panel as "done" without
-- editing your note's text. Nothing existing is touched.
-- ============================================================================

create table if not exists note_snippet_completions (
  id             uuid primary key default gen_random_uuid(),
  note_id        uuid not null references notes(id) on delete cascade,
  tag            text not null,
  snippet_hash   text not null,
  completed_at   timestamptz not null default now(),
  unique (note_id, tag, snippet_hash)
);

create index if not exists idx_note_snippet_note on note_snippet_completions(note_id);

alter table note_snippet_completions enable row level security;

drop policy if exists "public all" on note_snippet_completions;
create policy "public all" on note_snippet_completions
  for all to anon, authenticated using (true) with check (true);

-- Done.
