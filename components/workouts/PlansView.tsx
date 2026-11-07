"use client";

import { useEffect, useMemo, useState } from "react";
import type { BlockInput, PlanItemInput, SlotInput, WorkoutStore } from "@/lib/useWorkoutStore";
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_OF,
  MUSCLE_LABEL,
  blockActiveOn,
  blockGrid,
  describeTarget,
  fieldsFor,
  fmtNum,
  muscleCredit,
  plansForDay,
  workingSetsForPlan,
  type Block,
  type Exercise,
  type Plan,
} from "@/lib/workouts";
import { TAG_PALETTE } from "@/lib/colors";
import { addDays, diffDays, fmtMonthDay, todayStr, weekStart, WEEKDAYS, WEEKDAYS_LONG } from "@/lib/dates";
import { moveItem } from "@/lib/db";
import { Button, ColorPicker, EmptyState, Field, IconButton, OrderControls, Select, Sheet, Switch, TextInput, cx } from "../ui";
import { Copy, Pencil, Plus, Trash, X } from "../icons";
import { ExerciseEditor } from "./ExercisesView";
import { MuscleHeatmap } from "./MuscleHeatmap";

const DAY_COLUMNS = WEEKDAYS.map((d, i) => ({ key: d, label: d.slice(0, 2), title: WEEKDAYS_LONG[i] }));

/* ---------------------------------------------------------------------------------------------- */
/* Plan tab: blocks on top, workout templates below                                               */
/* ---------------------------------------------------------------------------------------------- */

export function PlansView({ store }: { store: WorkoutStore }) {
  const today = todayStr();
  const [blockEditor, setBlockEditor] = useState<BlockEditorState>({ open: false, block: null, draft: null });
  const [workoutEditor, setWorkoutEditor] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const [showEnded, setShowEnded] = useState(false);

  const blocks = [...store.blocks].sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
  const status = (b: Block) => (b.end_date && b.end_date < today ? "ended" : b.start_date > today ? "upcoming" : "active");
  const visible = blocks.filter((b) => showEnded || status(b) !== "ended");
  const endedCount = blocks.filter((b) => status(b) === "ended").length;

  function duplicate(b: Block) {
    const start = b.end_date ? addDays(b.end_date, 1) : addDays(weekStart(today), 7);
    const end = b.end_date ? addDays(start, diffDays(b.start_date, b.end_date)) : null;
    setBlockEditor({
      open: true,
      block: null,
      draft: {
        name: `${b.name} (next)`,
        start_date: start,
        end_date: end,
        slots: store.blockSlots.filter((s) => s.block_id === b.id).map((s) => ({ day: s.day, plan_id: s.plan_id })),
      },
    });
  }

  return (
    <div className="space-y-6 pb-28">
      {/* blocks */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold text-ink">Blocks</h2>
          <span className="text-[13px] text-muted">A block is a date range with a weekly layout of workouts.</span>
          <div className="ml-auto flex items-center gap-3">
            {endedCount > 0 && <Switch checked={showEnded} onChange={setShowEnded} label={`Ended (${endedCount})`} />}
            <Button variant="primary" onClick={() => setBlockEditor({ open: true, block: null, draft: null })}>
              <Plus size={16} /> Block
            </Button>
          </div>
        </div>
        {visible.length === 0 && (
          <EmptyState title="No current block" body="Create a block to put your workouts on the calendar, e.g. the next 4 weeks: Tue and Sat Workout A, Thu Workout B." />
        )}
        <div className="space-y-4">
          {visible.map((b) => (
            <BlockCard
              key={b.id}
              block={b}
              status={status(b)}
              store={store}
              onEdit={() => setBlockEditor({ open: true, block: b, draft: null })}
              onDuplicate={() => duplicate(b)}
            />
          ))}
        </div>
      </section>

      {/* workouts */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold text-ink">Workouts</h2>
          <span className="text-[13px] text-muted">Reusable templates. Editing one never changes workouts you already logged.</span>
          <Button variant="primary" className="ml-auto" onClick={() => setWorkoutEditor({ open: true, plan: null })}>
            <Plus size={16} /> Workout
          </Button>
        </div>
        {store.plans.length === 0 && <EmptyState title="No workouts yet" body="Create a workout, then slot it into a block." />}
        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {[...store.plans]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((p) => (
              <WorkoutCard key={p.id} plan={p} store={store} onEdit={() => setWorkoutEditor({ open: true, plan: p })} />
            ))}
        </div>
      </section>

      <BlockEditor state={blockEditor} store={store} onClose={() => setBlockEditor({ open: false, block: null, draft: null })} />
      <WorkoutEditor state={workoutEditor} store={store} onClose={() => setWorkoutEditor({ open: false, plan: null })} />
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Blocks                                                                                         */
/* ---------------------------------------------------------------------------------------------- */

function BlockCard({
  block,
  status,
  store,
  onEdit,
  onDuplicate,
}: {
  block: Block;
  status: "active" | "upcoming" | "ended";
  store: WorkoutStore;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const [pick, setPick] = useState<{ key: string; muscles: string[]; col: number } | null>(null);
  const grid = useMemo(() => blockGrid(block.id, store.schedule, store.planItems, store.exById), [block.id, store.schedule, store.planItems, store.exById]);
  const layout = WEEKDAYS.map((_, day) => plansForDay(block.id, day, store.schedule));
  const weekly = layout.reduce((n, plans) => n + plans.reduce((m, p) => m + workingSetsForPlan(p.id, store.planItems, store.exById), 0), 0);

  return (
    <section className={cx("overflow-hidden rounded-xl border border-line bg-surface shadow-card", status === "ended" && "opacity-70")}>
      <div className="flex items-start gap-2 px-4 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-semibold text-ink">{block.name}</span>
            <StatusBadge status={status} />
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {fmtMonthDay(block.start_date)} – {block.end_date ? fmtMonthDay(block.end_date) : "ongoing"}
            {block.end_date && ` · ${Math.round((diffDays(block.start_date, block.end_date) + 1) / 7)} weeks`}
            {` · ${weekly} working sets a week`}
          </div>
        </div>
        <IconButton label={`Duplicate ${block.name}`} onClick={onDuplicate}>
          <Copy size={16} />
        </IconButton>
        <IconButton label={`Edit ${block.name}`} onClick={onEdit}>
          <Pencil size={16} />
        </IconButton>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <ul className="space-y-1">
          {layout.map((plans, day) => (
            <li key={day} className="flex items-start gap-2">
              <span className="w-10 shrink-0 pt-1 text-[12px] font-semibold text-muted">{WEEKDAYS[day]}</span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {plans.length === 0 ? (
                  <span className="pt-1 text-[12.5px] text-faint">Rest</span>
                ) : (
                  plans.map((p, i) => <WorkoutChip key={`${p.id}-${i}`} plan={p} />)
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="min-w-0">
          <MuscleHeatmap
            columns={DAY_COLUMNS}
            values={grid}
            band={{ low: store.settings.setRangeLow, high: store.settings.setRangeHigh }}
            selected={pick}
            onPick={(key, muscles, col) => setPick(pick && pick.key === key && pick.col === col ? null : { key, muscles, col })}
          />
          {pick && <Breakdown muscles={pick.muscles} plans={layout[pick.col]} dayLabel={WEEKDAYS_LONG[pick.col]} store={store} onClose={() => setPick(null)} />}
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: "active" | "upcoming" | "ended" }) {
  const s = { active: ["Active", "#e3f4ea", "#0f7a52"], upcoming: ["Upcoming", "#e3eefb", "#1c5cab"], ended: ["Ended", "#efeee9", "#5d5c57"] }[status];
  return (
    <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: s[1], color: s[2] }}>
      {s[0]}
    </span>
  );
}

function WorkoutChip({ plan, onRemove }: { plan: Plan; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface pl-2.5 pr-2.5 text-[12.5px] font-medium text-ink">
      <span className="h-2 w-2 rounded-full" style={{ background: plan.color }} />
      {plan.name}
      {onRemove && (
        <button type="button" aria-label={`Remove ${plan.name}`} onClick={onRemove} className="-mr-1 ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-faint hover:bg-sunken hover:text-ink">
          <X size={12} />
        </button>
      )}
    </span>
  );
}

/** Which exercises make up a heatmap cell. */
function Breakdown({ muscles, plans, dayLabel, store, onClose }: { muscles: string[]; plans: Plan[]; dayLabel: string; store: WorkoutStore; onClose: () => void }) {
  const lines: Array<{ key: string; text: string; credit: number }> = [];
  for (const p of plans) {
    for (const it of store.planItems.filter((i) => i.plan_id === p.id)) {
      const ex = store.exById.get(it.exercise_id);
      if (!ex) continue;
      for (const [m, c] of muscleCredit(ex)) {
        if (!muscles.includes(m)) continue;
        lines.push({
          key: `${p.id}-${it.id}-${m}`,
          text: `${ex.name} (${p.name}): ${it.target_sets} ${it.target_sets === 1 ? "set" : "sets"}${c < 1 ? " × ½, secondary" : ""}${muscles.length > 1 ? ` · ${MUSCLE_LABEL.get(m)}` : ""}`,
          credit: c * it.target_sets,
        });
      }
    }
  }
  const total = lines.reduce((s, l) => s + l.credit, 0);
  const label = muscles.length > 1 ? MUSCLE_GROUPS.find((g) => g.id === MUSCLE_GROUP_OF.get(muscles[0]))?.label : MUSCLE_LABEL.get(muscles[0]);
  return (
    <div className="mt-3 rounded-lg bg-sunken px-3 py-2.5 text-[12.5px]">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-ink">
          {label}, {dayLabel}: {fmtNum(total)} sets
        </span>
        <button type="button" onClick={onClose} aria-label="Close breakdown" className="ml-auto text-faint hover:text-ink">
          <X size={14} />
        </button>
      </div>
      <ul className="space-y-0.5 text-muted">
        {lines.map((l) => (
          <li key={l.key}>{l.text}</li>
        ))}
      </ul>
    </div>
  );
}

interface BlockDraft {
  name: string;
  start_date: string;
  end_date: string | null;
  slots: SlotInput[];
}

interface BlockEditorState {
  open: boolean;
  block: Block | null;
  /** prefilled values for a new block (used by Duplicate) */
  draft: BlockDraft | null;
}

function BlockEditor({ state, store, onClose }: { state: BlockEditorState; store: WorkoutStore; onClose: () => void }) {
  const { block } = state;
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [slots, setSlots] = useState<SlotInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    if (block) {
      setName(block.name);
      setStart(block.start_date);
      setEnd(block.end_date ?? "");
      setSlots(
        store.blockSlots
          .filter((s) => s.block_id === block.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s) => ({ day: s.day, plan_id: s.plan_id }))
      );
    } else if (state.draft) {
      setName(state.draft.name);
      setStart(state.draft.start_date);
      setEnd(state.draft.end_date ?? "");
      setSlots(state.draft.slots);
    } else {
      const s = addDays(weekStart(todayStr()), 7);
      setName("");
      setStart(s);
      setEnd(addDays(s, 27));
      setSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, block, state.draft]);

  const plansById = new Map(store.plans.map((p) => [p.id, p]));
  const preview = useMemo(() => {
    const id = "__draft";
    return blockGrid(
      id,
      { blocks: [], slots: slots.map((s, i) => ({ id: String(i), block_id: id, day: s.day, plan_id: s.plan_id, sort_order: i })), plans: store.plans },
      store.planItems,
      store.exById
    );
  }, [slots, store.plans, store.planItems, store.exById]);

  // overlap with other blocks
  const overlaps = store.blocks.filter((b) => {
    if (b.id === block?.id || !start) return false;
    const aEnd = end || "9999-12-31";
    const bEnd = b.end_date || "9999-12-31";
    return b.start_date <= aEnd && start <= bEnd;
  });

  const valid = name.trim() && start && (!end || end >= start) && overlaps.length === 0;

  async function save() {
    if (!valid) return;
    setSaving(true);
    const input: BlockInput = { name: name.trim(), start_date: start, end_date: end || null };
    const ok = await store.saveBlock(input, slots, block?.id);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Sheet
      open={state.open}
      onClose={onClose}
      wide
      title={block ? "Edit block" : "New block"}
      footer={
        <>
          {block && (
            <Button
              variant="danger"
              onClick={async () => {
                if (!window.confirm(`Delete ${block.name}? Workouts you already logged are kept.`)) return;
                await store.deleteBlock(block);
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
        <Field label="Block name">
          <TextInput autoFocus={!block} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. December strength" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Ends (optional)" hint={end && start ? `${Math.round((diffDays(start, end) + 1) / 7 * 10) / 10} weeks` : "Leave empty for ongoing"}>
            <TextInput type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        {overlaps.map((o) => {
          const startsBefore = o.start_date < start;
          return (
            <div key={o.id} className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
              Overlaps with <b>{o.name}</b> ({fmtMonthDay(o.start_date)} – {o.end_date ? fmtMonthDay(o.end_date) : "ongoing"}). Only one block can be active at a time.
              <div className="mt-2">
                {startsBefore ? (
                  <Button size="sm" onClick={() => store.setBlockEnd(o, addDays(start, -1))}>
                    End {o.name} on {fmtMonthDay(addDays(start, -1))}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setEnd(addDays(o.start_date, -1))}>
                    End this block on {fmtMonthDay(addDays(o.start_date, -1))}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        <Field label="Weekly layout">
          <ul className="divide-y divide-line rounded-xl border border-line">
            {WEEKDAYS.map((d, day) => {
              const daySlots = slots.map((s, i) => ({ ...s, i })).filter((s) => s.day === day);
              return (
                <li key={d} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-10 shrink-0 text-[13px] font-semibold text-muted">{d}</span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {daySlots.map((s) => {
                      const p = plansById.get(s.plan_id);
                      return p ? <WorkoutChip key={s.i} plan={p} onRemove={() => setSlots((l) => l.filter((_, j) => j !== s.i))} /> : null;
                    })}
                    <select
                      value=""
                      aria-label={`Add a workout on ${WEEKDAYS_LONG[day]}`}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) setSlots((l) => [...l, { day, plan_id: v }]);
                      }}
                      className="h-7 rounded-full border border-dashed border-line bg-surface px-2 text-[12.5px] text-muted focus:outline-none"
                    >
                      <option value="">{daySlots.length ? "+ add" : "Rest · + add"}</option>
                      {store.plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        </Field>

        <div>
          <div className="mb-1 text-[13px] font-medium text-muted">Weekly balance</div>
          <MuscleHeatmap columns={DAY_COLUMNS} values={preview} band={{ low: store.settings.setRangeLow, high: store.settings.setRangeHigh }} />
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Workouts (templates)                                                                           */
/* ---------------------------------------------------------------------------------------------- */

function WorkoutCard({ plan, store, onEdit }: { plan: Plan; store: WorkoutStore; onEdit: () => void }) {
  const items = store.planItems.filter((i) => i.plan_id === plan.id).sort((a, b) => a.sort_order - b.sort_order);
  const working = workingSetsForPlan(plan.id, store.planItems, store.exById);
  const today = todayStr();
  const usedIn = store.blocks
    .filter((b) => blockActiveOn(b, today) || b.start_date > today)
    .map((b) => {
      const days = Array.from(new Set(store.blockSlots.filter((s) => s.block_id === b.id && s.plan_id === plan.id).map((s) => s.day))).sort();
      return days.length ? `${b.name} (${days.map((d) => WEEKDAYS[d]).join(", ")})` : null;
    })
    .filter(Boolean);

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-start gap-2 px-3.5 pt-3">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: plan.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-ink">{plan.name}</div>
          <div className="mt-0.5 text-[12px] text-muted">{usedIn.length ? `In ${usedIn.join("; ")}` : "Not scheduled in a current block"}</div>
        </div>
        <IconButton label={`Duplicate ${plan.name}`} onClick={() => store.duplicatePlan(plan)}>
          <Copy size={16} />
        </IconButton>
        <IconButton label={`Edit ${plan.name}`} onClick={onEdit}>
          <Pencil size={16} />
        </IconButton>
      </div>
      <ul className="mt-2.5 border-t border-line">
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
      {working > 0 && (
        <div className="border-t border-line bg-canvas/60 px-3.5 py-2 text-[12px] text-muted">
          {working} working {working === 1 ? "set" : "sets"} per session
        </div>
      )}
    </section>
  );
}

interface DraftItem extends PlanItemInput {
  key: string;
}

function WorkoutEditor({ state, store, onClose }: { state: { open: boolean; plan: Plan | null }; store: WorkoutStore; onClose: () => void }) {
  const { plan } = state;
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_PALETTE[0]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [newEx, setNewEx] = useState(false);
  const [pick, setPick] = useState<{ key: string; muscles: string[]; col: number } | null>(null);

  useEffect(() => {
    if (!state.open) return;
    setName(plan?.name ?? "");
    setColor(plan?.color ?? TAG_PALETTE[store.plans.length % TAG_PALETTE.length]);
    setPick(null);
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

  const perSession = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const it of items) {
      const ex = store.exById.get(it.exercise_id);
      if (!ex) continue;
      for (const [mu, c] of muscleCredit(ex)) {
        const row = m.get(mu) ?? [0];
        row[0] += c * it.target_sets;
        m.set(mu, row);
      }
    }
    return m;
  }, [items, store.exById]);

  const breakdown = useMemo(() => {
    if (!pick) return [];
    const out: string[] = [];
    for (const it of items) {
      const ex = store.exById.get(it.exercise_id);
      if (!ex) continue;
      for (const [m, c] of muscleCredit(ex)) {
        if (pick.muscles.includes(m)) out.push(`${ex.name}: ${it.target_sets} ${it.target_sets === 1 ? "set" : "sets"}${c < 1 ? " × ½, secondary" : ""}${pick.muscles.length > 1 ? ` · ${MUSCLE_LABEL.get(m)}` : ""}`);
      }
    }
    return out;
  }, [pick, items, store.exById]);

  const valid = Boolean(name.trim());

  async function save() {
    if (!valid) return;
    setSaving(true);
    const ok = await store.savePlan(
      { name: name.trim(), color },
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
      title={plan ? "Edit workout" : "New workout"}
      footer={
        <>
          {plan && (
            <Button
              variant="danger"
              onClick={async () => {
                if (!window.confirm(`Delete ${plan.name}? It's also removed from any block. Workouts you already logged are kept.`)) return;
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
        <Field label="Workout name">
          <TextInput autoFocus={!plan} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Full Body A" />
        </Field>
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
                    <IconButton label="Remove from workout" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>
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

        {perSession.size > 0 && (
          <div>
            <div className="mb-1 text-[13px] font-medium text-muted">Sets per muscle, one session</div>
            <div className="max-w-md">
              <MuscleHeatmap
                columns={[{ key: "s", label: "Sets", title: "One session" }]}
                values={perSession}
                band={null}
                selected={pick}
                onPick={(key, muscles, col) => setPick(pick && pick.key === key ? null : { key, muscles, col })}
              />
            </div>
            {pick && breakdown.length > 0 && (
              <ul className="mt-2 rounded-lg bg-sunken px-3 py-2 text-[12.5px] text-muted">
                {breakdown.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[12px] text-faint">Weekly totals depend on how often it&apos;s scheduled; see the block for the full week.</p>
          </div>
        )}
      </div>

      <ExerciseEditor state={{ open: newEx, ex: null }} store={store} onClose={() => setNewEx(false)} onCreated={(ex) => addItem(ex.id)} />
    </Sheet>
  );
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
