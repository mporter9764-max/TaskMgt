"use client";

import { useCallback, useEffect, useState } from "react";
import { isConfigured } from "@/lib/supabase";
import { useTasksStore } from "@/lib/useTasksStore";
import { useNotesStore } from "@/lib/useNotesStore";
import { useGoalsStore } from "@/lib/useGoalsStore";
import type { Task } from "@/lib/types";
import { TasksView } from "./tasks/TasksView";
import { TaskEditor, closedEditor, type TaskEditorState } from "./tasks/TaskEditor";
import { NotesView } from "./notes/NotesView";
import { GoalsView } from "./goals/GoalsView";
import { Button, Toaster, cx } from "./ui";
import { NoteIcon, Plus, TargetIcon, TaskIcon } from "./icons";

type Tab = "goals" | "tasks" | "notes";

const TABS: Array<{ id: Tab; label: string; Icon: typeof TaskIcon }> = [
  { id: "goals", label: "Goals", Icon: TargetIcon },
  { id: "tasks", label: "Tasks", Icon: TaskIcon },
  { id: "notes", label: "Notes", Icon: NoteIcon },
];

export function AppShell() {
  const [tab, setTab] = useState<Tab>("goals");
  const [editor, setEditor] = useState<TaskEditorState>(closedEditor);
  const tasks = useTasksStore(isConfigured);
  const notes = useNotesStore(isConfigured);
  const goals = useGoalsStore(isConfigured);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("taskmgt.tab") as Tab | null;
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function choose(t: Tab) {
    setTab(t);
    try {
      localStorage.setItem("taskmgt.tab", t);
    } catch {
      /* ignore */
    }
    window.scrollTo({ top: 0 });
  }

  const openTask = useCallback((task: Task, occDate: string | null) => setEditor({ open: true, task, occDate }), []);
  const newTask = useCallback(() => setEditor({ open: true, task: null, occDate: null }), []);
  const newTaskInGroup = useCallback(
    (groupId: string | null) => setEditor({ open: true, task: null, occDate: null, prefill: { group_id: groupId } }),
    []
  );
  const sendToTask = useCallback((title: string) => setEditor({ open: true, task: null, occDate: null, prefill: { title } }), []);

  if (!isConfigured) return <SetupScreen />;

  const error = tasks.error || notes.error || goals.error;
  const loading = tasks.loading || notes.loading || goals.loading;
  if (error) {
    return (
      <ConnectionError
        message={error}
        onRetry={() => {
          tasks.reload();
          notes.reload();
          goals.reload();
        }}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 w-full items-center gap-3 px-4 lg:px-6">
          <span className="text-[17px] font-semibold tracking-tight text-ink">TaskMgt</span>
          <nav className="ml-6 hidden gap-1 sm:flex">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                className={cx(
                  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  tab === id ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
                )}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
          {loading && <span className="ml-auto text-xs text-faint">Loading…</span>}
        </div>
      </header>

      <main className={cx("w-full flex-1 px-4 pt-4 lg:px-6", tab === "tasks" && "flex min-h-0 flex-col")}>
        <div className={tab === "goals" ? "" : "hidden"}>
          <GoalsView store={goals} />
        </div>
        <div className={tab === "tasks" ? "flex h-[calc(100dvh-56px-16px-env(safe-area-inset-top)-72px-env(safe-area-inset-bottom))] min-h-[420px] flex-col sm:h-[calc(100dvh-56px-32px)]" : "hidden"}>
          <TasksView store={tasks} active={tab === "tasks"} onOpenTask={openTask} onNewTask={newTask} onNewTaskInGroup={newTaskInGroup} />
        </div>
        <div className={tab === "notes" ? "" : "hidden"}>
          <NotesView store={notes} onSendToTask={sendToTask} />
        </div>
      </main>

      {/* floating add for tasks on phones */}
      {tab === "tasks" && (
        <button
          type="button"
          aria-label="New task"
          onClick={newTask}
          className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-pop sm:hidden"
        >
          <Plus size={24} />
        </button>
      )}

      {/* bottom tab bar on phones */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="grid grid-cols-3">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => choose(id)}
              className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", tab === id ? "text-accent" : "text-faint")}
            >
              <Icon size={22} strokeWidth={tab === id ? 2.2 : 1.8} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <TaskEditor state={editor} onClose={() => setEditor(closedEditor)} store={tasks} />
      <Toaster />
    </div>
  );
}

function SetupScreen() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-xl font-semibold text-ink">Almost there</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        TaskMgt can&apos;t find its Supabase settings. In Vercel, open this project, go to Settings, then Environment Variables, and add:
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="rounded-lg bg-surface px-3 py-2 font-mono text-[13px] text-ink">NEXT_PUBLIC_SUPABASE_URL</li>
        <li className="rounded-lg bg-surface px-3 py-2 font-mono text-[13px] text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-muted">Then redeploy (Deployments, the latest one, the ⋯ menu, Redeploy). Variables only take effect on a fresh build.</p>
    </div>
  );
}

function ConnectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const missingTable = /relation|does not exist|schema cache|Could not find the table/i.test(message);
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-xl font-semibold text-ink">Can&apos;t reach the database</h1>
      <p className="mt-2 rounded-lg bg-surface px-3 py-2 font-mono text-[12px] text-muted">{message}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
        {missingTable ? (
          <li>
            The tables don&apos;t exist yet. In Supabase, open the SQL Editor, paste the contents of <span className="font-mono">supabase/schema.sql</span>, and Run.
          </li>
        ) : (
          <>
            <li>
              Check the Supabase dashboard. Free projects pause after a stretch of inactivity; if you see a <b>Paused</b> banner, click Restore and wait a minute.
            </li>
            <li>Confirm the two environment variables in Vercel point at the TaskMgt project.</li>
          </>
        )}
      </ul>
      <Button variant="primary" className="mt-6" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
