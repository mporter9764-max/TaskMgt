-- ============================================================================
-- Migration: notes + tags
-- ----------------------------------------------------------------------------
-- Safe and additive. Run once in Supabase → SQL Editor → New query → Run.
-- Adds two new tables; nothing existing is touched.
-- ============================================================================

create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists notes_set_updated_at on notes;
create trigger notes_set_updated_at
  before update on notes
  for each row execute function set_updated_at();

create table if not exists note_tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,   -- lowercase, no leading '#'
  color       text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notes_updated on notes(updated_at desc);

alter table notes      enable row level security;
alter table note_tags  enable row level security;

drop policy if exists "public all" on notes;
create policy "public all" on notes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public all" on note_tags;
create policy "public all" on note_tags
  for all to anon, authenticated using (true) with check (true);

-- Done.
