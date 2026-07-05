"use client";

import { useMemo } from "react";
import type { Group, Task } from "@/lib/types";
import {
  eachDay,
  todayStr,
  addDays,
  daysBetween,
  weekday,
  monthDay,
  monthShort,
  isToday,
  isWeekend,
} from "@/lib/dates";
import { tint, deepen } from "@/lib/colors";
import { TaskCard } from "./TaskCard";

type Counts = Record<string, { done: number; total: number }>;

export function AgendaView({
  tasks,
  groupsById,
  checklistCounts,
  onEdit,
  onToggleComplete,
}: {
  tasks: Task[];
  groupsById: Map<string, Group>;
  checklistCounts: Counts;
  onEdit: (t: Task) => void;
  onToggleComplete: (t: Task) => void;
}) {
  const today = todayStr();

  // Compute the day range: from earliest start (or today) to latest end (or today+14 when empty).
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (tasks.length === 0) return { rangeStart: today, rangeEnd: addDays(today, 14) };
    let min = today;
    let max = today;
    for (const t of tasks) {
      if (daysBetween(t.start_date, min) > 0) min = t.start_date;
      const end = t.end_date ?? t.start_date;
      if (daysBetween(max, end) > 0) max = end;
    }
    return { rangeStart: min, rangeEnd: max };
  }, [tasks, today]);

  const days = useMemo(() => eachDay(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  // Index tasks by their start day, and compute ongoing spans.
  const startingByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      const arr = m.get(t.start_date) ?? [];
      arr.push(t);
      m.set(t.start_date, arr);
    }
    return m;
  }, [tasks]);

  function ongoingOn(day: string): Task[] {
    return tasks.filter((t) => {
      if (!t.end_date || t.end_date === t.start_date) return false;
      return daysBetween(t.start_date, day) > 0 && daysBetween(day, t.end_date) >= 0;
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-3 pb-28 pt-2">
      {days.map((day, idx) => {
        const starting = startingByDay.get(day) ?? [];
        const ongoing = ongoingOn(day);
        const hasContent = starting.length > 0 || ongoing.length > 0;
        const anchor = isToday(day) ? { id: "today-anchor" as string } : {};
        const showMonth = idx === 0 || day.slice(0, 7) !== days[idx - 1].slice(0, 7);

        const inner = !hasContent ? (
          // Slim row for empty days (kept visible per requirement, but low height).
          <div className="flex items-center gap-3 py-1">
            <DayTick day={day} muted />
            <div className="h-px flex-1 bg-line/70" />
          </div>
        ) : (
          <div className="mb-1">
            <div className="sticky top-0 z-10 bg-canvas/90 py-1.5 backdrop-blur">
              <DayHeader day={day} />
            </div>
            <div className="space-y-2 pt-1.5">
              {starting.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  group={groupsById.get(t.group_id)}
                  checklist={checklistCounts[t.id]}
                  onEdit={onEdit}
                  onToggleComplete={onToggleComplete}
                />
              ))}
              {ongoing.map((t) => {
                const g = groupsById.get(t.group_id);
                const color = g?.color ?? "#E7E9EE";
                return (
                  <button
                    key={`ong-${t.id}`}
                    onClick={() => onEdit(t)}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-3 py-1.5 text-left"
                    style={{ backgroundColor: tint(color, 0.1) }}
                  >
                    <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ backgroundColor: deepen(color) }} />
                    <span className="truncate text-xs text-muted">
                      {t.title} <span className="text-faint">· ongoing → {monthDay(t.end_date as string)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );

        return (
          <div key={day} {...anchor} className="flex gap-2">
            {/* Left month rail — month name appears beside its first day. */}
            <div className="w-9 flex-none">
              {showMonth && (
                <div className="sticky top-0 z-20 pt-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-accent">
                    {monthShort(day)}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">{inner}</div>
          </div>
        );
      })}
    </div>
  );
}

function DayHeader({ day }: { day: string }) {
  const todayFlag = isToday(day);
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-sm font-semibold ${todayFlag ? "text-accent" : "text-ink"}`}>
        {weekday(day)}
      </span>
      <span className={`text-sm ${todayFlag ? "text-accent" : "text-muted"}`}>{monthDay(day)}</span>
      {todayFlag && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Today
        </span>
      )}
    </div>
  );
}

function DayTick({ day, muted }: { day: string; muted?: boolean }) {
  return (
    <span
      className={`w-24 flex-none text-xs ${
        isToday(day) ? "font-semibold text-accent" : muted ? "text-faint" : "text-muted"
      } ${isWeekend(day) && !isToday(day) ? "opacity-70" : ""}`}
    >
      {weekday(day)} {monthDay(day)}
    </span>
  );
}
