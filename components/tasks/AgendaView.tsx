"use client";

import { useMemo } from "react";
import type { Group, Occurrence, Task } from "@/lib/types";
import { addDays, fmtMonthDay, fmtRange, fmtRelative, maxStr, monthIndex, MONTHS_LONG, todayStr } from "@/lib/dates";
import { occurrencesInRange } from "@/lib/recurrence";
import { deepen } from "@/lib/colors";
import { Checkbox, EmptyState, cx } from "../ui";
import { Repeat } from "../icons";

const HORIZON_DAYS = 90;
const RECURRING_OVERDUE_DAYS = 7;

interface Row {
  occ: Occurrence;
  /** the date this row is listed under */
  on: string;
}

interface Section {
  key: string;
  title: string;
  tone?: "overdue";
  month?: string;
  rows: Row[];
}

export function AgendaView({
  tasks,
  groups,
  occDone,
  showCompleted,
  onOpen,
  onToggleTask,
  onToggleOcc,
}: {
  tasks: Task[];
  groups: Group[];
  occDone: Set<string>;
  showCompleted: boolean;
  onOpen: (task: Task, occDate: string | null) => void;
  onToggleTask: (task: Task) => void;
  onToggleOcc: (taskId: string, date: string) => void;
}) {
  const today = todayStr();
  const groupOrder = useMemo(() => new Map(groups.map((g, i) => [g.id, i])), [groups]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const sections = useMemo(() => {
    const horizon = addDays(today, HORIZON_DAYS);
    const overdue: Row[] = [];
    const byDate = new Map<string, Row[]>();
    const undated: Row[] = [];
    const done: Row[] = [];

    const occs = occurrencesInRange(tasks, occDone, addDays(today, -RECURRING_OVERDUE_DAYS), horizon);
    const nonRecurringDated = new Set(occs.filter((o) => !o.recurring).map((o) => o.task.id));

    for (const o of occs) {
      if (o.done) {
        if (!showCompleted) continue;
        // finished tasks dated today or later stay in place (grayed out); older ones go to "Completed recently"
        if (o.end < today) {
          if (o.end >= addDays(today, -14)) done.push({ occ: o, on: o.start });
          continue;
        }
      }
      if (o.end < today) {
        overdue.push({ occ: o, on: o.end });
        continue;
      }
      const on = maxStr(o.start, today);
      const list = byDate.get(on) ?? [];
      list.push({ occ: o, on });
      byDate.set(on, list);
    }

    for (const t of tasks) {
      if (t.recurrence !== "none") continue;
      const s = t.start_date ?? t.end_date;
      const e = t.end_date ?? t.start_date;
      if (!s || !e) {
        const occ: Occurrence = { key: t.id, task: t, start: "", end: "", recurring: false, done: t.completed };
        if (!t.completed) undated.push({ occ, on: "" });
        else if (showCompleted) done.push({ occ, on: "" });
        continue;
      }
      // non-recurring tasks that ended before the overdue window still count as overdue
      if (!nonRecurringDated.has(t.id) && e < today && !t.completed) {
        overdue.push({ occ: { key: t.id, task: t, start: s, end: e, recurring: false, done: false }, on: e });
      }
    }

    const sortRows = (rows: Row[]) =>
      rows.sort((a, b) => {
        if (a.occ.done !== b.occ.done) return a.occ.done ? 1 : -1;
        const ga = groupOrder.get(a.occ.task.group_id ?? "") ?? 999;
        const gb = groupOrder.get(b.occ.task.group_id ?? "") ?? 999;
        if (ga !== gb) return ga - gb;
        return a.occ.task.title.localeCompare(b.occ.task.title);
      });

    const out: Section[] = [];
    if (overdue.length) {
      overdue.sort((a, b) => (a.on < b.on ? -1 : 1));
      out.push({ key: "overdue", title: "Overdue", tone: "overdue", rows: overdue });
    }
    let lastMonth = today.slice(0, 7);
    Array.from(byDate.keys())
      .sort()
      .forEach((d) => {
        const m = d.slice(0, 7);
        out.push({
          key: d,
          title: fmtRelative(d, today),
          month: m !== lastMonth ? MONTHS_LONG[monthIndex(d)] : undefined,
          rows: sortRows(byDate.get(d) as Row[]),
        });
        lastMonth = m;
      });
    if (undated.length) out.push({ key: "undated", title: "No date", rows: sortRows(undated) });
    if (done.length) out.push({ key: "done", title: "Completed recently", rows: done });
    return out;
  }, [tasks, occDone, showCompleted, today, groupOrder]);

  if (!sections.length) {
    return <EmptyState title="Nothing scheduled" body="Add a task with the + button. Tasks without dates show up here too." />;
  }

  return (
    <div className="space-y-5 pb-28">
      {sections.map((sec) => (
        <section key={sec.key}>
          {sec.month && (
            <div className="mb-3 mt-6 flex items-center gap-3">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-faint">{sec.month}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          )}
          <h3
            className={cx(
              "sticky top-0 z-10 -mx-1 mb-1.5 bg-canvas/95 px-1 py-1 text-[13px] font-semibold backdrop-blur",
              sec.tone === "overdue" ? "text-danger" : "text-ink"
            )}
          >
            {sec.title}
            <span className="ml-2 font-normal text-faint">{sec.rows.length}</span>
          </h3>
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {sec.rows.map(({ occ, on }) => {
              const g = occ.task.group_id ? groupById.get(occ.task.group_id) : undefined;
              const multi = occ.start && occ.end && occ.start !== occ.end;
              const meta: string[] = [];
              if (sec.tone === "overdue") meta.push(occ.start === occ.end ? `Due ${fmtMonthDay(occ.end)}` : fmtRange(occ.start, occ.end));
              else if (multi) meta.push(on > occ.start ? `Through ${fmtMonthDay(occ.end)}` : fmtRange(occ.start, occ.end));
              return (
                <li
                  key={occ.key}
                  className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-sunken/60"
                  onClick={() => onOpen(occ.task, occ.recurring ? occ.start : null)}
                >
                  <Checkbox
                    checked={occ.done}
                    color={g ? deepen(g.color, 0.35) : undefined}
                    label={`Mark "${occ.task.title}" ${occ.done ? "not done" : "done"}`}
                    onChange={() => (occ.recurring ? onToggleOcc(occ.task.id, occ.start) : onToggleTask(occ.task))}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={cx("text-[15px] leading-snug text-ink", occ.done && "text-faint line-through")}>{occ.task.title}</div>
                    {(g || meta.length || occ.recurring) && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                        {g && (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ background: deepen(g.color, 0.2) }} />
                            {g.name}
                          </span>
                        )}
                        {meta.map((m) => (
                          <span key={m}>{m}</span>
                        ))}
                        {occ.recurring && <Repeat size={11} />}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
