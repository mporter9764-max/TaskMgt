"use client";

import { useEffect, useState } from "react";
import type { WorkoutStore, WorkoutSettings } from "@/lib/useWorkoutStore";
import type { GoalsStore } from "@/lib/useGoalsStore";
import { todayStr } from "@/lib/dates";
import { Button, Field, IconButton, Segmented, Select, Sheet, TextInput } from "../ui";
import { ChartIcon, Check, Cog, Dumbbell, ListIcon } from "../icons";
import { LogView } from "./LogView";
import { PlansView } from "./PlansView";
import { ExercisesView } from "./ExercisesView";
import { MetricsView } from "./MetricsView";

type Sub = "log" | "plans" | "exercises" | "metrics";

function useToday(): string {
  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const tick = () => setToday((prev) => (todayStr() !== prev ? todayStr() : prev));
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return today;
}

/** null = automatic (a goal named like "Worked out"), "none" = off, otherwise a goal id */
export function linkedGoalId(settings: WorkoutSettings, goals: GoalsStore): string | null {
  if (settings.linkedGoalId === "none") return null;
  if (settings.linkedGoalId) return goals.goals.some((g) => g.id === settings.linkedGoalId) ? settings.linkedGoalId : null;
  return goals.goals.find((g) => !g.archived_on && /work(ed)?\s*out/i.test(g.name))?.id ?? null;
}

export function WorkoutsView({ store, goals }: { store: WorkoutStore; goals: GoalsStore }) {
  const today = useToday();
  const [sub, setSub] = useState<Sub>("log");
  const [settingsOpen, setSettingsOpen] = useState(false);

  function onFinished(date: string) {
    const gid = linkedGoalId(store.settings, goals);
    if (!gid) return;
    const already = goals.logs.get(gid)?.has(date);
    if (!already) goals.setLog(gid, date, "done");
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Segmented<Sub>
            value={sub}
            onChange={setSub}
            className="grid w-full grid-cols-4 sm:inline-flex sm:w-auto"
            options={[
              { value: "log", label: <><Check size={15} className="hidden sm:block" /> Log</> },
              { value: "plans", label: <><ListIcon size={15} className="hidden sm:block" /> Plans</> },
              { value: "exercises", label: <><Dumbbell size={15} className="hidden sm:block" /> Exercises</> },
              { value: "metrics", label: <><ChartIcon size={15} className="hidden sm:block" /> Metrics</> },
            ]}
          />
        </div>
        <IconButton label="Workout settings" onClick={() => setSettingsOpen(true)}>
          <Cog />
        </IconButton>
      </div>

      {sub === "log" && <LogView store={store} today={today} onFinished={onFinished} />}
      {sub === "plans" && <PlansView store={store} />}
      {sub === "exercises" && <ExercisesView store={store} />}
      {sub === "metrics" && <MetricsView store={store} today={today} />}

      <SettingsSheet open={settingsOpen} store={store} goals={goals} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function SettingsSheet({ open, store, goals, onClose }: { open: boolean; store: WorkoutStore; goals: GoalsStore; onClose: () => void }) {
  const [d, setD] = useState(store.settings);
  useEffect(() => {
    if (open) setD(store.settings);
  }, [open, store.settings]);
  const auto = linkedGoalId({ ...d, linkedGoalId: null }, goals);
  const autoName = goals.goals.find((g) => g.id === auto)?.name;
  const valid = d.setRangeLow > 0 && d.setRangeHigh > d.setRangeLow;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Workout settings"
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={async () => {
              await store.saveSettings(d);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="When I finish a workout, check off this goal">
          <Select value={d.linkedGoalId ?? ""} onChange={(e) => setD({ ...d, linkedGoalId: e.target.value || null })}>
            <option value="">Automatic{autoName ? ` (${autoName})` : " (no matching goal)"}</option>
            <option value="none">Don&apos;t check off a goal</option>
            {goals.goals
              .filter((g) => !g.archived_on)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Weekly hard-set target per muscle" hint="Shown as the shaded band in Metrics. 10 to 20 is a common range for growth; about 6 maintains.">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <TextInput inputMode="numeric" value={String(d.setRangeLow)} onChange={(e) => setD({ ...d, setRangeLow: Number(e.target.value.replace(/\D/g, "")) })} className="pr-12" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">low</span>
            </div>
            <div className="relative">
              <TextInput inputMode="numeric" value={String(d.setRangeHigh)} onChange={(e) => setD({ ...d, setRangeHigh: Number(e.target.value.replace(/\D/g, "")) })} className="pr-12" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">high</span>
            </div>
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
