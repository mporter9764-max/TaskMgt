# Timeline — lightweight task & timeline app

A small, personal task manager with a real timeline (not a Gantt chart). Tasks
live under colored groups, carry a checklist and notes, have start/end dates and
an independent reminder date, and show up in three views:

- **Timeline** — a vertical agenda on your phone, a horizontal swim-lane board on
  desktop. Every calendar day is shown; multi-day tasks appear on their start day
  with a faint "ongoing" marker on the days between.
- **Upcoming** — everything starting or due within a window you control (default
  14 days), with anything overdue pinned on top.
- **Completed** — finished tasks, kept and restorable rather than deleted.

Stack: Next.js 14 (App Router) · Supabase (Postgres) · Tailwind · TypeScript.
No login — it's a single shared board protected only by the URL and your anon key.

---

## Setup (about 10 minutes)

### 1. Create the database

1. In your Supabase project, open **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. In **Table Editor** you should now see `groups`, `tasks`, `checklist_items`,
   and `settings`, plus four starter pastel groups.

### 2. Configure the app

1. Copy the example env file:
   ```bash
   cp .env.local.example .env.local
   ```
2. Fill in your values (Supabase dashboard → **Project Settings → API**):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```

### 3. Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. If you see the "Almost there" screen, the env file
isn't loaded yet — double-check `.env.local` and restart the dev server.

### 4. Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. In Vercel, **Add New → Project**, import the repo.
3. Under **Environment Variables**, add the same two `NEXT_PUBLIC_…` values.
4. Deploy. Share the resulting URL with whoever should see the board (e.g. Whitney).

---

## How things work

- **Dates are day-level only.** No times anywhere — a task is on a day, not at a
  time. This is enforced in the database (`date` columns, not timestamps).
- **Completing a task** hides it from Timeline and Upcoming and moves it to
  Completed. `completed_at` is set automatically by a database trigger; restoring
  clears it.
- **Reminders** are separate from start/end and only surface in the Upcoming tab.
  They do **not** send email or push notifications — that would be a later phase
  (it needs a scheduled job + an email/push service).
- **Groups** carry the only color in the app. Deleting a group is blocked while it
  still has tasks, so you can't wipe tasks by accident — move or delete them first.

## Project layout

```
app/            Next.js routes, layout, global styles
components/      UI: timeline views, editor, group manager, cards
lib/            Supabase client, types, date + color helpers, data access
supabase/       schema.sql (run this once in Supabase)
```

## Notes & later phases

- Real reminder notifications (email/push) — deferred; needs a cron trigger.
- Optional login / private boards — currently intentionally open by URL.
- Because the board is shared by link with the anon key, don't store anything
  sensitive here.
