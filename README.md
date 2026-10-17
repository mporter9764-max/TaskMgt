# TaskMgt v2

Tasks with a timeline, notes with tagging, and a goal tracker. Next.js + Supabase + Vercel.

## Setup (one time)

1. **Supabase:** open your TaskMgt project, go to SQL Editor, New query, paste all of `supabase/schema.sql`, click Run.
   It creates every table plus starter groups, tags, roles and a few goals (edit or delete them in the app).
2. **GitHub:** create a repo (e.g. `TaskMgt`) and drag in the folders `app`, `components`, `lib`, `public`, `supabase`
   and the loose files at the root (`package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`,
   `postcss.config.js`, `next-env.d.ts`, `.gitignore`, `README.md`).
3. **Vercel:** Add New, Project, import the repo, add two environment variables, Deploy:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<your-project-id>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon (or publishable) key from Supabase, Project Settings, API Keys
4. **Phone:** open the Vercel URL in Chrome, menu, **Add to Home screen**. It then opens full-screen like an app.

## Using it

**Goals (opens here by default)**
- *Check-in:* one tap checks a goal off for the day; tap again to undo. Arrows go back up to 30 days to backfill.
- Weekly goals show dots for Mon to Sun and "3/5 this week"; streaks count days, weeks or months.
- The arrow on a row opens details: streaks, hit rate, a tappable calendar, recent periods and a weekday pattern.
- *Trends:* daily heatmap, consistency over time, weakest day of the week, and a goals-by-week grid. Filter by role or subgroup.
- *Manage:* roles, optional subgroups (Health > Sleep), goals, colors and order. Archive keeps history; delete removes it.

How scoring works: every goal is yes/no per day. "Every day" goals are judged daily; "N per week" goals Monday to Sunday;
"N per month" by calendar month. A period is a hit once you reach the target. The first period after a goal starts (or a
target change) is prorated. Changing a target starts a new version from today, so past periods keep their old target.

**Tasks**
- *List* shows overdue, today and upcoming by date. *Timeline* shows swim lanes by group.
- On the timeline, drag a bar to move it and drag its ends to resize. On a phone or tablet, press and hold a bar first.
  Repeating tasks are rescheduled in the editor instead.
- Group chips filter: the first tap focuses one group, further taps add or remove groups.

**Notes**
- `#tag` on a line tags that whole line. Select text and tap a tag to tag just that phrase.
- Starred tags (Manage tags, star) appear in each note's Recap at the bottom, newest first, with check-off.
- *Tagged items* gathers every tagged line across notes, filterable to one note. "Task" turns an item into a task.
