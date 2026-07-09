"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Group, Task, DisplayTask, ChecklistItem, Settings, OccurrenceCompletion, Note, NoteTag, NoteSnippetCompletion } from "@/lib/types";
import { isConfigured } from "@/lib/supabase";
import {
  fetchGroups,
  fetchTasks,
  fetchSettings,
  fetchAllChecklistItems,
  fetchOccurrenceCompletions,
  setTaskComplete,
  completeOccurrence,
  uncompleteOccurrence,
  updateWindowDays,
  fetchNotes,
  fetchNoteTags,
  fetchNoteSnippetCompletions,
  completeSnippet,
  uncompleteSnippet,
} from "@/lib/api";
import { expandTasks } from "@/lib/recurrence";
import { todayStr } from "@/lib/dates";
import { deepen } from "@/lib/colors";
import { AgendaView } from "./AgendaView";
import { SwimlaneView } from "./SwimlaneView";
import { UpcomingView } from "./UpcomingView";
import { CompletedView } from "./CompletedView";
import { NotesView } from "./NotesView";
import { NoteEditor } from "./NoteEditor";
import { NoteTagManager } from "./NoteTagManager";
import { TaskEditor } from "./TaskEditor";
import { GroupManager } from "./GroupManager";
import { Button, IconButton } from "./ui";
import { Plus, Cog, Target } from "./icons";

type Tab = "timeline" | "upcoming" | "completed" | "notes";

function useIsDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setD(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return d;
}

export default function AppShell() {
  const isDesktop = useIsDesktop();

  const [groups, setGroups] = useState<Group[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [completions, setCompletions] = useState<OccurrenceCompletion[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteTags, setNoteTags] = useState<NoteTag[]>([]);
  const [snippetCompletions, setSnippetCompletions] = useState<NoteSnippetCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("timeline");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [newTaskGroupId, setNewTaskGroupId] = useState<string | undefined>(undefined);
  const [newTaskTitle, setNewTaskTitle] = useState<string | undefined>(undefined);
  const [groupMgrOpen, setGroupMgrOpen] = useState(false);
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());

  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [editorNote, setEditorNote] = useState<Note | null>(null);
  const [noteTagMgrOpen, setNoteTagMgrOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [g, t, s, c, oc, n, nt, sc] = await Promise.all([
        fetchGroups(),
        fetchTasks(),
        fetchSettings(),
        fetchAllChecklistItems(),
        fetchOccurrenceCompletions(),
        fetchNotes(),
        fetchNoteTags(),
        fetchNoteSnippetCompletions(),
      ]);
      setGroups(g);
      setTasks(t);
      setSettings(s);
      setChecklistItems(c);
      setCompletions(oc);
      setNotes(n);
      setNoteTags(nt);
      setSnippetCompletions(sc);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load your data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConfigured) reload();
    else setLoading(false);
  }, [reload]);

  const groupsById = useMemo(() => {
    const m = new Map<string, Group>();
    groups.forEach((g) => m.set(g.id, g));
    return m;
  }, [groups]);

  const checklistCounts = useMemo(() => {
    const m: Record<string, { done: number; total: number }> = {};
    for (const it of checklistItems) {
      const c = m[it.task_id] ?? { done: 0, total: 0 };
      c.total++;
      if (it.is_checked) c.done++;
      m[it.task_id] = c;
    }
    return m;
  }, [checklistItems]);

  const taskCountByGroup = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) m[t.group_id] = (m[t.group_id] ?? 0) + 1;
    return m;
  }, [tasks]);

  // Expand recurring templates into concrete occurrences; non-recurring pass through.
  const today = todayStr();
  const expanded = useMemo(
    () => expandTasks(tasks, completions, today),
    [tasks, completions, today]
  );

  // Checklist counts are keyed by real task id; map occurrences back to their template's counts.
  const displayChecklistCounts = useMemo(() => {
    const m: Record<string, { done: number; total: number }> = { ...checklistCounts };
    for (const dt of expanded) {
      if (dt.recurring && dt.templateId && checklistCounts[dt.templateId]) {
        m[dt.id] = checklistCounts[dt.templateId];
      }
    }
    return m;
  }, [expanded, checklistCounts]);

  const activeTasks = useMemo(() => expanded.filter((t) => !t.is_complete), [expanded]);
  const completedTasks = useMemo(() => expanded.filter((t) => t.is_complete), [expanded]);
  const timelineTasks = useMemo(
    () => activeTasks.filter((t) => !hiddenGroups.has(t.group_id)),
    [activeTasks, hiddenGroups]
  );

  const openNew = (groupId?: string, title?: string) => {
    setEditorTask(null);
    setNewTaskGroupId(groupId);
    setNewTaskTitle(title);
    setEditorOpen(true);
  };
  const openEdit = (t: DisplayTask) => {
    // Editing an occurrence edits its underlying series.
    const real = t.recurring && t.templateId ? tasks.find((x) => x.id === t.templateId) ?? null : (t as Task);
    setEditorTask(real);
    setEditorOpen(true);
  };
  const toggleComplete = async (t: DisplayTask) => {
    if (t.recurring && t.templateId && t.occDate) {
      const nowComplete = !t.is_complete;
      // optimistic: adjust completions locally
      setCompletions((prev) =>
        nowComplete
          ? [...prev, { id: `tmp-${t.templateId}-${t.occDate}`, task_id: t.templateId!, occurrence_date: t.occDate!, completed_at: new Date().toISOString() }]
          : prev.filter((c) => !(c.task_id === t.templateId && c.occurrence_date === t.occDate))
      );
      try {
        if (nowComplete) await completeOccurrence(t.templateId, t.occDate);
        else await uncompleteOccurrence(t.templateId, t.occDate);
        reload();
      } catch {
        reload();
      }
      return;
    }
    // Non-recurring: flip the task's own flag.
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_complete: !x.is_complete } : x)));
    try {
      await setTaskComplete(t.id, !t.is_complete);
      reload();
    } catch {
      reload();
    }
  };
  const changeWindow = async (n: number) => {
    setSettings((s) => (s ? { ...s, upcoming_window_days: n } : s));
    try {
      await updateWindowDays(n);
    } catch {
      /* keep local value; will resync on reload */
    }
  };
  const goToday = () => {
    document.getElementById("today-anchor")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  };

  const openNewNote = () => {
    setEditorNote(null);
    setNoteEditorOpen(true);
  };
  const openEditNote = (n: Note) => {
    setEditorNote(n);
    setNoteEditorOpen(true);
  };
  const sendSnippetToTask = (title: string) => {
    openNew(undefined, title);
  };
  const markSnippetDone = async (noteId: string, tag: string, hash: string) => {
    setSnippetCompletions((prev) => [
      ...prev,
      { id: `tmp-${noteId}-${tag}-${hash}`, note_id: noteId, tag, snippet_hash: hash, completed_at: new Date().toISOString() },
    ]);
    try {
      await completeSnippet(noteId, tag, hash);
      reload();
    } catch {
      reload();
    }
  };
  const markSnippetNotDone = async (noteId: string, tag: string, hash: string) => {
    setSnippetCompletions((prev) =>
      prev.filter((c) => !(c.note_id === noteId && c.tag === tag && c.snippet_hash === hash))
    );
    try {
      await uncompleteSnippet(noteId, tag, hash);
      reload();
    } catch {
      reload();
    }
  };

  if (!isConfigured) return <SetupScreen />;

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex-none border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight">{tab === "notes" ? "Notes" : "Timeline"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {tab === "notes" ? (
              <IconButton label="Manage tags" onClick={() => setNoteTagMgrOpen(true)}>
                <Cog />
              </IconButton>
            ) : (
              <IconButton label="Manage groups" onClick={() => setGroupMgrOpen(true)}>
                <Cog />
              </IconButton>
            )}
            <Button
              size="sm"
              onClick={() => (tab === "notes" ? openNewNote() : openNew())}
              className="hidden sm:inline-flex"
            >
              <Plus width={16} height={16} />
              {tab === "notes" ? "New note" : "New task"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-5xl px-4">
          <nav className="flex gap-1 pb-1.5">
            {(["timeline", "upcoming", "completed", "notes"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  tab === t ? "bg-accent text-white" : "text-muted hover:bg-black/[0.04]"
                }`}
              >
                {t}
                {t === "completed" && completedTasks.length > 0 && (
                  <span className={`ml-1.5 text-xs ${tab === t ? "text-white/70" : "text-faint"}`}>
                    {completedTasks.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Body */}
      <main className="relative flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">Loading…</div>
        ) : error ? (
          <div className="mx-auto max-w-lg px-4 py-10 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <p className="mt-2 text-sm text-muted">
              Check that the schema ran and your .env.local values are correct, then reload.
            </p>
          </div>
        ) : tab === "timeline" ? (
          <div className="flex h-full flex-col">
            {/* Filter chips + Today */}
            <div className="flex-none border-b border-line bg-canvas/60 px-4 py-2">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5">
                {groups.map((g) => {
                  const hidden = hiddenGroups.has(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() =>
                        setHiddenGroups((prev) => {
                          const next = new Set(prev);
                          next.has(g.id) ? next.delete(g.id) : next.add(g.id);
                          return next;
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        hidden ? "border-line text-faint" : "border-transparent text-ink"
                      }`}
                      style={{ backgroundColor: hidden ? "transparent" : g.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: hidden ? "#C7CBD3" : deepen(g.color) }}
                      />
                      {g.name}
                    </button>
                  );
                })}
                <button
                  onClick={goToday}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted hover:text-ink"
                >
                  <Target width={13} height={13} />
                  Today
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {isDesktop ? (
                <SwimlaneView tasks={timelineTasks} groups={groups} onEdit={openEdit} onAddTask={openNew} />
              ) : (
                <div className="h-full overflow-y-auto">
                  <AgendaView
                    tasks={timelineTasks}
                    groupsById={groupsById}
                    checklistCounts={displayChecklistCounts}
                    onEdit={openEdit}
                    onToggleComplete={toggleComplete}
                  />
                </div>
              )}
            </div>
          </div>
        ) : tab === "upcoming" ? (
          <div className="h-full overflow-y-auto">
            <UpcomingView
              tasks={activeTasks}
              groupsById={groupsById}
              checklistCounts={displayChecklistCounts}
              windowDays={settings?.upcoming_window_days ?? 14}
              onChangeWindow={changeWindow}
              onEdit={openEdit}
              onToggleComplete={toggleComplete}
            />
          </div>
        ) : tab === "completed" ? (
          <div className="h-full overflow-y-auto">
            <CompletedView
              tasks={completedTasks}
              groupsById={groupsById}
              onToggleComplete={toggleComplete}
              onEdit={openEdit}
            />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <NotesView
              notes={notes}
              noteTags={noteTags}
              completions={snippetCompletions}
              onOpenNote={openEditNote}
              onManageTags={() => setNoteTagMgrOpen(true)}
              onSendToTask={sendSnippetToTask}
              onCompleteSnippet={markSnippetDone}
              onUncompleteSnippet={markSnippetNotDone}
            />
          </div>
        )}

        {/* Mobile FAB */}
        <button
          onClick={() => (tab === "notes" ? openNewNote() : openNew())}
          aria-label={tab === "notes" ? "New note" : "New task"}
          className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-pop transition-transform hover:scale-105 sm:hidden"
        >
          <Plus width={24} height={24} />
        </button>
      </main>

      <TaskEditor
        open={editorOpen}
        task={editorTask}
        groups={groups}
        defaultGroupId={newTaskGroupId}
        defaultTitle={newTaskTitle}
        onClose={() => setEditorOpen(false)}
        onSaved={reload}
      />
      <GroupManager
        open={groupMgrOpen}
        groups={groups}
        taskCountByGroup={taskCountByGroup}
        onClose={() => setGroupMgrOpen(false)}
        onChanged={reload}
      />
      <NoteEditor
        open={noteEditorOpen}
        note={editorNote}
        noteTags={noteTags}
        onClose={() => setNoteEditorOpen(false)}
        onSaved={reload}
      />
      <NoteTagManager
        open={noteTagMgrOpen}
        tags={noteTags}
        onClose={() => setNoteTagMgrOpen(false)}
        onChanged={reload}
      />
    </div>
  );
}

function SetupScreen() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-lg font-semibold">Almost there</h1>
      <p className="mt-2 text-sm text-muted">
        Add your Supabase keys to connect the app. Create a file named{" "}
        <code className="rounded bg-black/[0.06] px-1">.env.local</code> in the project root with:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface p-3 text-xs text-ink">
{`NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY`}
      </pre>
      <p className="mt-3 text-sm text-muted">
        Find both in your Supabase dashboard under Project Settings → API. Restart the dev server after saving.
      </p>
    </div>
  );
}
