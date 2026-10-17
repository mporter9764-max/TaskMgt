"use client";

import { useEffect, useMemo, useState } from "react";
import type { Goal, GoalRole, GoalSubgroup } from "@/lib/types";
import {
  describeTarget,
  dowPattern,
  goalStats,
  isActiveOn,
  pct,
  periodAt,
  periodNoun,
  versionAt,
  type GoalData,
} from "@/lib/goals";
import { addDays, diffDays, fmtMonthDay, maxStr, minStr, monthEnd, monthIndex, monthStart, MONTHS, MONTHS_LONG, weekStart, WEEKDAYS } from "@/lib/dates";
import { Button, IconButton, Sheet, cx } from "../ui";
import { ChevronLeft, ChevronRight, Pencil } from "../icons";
import { Card, DowBars, PeriodBars, StatTile, type PeriodBarItem } from "./charts";

export function GoalDetail({
  open,
  gd,
  role,
  subgroup,
  today,
  onClose,
  onToggle,
  onEdit,
}: {
  open: boolean;
  gd: GoalData | null;
  role: GoalRole | undefined;
  subgroup: GoalSubgroup | undefined;
  today: string;
  onClose: () => void;
  onToggle: (goalId: string, date: string) => void;
  onEdit: (goal: Goal) => void;
}) {
  const [month, setMonth] = useState(monthStart(today));
  useEffect(() => {
    if (open) setMonth(monthStart(today));
  }, [open, today]);

  const since90 = addDays(today, -90);
  const stats = useMemo(() => (gd ? goalStats(gd.periods, since90) : null), [gd, since90]);
  const allTime = useMemo(() => (gd ? goalStats(gd.periods) : null), [gd]);
  const version = gd ? versionAt(gd.targets, today) : null;
  const current = gd ? periodAt(gd.periods, today) : null;

  const bars: PeriodBarItem[] = useMemo(() => {
    if (!gd || !version) return [];
    if (version.period === "day") {
      // a daily goal reads best as days-per-week
      const out: PeriodBarItem[] = [];
      for (let i = 11; i >= 0; i--) {
        const ws = addDays(weekStart(today), -7 * i);
        const we = addDays(ws, 6);
        const a = maxStr(ws, gd.goal.start_date);
        let b = minStr(we, today);
        if (gd.goal.archived_on) b = minStr(b, addDays(gd.goal.archived_on, -1));
        if (a > b) continue;
        let done = 0;
        for (let d = a; d <= b; d = addDays(d, 1)) if (gd.logs.has(d)) done++;
        const target = diffDays(a, b) + 1;
        const closed = we < today;
        out.push({
          key: ws,
          label: fmtMonthDay(ws),
          done,
          target,
          status: done >= target ? "hit" : closed ? "miss" : "open",
        });
      }
      return out;
    }
    return gd.periods.slice(-12).map((p) => ({
      key: p.start,
      label: p.period === "month" ? `${MONTHS[monthIndex(p.fullStart)]} ${p.fullStart.slice(2, 4)}` : fmtMonthDay(p.fullStart),
      done: p.done,
      target: p.target,
      status: p.status,
    }));
  }, [gd, version, today]);

  const dow = useMemo(() => (gd ? dowPattern([gd], maxStr(since90, gd.goal.start_date), today) : []), [gd, since90, today]);

  if (!gd || !version || !stats || !allTime) return null;
  const goal = gd.goal;
  const color = role?.color ?? "#256abf";
  const unit = periodNoun(version.period, true);
  const streakUnit = (n: number) => periodNoun(version.period, n !== 1);

  let currentLine = "";
  if (current) {
    if (version.period === "day") currentLine = gd.logs.has(today) ? "Done today" : "Not checked off yet today";
    else {
      const left = diffDays(today, current.end) + 1;
      currentLine = `This ${version.period}: ${current.done} of ${current.target}${
        current.status === "hit" ? ", target met" : current.reachable ? `, ${left} ${left === 1 ? "day" : "days"} left` : ", out of reach"
      }`;
    }
  }

  // calendar grid
  const gridStart = weekStart(month);
  const gridEnd = addDays(weekStart(monthEnd(month)), 6);
  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const canPrev = month > monthStart(goal.start_date);
  const canNext = month < monthStart(today);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={goal.name}
      headerRight={
        <Button size="sm" variant="ghost" onClick={() => onEdit(goal)}>
          <Pencil size={14} /> Edit
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {role?.name}
            {subgroup ? ` › ${subgroup.name}` : ""}
          </span>
          <span>·</span>
          <span className="font-medium text-ink">{describeTarget(version)}</span>
          {goal.archived_on && <span className="rounded bg-sunken px-1.5 text-[11px]">Archived</span>}
        </div>
        {currentLine && <p className="rounded-lg bg-sunken px-3 py-2 text-[13px] text-ink">{currentLine}</p>}

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile label="Current streak" value={String(stats.currentStreak)} sub={streakUnit(stats.currentStreak)} />
          <StatTile label="Best streak" value={String(allTime.bestStreak)} sub={streakUnit(allTime.bestStreak)} />
          <StatTile label="Targets hit (90 days)" value={pct(stats.hitRate)} sub={stats.closedCount ? `${stats.hits} of ${stats.closedCount} ${unit}` : "No full periods yet"} />
          <StatTile label="Consistency (90 days)" value={pct(stats.consistency)} sub="share of target achieved" />
        </div>

        <Card
          title={`${MONTHS_LONG[monthIndex(month)]} ${month.slice(0, 4)}`}
          right={
            <div className="flex">
              <IconButton label="Previous month" disabled={!canPrev} onClick={() => setMonth(monthStart(addDays(month, -1)))}>
                <ChevronLeft size={16} />
              </IconButton>
              <IconButton label="Next month" disabled={!canNext} onClick={() => setMonth(addDays(monthEnd(month), 1))}>
                <ChevronRight size={16} />
              </IconButton>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] text-faint">
                {w}
              </div>
            ))}
            {days.map((d) => {
              const inMonth = d.slice(0, 7) === month.slice(0, 7);
              const activeDay = isActiveOn(goal, d) && d <= today;
              const on = gd.logs.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!activeDay || !inMonth}
                  onClick={() => onToggle(goal.id, d)}
                  className={cx(
                    "flex aspect-square items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors",
                    !inMonth && "invisible",
                    d === today && "ring-2 ring-ink/30"
                  )}
                  style={{
                    background: on ? color : activeDay ? "#f3f2ee" : "transparent",
                    color: on ? "#fff" : activeDay ? "#1d1d1b" : "#c9c7c0",
                    fontWeight: on ? 600 : 400,
                  }}
                  aria-label={`${d}: ${on ? "done" : "not done"}`}
                >
                  {Number(d.slice(8, 10))}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-faint">Tap a day to check it off or undo it.</p>
        </Card>

        <Card title={version.period === "day" ? "Days per week" : `Recent ${unit}`}>
          <PeriodBars items={bars} unit="days" />
        </Card>

        <Card title="By day of week (last 90 days)">
          <DowBars bars={dow} />
        </Card>

        {gd.targets.length > 1 && (
          <Card title="Target history">
            <ul className="space-y-1 text-[13px] text-muted">
              {[...gd.targets].reverse().map((t) => (
                <li key={t.id}>
                  <span className="text-ink">{describeTarget(t)}</span> from {fmtMonthDay(t.effective_from)}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Sheet>
  );
}
