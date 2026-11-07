"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkoutStore } from "@/lib/useWorkoutStore";
import {
  EQUIPMENT,
  KINDS,
  KIND_LABEL,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_OF,
  MUSCLE_LABEL,
  type Exercise,
  type ExerciseKind,
  type Intensity,
} from "@/lib/workouts";
import { Button, EmptyState, Field, Segmented, Select, Sheet, Switch, TextInput, cx } from "../ui";
import { Plus, Search, Trash } from "../icons";

const CARDIO_GROUP = "__cardio";

export function ExercisesView({ store }: { store: WorkoutStore }) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{ open: boolean; ex: Exercise | null }>({ open: false, ex: null });

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = store.exercises
      .filter((e) => (showArchived ? e.archived : !e.archived))
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    const out = MUSCLE_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      items: list.filter((e) => e.primary_muscle && MUSCLE_GROUP_OF.get(e.primary_muscle) === g.id),
    }));
    out.push({ id: CARDIO_GROUP, label: "Cardio", items: list.filter((e) => !e.primary_muscle) });
    return out.filter((g) => g.items.length);
  }, [store.exercises, query, showArchived]);

  return (
    <div className="pb-28">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <TextInput placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <Switch checked={showArchived} onChange={setShowArchived} label="Archived" />
        <Button variant="primary" onClick={() => setEditing({ open: true, ex: null })}>
          <Plus size={16} /> Exercise
        </Button>
      </div>

      {groups.length === 0 && <EmptyState title={showArchived ? "No archived exercises" : "No exercises found"} />}

      <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {groups.map((g) => (
          <section key={g.id} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="border-b border-line bg-canvas/60 px-3.5 py-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
              {g.label} <span className="font-normal normal-case tracking-normal">· {g.items.length}</span>
            </div>
            <ul>
              {g.items.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setEditing({ open: true, ex: e })}
                    className="flex w-full items-start gap-3 border-b border-line px-3.5 py-2.5 text-left last:border-b-0 hover:bg-sunken/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] text-ink">{e.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {e.primary_muscle ? MUSCLE_LABEL.get(e.primary_muscle) : e.intensity === "high" ? "High intensity" : "Low intensity"}
                        {e.secondary_muscles.length > 0 && <span className="text-faint"> · {e.secondary_muscles.map((m) => MUSCLE_LABEL.get(m)).join(", ")}</span>}
                      </div>
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-md bg-sunken px-1.5 py-0.5 text-[11px] text-muted">{KIND_LABEL.get(e.kind)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <ExerciseEditor state={editing} store={store} onClose={() => setEditing({ open: false, ex: null })} />
    </div>
  );
}

export function ExerciseEditor({
  state,
  store,
  onClose,
  onCreated,
}: {
  state: { open: boolean; ex: Exercise | null };
  store: WorkoutStore;
  onClose: () => void;
  onCreated?: (ex: Exercise) => void;
}) {
  const { ex } = state;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ExerciseKind>("weight_reps");
  const [primary, setPrimary] = useState<string>("");
  const [secondary, setSecondary] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string>("");
  const [intensity, setIntensity] = useState<Intensity>("low");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.open) return;
    setName(ex?.name ?? "");
    setKind(ex?.kind ?? "weight_reps");
    setPrimary(ex?.primary_muscle ?? "");
    setSecondary(ex?.secondary_muscles ?? []);
    setEquipment(ex?.equipment ?? "");
    setIntensity(ex?.intensity ?? "low");
  }, [state.open, ex]);

  const isCardio = kind === "cardio";
  const needsMuscle = !isCardio && kind !== "carry";
  const showIntensity = isCardio || (kind === "carry" && !primary);
  const valid = name.trim() && (!needsMuscle || primary);

  async function save() {
    if (!valid) return;
    setSaving(true);
    const prim = isCardio ? null : primary || null;
    const saved = await store.saveExercise(
      {
        name: name.trim(),
        kind,
        primary_muscle: prim,
        secondary_muscles: prim ? secondary.filter((m) => m !== prim) : [],
        equipment: equipment || null,
        intensity: showIntensity ? intensity : null,
      },
      ex?.id
    );
    setSaving(false);
    if (saved) {
      if (!ex) onCreated?.(saved);
      onClose();
    }
  }

  return (
    <Sheet
      open={state.open}
      onClose={onClose}
      title={ex ? "Edit exercise" : "New exercise"}
      footer={
        <>
          {ex && !ex.archived && (
            <Button
              variant="danger"
              onClick={async () => {
                if (!window.confirm(`Remove ${ex.name}? If it's used in plans or history it will be archived instead.`)) return;
                await store.removeExercise(ex);
                onClose();
              }}
            >
              <Trash size={16} /> Remove
            </Button>
          )}
          {ex?.archived && (
            <Button
              onClick={async () => {
                await store.restoreExercise(ex);
                onClose();
              }}
            >
              Restore
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
        <Field label="Name">
          <TextInput autoFocus={!ex} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goblet Squat" />
        </Field>

        <Field label="What you log" hint={KINDS.find((k) => k.id === kind)?.hint}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        {!isCardio && (
          <Field label={kind === "carry" ? "Main muscle (leave empty for pure cardio like rucking)" : "Main muscle"}>
            <Select value={primary} onChange={(e) => setPrimary(e.target.value)}>
              <option value="">{needsMuscle ? "Choose…" : "None (cardio)"}</option>
              {MUSCLE_GROUPS.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {g.muscles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}

        {primary && !isCardio && (
          <Field label="Secondary muscles" hint="Each counts as half a set toward that muscle.">
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_GROUPS.flatMap((g) => g.muscles)
                .filter((m) => m.id !== primary)
                .map((m) => {
                  const on = secondary.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSecondary((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))}
                      className={cx(
                        "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
                        on ? "border-accent bg-accent-soft text-accent-deep" : "border-line bg-surface text-muted hover:text-ink"
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
            </div>
          </Field>
        )}

        {showIntensity && (
          <Field label="Cardio intensity">
            <Segmented
              value={intensity}
              onChange={setIntensity}
              options={[
                { value: "low", label: "Low (walk, ruck, zone 2)" },
                { value: "high", label: "High (intervals)" },
              ]}
            />
          </Field>
        )}

        <Field label="Equipment (optional)">
          <Select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            <option value="">None</option>
            {EQUIPMENT.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Sheet>
  );
}
