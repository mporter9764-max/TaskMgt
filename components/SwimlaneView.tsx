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
  monthName,
} from "@/lib/dates";
import { tint, deepen, solidTint } from "@/lib/colors";
import { Plus } from "./icons";

const DAY_W = 46;
const LABEL_W = 150;
const STRIP_H = 9; // the colored strip showing the exact date span
const LABEL_GAP = 3; // space between strip and title label
const TITLE_H = 16; // title label row height
const LANE_H = STRIP_H + LABEL_GAP + TITLE_H;
const BAR_GAP = 9; // vertical space between lanes

export function SwimlaneView({
  tasks,
  groups,
  onEdit,
  onAddTask,
}: {
  tasks: Task[];
  groups: Group[];
  onEdit: (t: Task) => void;
  onAddTask: (groupId: string) => void;
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

  // Group consecutive days into month segments for the month band.
  const monthSegments = useMemo(() => {
    const segs: { key: string; label: string; count: number }[] = [];
    for (const day of days) {
      const d = parseYMD(day);
      const label = `${monthName(day)} ${d.getFullYear()}`;
      const last = segs[segs.length - 1];
      if (last && last.label === label) last.count += 1;
      else segs.push({ key: day, label, count: 1 });
    }
    return segs;
  }, [days]);

  return (
    <div className="h-full overflow-auto scroll-thin px-4 py-3">
      <div style={{ width: totalW }} className="min-w-full">
        {/* Sticky header: month band + day axis */}
        <div className="sticky top-0 z-20 bg-canvas/95 backdrop-blur">
          {/* Month band */}
          <div className="flex">
            <div className="sticky left-0 z-30 flex-none bg-canvas/95" style={{ width: LABEL_W }} />
            {monthSegments.map((seg, i) => (
              <div
                key={seg.key}
                className="flex-none overflow-hidden whitespace-nowrap px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted"
                style={{
                  width: seg.count * DAY_W,
                  borderLeft: i === 0 ? "none" : "1px solid #E7E9EE",
                }}
              >
                {seg.label}
              </div>
            ))}
          </div>
          {/* Day axis */}
          <div className="flex">
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
        </div>


        {/* Group rows */}
        {visibleGroups.map((group) => {
          const groupTasks = tasks.filter((t) => t.group_id === group.id);
          const lanes = packLanes(groupTasks);
          const rowH = Math.max(1, lanes.length) * (LANE_H + BAR_GAP) + BAR_GAP;

          return (
            <div key={group.id} className="flex border-b border-line">
              {/* Sticky group label */}
              <div
                className="group/label sticky left-0 z-10 flex-none px-3 py-2"
                style={{ width: LABEL_W, backgroundColor: solidTint(group.color) }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: deepen(group.color) }} />
                  <span className="truncate text-sm font-medium text-ink">{group.name}</span>
                  <button
                    aria-label={`Add task to ${group.name}`}
                    title={`Add task to ${group.name}`}
                    onClick={() => onAddTask(group.id)}
                    className="ml-auto flex h-5 w-5 flex-none items-center justify-center rounded-full text-muted opacity-0 transition-opacity hover:bg-black/[0.08] hover:text-ink group-hover/label:opacity-100"
                  >
                    <Plus width={13} height={13} />
                  </button>
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

                {/* task bars: a slim date strip + a title label below it */}
                {lanes.map((lane, laneIdx) =>
                  lane.map((t, i) => {
                    const offset = daysBetween(rangeStart, t.start_date);
                    const end = t.end_date ?? t.start_date;
                    const span = daysBetween(t.start_date, end) + 1;
                    const left = offset * DAY_W + 2;
                    const stripWidth = span * DAY_W - 4;

                    // Let the title extend rightward into empty lane space (up to the
                    // next task in this lane, or the end of the visible range) so
                    // short single-day tasks aren't clipped to a 1-day-wide box.
                    const next = lane[i + 1];
                    const rightLimit = next
                      ? daysBetween(rangeStart, next.start_date) * DAY_W + 2 - 6
                      : days.length * DAY_W - 4;
                    const labelWidth = Math.max(stripWidth, rightLimit - left);

                    const top = BAR_GAP + laneIdx * (LANE_H + BAR_GAP);
                    const complete = t.is_complete;

                    return (
                      <div key={t.id} className="absolute" style={{ left, top, width: labelWidth }}>
                        <button
                          onClick={() => onEdit(t)}
                          title={t.title}
                          className="block rounded-sm shadow-card transition-transform hover:-translate-y-px"
                          style={{
                            width: stripWidth,
                            height: STRIP_H,
                            backgroundColor: complete ? "#EEF0F3" : group.color,
                            border: `1px solid ${deepen(group.color, 0.9)}`,
                          }}
                        />
                        <button
                          onClick={() => onEdit(t)}
                          title={t.title}
                          className={`mt-[3px] block max-w-full truncate text-left text-xs font-medium leading-none ${
                            complete ? "text-faint line-through" : "text-ink"
                          }`}
                          style={{ width: labelWidth }}
                        >
                          {t.title}
                        </button>
                      </div>
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
