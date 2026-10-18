"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Group, Occurrence, Task } from "@/lib/types";
import { addDays, diffDays, dayOfMonth, dow, MONTHS_LONG, monthIndex, monthEnd, minStr, todayStr, weekStart, WEEKDAYS, fmtRange } from "@/lib/dates";
import { occurrencesInRange } from "@/lib/recurrence";
import { textWidth } from "@/lib/measure";
import { deepen, solidTint } from "@/lib/colors";
import { Repeat } from "../icons";

export const ZOOMS = [20, 30, 44, 64];
const ROW_H = 30;
const BAR_H = 22;
const LANE_PAD = 6;
const MONTH_H = 22;
const DAY_H = 30;
const RANGE_WEEKS_BEFORE = 8;
const RANGE_WEEKS = 40;
const LABEL_FONT = "500 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

interface Lane {
  id: string;
  name: string;
  color: string;
}

interface Placed {
  occ: Occurrence;
  row: number;
  x0: number;
  x1: number;
  labelInside: boolean;
}

type DragMode = "move" | "start" | "end" | "tap";

interface DragState {
  occ: Occurrence;
  mode: DragMode;
  pointerType: string;
  startX: number;
  startY: number;
  active: boolean;
  moved: boolean;
  timer: number | null;
}

export function TimelineView({
  tasks,
  groups,
  showUngrouped,
  occDone,
  showCompleted,
  zoom,
  todaySignal,
  active,
  onOpen,
  onMove,
  onAdd,
}: {
  tasks: Task[];
  groups: Group[];
  showUngrouped: boolean;
  occDone: Set<string>;
  showCompleted: boolean;
  zoom: number;
  todaySignal: number;
  /** whether the Tasks tab is on screen (scrolling a hidden element does nothing) */
  active: boolean;
  onOpen: (task: Task, occDate: string | null) => void;
  onMove: (taskId: string, start: string, end: string) => void;
  /** add a task in a lane (null = no group) */
  onAdd: (groupId: string | null) => void;
}) {
  const today = todayStr();
  const dw = ZOOMS[zoom] ?? 30;
  const from = useMemo(() => weekStart(addDays(today, -7 * RANGE_WEEKS_BEFORE)), [today]);
  const to = addDays(from, RANGE_WEEKS * 7 - 1);
  const days = RANGE_WEEKS * 7;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [labelCol, setLabelCol] = useState(132);
  const [preview, setPreview] = useState<{ key: string; start: string; end: string } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;
  const implRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; cancel: () => void }>({
    move: () => {},
    up: () => {},
    cancel: () => {},
  });
  const stable = useMemo(
    () => ({
      move: (e: PointerEvent) => implRef.current.move(e),
      up: (e: PointerEvent) => implRef.current.up(e),
      cancel: () => implRef.current.cancel(),
    }),
    []
  );

  useEffect(() => {
    const set = () => setLabelCol(window.innerWidth < 640 ? 84 : 140);
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  // scroll so today sits near the left edge (on load, zoom change, or "Today")
  useEffect(() => {
    const el = scrollRef.current;
    if (el && active) el.scrollLeft = Math.max(0, (diffDays(from, today) - 3) * dw);
  }, [dw, from, today, todaySignal, active]);

  // block page scrolling while a touch drag is active
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (dragRef.current?.active) e.preventDefault();
    };
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, []);

  const lanes: Lane[] = useMemo(() => {
    const l: Lane[] = groups.map((g) => ({ id: g.id, name: g.name, color: g.color }));
    if (showUngrouped) l.push({ id: "__none", name: "No group", color: "#e4e2dc" });
    return l;
  }, [groups, showUngrouped]);

  const occs = useMemo(() => {
    const all = occurrencesInRange(tasks, occDone, from, to);
    return showCompleted ? all : all.filter((o) => !o.done);
  }, [tasks, occDone, from, to, showCompleted]);

  const placedByLane = useMemo(() => {
    const map = new Map<string, { items: Placed[]; rows: number }>();
    for (const lane of lanes) {
      const items = occs
        .filter((o) => (o.task.group_id ?? "__none") === lane.id)
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : diffDays(b.start, b.end) - diffDays(a.start, a.end)));
      const rowEnds: number[] = [];
      const placed: Placed[] = [];
      for (const occ of items) {
        const x0 = Math.max(0, diffDays(from, occ.start) * dw);
        const x1 = Math.min(days * dw, (diffDays(from, occ.end) + 1) * dw);
        const labelW = textWidth(occ.task.title, LABEL_FONT) + 16 + (occ.recurring ? 16 : 0);
        const labelInside = labelW <= x1 - x0;
        const extent = labelInside ? x1 : Math.max(x1, x0 + labelW + 8);
        let row = rowEnds.findIndex((e) => e + 4 <= x0);
        if (row === -1) {
          row = rowEnds.length;
          rowEnds.push(extent);
        } else rowEnds[row] = extent;
        placed.push({ occ, row, x0, x1, labelInside });
      }
      map.set(lane.id, { items: placed, rows: Math.max(1, rowEnds.length) });
    }
    return map;
  }, [lanes, occs, from, dw, days]);

  const months = useMemo(() => {
    const out: Array<{ key: string; left: number; width: number; label: string }> = [];
    for (let d = from; d <= to; ) {
      const end = minStr(monthEnd(d), to);
      out.push({
        key: d,
        left: diffDays(from, d) * dw,
        width: (diffDays(d, end) + 1) * dw,
        label: `${MONTHS_LONG[monthIndex(d)]} ${d.slice(0, 4)}`,
      });
      d = addDays(end, 1);
    }
    return out;
  }, [from, to, dw]);

  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(from, i)), [from, days]);
  const todayX = diffDays(from, today) * dw;
  const width = labelCol + days * dw;

  /* ---------------- drag & tap ---------------- */

  function endGesture() {
    const st = dragRef.current;
    if (st?.timer) window.clearTimeout(st.timer);
    dragRef.current = null;
    window.removeEventListener("pointermove", stable.move);
    window.removeEventListener("pointerup", stable.up);
    window.removeEventListener("pointercancel", stable.cancel);
  }

  function computeDates(st: DragState, clientX: number): { start: string; end: string } {
    const delta = Math.round((clientX - st.startX) / dw);
    const { start, end } = st.occ;
    if (st.mode === "move") return { start: addDays(start, delta), end: addDays(end, delta) };
    if (st.mode === "start") {
      const s = addDays(start, delta);
      return { start: s > end ? end : s, end };
    }
    const e = addDays(end, delta);
    return { start, end: e < start ? start : e };
  }

  function onPointerMove(e: PointerEvent) {
    const st = dragRef.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.active) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        st.moved = true;
        if (st.pointerType === "mouse" && st.mode !== "tap" && Math.abs(dx) > Math.abs(dy)) {
          st.active = true;
        } else if (st.pointerType !== "mouse") {
          // finger moved before the long-press fired: it's a scroll, let the browser have it
          endGesture();
          return;
        }
      }
      if (!st.active) return;
    }
    e.preventDefault();
    const next = computeDates(st, e.clientX);
    const cur = previewRef.current;
    if (!cur || cur.start !== next.start || cur.end !== next.end) setPreview({ key: st.occ.key, ...next });
  }

  function onPointerUp(e: PointerEvent) {
    const st = dragRef.current;
    if (!st) return;
    if (st.active) {
      const next = computeDates(st, e.clientX);
      if (next.start !== st.occ.start || next.end !== st.occ.end) onMove(st.occ.task.id, next.start, next.end);
    } else if (!st.moved) {
      onOpen(st.occ.task, st.occ.recurring ? st.occ.start : null);
    }
    setPreview(null);
    endGesture();
  }

  function onPointerCancel() {
    setPreview(null);
    endGesture();
  }

  function onBarPointerDown(e: React.PointerEvent<HTMLDivElement>, occ: Occurrence) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    endGesture();
    const rect = e.currentTarget.getBoundingClientRect();
    const off = e.clientX - rect.left;
    const touch = e.pointerType !== "mouse";
    const edge = touch ? 14 : 7;
    let mode: DragMode = "move";
    if (occ.recurring) mode = "tap";
    else if (rect.width >= edge * 3 + 8) {
      if (off < edge) mode = "start";
      else if (off > rect.width - edge) mode = "end";
    }
    const st: DragState = {
      occ,
      mode,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      moved: false,
      timer: null,
    };
    if (touch && mode !== "tap") {
      st.timer = window.setTimeout(() => {
        const cur = dragRef.current;
        if (cur && !cur.moved) {
          cur.active = true;
          setPreview({ key: occ.key, start: occ.start, end: occ.end });
          try {
            navigator.vibrate?.(12);
          } catch {
            /* ignore */
          }
        }
      }, 380);
    }
    dragRef.current = st;
    window.addEventListener("pointermove", stable.move, { passive: false });
    window.addEventListener("pointerup", stable.up);
    window.addEventListener("pointercancel", stable.cancel);
  }

  // window listeners must keep a stable identity across re-renders; they forward to the latest handlers
  implRef.current = { move: onPointerMove, up: onPointerUp, cancel: onPointerCancel };

  /* ---------------- render ---------------- */

  const weekendBg = `repeating-linear-gradient(to right, transparent 0, transparent ${5 * dw}px, rgba(120,115,100,0.07) ${5 * dw}px, rgba(120,115,100,0.07) ${7 * dw}px)`;
  const weekLines = `repeating-linear-gradient(to right, rgba(120,115,100,0.16) 0, rgba(120,115,100,0.16) 1px, transparent 1px, transparent ${7 * dw}px)`;

  return (
    <div ref={scrollRef} className="scrollbar-thin relative h-full overflow-auto overscroll-contain rounded-xl border border-line bg-surface">
      <div style={{ width }} className="relative">
        {/* header */}
        <div className="sticky top-0 z-30 flex bg-surface" style={{ height: MONTH_H + DAY_H }}>
          <div
            className="sticky left-0 z-40 flex shrink-0 items-end border-b border-r border-line bg-surface px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint"
            style={{ width: labelCol }}
          >
            Groups
          </div>
          <div className="relative border-b border-line" style={{ width: days * dw }}>
            {months.map((m) => (
              <div
                key={m.key}
                className="absolute top-0 border-l border-line"
                style={{ left: m.left, width: m.width, height: MONTH_H }}
              >
                <span className="sticky inline-block whitespace-nowrap px-2 text-[12px] font-semibold leading-[22px] text-ink" style={{ left: labelCol }}>
                  {m.label}
                </span>
              </div>
            ))}
            {dayList.map((d, i) => {
              const isToday = d === today;
              const wd = dow(d);
              return (
                <div
                  key={d}
                  className="absolute flex flex-col items-center justify-center leading-none"
                  style={{ left: i * dw, width: dw, top: MONTH_H, height: DAY_H }}
                >
                  {dw >= 30 && <span className={`text-[10px] ${isToday ? "text-accent" : "text-faint"}`}>{WEEKDAYS[wd][0]}</span>}
                  <span
                    className={`mt-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-0.5 text-[11px] ${
                      isToday ? "bg-accent font-semibold text-white" : wd >= 5 ? "text-faint" : "text-muted"
                    }`}
                  >
                    {dayOfMonth(d)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* lanes */}
        <div className="relative">
          <div
            className="pointer-events-none absolute bottom-0 top-0"
            style={{ left: labelCol, width: days * dw, backgroundImage: `${weekLines}, ${weekendBg}` }}
          />
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-[5] w-0.5 bg-accent/70"
            style={{ left: labelCol + todayX + dw / 2 - 1 }}
          />
          {lanes.map((lane) => {
            const info = placedByLane.get(lane.id) ?? { items: [], rows: 1 };
            const height = info.rows * ROW_H + LANE_PAD * 2;
            return (
              <div key={lane.id} className="flex border-b border-line" style={{ height }}>
                <div
                  className="group/lane sticky left-0 z-20 flex shrink-0 items-start gap-1 border-r border-line pl-2.5 pr-1 pt-2"
                  style={{ width: labelCol, background: solidTint(lane.color, 0.35) }}
                >
                  <span className="line-clamp-2 min-w-0 flex-1 break-words text-[12.5px] font-semibold leading-tight" style={{ color: deepen(lane.color, 0.72) }}>
                    {lane.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add task to ${lane.name}`}
                    title={`Add task to ${lane.name}`}
                    onClick={() => onAdd(lane.id === "__none" ? null : lane.id)}
                    className="-mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/70"
                    style={{ color: deepen(lane.color, 0.6) }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>
                <div className="relative" style={{ width: days * dw }}>
                  {info.items.map((p) => {
                    const isPreview = preview?.key === p.occ.key;
                    let x0 = p.x0;
                    let x1 = p.x1;
                    if (isPreview && preview) {
                      x0 = diffDays(from, preview.start) * dw;
                      x1 = (diffDays(from, preview.end) + 1) * dw;
                    }
                    const overdue = !p.occ.done && p.occ.end < today;
                    const color = lane.color;
                    return (
                      <div
                        key={p.occ.key}
                        role="button"
                        tabIndex={0}
                        aria-label={`${p.occ.task.title}, ${fmtRange(p.occ.start, p.occ.end)}`}
                        onPointerDown={(e) => onBarPointerDown(e, p.occ)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onOpen(p.occ.task, p.occ.recurring ? p.occ.start : null);
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`no-callout group absolute rounded-md ${p.occ.recurring ? "cursor-pointer" : "cursor-grab"} ${
                          isPreview ? "z-20 shadow-pop ring-2 ring-accent" : "z-10 hover:brightness-[0.97]"
                        }`}
                        style={{
                          left: x0 + 1,
                          width: Math.max(6, x1 - x0 - 2),
                          top: LANE_PAD + p.row * ROW_H + (ROW_H - BAR_H) / 2,
                          height: BAR_H,
                          background: color,
                          border: `1px solid ${deepen(color, 0.18)}`,
                          borderLeft: overdue ? "3px solid #c2410c" : undefined,
                          opacity: p.occ.done ? 0.5 : 1,
                          touchAction: "pan-x pan-y",
                        }}
                      >
                        <span
                          className={`pointer-events-none flex h-full items-center gap-1 whitespace-nowrap px-2 text-[12px] font-medium text-ink ${
                            p.occ.done ? "line-through" : ""
                          } ${p.labelInside ? "sticky w-max" : "absolute left-0 top-0"}`}
                          style={p.labelInside ? { left: labelCol } : undefined}
                        >
                          {p.occ.recurring && <Repeat size={11} className="shrink-0 text-muted" />}
                          {p.occ.task.title}
                        </span>
                        {!p.occ.recurring && !isPreview && x1 - x0 >= 52 && (
                          <>
                            <span className="absolute inset-y-1 left-0.5 w-1 cursor-ew-resize rounded-full opacity-0 transition-opacity group-hover:opacity-40" style={{ background: deepen(color, 0.6) }} />
                            <span className="absolute inset-y-1 right-0.5 w-1 cursor-ew-resize rounded-full opacity-0 transition-opacity group-hover:opacity-40" style={{ background: deepen(color, 0.6) }} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {lanes.length === 0 && <div className="p-6 text-sm text-muted">No groups selected.</div>}
        </div>
      </div>
    </div>
  );
}
