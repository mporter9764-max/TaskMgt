"use client";

import { useEffect, useState } from "react";
import type { Recurrence, Task } from "@/lib/types";
import type { TasksStore } from "@/lib/useTasksStore";
import { fmtShort, todayStr } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import { Button, Checkbox, Field, Select, Sheet, TextArea, TextInput, cx } from "../ui";
import { Trash } from "../icons";

export interface TaskEditorState {
  open: boolean;
  task: Task | null;
  /** start date of the specific occurrence opened, for recurring tasks */
  occDate: string | null;
  prefill?: { title?: string; group_id?: string | null; start_date?: string | null };
}

export const closedEditor: TaskEditorState = { open: false, task: null, occDate: null };

export function TaskEditor({
  state,
  onClose,
  store,
}: {
  state: TaskEditorState;
  onClose: () => void;
  store: TasksStore;
}) {
  const { task, occDate, prefill } = state;
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [every, setEvery] = useState(1);
  const [until, setUntil] = useState("");
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    if (task) {
      setTitle(task.title);
      setDetails(task.details);
      setGroupId(task.group_id);
      setStart(task.start_date ?? "");
      setEnd(task.end_date ?? "");
      setRecurrence(task.recurrence);
      setEvery(task.recurrence_interval || 1);
      setUntil(task.recurrence_until ?? "");
      setCompleted(task.completed);
    } else {
      setTitle(prefill?.title ?? "");
      setDetails("");
      setGroupId(prefill?.group_id ?? null);
      setStart(prefill?.start_date ?? todayStr());
      setEnd("");
      setRecurrence("none");
      setEvery(1);
      setUntil("");
      setCompleted(false);
    }
  }, [state.open, task, prefill]);

  const occDone = task && occDate ? store.occDone.has(`${task.id}:${occDate}`) : false;
  const canRepeat = Boolean(start || end);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const rec: Recurrence = canRepeat ? recurrence : "none";
    const saved = await store.saveTask({
      id: task?.id,
      title: title.trim(),
      details,
      group_id: groupId,
      start_date: start || null,
      end_date: end || null,
      completed: rec === "none" ? completed : false,
      completed_at: rec === "none" && completed ? task?.completed_at ?? new Date().toISOString() : null,
      recurrence: rec,
      recurrence_interval: Math.max(1, every),
      recurrence_until: rec !== "none" && until ? until : null,
    });
    setSaving(false);
    if (saved) onClose();
  }

  async function remove() {
    if (!task) return;
    if (!window.confirm(`Delete "${task.title}"${task.recurrence !== "none" ? " and every repeat of it" : ""}?`)) return;
    await store.deleteTask(task.id);
    onClose();
  }

  return (
    <Sheet
      open={state.open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      footer={
        <>
          {task && (
            <Button variant="danger" onClick={remove}>
              <Trash size={16} /> Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!title.trim() || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput
          autoFocus={!task}
          placeholder="What needs doing?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          className="h-11 text-base font-medium"
        />

        {task && occDate && task.recurrence !== "none" && (
          <div className="flex items-center gap-3 rounded-lg bg-sunken px-3 py-2.5">
            <Checkbox checked={occDone} onChange={() => store.toggleOccurrence(task.id, occDate)} label="Mark this occurrence done" />
            <span className="text-sm text-ink">
              Done for <span className="font-medium">{fmtShort(occDate)}</span>
            </span>
          </div>
        )}

        <Field label="Group">
          <div className="flex flex-wrap gap-2">
            <GroupPill active={groupId === null} onClick={() => setGroupId(null)} color="#e4e2dc">
              None
            </GroupPill>
            {store.groups.map((g) => (
              <GroupPill key={g.id} active={groupId === g.id} onClick={() => setGroupId(g.id)} color={g.color}>
                {g.name}
              </GroupPill>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End (optional)">
            <TextInput type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        {(start || end) && (
          <button
            type="button"
            className="-mt-2 text-xs text-faint underline-offset-2 hover:underline"
            onClick={() => {
              setStart("");
              setEnd("");
              setRecurrence("none");
            }}
          >
            Clear dates (keep as an undated task)
          </button>
        )}

        <Field label="Repeat" hint={canRepeat ? undefined : "Set a date to make a task repeat."}>
          <div className="flex gap-2">
            <Select
              value={canRepeat ? recurrence : "none"}
              disabled={!canRepeat}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              className="flex-1"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
            {canRepeat && recurrence !== "none" && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted">every</span>
                <TextInput
                  type="number"
                  min={1}
                  max={99}
                  value={every}
                  onChange={(e) => setEvery(Number(e.target.value) || 1)}
                  className="w-16 text-center"
                />
              </div>
            )}
          </div>
        </Field>
        {canRepeat && recurrence !== "none" && (
          <Field label="Repeat until (optional)" hint={describeRecurrence({ recurrence, recurrence_interval: every })}>
            <TextInput type="date" value={until} min={start || undefined} onChange={(e) => setUntil(e.target.value)} />
          </Field>
        )}

        <Field label="Details">
          <TextArea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Notes, links, context…" />
        </Field>

        {(!canRepeat || recurrence === "none") && task && (
          <label className="flex items-center gap-3">
            <Checkbox checked={completed} onChange={() => setCompleted((c) => !c)} label="Completed" />
            <span className="text-sm text-ink">Completed</span>
          </label>
        )}
      </div>
    </Sheet>
  );
}

function GroupPill({
  active,
  color,
  children,
  onClick,
}: {
  active: boolean;
  color: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
        active ? "border-ink text-ink" : "border-transparent text-muted"
      )}
      style={{ background: color }}
    >
      {children}
    </button>
  );
}
