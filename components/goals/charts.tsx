"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DayCell, DowBar, MatrixCell, TrendPoint } from "@/lib/goals";
import { pct } from "@/lib/goals";
import { addDays, diffDays, fmtMonthDay, fmtShort, monthIndex, MONTHS, WEEKDAYS, weekStart } from "@/lib/dates";
import { cx } from "../ui";

/* Sequential blue ramp (validated reference palette), light -> dark. */
export const SEQ = ["#e8e7e2", "#cde2fb", "#86b6ef", "#3987e5", "#1c5cab"];
export const HIT = "#256abf";
export const MISS = "#d9d7d0";

export function levelColor(ratio: number | null): string {
  if (ratio === null) return "transparent";
  if (ratio <= 0) return SEQ[0];
  if (ratio < 0.34) return SEQ[1];
  if (ratio < 0.67) return SEQ[2];
  if (ratio < 1) return SEQ[3];
  return SEQ[4];
}

export function Card({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-line bg-surface p-4 shadow-card", className)}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="mt-1 text-[24px] font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-faint">{sub}</div>}
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-faint">
      <span>Less</span>
      {SEQ.map((c) => (
        <span key={c} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
      ))}
      <span>More</span>
    </div>
  );
}

/* ---------------- calendar heatmap ---------------- */

export function CalendarHeatmap({ cells, from, today }: { cells: Map<string, DayCell>; from: string; today: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [avail, setAvail] = useState(0);
  const gap = 3;
  const first = weekStart(from);
  const weeks = Math.floor(diffDays(first, weekStart(today)) / 7) + 1;
  // grow the squares to fill wide screens (14px minimum, 26px maximum)
  const cell = avail ? Math.max(14, Math.min(26, Math.floor((avail - 34) / weeks) - gap)) : 14;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  const columns = useMemo(() => Array.from({ length: weeks }, (_, w) => addDays(first, w * 7)), [weeks, first]);
  const pickedCell = picked ? cells.get(picked) : null;

  return (
    <div>
      <div ref={scroller} className="scrollbar-thin overflow-x-auto pb-1">
        <div className="flex" style={{ gap }}>
          <div className="flex shrink-0 flex-col pr-1" style={{ gap, paddingTop: 16 }}>
            {WEEKDAYS.map((d, i) => (
              <div key={d} className="text-[10px] leading-none text-faint" style={{ height: cell, lineHeight: `${cell}px` }}>
                {i % 2 === 0 ? d : ""}
              </div>
            ))}
          </div>
          {columns.map((ws, w) => {
            const showMonth = w === 0 || ws.slice(5, 7) !== addDays(ws, -7).slice(5, 7);
            return (
              <div key={ws} className="flex shrink-0 flex-col" style={{ gap, width: cell }}>
                <div className="h-[13px] overflow-visible whitespace-nowrap text-[10px] leading-none text-faint">
                  {showMonth ? MONTHS[monthIndex(addDays(ws, 6))] : ""}
                </div>
                {Array.from({ length: 7 }, (_, d) => {
                  const day = addDays(ws, d);
                  const c = cells.get(day);
                  const future = day > today;
                  const ratio = c && c.active ? c.done / c.active : null;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={future || day < from}
                      onClick={() => setPicked(day === picked ? null : day)}
                      title={c ? `${fmtShort(day)}: ${c.done} of ${c.active}` : fmtShort(day)}
                      className={cx("rounded-[3px] outline-none", picked === day && "ring-2 ring-ink/60")}
                      style={{
                        width: cell,
                        height: cell,
                        background: future || day < from ? "transparent" : ratio === null ? "#f3f2ee" : levelColor(ratio),
                        border: ratio === null && !future && day >= from ? "1px solid #ecebe6" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="min-h-[18px] text-[12px] text-muted">
          {picked
            ? pickedCell && pickedCell.active
              ? `${fmtShort(picked)}: ${pickedCell.done} of ${pickedCell.active} goals checked off`
              : `${fmtShort(picked)}: no active goals`
            : "Tap a day for details"}
        </span>
        <div className="ml-auto">
          <Legend />
        </div>
      </div>
    </div>
  );
}

/* ---------------- trend line ---------------- */

export function TrendLine({ points, height = 170 }: { points: TrendPoint[]; height?: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const padL = 34;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const n = points.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (1 - v) * (H - padT - padB);

  const segments: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) segments.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (cur) segments.push(cur);

  const lastIdx = (() => {
    for (let i = n - 1; i >= 0; i--) if (points[i].value !== null) return i;
    return -1;
  })();
  const shown = sel ?? (lastIdx >= 0 ? lastIdx : null);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(W / 90))));

  if (lastIdx === -1) return <div ref={box}><p className="py-8 text-center text-sm text-faint">Not enough history yet. Check back after a full week.</p></div>;

  return (
    <div ref={box}>
      <div className="mb-1 min-h-[18px] text-[12px] text-muted">
        {shown !== null && points[shown] && (
          <>
            <span className="font-medium text-ink">{points[shown].label}</span>
            {": "}
            {points[shown].value === null ? "no completed periods" : `${pct(points[shown].value)} consistency`}
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" onMouseLeave={() => setSel(null)}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#ecebe6" strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="#97958e">
              {v * 100}%
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.key} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#97958e">
              {p.label}
            </text>
          ) : null
        )}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={HIT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((p, i) =>
          p.value === null ? null : (
            <g key={p.key}>
              <circle cx={x(i)} cy={y(p.value)} r={shown === i ? 5 : 3.5} fill={HIT} stroke="#fff" strokeWidth={2} />
              <rect
                x={x(i) - (W - padL - padR) / Math.max(1, n - 1) / 2}
                y={padT}
                width={(W - padL - padR) / Math.max(1, n - 1)}
                height={H - padT - padB}
                fill="transparent"
                onMouseEnter={() => setSel(i)}
                onClick={() => setSel(i)}
              />
            </g>
          )
        )}
      </svg>
    </div>
  );
}

/* ---------------- day of week ---------------- */

export function DowBars({ bars }: { bars: DowBar[] }) {
  const any = bars.some((b) => b.value !== null);
  if (!any) return <p className="py-6 text-center text-sm text-faint">Not enough history yet.</p>;
  const values = bars.map((b) => b.value ?? 0);
  const min = Math.min(...bars.filter((b) => b.value !== null).map((b) => b.value as number));
  return (
    <div className="flex h-[150px] items-end gap-2">
      {bars.map((b, i) => {
        const v = b.value;
        const isLow = v !== null && v === min && Math.max(...values) - min >= 0.1;
        return (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className={cx("mb-1 text-[11px] tabular-nums", isLow ? "font-semibold text-ink" : "text-muted")}>{pct(v)}</span>
            <div className="flex w-full max-w-[44px] flex-1 items-end">
              <div
                className="w-full rounded-t-[4px]"
                title={`${WEEKDAYS[i]}: ${b.done} of ${b.active} goal-days`}
                style={{ height: `${Math.max(2, (v ?? 0) * 100)}%`, background: isLow ? "#86b6ef" : HIT }}
              />
            </div>
            <span className="mt-1.5 text-[11px] text-faint">{WEEKDAYS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- period bars for one goal ---------------- */

export interface PeriodBarItem {
  key: string;
  label: string;
  done: number;
  target: number;
  status: "hit" | "miss" | "open";
}

export function PeriodBars({ items, unit }: { items: PeriodBarItem[]; unit: string }) {
  const [sel, setSel] = useState<number | null>(null);
  if (!items.length) return <p className="py-6 text-center text-sm text-faint">No history yet.</p>;
  const max = Math.max(...items.map((i) => Math.max(i.done, i.target)), 1);
  const shown = sel ?? items.length - 1;
  const it = items[shown];
  return (
    <div>
      <div className="mb-2 min-h-[18px] text-[12px] text-muted">
        <span className="font-medium text-ink">{it.label}</span>: {it.done} of {it.target} {unit}
        {it.status === "hit" ? " · target met" : it.status === "miss" ? " · missed" : " · in progress"}
      </div>
      <div className="flex h-[120px] items-end gap-1.5">
        {items.map((p, i) => {
          const h = (p.done / max) * 100;
          const t = (p.target / max) * 100;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              className="relative flex h-full flex-1 items-end"
              aria-label={`${p.label}: ${p.done} of ${p.target}`}
            >
              <div
                className={cx("w-full rounded-t-[4px]", shown === i && "ring-2 ring-ink/40")}
                style={{
                  height: `${Math.max(3, h)}%`,
                  background: p.status === "hit" ? HIT : p.status === "open" ? "#86b6ef" : MISS,
                }}
              />
              <div className="pointer-events-none absolute inset-x-[-2px] border-t-2 border-dashed border-ink/40" style={{ bottom: `${t}%` }} />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-faint">
        <span>{items[0].label}</span>
        <span>{items[items.length - 1].label}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: HIT }} /> Target met</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: MISS }} /> Missed</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "#86b6ef" }} /> In progress</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 border-t-2 border-dashed border-ink/40" /> Target</span>
      </div>
    </div>
  );
}

/* ---------------- goal x week matrix ---------------- */

export function GoalMatrix({
  rows,
  weeks,
}: {
  rows: Array<{ id: string; name: string; sub?: string; cells: MatrixCell[] }>;
  weeks: string[];
}) {
  const [picked, setPicked] = useState<{ r: number; c: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);
  if (!rows.length) return <p className="py-4 text-sm text-faint">No goals here yet.</p>;
  const pickedRow = picked ? rows[picked.r] : null;
  const pickedCell = picked && pickedRow ? pickedRow.cells[picked.c] : null;
  return (
    <div>
      <div ref={scroller} className="scrollbar-thin overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface" />
              {weeks.map((w) => (
                <th key={w} className="px-0 pb-1 text-center text-[10px] font-normal leading-tight text-faint">
                  {fmtMonthDay(w).replace(" ", " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.id}>
                <th className="sticky left-0 z-10 max-w-[150px] bg-surface pr-2 text-left align-middle font-normal">
                  <div className="truncate text-[13px] text-ink">{row.name}</div>
                  {row.sub && <div className="truncate text-[11px] text-faint">{row.sub}</div>}
                </th>
                {row.cells.map((c, ci) => (
                  <td key={ci} className="p-0">
                    <button
                      type="button"
                      onClick={() => setPicked(picked && picked.r === r && picked.c === ci ? null : { r, c: ci })}
                      title={`${fmtMonthDay(weeks[ci])} week: ${c.label}`}
                      className={cx(
                        "relative flex h-8 w-11 items-center justify-center rounded-[5px] text-[11px] font-semibold",
                        picked?.r === r && picked?.c === ci && "ring-2 ring-ink/60"
                      )}
                      style={{
                        background: c.ratio === null ? "transparent" : levelColor(c.ratio),
                        border: c.ratio === null ? "1px dashed #e4e2dc" : undefined,
                        color: c.ratio !== null && c.ratio >= 0.67 ? "#fff" : "#5d5c57",
                      }}
                    >
                      {c.hit === true ? "✓" : c.open && c.ratio !== null ? "·" : ""}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="min-h-[18px] text-[12px] text-muted">
          {pickedRow && pickedCell
            ? `${pickedRow.name}, week of ${fmtMonthDay(weeks[picked!.c])}: ${pickedCell.label}${pickedCell.hit === true ? " · target met" : pickedCell.hit === false ? " · missed" : pickedCell.open ? " · in progress" : ""}`
            : "✓ = target met for the week · tap a cell for details"}
        </span>
        <div className="ml-auto">
          <Legend />
        </div>
      </div>
    </div>
  );
}
