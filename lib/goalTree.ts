import type { Goal, GoalRole, GoalSubgroup } from "./types";

export interface SubNode {
  sub: GoalSubgroup;
  goals: Goal[];
}

export interface RoleNode {
  role: GoalRole;
  /** goals directly under the role (no subgroup) */
  direct: Goal[];
  subs: SubNode[];
  /** every goal in display order: direct first, then by subgroup */
  all: Goal[];
}

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/** Roles > (direct goals, subgroups > goals) in display order. */
export function buildTree(
  roles: GoalRole[],
  subgroups: GoalSubgroup[],
  goals: Goal[],
  include: (g: Goal) => boolean = () => true
): RoleNode[] {
  return [...roles].sort(bySort).map((role) => {
    const roleGoals = goals.filter((g) => g.role_id === role.id && include(g)).sort(bySort);
    const subs = subgroups
      .filter((s) => s.role_id === role.id)
      .sort(bySort)
      .map((sub) => ({ sub, goals: roleGoals.filter((g) => g.subgroup_id === sub.id) }));
    const subIds = new Set(subs.map((s) => s.sub.id));
    const direct = roleGoals.filter((g) => !g.subgroup_id || !subIds.has(g.subgroup_id));
    return { role, direct, subs, all: [...direct, ...subs.flatMap((s) => s.goals)] };
  });
}

/** Scope key used by the Trends filter: "all", "role:<id>" or "sub:<id>". */
export function goalsInScope(tree: RoleNode[], scope: string): Goal[] {
  if (scope === "all") return tree.flatMap((r) => r.all);
  const [kind, id] = scope.split(":");
  if (kind === "role") return tree.find((r) => r.role.id === id)?.all ?? [];
  for (const r of tree) {
    const s = r.subs.find((x) => x.sub.id === id);
    if (s) return s.goals;
  }
  return [];
}
