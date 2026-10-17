"use client";

import { useEffect, useMemo, useState } from "react";
import type { Goal, GoalTarget } from "@/lib/types";
import type { GoalsStore } from "@/lib/useGoalsStore";
import { buildGoalData, type GoalData } from "@/lib/goals";
import { buildTree } from "@/lib/goalTree";
import { todayStr } from "@/lib/dates";
import { Segmented } from "../ui";
import { ChartIcon, Check, Cog } from "../icons";
import { TodayView } from "./TodayView";
import { TrendsView } from "./TrendsView";
import { ManageView } from "./ManageView";
import { GoalDetail } from "./GoalDetail";
import { GoalForm, type GoalFormState } from "./GoalForm";

type Sub = "today" | "trends" | "manage";

/** Today's date that rolls over at midnight and when the app comes back to the foreground. */
function useToday(): string {
  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const tick = () => setToday((prev) => (todayStr() !== prev ? todayStr() : prev));
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return today;
}

export function GoalsView({ store }: { store: GoalsStore }) {
  const today = useToday();
  const [sub, setSub] = useState<Sub>("today");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<GoalFormState>({ open: false, goal: null });

  const data = useMemo(() => {
    const byGoal = new Map<string, GoalTarget[]>();
    for (const t of store.targets) {
      const list = byGoal.get(t.goal_id) ?? [];
      list.push(t);
      byGoal.set(t.goal_id, list);
    }
    const map = new Map<string, GoalData>();
    for (const g of store.goals) {
      map.set(g.id, buildGoalData(g, byGoal.get(g.id) ?? [], Array.from(store.logs.get(g.id) ?? []), today));
    }
    return map;
  }, [store.goals, store.targets, store.logs, today]);

  const activeTree = useMemo(
    () => buildTree(store.roles, store.subgroups, store.goals, (g) => !g.archived_on || g.archived_on > today),
    [store.roles, store.subgroups, store.goals, today]
  );
  const archivedTree = useMemo(
    () => buildTree(store.roles, store.subgroups, store.goals, (g) => Boolean(g.archived_on && g.archived_on <= today)),
    [store.roles, store.subgroups, store.goals, today]
  );
  const fullTree = useMemo(() => buildTree(store.roles, store.subgroups, store.goals), [store.roles, store.subgroups, store.goals]);

  const detail = detailId ? data.get(detailId) ?? null : null;
  const detailRole = detail ? store.roles.find((r) => r.id === detail.goal.role_id) : undefined;
  const detailSub = detail?.goal.subgroup_id ? store.subgroups.find((s) => s.id === detail.goal.subgroup_id) : undefined;

  function editGoal(g: Goal) {
    setDetailId(null);
    setForm({ open: true, goal: g });
  }

  return (
    <div>
      <div className="mb-4">
        <Segmented<Sub>
          value={sub}
          onChange={setSub}
          options={[
            { value: "today", label: <><Check size={15} /> Check-in</> },
            { value: "trends", label: <><ChartIcon size={15} /> Trends</> },
            { value: "manage", label: <><Cog size={15} /> Manage</> },
          ]}
        />
      </div>

      {sub === "today" && (
        <TodayView
          store={store}
          tree={activeTree}
          data={data}
          today={today}
          onOpenGoal={(g) => setDetailId(g.id)}
          onManage={() => setSub("manage")}
        />
      )}
      {sub === "trends" && <TrendsView tree={fullTree} data={data} today={today} />}
      {sub === "manage" && (
        <ManageView
          store={store}
          tree={activeTree}
          archivedTree={archivedTree}
          onEditGoal={editGoal}
          onNewGoal={(roleId, subgroupId) => setForm({ open: true, goal: null, roleId, subgroupId })}
        />
      )}

      <GoalDetail
        open={Boolean(detail)}
        gd={detail}
        role={detailRole}
        subgroup={detailSub}
        today={today}
        onClose={() => setDetailId(null)}
        onToggle={store.toggleLog}
        onEdit={editGoal}
      />
      <GoalForm state={form} store={store} onClose={() => setForm({ open: false, goal: null })} />
    </div>
  );
}
