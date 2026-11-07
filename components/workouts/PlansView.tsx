"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanItemInput, WorkoutStore } from "@/lib/useWorkoutStore";
import { MUSCLE_GROUPS, MUSCLE_GROUP_OF, describeTarget, fieldsFor, hasMuscles, muscleCredit, type Exercise, type Plan } from "@/lib/workouts";
import { TAG_PALETTE } from "@/lib/colors";
import { fmtMonthDay, todayStr, weekStart, WEEKDAYS } from "@/lib/dates";
import { moveItem } from "@/lib/db";
import { Button, ColorPicker, EmptyState, Field, IconButton, OrderControls, Select, Sheet, TextInput, cx } from "../ui";
import { Copy, Pencil, Plus, Trash } from "../icons";
import { ExerciseEditor } from "./ExercisesView";

export function PlansView({ store }: { store: WorkoutStore }) {
  const [editing, setEditing] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const today = todayStr();

  const plans = [...store.plans].sort((a, b) => a.sort_order - b.sort_order);
  const status = (p: Plan) => (p.end_date && p.end_date < today ? "ended" : p.start_date > today ? "upcoming" : "active");

  return (
    <div className="pb-28">
      <div className="mb-3 flex items-center gap-2">
        <p className="flex-1 text-[13px] text-muted">A plan repeats on its days between its start and end dates. Editing a plan never changes workouts you already logged.</p>
        <Button variant="primary" onClick={() => setEditing({ open: true, plan: null })}>
          <Plus size={16} /> Plan
        </Button>
      </div>

      {plans.length === 0 && <EmptyState title="No plans yet" body="Create a plan, pick its exercises and the days it runs." />}

      <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {plans.map((p) => {
          const items = store.planItems.filter((i) => i.plan_id === p.id).sort((a, b) => a.sort_order - b.sort_order);
          const hardSets = items.reduce((sum, it) => sum + (hasMuscles(store.exById.get(it.exercise_id)) ? it.target_sets : 0), 0);
          const st = status(p);
          return (
            <section key={p.id} className={cx("overflow-hidden rounded-xl border border-line bg-surface shadow-card", st === "ended" && "opacity-60")}>
              <div className="flex items-start gap-2 px-3.5 pt-3">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-ink">{p.name}</div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    {fmtMonthDay(p.start_date)} – {p.end_date ? fmtMonthDay(p.end_date) : "ongoing"}
                    {st !== "active" && <span className="ml-1.5 rounded bg-sunken px-1.5 py-0.5 text-[11px]">{st === "ended" ? "Ended" : "Upcoming"}</span>}
                  </div>
                </div>
                <IconButton label={`Duplicate ${p.name}`} onClick={() => store.duplicatePlan(p)}>
                  <Copy size={16} />
                </IconButton>
                <IconButton label={`Edit ${p.name}`} onClick={() => setEditing({ open: true, plan: p })}>
                  <Pencil size={16} />
                </IconButton>
              </div>
              <div className="flex gap-1 px-3.5 pt-2.5">
                {WEEKDAYS.map((d, i) => (
                  <span
                    key={d}
                    className={cx(
                      "flex h-7 w-8 items-center justify-center rounded-md text-[11px] font-semibold",
                      p.days.includes(i) ? "text-white" : "bg-sunken text-faint"
                    )}
                    style={p.days.includes(i) ? { background: p.color } : undefined}
                  >
                    {d.slice(0, 2)}
                  </span>
                ))}
              </div>
              <ul className="mt-3 border-t border-line">
                {items.map((it) => {
                  const ex = store.exById.get(it.exercise_id);
                  return (
                    <li key={it.id} className="flex items-baseline gap-2 border-b border-line px-3.5 py-1.5 text-[13.5px] last:border-b-0">
                      <span className="min-w-0 flex-1 truncate text-ink">{ex?.name ?? "Missing exercise"}</span>
                      <span className="shrink-0 tabular-nums text-muted">{ex ? describeTarget(ex.kind, it) : ""}</span>
                    </li>
                  );
                })}
              </ul>
              {hardSets > 0 && (
                <div className="border-t border-line bg-canvas/60 px-3.5 py-2 text-[12px] text-muted">
                  {hardSets} working {hardSets === 1 ? "set" : "sets"} per session · {p.days.length} {p.days.length === 1 ? "day" : "days"} a week
                </div>
              )}
            </section>
          );
        })}
      </div>

      <PlanEditor state={editing} store={store} onClose={() => setEditing({ open: false, plan: null })} />
    </div>
  );
}

interface DraftItem extends PlanItemInput {
  key: string;
}

function PlanEditor({ state, store, onClose }: { state: { open: boolean; plan: Plan | null }; store: WorkoutStore; onClose: () => void }) {
  const { plan } = state;
  const [name, setName] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState(todayStr());
  const [end, setEnd] = useState("");
  const [color, setColor] = useState(TAG_PALETTE[0]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [newEx, setNewEx] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    setName(plan?.name ?? "");
    setDays(plan?.days ?? []);
    setStart(plan?.start_date ?? weekStart(todayStr()));
    setEnd(plan?.end_date ?? "");
    setColor(plan?.color ?? TAG_PALETTE[store.plans.length % TAG_PALETTE.length]);
    setItems(
      plan
        ? store.planItems
            .filter((i) => i.plan_id === plan.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(({ id, plan_id: _p, ...rest }) => {
              void _p;
              return { ...rest, key: id };
            })
        : []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, plan]);

  const activeExercises = useMemo(() => store.exercises.filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name)), [store.exercises]);

  function addItem(exerciseId: string) {
    const ex = store.exById.get(exerciseId);
    if (!ex) return;
    const cardio = ex.kind === "cardio" || ex.kind === "carry";
    setItems((p) => [
      ...p,
      {
        key: `new-${Date.now()}-${Math.random()}`,
        exercise_id: exerciseId,
        sort_order: p.length,
        target_sets: cardio ? 1 : 2,
        target_reps: null,
        target_weight: null,
        target_seconds: null,
        target_minutes: cardio ? 30 : null,
      },
    ]);
  }

  function patch(key: string, p: Partial<DraftItem>) {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));
  }

  const perMuscle = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const ex = store.exById.get(it.exercise_id);
      if (!ex) continue;
      for (const [mu, c] of muscleCredit(ex)) m.set(mu, (m.get(mu) ?? 0) + c * it.target_sets * Math.max(1, days.length));
    }
    return m;
  }, [items, days, store.exById]);

  const valid = name.trim() && days.length > 0 && start && (!end || end >= start);

  async function save() {
    if (!valid) return;
    setSaving(true);
    const ok = await store.savePlan(
      { name: name.trim(), days: [...days].sort(), start_date: start, end_date: end || null, color },
      items.map(({ key: _k, ...it }) => {
        void _k;
        return it;
      }),
      plan?.id
    );
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Sheet
      open={state.open}
      onClose={onClose}
      wide
      title={plan ? "Edit plan" : "New plan"}
      footer={
        <>
          {plan && (
            <Button
              variant="danger"
              onClick={async () => {
                if (!window.confirm(`Delete ${plan.name}? Workouts you already logged are kept.`)) return;
                await store.deletePlan(plan);
                onClose();
              }}
            >
              <Trash size={16} /> Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid || saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Plan name">
          <TextInput autoFocus={!plan} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Full Body A" />
        </Field>

        <Field label="Days">
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const on = days.includes(i);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays((p) => (on ? p.filter((x) => x !== i) : [...p, i]))}
                  className={cx("h-10 w-12 rounded-lg border text-[13px] font-semibold transition-colors", on ? "border-transparent text-white" : "border-line bg-surface text-muted")}
                  style={on ? { background: color } : undefined}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Ends (optional)">
            <TextInput type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <Field label="Color">
          <ColorPicker colors={TAG_PALETTE} value={color} onChange={setColor} />
        </Field>

        <Field label="Exercises">
          <div className="space-y-2">
            {items.length === 0 && <p className="text-[13px] text-faint">No exercises yet. Add some below.</p>}
            {items.map((it, i) => {
              const ex = store.exById.get(it.exercise_id);
              return (
                <div key={it.key} className="rounded-xl border border-line p-2.5">
                  <div className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">{ex?.name ?? "Missing exercise"}</span>
                    <OrderControls index={i} count={items.length} onMove={(to) => setItems((l) => moveItem(l, i, to))} />
                    <IconButton label="Remove from plan" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>
                      <Trash size={15} />
                    </IconButton>
                  </div>
                  {ex && <TargetInputs ex={ex} item={it} onChange={(p) => patch(it.key, p)} />}
                </div>
              );
            })}
            <div className="flex gap-2 pt-1">
              <ExercisePicker exercises={activeExercises} onPick={addItem} placeholder="+ Add exercise…" />
              <Button onClick={() => setNewEx(true)}>New exercise</Button>
            </div>
          </div>
        </Field>

        {perMuscle.size > 0 && (
          <div className="rounded-lg bg-sunken px-3 py-2.5 text-[12.5px] text-muted">
            <div className="mb-1 font-medium text-ink">This plan adds per week</div>
            {MUSCLE_GROUPS.flatMap((g) => g.muscles)
              .filter((m) => perMuscle.has(m.id))
              .map((m) => `${m.label} ${fmtSets(perMuscle.get(m.id) as number)}`)
              .join(" · ")}
          </div>
        )}
      </div>

      <ExerciseEditor state={{ open: newEx, ex: null }} store={store} onClose={() => setNewEx(false)} onCreated={(ex) => addItem(ex.id)} />
    </Sheet>
  );
}

function fmtSets(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function NumBox({ label, value, onChange, suffix, step }: { label: string; value: number | null; onChange: (v: number | null) => void; suffix?: string; step?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-faint">{label}</span>
      <div className="relative">
        <TextInput
          inputMode={step === "any" ? "decimal" : "numeric"}
          value={value === null ? "" : String(value)}
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d.]/g, "");
            onChange(t === "" ? null : Number(t));
          }}
          className={cx("h-9 tabular-nums", suffix && "pr-9")}
        />
        {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-faint">{suffix}</span>}
      </div>
    </label>
  );
}

function TargetInputs({ ex, item, onChange }: { ex: Exercise; item: PlanItemInput; onChange: (p: Partial<PlanItemInput>) => void }) {
  const f = fieldsFor(ex.kind);
  return (
    <div className="mt-2 grid grid-cols-4 gap-2">
      <NumBox label="Sets" value={item.target_sets} onChange={(v) => onChange({ target_sets: Math.max(1, v ?? 1) })} />
      {f.reps && <NumBox label="Reps" value={item.target_reps} onChange={(v) => onChange({ target_reps: v })} />}
      {f.weight && <NumBox label={ex.kind === "bodyweight" ? "Added lb" : "Weight"} value={item.target_weight} onChange={(v) => onChange({ target_weight: v })} suffix="lb" step="any" />}
      {f.seconds && <NumBox label="Seconds" value={item.target_seconds} onChange={(v) => onChange({ target_seconds: v })} suffix="s" />}
      {f.minutes && <NumBox label="Minutes" value={item.target_minutes} onChange={(v) => onChange({ target_minutes: v })} suffix="min" step="any" />}
    </div>
  );
}

/** Grouped select that fires on choice and resets, so it works as an "add" control. */
export function ExercisePicker({ exercises, onPick, placeholder }: { exercises: Exercise[]; onPick: (id: string) => void; placeholder: string }) {
  const groups = [
    ...MUSCLE_GROUPS.map((g) => ({ label: g.label, items: exercises.filter((e) => e.primary_muscle && MUSCLE_GROUP_OF.get(e.primary_muscle) === g.id) })),
    { label: "Cardio", items: exercises.filter((e) => !e.primary_muscle) },
  ].filter((g) => g.items.length);
  return (
    <Select
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
      className="flex-1"
    >
      <option value="">{placeholder}</option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
