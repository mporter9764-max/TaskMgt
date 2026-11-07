"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkoutStore } from "@/lib/useWorkoutStore";
import { describeSet, describeTarget, fieldsFor, hasMuscles, plansOn, type Exercise, type Plan, type Session, type SessionItem, type WSet } from "@/lib/workouts";
import { addDays, diffDays, fmtLong, fmtMonthDay, fmtRelative, fmtShort, todayStr } from "@/lib/dates";
import { alpha } from "@/lib/colors";
import { Button, EmptyState, Field, IconButton, Select, Sheet, TextArea, TextInput, cx } from "../ui";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, More, Plus, Trash } from "../icons";
import { ExercisePicker } from "./PlansView";

export function LogView({
  store,
  today,
  onFinished,
}: {
  store: WorkoutStore;
  today: string;
  /** called when a workout is marked finished (used to check off the linked goal) */
  onFinished: (date: string) => void;
}) {
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState(false);
  useEffect(() => setDate(today), [today]);

  const scheduled = plansOn(store.plans, date);
  const daySessions = store.sessions.filter((s) => s.session_date === date).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const scheduledIds = new Set(scheduled.map((p) => p.id));
  const extra = daySessions.filter((s) => !s.plan_id || !scheduledIds.has(s.plan_id));

  return (
    <div className="pb-28">
      <div className="mb-3 flex items-center gap-2">
        <IconButton label="Previous day" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft />
        </IconButton>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[17px] font-semibold text-ink">{fmtRelative(date, today)}</div>
          <div className="text-[12px] text-faint">{fmtLong(date)}</div>
        </div>
        <IconButton label="Next day" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight />
        </IconButton>
      </div>
      {date !== today && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent-deep">
          {date < today ? `${diffDays(date, today)} ${diffDays(date, today) === 1 ? "day" : "days"} ago` : `In ${diffDays(today, date)} ${diffDays(today, date) === 1 ? "day" : "days"}`}
          <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setDate(today)}>
            Back to today
          </button>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {scheduled.map((p) => {
          const s = daySessions.find((x) => x.plan_id === p.id);
          return s ? (
            <SessionCard key={p.id} store={store} session={s} color={p.color} onFinished={onFinished} />
          ) : (
            <PlanPreview key={p.id} store={store} plan={p} date={date} />
          );
        })}
        {extra.map((s) => (
          <SessionCard key={s.id} store={store} session={s} color={store.plans.find((p) => p.id === s.plan_id)?.color ?? "#97958e"} onFinished={onFinished} />
        ))}
      </div>

      {scheduled.length === 0 && extra.length === 0 && <EmptyState title="Rest day" body="Nothing planned. Add a workout below if you're training anyway." />}

      <div className="mt-4 flex justify-center">
        <Button onClick={() => setAdding(true)}>
          <Plus size={16} /> Add workout
        </Button>
      </div>

      <AddWorkoutSheet open={adding} store={store} date={date} onClose={() => setAdding(false)} />
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function PlanPreview({ store, plan, date }: { store: WorkoutStore; plan: Plan; date: string }) {
  const [busy, setBusy] = useState(false);
  const items = store.planItems.filter((i) => i.plan_id === plan.id).sort((a, b) => a.sort_order - b.sort_order);
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <CardHeader color={plan.color} title={plan.name} sub={`${items.length} ${items.length === 1 ? "exercise" : "exercises"} · not started`} />
      <ul>
        {items.map((it) => {
          const ex = store.exById.get(it.exercise_id);
          const last = ex ? store.lastSets(ex.id, date) : null;
          return (
            <li key={it.id} className="border-t border-line px-3.5 py-2">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">{ex?.name ?? "Missing exercise"}</span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-muted">{ex ? describeTarget(ex.kind, it) : ""}</span>
              </div>
              {ex && last && <div className="mt-0.5 text-[12px] text-faint">Last {fmtMonthDay(last.date)}: {last.sets.map((s) => describeSet(ex.kind, s)).join(", ")}</div>}
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line p-3">
        <Button
          variant="primary"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await store.startSession(date, plan);
            setBusy(false);
          }}
        >
          {busy ? "Starting…" : date <= todayStr() ? "Start workout" : "Start early"}
        </Button>
      </div>
    </section>
  );
}

function CardHeader({ color, title, sub, right }: { color: string; title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ background: alpha(color, 0.08) }}>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-ink">{title}</div>
        {sub && <div className="text-[12px] text-muted">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function SessionCard({ store, session, color, onFinished }: { store: WorkoutStore; session: Session; color: string; onFinished: (date: string) => void }) {
  const [menu, setMenu] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [notes, setNotes] = useState(session.notes);
  useEffect(() => setNotes(session.notes), [session.notes]);

  const items = store.idx.itemsBySession.get(session.id) ?? [];
  let total = 0;
  let done = 0;
  for (const it of items)
    for (const s of store.idx.setsByItem.get(it.id) ?? []) {
      total++;
      if (s.done) done++;
    }
  const finished = Boolean(session.completed_at);
  const activeExercises = store.exercises.filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <CardHeader
        color={color}
        title={session.name}
        sub={
          finished ? (
            <span className="inline-flex items-center gap-1 font-medium text-[#0f7a52]">
              <Check size={13} strokeWidth={3} /> Finished · {done} of {total} sets
            </span>
          ) : (
            `${done} of ${total} sets done`
          )
        }
        right={
          <IconButton label="Workout options" active={menu} onClick={() => setMenu((m) => !m)}>
            <More />
          </IconButton>
        }
      />
      {menu && (
        <div className="flex flex-wrap gap-2 border-t border-line bg-canvas/60 px-3.5 py-2.5">
          <Button size="sm" onClick={() => setCopyOpen(true)}>
            <Copy size={14} /> Copy to another day
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (window.confirm(`Delete this ${session.name} workout and everything logged in it?`)) store.deleteSession(session);
            }}
          >
            <Trash size={14} /> Delete workout
          </Button>
        </div>
      )}

      <div>
        {items.map((it, i) => (
          <ExerciseBlock key={it.id} store={store} session={session} item={it} index={i} count={items.length} />
        ))}
      </div>

      <div className="space-y-3 border-t border-line p-3">
        <ExercisePicker exercises={activeExercises} onPick={(id) => store.addExercise(session, id)} placeholder="+ Add exercise…" />
        <TextArea
          rows={2}
          placeholder="Notes (how it felt, anything to change next time)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== session.notes && store.updateSession(session, { notes })}
        />
        <Button
          variant={finished ? "secondary" : "primary"}
          className="w-full"
          onClick={() => {
            const completed_at = finished ? null : new Date().toISOString();
            store.updateSession(session, { completed_at });
            if (!finished) onFinished(session.session_date);
          }}
        >
          {finished ? "Mark as not finished" : "Finish workout"}
        </Button>
      </div>

      <CopySheet open={copyOpen} session={session} store={store} onClose={() => setCopyOpen(false)} />
    </section>
  );
}

function ExerciseBlock({ store, session, item, index, count }: { store: WorkoutStore; session: Session; item: SessionItem; index: number; count: number }) {
  const [edit, setEdit] = useState(false);
  const ex = store.exById.get(item.exercise_id);
  const sets = store.idx.setsByItem.get(item.id) ?? [];
  const last = useMemo(() => (ex ? store.lastSets(ex.id, session.session_date, session.id) : null), [ex, store, session.session_date, session.id]);
  if (!ex) return null;
  const allDone = sets.length > 0 && sets.every((s) => s.done);

  return (
    <div className="border-t border-line px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className={cx("truncate text-[15px] font-medium", allDone ? "text-muted" : "text-ink")}>
            {allDone && <Check size={14} strokeWidth={3} className="mr-1 inline text-[#0f7a52]" />}
            {ex.name}
          </div>
          {last && (
            <div className="truncate text-[12px] text-faint">
              Last {fmtMonthDay(last.date)}: {last.sets.map((s) => describeSet(ex.kind, s)).join(", ")}
            </div>
          )}
        </div>
        <IconButton label={`Edit ${ex.name}`} active={edit} onClick={() => setEdit((v) => !v)} className="h-8 w-8">
          <More size={16} />
        </IconButton>
      </div>

      {edit && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => store.moveItem(item, -1)}>
            <ChevronUp size={14} /> Up
          </Button>
          <Button size="sm" variant="ghost" disabled={index === count - 1} onClick={() => store.moveItem(item, 1)}>
            <ChevronDown size={14} /> Down
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (window.confirm(`Remove ${ex.name} from this workout?`)) store.removeItem(item);
            }}
          >
            <Trash size={14} /> Remove exercise
          </Button>
          <span className="text-[12px] text-faint">Tap × on a set to delete it.</span>
        </div>
      )}

      <div className="mt-1.5 space-y-1">
        <SetHeader ex={ex} />
        {sets.map((s) => (
          <SetRow key={s.id} ex={ex} set={s} store={store} editing={edit} />
        ))}
      </div>
      <button type="button" onClick={() => store.addSet(item)} className="mt-1 inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-accent hover:bg-accent-soft">
        <Plus size={14} /> Add set
      </button>
    </div>
  );
}

function SetHeader({ ex }: { ex: Exercise }) {
  const f = fieldsFor(ex.kind);
  return (
    <div className="flex items-center gap-1.5 px-0.5 text-[11px] font-medium uppercase tracking-wide text-faint">
      <span className="w-6 text-center">Set</span>
      {f.weight && <span className="w-[76px] text-center">{ex.kind === "bodyweight" ? "+lb" : "lb"}</span>}
      {f.weight && f.reps && <span className="w-3" />}
      {f.reps && <span className="w-[58px] text-center">Reps</span>}
      {f.seconds && <span className="w-[76px] text-center">Seconds</span>}
      {f.minutes && <span className="w-[76px] text-center">Minutes</span>}
      <span className="flex-1" />
      {hasMuscles(ex) && <span className="w-10 text-center">Hard</span>}
      <span className="w-11 text-center">Done</span>
    </div>
  );
}

type Field4 = "weight" | "reps" | "seconds" | "minutes";

function SetRow({ ex, set, store, editing }: { ex: Exercise; set: WSet; store: WorkoutStore; editing: boolean }) {
  const f = fieldsFor(ex.kind);
  const [vals, setVals] = useState<Record<Field4, string>>(() => toText(set));
  const timer = useRef<number | null>(null);
  const latest = useRef(vals);
  latest.current = vals;

  // follow server values unless the user is mid-edit
  useEffect(() => {
    if (!timer.current) setVals(toText(set));
  }, [set]);

  function parsed(v: Record<Field4, string>) {
    const n = (t: string) => (t.trim() === "" ? null : Number(t));
    return { weight: n(v.weight), reps: n(v.reps), seconds: n(v.seconds), minutes: n(v.minutes) };
  }

  function flush() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const p = parsed(latest.current);
    if (p.weight !== set.weight || p.reps !== set.reps || p.seconds !== set.seconds || p.minutes !== set.minutes) store.updateSet(set, p);
  }

  function change(k: Field4, text: string) {
    const clean = text.replace(/[^\d.]/g, "");
    const next = { ...vals, [k]: clean };
    setVals(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      flush();
    }, 700);
  }

  const box = (k: Field4, w: string, placeholder: string) => (
    <input
      inputMode={k === "weight" || k === "minutes" ? "decimal" : "numeric"}
      value={vals[k]}
      placeholder={placeholder}
      onChange={(e) => change(k, e.target.value)}
      onBlur={flush}
      onFocus={(e) => e.currentTarget.select()}
      className={cx(
        "h-11 rounded-lg border text-center text-[17px] font-semibold tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
        w,
        set.done ? "border-transparent bg-sunken text-muted" : "border-line bg-surface text-ink"
      )}
    />
  );

  return (
    <div className="flex items-center gap-1.5">
      {editing ? (
        <button type="button" aria-label={`Delete set ${set.set_no}`} onClick={() => store.deleteSet(set)} className="flex h-11 w-6 items-center justify-center text-danger">
          ×
        </button>
      ) : (
        <span className="w-6 text-center text-[13px] font-medium tabular-nums text-faint">{set.set_no}</span>
      )}
      {f.weight && box("weight", "w-[76px]", ex.kind === "bodyweight" ? "BW" : "lb")}
      {f.weight && f.reps && <span className="w-3 text-center text-[13px] text-faint">×</span>}
      {f.reps && box("reps", "w-[58px]", "reps")}
      {f.seconds && box("seconds", "w-[76px]", "sec")}
      {f.minutes && box("minutes", "w-[76px]", "min")}
      <span className="flex-1" />
      {hasMuscles(ex) && (
        <button
          type="button"
          aria-label={`Set ${set.set_no} hard set`}
          aria-pressed={set.hard}
          onClick={() => store.updateSet(set, { hard: !set.hard })}
          className={cx(
            "flex h-9 w-10 items-center justify-center rounded-lg border text-[13px] font-bold transition-colors",
            set.hard ? "border-[#eb6834] bg-[#fdeee6] text-[#b4461b]" : "border-line bg-surface text-faint"
          )}
        >
          H
        </button>
      )}
      <button
        type="button"
        aria-label={`Set ${set.set_no} done`}
        aria-pressed={set.done}
        onClick={() => {
          const p = parsed(latest.current);
          if (timer.current) {
            window.clearTimeout(timer.current);
            timer.current = null;
          }
          store.updateSet(set, { ...p, done: !set.done });
          if (!set.done) {
            try {
              navigator.vibrate?.(8);
            } catch {
              /* ignore */
            }
          }
        }}
        className="flex h-11 w-11 items-center justify-center"
      >
        <span
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 transition-colors"
          style={{ borderColor: set.done ? "#1baf7a" : "#d6d4cd", background: set.done ? "#1baf7a" : "transparent", color: set.done ? "#fff" : "#b9b7b0" }}
        >
          <Check size={18} strokeWidth={3} />
        </span>
      </button>
    </div>
  );
}

function toText(s: WSet): Record<Field4, string> {
  const t = (v: number | null) => (v === null || v === undefined ? "" : String(+v));
  return { weight: t(s.weight), reps: t(s.reps), seconds: t(s.seconds), minutes: t(s.minutes) };
}

/* ---------------------------------------------------------------------------------------------- */

function AddWorkoutSheet({ open, store, date, onClose }: { open: boolean; store: WorkoutStore; date: string; onClose: () => void }) {
  const [planId, setPlanId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setPlanId("");
      setName("");
    }
  }, [open]);
  const taken = new Set(store.sessions.filter((s) => s.session_date === date && s.plan_id).map((s) => s.plan_id));
  const plans = [...store.plans].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Add a workout · ${fmtShort(date)}`}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || (!planId && !name.trim())}
            onClick={async () => {
              setBusy(true);
              const plan = planId ? store.plans.find((p) => p.id === planId) ?? null : null;
              await store.startSession(date, plan, name.trim() || "Workout");
              setBusy(false);
              onClose();
            }}
          >
            Start
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Run one of your plans">
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Choose a plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id} disabled={taken.has(p.id)}>
                {p.name}
                {taken.has(p.id) ? " (already on this day)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {!planId && (
          <Field label="Or start an empty workout" hint="Add exercises once it's started.">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Workout name, e.g. Hotel gym" />
          </Field>
        )}
      </div>
    </Sheet>
  );
}

function CopySheet({ open, session, store, onClose }: { open: boolean; session: Session; store: WorkoutStore; onClose: () => void }) {
  const [to, setTo] = useState(addDays(session.session_date, 1));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setTo(addDays(session.session_date, 1));
  }, [open, session.session_date]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Copy ${session.name}`}
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!to || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await store.copySession(session, to);
              setBusy(false);
              if (ok) onClose();
            }}
          >
            Copy
          </Button>
        </>
      }
    >
      <Field label="Copy to" hint="Copies the exercises and numbers, with every set unchecked. To repeat a workout every week, use a plan instead.">
        <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
    </Sheet>
  );
}
