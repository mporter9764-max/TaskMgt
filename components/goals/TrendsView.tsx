"use client";

import { useMemo, useState } from "react";
import type { RoleNode } from "@/lib/goalTree";
import { goalsInScope } from "@/lib/goalTree";
import { dayActivity, dowPattern, goalStats, matrixCell, pct, trendSeries, type GoalData } from "@/lib/goals";
import { addDays, maxStr, weekStart } from "@/lib/dates";
import { EmptyState, Segmented, Select } from "../ui";
import { CalendarHeatmap, Card, DowBars, GoalMatrix, StatTile, TrendLine } from "./charts";

type Range = "90" | "180" | "365";

export function TrendsView({ tree, data, today }: { tree: RoleNode[]; data: Map<string, GoalData>; today: string }) {
  const [scope, setScope] = useState("all");
  const [range, setRange] = useState<Range>("180");
  const [trendMode, setTrendMode] = useState<"week" | "month">("week");
  const [matrixWeeks, setMatrixWeeks] = useState(12);

  const scopedGoals = useMemo(() => goalsInScope(tree, scope), [tree, scope]);
  const scoped = useMemo(() => scopedGoals.map((g) => data.get(g.id)).filter(Boolean) as GoalData[], [scopedGoals, data]);

  const earliestStart = scoped.reduce((m, gd) => (gd.goal.start_date < m ? gd.goal.start_date : m), today);
  const from = maxStr(addDays(today, -Number(range) + 1), earliestStart);

  const heat = useMemo(() => dayActivity(scoped, from, today, today), [scoped, from, today]);
  const trend = useMemo(() => trendSeries(scoped, trendMode, from, today), [scoped, trendMode, from, today]);
  const dow = useMemo(() => dowPattern(scoped, from, today), [scoped, from, today]);

  const kpi = useMemo(() => {
    let hits = 0;
    let closed = 0;
    let num = 0;
    let den = 0;
    for (const gd of scoped) {
      const s = goalStats(gd.periods, from);
      hits += s.hits;
      closed += s.closedCount;
      for (const p of gd.periods) {
        if (!p.closed || p.end < from) continue;
        num += Math.min(p.done, p.target);
        den += p.target;
      }
    }
    const active = scoped.filter((gd) => !gd.goal.archived_on || gd.goal.archived_on > today).length;
    return { hits, closed, consistency: den ? num / den : null, active };
  }, [scoped, from, today]);

  const weeks = useMemo(() => {
    const out: string[] = [];
    const last = weekStart(today);
    for (let i = matrixWeeks - 1; i >= 0; i--) out.push(addDays(last, -7 * i));
    return out;
  }, [today, matrixWeeks]);

  const matrixSections = useMemo(() => {
    const subName = new Map<string, string>();
    tree.forEach((r) => r.subs.forEach((s) => subName.set(s.sub.id, s.sub.name)));
    const make = (gds: GoalData[]) =>
      gds.map((gd) => ({
        id: gd.goal.id,
        name: gd.goal.name,
        sub: gd.goal.subgroup_id ? subName.get(gd.goal.subgroup_id) : undefined,
        cells: weeks.map((w) => matrixCell(gd, w, today)),
      }));
    if (scope !== "all") return [{ key: scope, title: null as string | null, rows: make(scoped) }];
    return tree
      .map((r) => ({
        key: r.role.id,
        title: r.role.name as string | null,
        rows: make(r.all.map((g) => data.get(g.id)).filter(Boolean) as GoalData[]),
      }))
      .filter((s) => s.rows.length);
  }, [tree, scope, scoped, data, weeks, today]);

  if (!tree.some((r) => r.all.length)) {
    return <EmptyState title="No goals to chart yet" body="Add goals in Manage, check them off for a while, and trends appear here." />;
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-auto min-w-[180px] flex-1 sm:flex-none">
          <option value="all">All goals</option>
          {tree.map((r) => (
            <optgroup key={r.role.id} label={r.role.name}>
              <option value={`role:${r.role.id}`}>All {r.role.name}</option>
              {r.subs.map((s) => (
                <option key={s.sub.id} value={`sub:${s.sub.id}`}>
                  {r.role.name} › {s.sub.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "90", label: "3M" },
            { value: "180", label: "6M" },
            { value: "365", label: "1Y" },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <StatTile label="Consistency" value={pct(kpi.consistency)} sub="share of targets achieved" />
        <StatTile label="Targets hit" value={kpi.closed ? pct(kpi.hits / kpi.closed) : "–"} sub={kpi.closed ? `${kpi.hits} of ${kpi.closed} periods` : "No full periods yet"} />
        <StatTile label="Active goals" value={String(kpi.active)} sub={scope === "all" ? "across all roles" : "in this view"} />
      </div>

      <Card title="Daily heatmap">
        <p className="-mt-1 mb-3 text-[12px] text-muted">Share of your goals checked off each day. Darker is more.</p>
        <CalendarHeatmap cells={heat} from={from} today={today} />
      </Card>

      <Card
        title="Consistency over time"
        right={
          <Segmented
            size="sm"
            value={trendMode}
            onChange={setTrendMode}
            options={[
              { value: "week", label: "Weekly" },
              { value: "month", label: "Monthly" },
            ]}
          />
        }
      >
        <TrendLine points={trend} />
        {trendMode === "week" && scoped.some((gd) => gd.targets.some((t) => t.period === "month")) && (
          <p className="mt-2 text-[12px] text-faint">Monthly goals are left out of the weekly view; switch to Monthly to include them.</p>
        )}
      </Card>

      <Card title="By day of week">
        <p className="-mt-1 mb-3 text-[12px] text-muted">How often goals get checked off on each weekday. The weakest day is highlighted.</p>
        <DowBars bars={dow} />
      </Card>

      <Card
        title="Goals by week"
        right={
          <Segmented
            size="sm"
            value={String(matrixWeeks)}
            onChange={(v) => setMatrixWeeks(Number(v))}
            options={[
              { value: "8", label: "8W" },
              { value: "12", label: "12W" },
              { value: "26", label: "26W" },
            ]}
          />
        }
      >
        <div className="space-y-5">
          {matrixSections.map((sec) => (
            <div key={sec.key}>
              {sec.title && <div className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-faint">{sec.title}</div>}
              <GoalMatrix rows={sec.rows} weeks={weeks} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
