"use client";

import { useMemo } from "react";
import type { Group, Task } from "@/lib/types";
import {
  eachDay,
  todayStr,
  addDays,
  daysBetween,
  weekday,
  isToday,
  isWeekend,
  parseYMD,
} from "@/lib/dates";
import { tint, deepen, readableText } from "@/lib/colors";

const DAY_W = 46;
const LABEL_W = 150;
const BAR_H = 30;
const BAR_GAP = 6;

export function SwimlaneView({
  tasks,
  groups,
  onEdit,
}: {
  tasks: Task[];
  groups: Group[];
  onEdit: (t: Task) => void;
}) {
  const today = todayStr();

  const { rangeStart, days } = useMemo(() => {
    if (tasks.length === 0) {
      const start = addDays(today, -2);
      return { rangeStart: start, days: eachDay(start, addDays(today, 21)) };
    }
    let min = today;
    let max = today;
    for (const t of tasks) {
      if (daysBetween(t.start_date, min) > 0) min = t.start_date;
      const end = t.end_date ?? t.start_date;
      if (daysBetween(max, end) > 0) max = end;
    }
    const start = addDays(min, -2);
    const end = addDays(max, 2);
    return { rangeStart: start, days: eachDay(start, end) };
  }, [tasks, today]);

  const totalW = LABEL_W + days.length * DAY_W;
  const visibleGroups = groups.filter((g) => tasks.some((t) => t.group_id === g.id) || true);

  return (
    <div className="h-full overflow-auto scroll-thin px-4 py-3">
      <div style={{ width: totalW }} className="min-w-full">
        {/* Day axis header */}
        <div className="sticky top-0 z-20 flex bg-canvas/95 backdrop-blur">
          <div
            className="sticky left-0 z-30 flex-none border-b border-line bg-canvas/95"
            style={{ width: LABEL_W }}
          />
          {days.map((day) => (
            <div
              key={day}
              id={isToday(day) ? "today-anchor" : undefined}
              className={`flex-none border-b border-line py-1.5 text-center ${
                isWeekend(day) ? "bg-black/[0.02]" : ""
              }`}
              style={{ width: DAY_W }}
            >
              <div className={`text-[10px] uppercase ${isToday(day) ? "font-bold text-accent" : "text-faint"}`}>
                {weekday(day)}
              </div>
              <div className={`text-xs ${isToday(day) ? "font-bold text-accent" : "text-muted"}`}>
                {parseYMD(day).getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Group rows */}
        {visibleGroups.map((group) => {
          const groupTasks = tasks.filter((t) => t.group_id === group.id);
          const lanes = packLanes(groupTasks);
          const rowH = Math.max(1, lanes.length) * (BAR_H + BAR_GAP) + BAR_GAP;

          return (
            <div key={group.id} className="flex border-b border-line">
              {/* Sticky group label */}
              <div
                className="sticky left-0 z-10 flex-none px-3 py-2"
                style={{ width: LABEL_W, backgroundColor: tint(group.color, 0.22) }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: deepen(group.color) }} />
                  <span className="truncate text-sm font-medium text-ink">{group.name}</span>
                </div>
                <span className="text-xs text-muted">{groupTasks.length} task{groupTasks.length === 1 ? "" : "s"}</span>
              </div>

              {/* Timeline track */}
              <div className="relative flex-none" style={{ width: days.length * DAY_W, height: rowH }}>
                {/* weekend + today column shading */}
                {days.map((day, i) => (
                  <div
                    key={day}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: i * DAY_W,
                      width: DAY_W,
                      backgroundColor: isToday(day)
                        ? "rgba(46,52,64,0.06)"
                        : isWeekend(day)
                        ? "rgba(0,0,0,0.015)"
                        : "transparent",
                      borderRight: "1px solid #EEF0F3",
                    }}
                  />
                ))}

                {/* task bars */}
                {lanes.map((lane, laneIdx) =>
                  lane.map((t) => {
                    const offset = daysBetween(rangeStart, t.start_date);
                    const end = t.end_date ?? t.start_date;
                    const span = daysBetween(t.start_date, end) + 1;
                    const left = offset * DAY_W + 2;
                    const width = span * DAY_W - 4;
                    return (
                      <button
                        key={t.id}
                        onClick={() => onEdit(t)}
                        title={t.title}
                        className="absolute flex items-center overflow-hidden rounded-md px-2 text-left shadow-card transition-transform hover:-translate-y-px"
                        style={{
                          left,
                          width,
                          top: BAR_GAP + laneIdx * (BAR_H + BAR_GAP),
                          height: BAR_H,
                          backgroundColor: t.is_complete ? "#EEF0F3" : group.color,
                          color: t.is_complete ? "#9AA1AC" : readableText(group.color),
                          border: `1px solid ${deepen(group.color, 0.9)}`,
                        }}
                      >
                        <span className={`truncate text-xs font-medium ${t.is_complete ? "line-through" : ""}`}>
                          {t.title}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Pack tasks into lanes so overlapping date ranges never collide. */
function packLanes(tasks: Task[]): Task[][] {
  const sorted = [...tasks].sort((a, b) => daysBetween(b.start_date, a.start_date));
  const lanes: { end: string; items: Task[] }[] = [];
  for (const t of sorted) {
    const end = t.end_date ?? t.start_date;
    let placed = false;
    for (const lane of lanes) {
      if (daysBetween(lane.end, t.start_date) > 0) {
        lane.items.push(t);
        lane.end = end;
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push({ end, items: [t] });
  }
  return lanes.map((l) => l.items);
}
