"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkoutStore } from "@/lib/useWorkoutStore";
import {
  MUSCLE_GROUPS,
  actualSets,
  adherence,
  fmtNum,
  plannedSetsForWeek,
  progression,
  progressUnit,
  weeklySeries,
} from "@/lib/workouts";
import { addDays, fmtMonthDay, weekStart } from "@/lib/dates";
import { IconButton, Segmented, Select, cx } from "../ui";
import { ChevronLeft, ChevronRight } from "../icons";

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const INK_SOFT = "#5d5c57";

export function MetricsView({ store, today }: { store: WorkoutStore; today: string }) {
  const [ws, setWs] = useState(weekStart(today));
  const [view, setView] = useState<"muscles" | "groups">("muscles");
  const we = addDays(ws, 6);
  const low = store.settings.setRangeLow;
  const high = store.settings.setRangeHigh;

  const planned = useMemo(() => plannedSetsForWeek(ws, store.plans, store.planItems, store.exById), [ws, store.plans, store.planItems, store.exById]);
  const actual = useMemo(() => actualSets(ws, we, store.sets, store.idx, store.exById), [ws, we, store.sets, store.idx, store.exById]);
  const series = useMemo(() => weeklySeries(12, today, store.sets, store.idx, store.exById), [today, store.sets, store.idx, store.exById]);
  const weekAdh = useMemo(() => adherence(ws, we < today ? we : today, store.plans, store.sessions), [ws, we, today, store.plans, store.sessions]);
  const adh4 = useMemo(() => adherence(addDays(weekStart(today), -21), today, store.plans, store.sessions), [today, store.plans, store.sessions]);
  // planned hard sets per week counts each working set once (primary muscle), matching how "done" is counted
  const plannedPerWeek = useMemo(() => series.map((p) => plannedTotal(store, p.week)), [series, store]);

  const thisWeek = series.find((p) => p.week === ws);

  const rows = useMemo(() => {
    if (view === "muscles") {
      return MUSCLE_GROUPS.map((g) => ({
        group: g.label,
        rows: g.muscles.map((m) => ({ id: m.id, label: m.label, planned: planned.get(m.id) ?? 0, actual: actual.get(m.id) ?? 0 })),
      }));
    }
    return [
      {
        group: "",
        rows: MUSCLE_GROUPS.map((g) => ({
          id: g.id,
          label: g.label,
          planned: g.muscles.reduce((s, m) => s + (planned.get(m.id) ?? 0), 0),
          actual: g.muscles.reduce((s, m) => s + (actual.get(m.id) ?? 0), 0),
        })),
      },
    ];
  }, [view, planned, actual]);

  const scaleMax = Math.max(view === "muscles" ? high + 4 : 10, ...rows.flatMap((g) => g.rows.flatMap((r) => [r.planned, r.actual]))) * 1.05;

  const progressExercises = useMemo(() => {
    const used = new Set(store.sessionItems.map((i) => i.exercise_id));
    return store.exercises.filter((e) => used.has(e.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [store.sessionItems, store.exercises]);
  const [exId, setExId] = useState("");
  useEffect(() => {
    if (exId || !progressExercises.length) return;
    // default to the lift logged most often
    const counts = new Map<string, number>();
    for (const i of store.sessionItems) counts.set(i.exercise_id, (counts.get(i.exercise_id) ?? 0) + 1);
    const lifts = progressExercises.filter((e) => e.kind === "weight_reps");
    const pool = lifts.length ? lifts : progressExercises;
    const best = [...pool].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0];
    setExId(best.id);
  }, [exId, progressExercises, store.sessionItems]);
  const ex = store.exById.get(exId);
  const prog = useMemo(() => (ex ? progression(ex, store.sets, store.idx) : []), [ex, store.sets, store.idx]);

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-2">
        <IconButton label="Previous week" onClick={() => setWs(addDays(ws, -7))}>
          <ChevronLeft />
        </IconButton>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[16px] font-semibold text-ink">{ws === weekStart(today) ? "This week" : `Week of ${fmtMonthDay(ws)}`}</div>
          <div className="text-[12px] text-faint">
            {fmtMonthDay(ws)} – {fmtMonthDay(we)}
          </div>
        </div>
        <IconButton label="Next week" onClick={() => setWs(addDays(ws, 7))}>
          <ChevronRight />
        </IconButton>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tile label="Hard sets done" value={fmtNum(thisWeek?.hardSets ?? countHard(store, ws, we), 0)} sub={`${plannedTotal(store, ws)} planned`} />
        <Tile label="Workouts" value={`${weekAdh.done} / ${weekAdh.planned}`} sub="finished / scheduled so far" />
        <Tile label="Cardio minutes" value={fmtNum(cardioFor(store, ws, we).total, 0)} sub={`${fmtNum(cardioFor(store, ws, we).high, 0)} high intensity`} />
        <Tile label="Adherence, 4 weeks" value={adh4.planned ? `${Math.round((adh4.done / adh4.planned) * 100)}%` : "–"} sub={`${adh4.done} of ${adh4.planned} workouts`} />
      </div>

      <Card
        title="Hard sets per muscle"
        right={
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "muscles", label: "Muscles" },
              { value: "groups", label: "Groups" },
            ]}
          />
        }
      >
        <p className="-mt-1 mb-3 text-[12px] text-muted">
          Bars are hard sets done this week; the dark tick is what your plans call for. Secondary muscles count as half a set.
          {view === "muscles" && ` Shaded band is the ${low} to ${high} set target range.`}
        </p>
        <div className="space-y-3">
          {rows.map((g) => (
            <div key={g.group || "all"}>
              {g.group && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">{g.group}</div>}
              <div className="space-y-1.5">
                {g.rows.map((r) => (
                  <BalanceRow key={r.id} label={r.label} planned={r.planned} actual={r.actual} max={scaleMax} band={view === "muscles" ? [low, high] : null} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-[3px]" style={{ background: BLUE }} /> Done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-[3px] rounded-full" style={{ background: INK_SOFT }} /> Planned
          </span>
          {view === "muscles" && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-[3px] bg-[#e6efe9]" /> Target range
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#b4461b]">▲</span> Planned outside range
          </span>
        </div>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card title="Hard sets per week">
          <WeekBars
            weeks={series.map((p) => p.week)}
            layers={[{ label: "Done", color: BLUE, values: series.map((p) => p.hardSets) }]}
            ticks={plannedPerWeek}
            tickLabel="Planned"
            selected={ws}
            onPick={setWs}
            unit="sets"
          />
        </Card>
        <Card title="Cardio minutes per week">
          <WeekBars
            weeks={series.map((p) => p.week)}
            layers={[
              { label: "Low intensity", color: BLUE, values: series.map((p) => p.cardioLow) },
              { label: "High intensity", color: ORANGE, values: series.map((p) => p.cardioHigh) },
            ]}
            selected={ws}
            onPick={setWs}
            unit="min"
          />
        </Card>
      </div>

      <Card
        title="Exercise progress"
        right={
          progressExercises.length > 0 ? (
            <Select value={exId} onChange={(e) => setExId(e.target.value)} className="h-9 w-48 text-[14px]">
              {progressExercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      >
        {ex && prog.length ? (
          <ProgressChart
            points={prog}
            unit={progressUnit(ex.kind)}
            showE1rm={ex.kind === "weight_reps" && prog.some((p) => p.e1rm !== null)}
          />
        ) : (
          <p className="py-8 text-center text-sm text-faint">Finish a few sets and your progress shows here.</p>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function plannedTotal(store: WorkoutStore, ws: string): number {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    for (const plan of store.plans) {
      if (!(plan.start_date <= d && (!plan.end_date || d <= plan.end_date) && plan.days.includes(i))) continue;
      for (const it of store.planItems) if (it.plan_id === plan.id && store.exById.get(it.exercise_id)?.primary_muscle) total += it.target_sets;
    }
  }
  return total;
}

function countHard(store: WorkoutStore, from: string, to: string): number {
  let n = 0;
  for (const s of store.sets) {
    if (!s.done || !s.hard) continue;
    const it = store.idx.itemById.get(s.item_id);
    const ses = it ? store.idx.sessionById.get(it.session_id) : undefined;
    if (!it || !ses || ses.session_date < from || ses.session_date > to) continue;
    if (store.exById.get(it.exercise_id)?.primary_muscle) n++;
  }
  return n;
}

function cardioFor(store: WorkoutStore, from: string, to: string): { total: number; high: number } {
  let total = 0;
  let high = 0;
  for (const s of store.sets) {
    if (!s.done || !s.minutes) continue;
    const it = store.idx.itemById.get(s.item_id);
    const ses = it ? store.idx.sessionById.get(it.session_id) : undefined;
    if (!it || !ses || ses.session_date < from || ses.session_date > to) continue;
    const ex = store.exById.get(it.exercise_id);
    if (!ex || (ex.kind !== "cardio" && ex.kind !== "carry")) continue;
    if (ex.primary_muscle && !ex.intensity) continue; // weighted carries for muscle, not cardio
    total += +s.minutes;
    if (ex.intensity === "high") high += +s.minutes;
  }
  return { total, high };
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-semibold leading-none tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-faint">{sub}</div>}
    </div>
  );
}

function BalanceRow({ label, planned, actual, max, band }: { label: string; planned: number; actual: number; max: number; band: [number, number] | null }) {
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const outside = band && planned > 0 && (planned < band[0] || planned > band[1]);
  const unplanned = planned === 0 && actual === 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className={cx("w-[104px] shrink-0 truncate text-[13px] sm:w-[132px]", unplanned ? "text-faint" : "text-ink")}>{label}</span>
      <div className="relative h-5 min-w-0 flex-1 rounded-[4px] bg-[#f3f2ee]" title={`${label}: ${fmtNum(actual)} done, ${fmtNum(planned)} planned`}>
        {band && <div className="absolute inset-y-0 bg-[#e6efe9]" style={{ left: pct(band[0]), width: `calc(${pct(band[1])} - ${pct(band[0])})` }} />}
        {actual > 0 && <div className="absolute inset-y-[3px] left-0 rounded-r-[4px]" style={{ width: pct(actual), background: BLUE }} />}
        {planned > 0 && <div className="absolute -inset-y-0.5 w-[3px] -translate-x-1/2 rounded-full" style={{ left: pct(planned), background: INK_SOFT }} />}
      </div>
      <span className="w-[70px] shrink-0 text-right text-[12px] tabular-nums text-muted">
        <span className="font-semibold text-ink">{fmtNum(actual)}</span> / {fmtNum(planned)}
        {outside && <span className="ml-0.5 text-[#b4461b]">▲</span>}
      </span>
    </div>
  );
}

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function WeekBars({
  weeks,
  layers,
  ticks,
  tickLabel,
  selected,
  onPick,
  unit,
}: {
  weeks: string[];
  layers: Array<{ label: string; color: string; values: number[] }>;
  ticks?: number[];
  tickLabel?: string;
  selected: string;
  onPick: (w: string) => void;
  unit: string;
}) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const H = 170;
  const padL = 32;
  const padR = 6;
  const padT = 8;
  const padB = 22;
  const n = weeks.length;
  const totals = weeks.map((_, i) => layers.reduce((s, l) => s + l.values[i], 0));
  const maxV = Math.max(1, ...totals, ...(ticks ?? [0]));
  const nice = niceMax(maxV);
  const colW = (W - padL - padR) / n;
  const barW = Math.min(28, colW * 0.62);
  const y = (v: number) => padT + (1 - v / nice) * (H - padT - padB);
  const selIdx = weeks.indexOf(selected);
  const shown = hover ?? (selIdx >= 0 ? selIdx : n - 1);

  return (
    <div ref={ref}>
      <div className="mb-1 min-h-[18px] text-[12px] text-muted">
        <span className="font-medium text-ink">Week of {fmtMonthDay(weeks[shown])}</span>
        {": "}
        {layers.map((l) => `${fmtNum(l.values[shown], 0)} ${layers.length > 1 ? l.label.toLowerCase() : unit}`).join(", ")}
        {ticks && ` · ${fmtNum(ticks[shown], 0)} ${tickLabel?.toLowerCase()}`}
      </div>
      <svg width={W} height={H} className="block max-w-full" onMouseLeave={() => setHover(null)}>
        {[0, nice / 2, nice].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#ecebe6" />
            <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#97958e">
              {fmtNum(t, 0)}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx0 = padL + colW * i + colW / 2;
          let acc = 0;
          return (
            <g key={w} opacity={hover === null || hover === i ? 1 : 0.55}>
              {layers.map((l, li) => {
                const v = l.values[i];
                if (v <= 0) return null;
                const y1 = y(acc + v);
                const y0 = y(acc);
                acc += v;
                const top = li === layers.length - 1 || layers.slice(li + 1).every((x) => x.values[i] <= 0);
                const h = Math.max(1, y0 - y1 - (li > 0 ? 2 : 0));
                return <rect key={l.label} x={cx0 - barW / 2} y={y1} width={barW} height={h} rx={top ? 4 : 0} fill={l.color} />;
              })}
              {ticks && ticks[i] > 0 && <line x1={cx0 - barW / 2 - 3} x2={cx0 + barW / 2 + 3} y1={y(ticks[i])} y2={y(ticks[i])} stroke={INK_SOFT} strokeWidth={2} strokeLinecap="round" />}
              {i === selIdx && <rect x={cx0 - colW / 2 + 1} y={H - padB + 3} width={colW - 2} height={2} rx={1} fill={INK_SOFT} />}
              {(n - 1 - i) % Math.max(1, Math.round(n / Math.max(3, Math.floor(W / 80)))) === 0 && (
                <text x={cx0} y={H - 6} textAnchor="middle" fontSize={10} fill="#97958e">
                  {fmtMonthDay(w)}
                </text>
              )}
              <rect x={cx0 - colW / 2} y={padT} width={colW} height={H - padT - padB} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHover(i)} onClick={() => onPick(w)} />
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        {layers.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: l.color }} /> {l.label}
          </span>
        ))}
        {ticks && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-3 rounded-full" style={{ background: INK_SOFT }} /> {tickLabel}
          </span>
        )}
        <span className="text-faint">Tap a week to see its balance</span>
      </div>
    </div>
  );
}

function niceMax(v: number): number {
  const steps = [5, 10, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000];
  for (const s of steps) if (v <= s) return s;
  return Math.ceil(v / 500) * 500;
}

function ProgressChart({ points, unit, showE1rm }: { points: Array<{ date: string; top: number; e1rm: number | null; label: string }>; unit: string; showE1rm: boolean }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const H = 180;
  const padL = 38;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const vals = points.flatMap((p) => [p.top, ...(showE1rm && p.e1rm ? [p.e1rm] : [])]);
  const lo = Math.max(0, Math.floor((Math.min(...vals) * 0.9) / 5) * 5);
  const hi = Math.ceil((Math.max(...vals) * 1.05) / 5) * 5 || 5;
  const n = points.length;
  const x = (i: number) => (n === 1 ? (padL + W - padR) / 2 : padL + (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - padT - padB);
  const line = (get: (p: (typeof points)[number]) => number | null) =>
    points
      .map((p, i) => [i, get(p)] as const)
      .filter(([, v]) => v !== null)
      .map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v as number).toFixed(1)}`)
      .join("");
  const shown = hover ?? n - 1;
  const p = points[shown];

  return (
    <div ref={ref}>
      <div className="mb-1 min-h-[18px] text-[12px] text-muted">
        <span className="font-medium text-ink">{fmtMonthDay(p.date)}</span>: best set {p.label}
        {showE1rm && p.e1rm ? ` · est. 1-rep max ${fmtNum(p.e1rm, 0)} lb` : ""}
      </div>
      <svg width={W} height={H} className="block max-w-full" onMouseLeave={() => setHover(null)}>
        {[lo, Math.round((lo + hi) / 10) * 5, hi].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#ecebe6" />
            <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#97958e">
              {fmtNum(t, 0)}
            </text>
          </g>
        ))}
        {showE1rm && <path d={line((q) => q.e1rm)} fill="none" stroke={ORANGE} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />}
        <path d={line((q) => q.top)} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((q, i) => (
          <g key={q.date + i}>
            {(i === shown || n <= 16) && <circle cx={x(i)} cy={y(q.top)} r={i === shown ? 5 : 3.5} fill={BLUE} stroke="#fff" strokeWidth={2} />}
            {showE1rm && q.e1rm && (i === shown || n <= 16) && <circle cx={x(i)} cy={y(q.e1rm)} r={i === shown ? 4.5 : 3} fill={ORANGE} stroke="#fff" strokeWidth={2} />}
            <rect x={x(i) - (W - padL - padR) / Math.max(1, n - 1) / 2} y={padT} width={(W - padL - padR) / Math.max(1, n - 1)} height={H - padT - padB} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
          </g>
        ))}
        {[0, n - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={n === 1 ? "middle" : i === 0 ? "start" : "end"} fontSize={10} fill="#97958e">
            {fmtMonthDay(points[i].date)}
          </text>
        ))}
      </svg>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: BLUE }} /> Top set ({unit})
        </span>
        {showE1rm && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-3" style={{ background: ORANGE }} /> Estimated 1-rep max (lb)
          </span>
        )}
      </div>
    </div>
  );
}
