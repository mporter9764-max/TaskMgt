"use client";

import { useEffect, useState } from "react";
import type { Group, Task, ChecklistDraft, Recurrence } from "@/lib/types";
import { todayStr } from "@/lib/dates";
import {
  createTask,
  updateTask,
  deleteTask,
  fetchChecklist,
  saveChecklist,
} from "@/lib/api";
import { Sheet, Button, Field, TextInput, TextArea, DateInput } from "./ui";
import { Plus, Trash, Check, X } from "./icons";

export function TaskEditor({
  open,
  task,
  groups,
  defaultGroupId,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: Task | null; // null => creating
  groups: Group[];
  defaultGroupId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(task);

  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Initialize when opened / task changes.
  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (task) {
      setTitle(task.title);
      setGroupId(task.group_id);
      setStartDate(task.start_date);
      setEndDate(task.end_date ?? "");
      setReminderDate(task.reminder_date ?? "");
      setRecurrence(task.recurrence ?? "none");
      setNotes(task.notes ?? "");
      fetchChecklist(task.id)
        .then((items) =>
          setChecklist(items.map((i) => ({ id: i.id, label: i.label, is_checked: i.is_checked })))
        )
        .catch(() => setChecklist([]));
    } else {
      setTitle("");
      setGroupId(defaultGroupId ?? groups[0]?.id ?? "");
      setStartDate(todayStr());
      setEndDate("");
      setReminderDate("");
      setRecurrence("none");
      setNotes("");
      setChecklist([]);
    }
    setNewItem("");
  }, [open, task, defaultGroupId, groups]);

  function addChecklistItem() {
    const label = newItem.trim();
    if (!label) return;
    setChecklist((c) => [...c, { label, is_checked: false }]);
    setNewItem("");
  }

  async function handleSave() {
    if (!title.trim()) return setErr("Give the task a title.");
    if (!groupId) return setErr("Pick a group.");
    if (endDate && endDate < startDate) return setErr("End date can't be before the start date.");

    setBusy(true);
    setErr(null);
    try {
      const draft = {
        group_id: groupId,
        title: title.trim(),
        notes: notes.trim() ? notes.trim() : null,
        start_date: startDate,
        end_date: endDate || null,
        reminder_date: reminderDate || null,
        recurrence,
      };
      const saved = task ? await updateTask(task.id, draft) : await createTask(draft);
      await saveChecklist(saved.id, checklist);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong saving.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!window.confirm("Delete this task permanently? This can't be undone.")) return;
    setBusy(true);
    try {
      await deleteTask(task.id);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't delete the task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit task" : "New task"}
      footer={
        <>
          {editing ? (
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={busy}>
              <Trash width={14} height={14} />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create task"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <TextInput
            value={title}
            autoFocus
            placeholder="What needs doing?"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </Field>

        <Field label="Group">
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {groups.length === 0 && <option value="">No groups yet</option>}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <DateInput value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End" hint="Leave blank for a single day">
            <DateInput value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>

        <Field label="Reminder" hint="Independent of start and end — used by the Upcoming tab">
          <DateInput value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
        </Field>

        <Field
          label="Repeats"
          hint={
            recurrence === "none"
              ? undefined
              : "Editing a repeating task changes every occurrence. Completing one only affects that day."
          }
        >
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </Field>

        <Field label="Checklist">
          <div className="space-y-1.5">
            {checklist.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  aria-label={item.is_checked ? "Uncheck" : "Check"}
                  onClick={() =>
                    setChecklist((c) =>
                      c.map((it, i) => (i === idx ? { ...it, is_checked: !it.is_checked } : it))
                    )
                  }
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded border transition-colors ${
                    item.is_checked ? "border-accent bg-accent text-white" : "border-faint text-transparent hover:border-accent"
                  }`}
                >
                  <Check width={12} height={12} />
                </button>
                <input
                  value={item.label}
                  onChange={(e) =>
                    setChecklist((c) => c.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)))
                  }
                  className={`flex-1 rounded-md border border-transparent px-2 py-1 text-sm focus:border-line focus:outline-none ${
                    item.is_checked ? "text-faint line-through" : "text-ink"
                  }`}
                />
                <button
                  aria-label="Remove item"
                  onClick={() => setChecklist((c) => c.filter((_, i) => i !== idx))}
                  className="flex h-6 w-6 flex-none items-center justify-center rounded text-faint hover:bg-black/[0.05] hover:text-ink"
                >
                  <X width={14} height={14} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <TextInput
                value={newItem}
                placeholder="Add a checklist item"
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
              />
              <Button variant="ghost" size="sm" onClick={addChecklistItem}>
                <Plus width={14} height={14} />
                Add
              </Button>
            </div>
          </div>
        </Field>

        <Field label="Notes">
          <TextArea value={notes} placeholder="Anything else worth keeping with this task…" onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      </div>
    </Sheet>
  );
}
