"use client";

import { useMemo } from "react";
import type { Group, Task } from "@/lib/types";
import { todayStr, addDays, daysBetween, relativeLabel } from "@/lib/dates";
import { TaskCard, Trigger } from "./TaskCard";
import { EmptyState } from "./ui";

type Counts = Record<string, { done: number; total: number }>;
type Row = { task: Task; trigger: Trigger; sortDate: string; overdue: boolean };

export function UpcomingView({
  tasks,
  groupsById,
  checklistCounts,
  windowDays,
  onChangeWindow,
  onEdit,
  onToggleComplete,
}: {
  tasks: Task[]; // incomplete only
  groupsById: Map<string, Group>;
  checklistCounts: Counts;
  windowDays: number;
  onChangeWindow: (n: number) => void;
  onEdit: (t: Task) => void;
  onToggleComplete: (t: Task) => void;
}) {
  const today = todayStr();
  const windowEnd = addDays(today, windowDays);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const t of tasks) {
      const start = t.start_date;
      const rem = t.reminder_date;

      const startPast = daysBetween(today, start) < 0;
      const remPast = rem ? daysBetween(today, rem) < 0 : false;
      const startInWindow = daysBetween(today, start) >= 0 && daysBetween(start, windowEnd) >= 0;
      const remInWindow = rem ? daysBetween(today, rem) >= 0 && daysBetween(rem, windowEnd) >= 0 : false;

      if (startPast || remPast) {
        // Overdue: pin regardless of window. Use the earliest past date.
        const dates = [startPast ? start : null, remPast ? rem : null].filter(Boolean) as string[];
        const earliest = dates.sort((a, b) => daysBetween(b, a))[0];
        const kind = remPast && (!startPast || (rem && daysBetween(rem, start) > 0)) ? "reminder" : "start";
        out.push({ task: t, trigger: { kind: "overdue", date: earliest }, sortDate: earliest, overdue: true });
        continue;
      }

      if (startInWindow || remInWindow) {
        // Pick whichever date lands first inside the window.
        let kind: Trigger["kind"] = "start";
        let date = start;
        if (startInWindow && remInWindow) {
          if (daysBetween(start, rem as string) < 0) {
            kind = "reminder";
            date = rem as string;
          }
        } else if (remInWindow) {
          kind = "reminder";
          date = rem as string;
        }
        out.push({ task: t, trigger: { kind, date }, sortDate: date, overdue: false });
      }
    }
    // Overdue first (most overdue first), then upcoming soonest first.
    out.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return daysBetween(b.sortDate, a.sortDate);
    });
    return out;
  }, [tasks, today, windowEnd]);

  const overdue = rows.filter((r) => r.overdue);
  const upcoming = rows.filter((r) => !r.overdue);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <WindowControl value={windowDays} onChange={onChangeWindow} />

      {rows.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="Nothing coming up"
            hint={`No tasks start or have a reminder in the next ${windowDays} days.`}
          />
        </div>
      )}

      {overdue.length > 0 && (
        <Section label="Overdue" count={overdue.length}>
          {overdue.map((r) => (
            <div key={r.task.id}>
              <TaskCard
                task={r.task}
                group={groupsById.get(r.task.group_id)}
                checklist={checklistCounts[r.task.id]}
                trigger={r.trigger}
                onEdit={onEdit}
                onToggleComplete={onToggleComplete}
              />
            </div>
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section label={`Next ${windowDays} days`} count={upcoming.length}>
          {upcoming.map((r) => (
            <div key={r.task.id}>
              <div className="mb-1 pl-1 text-xs text-faint">{relativeLabel(r.sortDate)}</div>
              <TaskCard
                task={r.task}
                group={groupsById.get(r.task.group_id)}
                checklist={checklistCounts[r.task.id]}
                trigger={r.trigger}
                onEdit={onEdit}
                onToggleComplete={onToggleComplete}
              />
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</h3>
        <span className="text-xs text-faint">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function WindowControl({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const presets = [7, 14, 30];
  return (
    <div className="rounded-xl2 border border-line bg-surface p-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">Show tasks starting or due in the next</span>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-line">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => onChange(p)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  value === p ? "bg-accent text-white" : "text-muted hover:bg-black/[0.04]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            max={365}
            value={value}
            onChange={(e) => {
              const n = Math.max(1, Math.min(365, Number(e.target.value) || 1));
              onChange(n);
            }}
            className="w-16 rounded-lg border border-line px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <span className="text-sm text-muted">days</span>
        </div>
      </div>
    </div>
  );
}
