"use client";

import type { Group, Task } from "@/lib/types";
import { monthDay, isPast } from "@/lib/dates";
import { tint, deepen } from "@/lib/colors";
import { Bell, Check, ListChecks, ArrowRight } from "./icons";

export type Trigger = { kind: "start" | "reminder" | "overdue"; date: string };

export function TaskCard({
  task,
  group,
  checklist,
  onEdit,
  onToggleComplete,
  trigger,
}: {
  task: Task;
  group?: Group;
  checklist?: { done: number; total: number };
  onEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  trigger?: Trigger;
}) {
  const color = group?.color ?? "#E7E9EE";
  const multiDay = Boolean(task.end_date && task.end_date !== task.start_date);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(task)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onEdit(task))}
      className="group flex cursor-pointer items-start gap-3 rounded-xl2 border border-line bg-surface p-3 shadow-card transition-colors hover:border-faint"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      {/* Complete toggle */}
      <button
        aria-label={task.is_complete ? "Mark incomplete" : "Mark complete"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete(task);
        }}
        className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border transition-colors ${
          task.is_complete
            ? "border-accent bg-accent text-white"
            : "border-faint bg-surface text-transparent hover:border-accent"
        }`}
      >
        <Check width={12} height={12} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 flex-none rounded-full"
            style={{ backgroundColor: deepen(color) }}
          />
          <span className="truncate text-xs font-medium text-muted">{group?.name}</span>
          {trigger && <TriggerBadge trigger={trigger} />}
        </div>

        <p className={`mt-0.5 text-sm font-medium ${task.is_complete ? "text-faint line-through" : "text-ink"}`}>
          {task.title}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            {monthDay(task.start_date)}
            {multiDay && (
              <>
                <ArrowRight width={12} height={12} className="text-faint" />
                {monthDay(task.end_date as string)}
              </>
            )}
          </span>

          {task.reminder_date && (
            <span
              className="inline-flex items-center gap-1"
              style={{ color: isPast(task.reminder_date) && !task.is_complete ? "#dc2626" : undefined }}
            >
              <Bell width={12} height={12} />
              {monthDay(task.reminder_date)}
            </span>
          )}

          {checklist && checklist.total > 0 && (
            <span
              className="inline-flex items-center gap-1"
              style={{
                color: checklist.done === checklist.total ? deepen(color) : undefined,
              }}
            >
              <ListChecks width={12} height={12} />
              {checklist.done}/{checklist.total}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TriggerBadge({ trigger }: { trigger: Trigger }) {
  const map = {
    start: { label: "Starts", cls: "bg-black/[0.05] text-muted" },
    reminder: { label: "Reminder", cls: "bg-amber-100 text-amber-800" },
    overdue: { label: "Overdue", cls: "bg-red-100 text-red-700" },
  } as const;
  const t = map[trigger.kind];
  return (
    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${t.cls}`}>
      {t.label}
    </span>
  );
}
