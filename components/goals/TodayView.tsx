"use client";

import { useEffect, useMemo, useState } from "react";
import type { Goal } from "@/lib/types";
import type { GoalsStore } from "@/lib/useGoalsStore";
import type { RoleNode } from "@/lib/goalTree";
import { goalStats, isActiveOn, periodAt, periodNoun, versionAt, type GoalData } from "@/lib/goals";
import { addDays, diffDays, dow, fmtLong, fmtRelative, weekStart } from "@/lib/dates";
import { alpha, deepen } from "@/lib/colors";
import { Button, CheckDot, EmptyState, IconButton, cx } from "../ui";
import { ChevronDown, ChevronLeft, ChevronRight, Flame } from "../icons";

const BACKFILL_DAYS = 30;

export function TodayView({
  store,
  tree,
  data,
  today,
  onOpenGoal,
  onManage,
}: {
  store: GoalsStore;
  tree: RoleNode[];
  data: Map<string, GoalData>;
  today: string;
  onOpenGoal: (goal: Goal) => void;
  onManage: () => void;
}) {
  const [date, setDate] = useState(today);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => setDate(today), [today]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("taskmgt.collapsedRoles");
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("taskmgt.collapsedRoles", JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const earliest = addDays(today, -BACKFILL_DAYS);
  const active = (g: Goal) => isActiveOn(g, date);

  const totals = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const r of tree)
      for (const g of r.all) {
        if (!isActiveOn(g, date)) continue;
        total++;
        if (data.get(g.id)?.logs.has(date)) done++;
      }
    return { total, done };
  }, [tree, data, date]);

  const hasAnyGoal = tree.some((r) => r.all.length > 0);
  if (!hasAnyGoal) {
    return (
      <EmptyState
        title="No goals yet"
        body="Set up roles like Father, Husband and Health, then add a few goals you can check off with one tap."
        action={<Button variant="primary" onClick={onManage}>Set up goals</Button>}
      />
    );
  }

  return (
    <div className="pb-28">
      {/* date navigation */}
      <div className="mb-3 flex items-center gap-2">
        <IconButton label="Previous day" disabled={date <= earliest} onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft />
        </IconButton>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[17px] font-semibold text-ink">{fmtRelative(date, today)}</div>
          <div className="text-[12px] text-faint">{fmtLong(date)}</div>
        </div>
        <IconButton label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight />
        </IconButton>
      </div>
      {date !== today && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent-deep">
          Backfilling {diffDays(date, today)} {diffDays(date, today) === 1 ? "day" : "days"} ago
          <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setDate(today)}>
            Back to today
          </button>
        </div>
      )}

      {/* daily summary */}
      <div className="mb-4 rounded-xl border border-line bg-surface p-3.5 shadow-card">
        <div className="flex items-baseline gap-2">
          <span className="text-[26px] font-semibold leading-none tabular-nums text-ink">
            {totals.done}
            <span className="text-[18px] text-faint"> / {totals.total}</span>
          </span>
          <span className="text-[13px] text-muted">checked off {date === today ? "today" : "that day"}</span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${totals.total ? (totals.done / totals.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {tree.map((node) => {
          const goals = node.all.filter(active);
          if (!goals.length) return null;
          const roleDone = goals.filter((g) => data.get(g.id)?.logs.has(date)).length;
          const isCollapsed = collapsed.has(node.role.id);
          const color = node.role.color;
          const sections: Array<{ key: string; title: string | null; goals: Goal[] }> = [
            { key: "direct", title: null, goals: node.direct.filter(active) },
            ...node.subs.map((s) => ({ key: s.sub.id, title: s.sub.name, goals: s.goals.filter(active) })),
          ].filter((s) => s.goals.length);
          return (
            <section key={node.role.id} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              <button
                type="button"
                onClick={() => toggleCollapsed(node.role.id)}
                className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
                style={{ background: alpha(color, 0.07) }}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                <span className="text-[15px] font-semibold text-ink">{node.role.name}</span>
                <span className="text-[13px] tabular-nums text-muted">
                  {roleDone}/{goals.length}
                </span>
                {roleDone === goals.length && <span className="text-[12px] font-medium" style={{ color: deepen(color, 0.25) }}>All done</span>}
                <ChevronDown size={16} className={cx("ml-auto text-faint transition-transform", isCollapsed && "-rotate-90")} />
              </button>
              {!isCollapsed &&
                sections.map((sec) => (
                  <div key={sec.key}>
                    {sec.title && (
                      <div className="border-t border-line bg-canvas/60 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                        {sec.title}
                      </div>
                    )}
                    {sec.goals.map((g) => (
                      <GoalRow
                        key={g.id}
                        goal={g}
                        gd={data.get(g.id)}
                        date={date}
                        today={today}
                        color={color}
                        onToggle={() => store.toggleLog(g.id, date)}
                        onOpen={() => onOpenGoal(g)}
                      />
                    ))}
                  </div>
                ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  gd,
  date,
  today,
  color,
  onToggle,
  onOpen,
}: {
  goal: Goal;
  gd: GoalData | undefined;
  date: string;
  today: string;
  color: string;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const done = gd?.logs.has(date) ?? false;
  const period = gd ? periodAt(gd.periods, date) : null;
  const version = gd ? versionAt(gd.targets, date) : null;
  const stats = gd && date === today ? goalStats(gd.periods) : null;

  let detail: React.ReactNode = null;
  if (version?.period === "day") {
    if (stats && stats.currentStreak > 1) {
      detail = (
        <span className="inline-flex items-center gap-1">
          <Flame size={12} className="text-[#eb6834]" /> {stats.currentStreak} day streak
        </span>
      );
    }
  } else if (period && version) {
    const label = version.period === "week" ? "this week" : "this month";
    const met = period.done >= period.target;
    const left = period.closed ? 0 : diffDays(today, period.end) + 1;
    detail = (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        {version.period === "week" && <WeekDots gd={gd as GoalData} date={date} today={today} color={color} />}
        <span className={met ? "font-medium" : ""} style={met ? { color: deepen(color, 0.3) } : undefined}>
          {period.done}/{period.target} {label}
          {met ? " · target met" : !period.reachable ? " · out of reach" : date === today && left > 0 ? ` · ${left} ${left === 1 ? "day" : "days"} left` : ""}
        </span>
        {stats && stats.currentStreak > 1 && (
          <span className="inline-flex items-center gap-1">
            <Flame size={12} className="text-[#eb6834]" /> {stats.currentStreak} {periodNoun(version.period, true)}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="flex items-stretch border-t border-line">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        className="flex min-h-[58px] flex-1 items-center gap-3 px-3.5 py-2.5 text-left active:bg-sunken/70"
      >
        <CheckDot checked={done} color={color} size={26} />
        <span className="min-w-0 flex-1">
          <span className={cx("block text-[15px] leading-snug", done ? "text-muted" : "text-ink")}>{goal.name}</span>
          {detail && <span className="mt-0.5 block text-[12px] text-muted">{detail}</span>}
        </span>
      </button>
      <button type="button" onClick={onOpen} aria-label={`Details for ${goal.name}`} className="flex w-11 shrink-0 items-center justify-center text-faint hover:text-ink">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function WeekDots({ gd, date, today, color }: { gd: GoalData; date: string; today: string; color: string }) {
  const ws = weekStart(date);
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(ws, i);
        const on = gd.logs.has(d);
        const inactive = !isActiveOn(gd.goal, d) || d > today;
        return (
          <span
            key={d}
            className={cx("h-[7px] w-[7px] rounded-full", d === date && "ring-1 ring-offset-1 ring-ink/40")}
            style={{ background: on ? color : inactive ? "#efeee9" : "#d9d7d0" }}
            title={`${["M", "T", "W", "T", "F", "S", "S"][dow(d)]}`}
          />
        );
      })}
    </span>
  );
}
