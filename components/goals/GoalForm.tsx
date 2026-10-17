"use client";

import { useEffect, useState } from "react";
import type { Goal, Period } from "@/lib/types";
import type { GoalsStore } from "@/lib/useGoalsStore";
import { describeTarget, sortTargets } from "@/lib/goals";
import { todayStr } from "@/lib/dates";
import { Button, Field, IconButton, Segmented, Select, Sheet, TextInput } from "../ui";
import { Archive, Trash } from "../icons";

export interface GoalFormState {
  open: boolean;
  goal: Goal | null;
  roleId?: string;
  subgroupId?: string | null;
}

export function GoalForm({ state, store, onClose }: { state: GoalFormState; store: GoalsStore; onClose: () => void }) {
  const { goal } = state;
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [subId, setSubId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("day");
  const [target, setTarget] = useState(5);
  const [start, setStart] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const versions = goal ? sortTargets(store.targets.filter((t) => t.goal_id === goal.id)) : [];
  const latest = versions[versions.length - 1];

  useEffect(() => {
    if (!state.open) return;
    if (goal) {
      const vs = sortTargets(store.targets.filter((t) => t.goal_id === goal.id));
      const v = vs[vs.length - 1];
      setName(goal.name);
      setRoleId(goal.role_id);
      setSubId(goal.subgroup_id);
      setPeriod(v?.period ?? "day");
      setTarget(v && v.period !== "day" ? v.target : 5);
      setStart(goal.start_date);
    } else {
      setName("");
      setRoleId(state.roleId ?? store.roles[0]?.id ?? "");
      setSubId(state.subgroupId ?? null);
      setPeriod("day");
      setTarget(5);
      setStart(todayStr());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, goal]);

  const subs = store.subgroups.filter((s) => s.role_id === roleId).sort((a, b) => a.sort_order - b.sort_order);
  const maxTarget = period === "week" ? 7 : 31;
  const effectiveTarget = Math.min(target, maxTarget);
  const targetChanged = Boolean(goal && latest && (latest.period !== period || (period !== "day" && latest.target !== effectiveTarget)));
  const valid = name.trim() && roleId;

  async function save() {
    if (!valid) return;
    setSaving(true);
    const input = { name: name.trim(), role_id: roleId, subgroup_id: subId, start_date: start || todayStr(), period, target: period === "day" ? 1 : effectiveTarget };
    if (goal) await store.updateGoal(goal, input);
    else await store.createGoal(input);
    setSaving(false);
    onClose();
  }

  async function remove() {
    if (!goal) return;
    if (!window.confirm(`Delete "${goal.name}" and all of its history? Archiving keeps the history instead.`)) return;
    await store.deleteGoal(goal.id);
    onClose();
  }

  return (
    <Sheet
      open={state.open}
      onClose={onClose}
      title={goal ? "Edit goal" : "New goal"}
      headerRight={
        goal ? (
          <IconButton label={goal.archived_on ? "Restore goal" : "Archive goal"} onClick={async () => {
            await store.setArchived(goal, !goal.archived_on);
            onClose();
          }}>
            <Archive size={17} />
          </IconButton>
        ) : undefined
      }
      footer={
        <>
          {goal && (
            <Button variant="danger" onClick={remove}>
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
        <Field label="Goal" hint="Phrase it as the good behavior, so a check always means success: “No alcohol”, not “Drank alcohol”.">
          <TextInput autoFocus={!goal} value={name} placeholder="e.g. Read to him" onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <Select
              value={roleId}
              onChange={(e) => {
                setRoleId(e.target.value);
                setSubId(null);
              }}
            >
              {store.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subgroup (optional)">
            <Select value={subId ?? ""} onChange={(e) => setSubId(e.target.value || null)}>
              <option value="">None</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="How often">
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            className="w-full"
            options={[
              { value: "day", label: "Every day" },
              { value: "week", label: "Per week" },
              { value: "month", label: "Per month" },
            ]}
          />
        </Field>

        {period !== "day" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-line">
              <button type="button" className="h-10 w-10 text-lg text-muted disabled:opacity-30" disabled={effectiveTarget <= 1} onClick={() => setTarget(Math.max(1, effectiveTarget - 1))}>
                −
              </button>
              <span className="w-10 text-center text-[17px] font-semibold tabular-nums text-ink">{effectiveTarget}</span>
              <button type="button" className="h-10 w-10 text-lg text-muted disabled:opacity-30" disabled={effectiveTarget >= maxTarget} onClick={() => setTarget(Math.min(maxTarget, effectiveTarget + 1))}>
                +
              </button>
            </div>
            <span className="text-[14px] text-ink">{describeTarget({ period, target: effectiveTarget })}</span>
          </div>
        )}

        <Field label="Start date" hint={goal ? undefined : "Set an earlier date if you want to backfill past days."}>
          <TextInput type="date" value={start} max={todayStr()} onChange={(e) => setStart(e.target.value)} />
        </Field>

        {targetChanged && (
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent-deep">
            The new target applies from today. Past periods keep the target they had, so your history stays accurate.
          </p>
        )}
        {goal?.archived_on && <p className="rounded-lg bg-sunken px-3 py-2 text-[13px] text-muted">This goal is archived. Use the archive button above to restore it.</p>}
      </div>
    </Sheet>
  );
}
