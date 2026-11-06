"use client";

import { useEffect, useMemo, useState } from "react";
import type { Goal, LogStatus } from "@/lib/types";
import type { GoalsStore } from "@/lib/useGoalsStore";
import type { RoleNode } from "@/lib/goalTree";
import { goalStats, isActiveOn, periodAt, periodNoun, versionAt, type GoalData } from "@/lib/goals";
import { addDays, diffDays, dow, fmtLong, fmtRelative, weekStart } from "@/lib/dates";
import { alpha, deepen } from "@/lib/colors";
import { Button, EmptyState, IconButton, cx } from "../ui";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Flame, X } from "../icons";

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
    let missed = 0;
    for (const r of tree)
      for (const g of r.all) {
        if (!isActiveOn(g, date)) continue;
        total++;
        if (data.get(g.id)?.logs.has(date)) done++;
        else if (data.get(g.id)?.misses.has(date)) missed++;
      }
    return { total, done, missed, open: total - done - missed };
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
          <span className="text-[13px] text-muted">done {date === today ? "today" : "that day"}</span>
        </div>
        <div className="mt-2.5 flex h-2 gap-[2px] overflow-hidden rounded-full bg-sunken">
          {totals.done > 0 && (
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(totals.done / totals.total) * 100}%` }} />
          )}
          {totals.missed > 0 && (
            <div className="h-full transition-[width] duration-300" style={{ width: `${(totals.missed / totals.total) * 100}%`, background: MISS_SOFT }} />
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" /> {totals.done} yes
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: MISS_SOFT }} /> {totals.missed} no
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sunken ring-1 ring-line" /> {totals.open} not logged
          </span>
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
                        onSet={(status) => store.setLog(g.id, date, status)}
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
  onSet,
  onOpen,
}: {
  goal: Goal;
  gd: GoalData | undefined;
  date: string;
  today: string;
  color: string;
  onSet: (status: LogStatus | null) => void;
  onOpen: () => void;
}) {
  const done = gd?.logs.has(date) ?? false;
  const missed = !done && (gd?.misses.has(date) ?? false);
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
        onClick={onOpen}
        aria-label={`Details for ${goal.name}`}
        className="flex min-h-[58px] min-w-0 flex-1 items-center py-2.5 pl-3.5 pr-1 text-left active:bg-sunken/70"
      >
        <span className="min-w-0 flex-1">
          <span className={cx("block text-[15px] leading-snug", done || missed ? "text-muted" : "text-ink")}>{goal.name}</span>
          {detail && <span className="mt-0.5 block text-[12px] text-muted">{detail}</span>}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1.5 pr-3">
        <ChoiceButton kind="no" on={missed} color={MISS_COLOR} label={`${goal.name}: no`} onClick={() => onSet(missed ? null : "missed")} />
        <ChoiceButton kind="yes" on={done} color={color} label={`${goal.name}: yes`} onClick={() => onSet(done ? null : "done")} />
      </div>
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
        const no = gd.misses.has(d);
        const inactive = !isActiveOn(gd.goal, d) || d > today;
        return (
          <span
            key={d}
            className={cx("h-[7px] w-[7px] rounded-full", d === date && "ring-1 ring-offset-1 ring-ink/40")}
            style={{ background: on ? color : no ? MISS_SOFT : inactive ? "#efeee9" : "#d9d7d0" }}
            title={`${["M", "T", "W", "T", "F", "S", "S"][dow(d)]}`}
          />
        );
      })}
    </span>
  );
}

const MISS_COLOR = "#c2410c";
const MISS_SOFT = "#f2b8a3";

/** Yes / No buttons: tap to choose, tap the chosen one again to clear back to "not logged". */
function ChoiceButton({
  kind,
  on,
  color,
  label,
  onClick,
}: {
  kind: "yes" | "no";
  on: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full"
    >
      <span
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 transition-colors"
        style={{ borderColor: on ? color : "#d6d4cd", background: on ? color : "transparent", color: on ? "#fff" : "#b9b7b0" }}
      >
        {kind === "yes" ? <Check size={17} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
      </span>
    </button>
  );
}
