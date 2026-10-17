"use client";

import { useState } from "react";
import type { Goal, GoalTarget } from "@/lib/types";
import type { GoalsStore } from "@/lib/useGoalsStore";
import type { RoleNode } from "@/lib/goalTree";
import { describeTarget, sortTargets } from "@/lib/goals";
import { TAG_PALETTE, alpha } from "@/lib/colors";
import { moveItem } from "@/lib/db";
import { fmtMonthDay } from "@/lib/dates";
import { Button, ColorPicker, IconButton, OrderControls, TextInput, cx } from "../ui";
import { ChevronDown, Pencil, Plus, Trash } from "../icons";

export function ManageView({
  store,
  tree,
  archivedTree,
  onEditGoal,
  onNewGoal,
}: {
  store: GoalsStore;
  tree: RoleNode[];
  archivedTree: RoleNode[];
  onEditGoal: (g: Goal) => void;
  onNewGoal: (roleId: string, subgroupId: string | null) => void;
}) {
  const [newRole, setNewRole] = useState("");
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const targetsByGoal = new Map<string, GoalTarget[]>();
  for (const t of store.targets) {
    const list = targetsByGoal.get(t.goal_id) ?? [];
    list.push(t);
    targetsByGoal.set(t.goal_id, list);
  }
  const current = (g: Goal) => {
    const v = sortTargets(targetsByGoal.get(g.id) ?? []);
    return v[v.length - 1] ?? null;
  };
  const archived = archivedTree.flatMap((r) => r.all.map((g) => ({ g, role: r.role })));

  function addRole() {
    const name = newRole.trim();
    if (!name) return;
    const used = new Set(store.roles.map((r) => r.color));
    store.addRole(name, TAG_PALETTE.find((c) => !used.has(c)) ?? TAG_PALETTE[store.roles.length % TAG_PALETTE.length]);
    setNewRole("");
  }

  return (
    <div className="space-y-4 pb-28">
      <p className="text-[13px] text-muted">
        Roles hold goals, optionally split into subgroups (Health › Sleep). Keep the list short: a few goals you actually check off beat many you skip.
      </p>

      {tree.map((node, ri) => {
        const { role } = node;
        return (
          <section key={role.id} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="flex items-center gap-1.5 px-2.5 py-2" style={{ background: alpha(role.color, 0.07) }}>
              <button
                type="button"
                aria-label="Change role color"
                onClick={() => setColorFor(colorFor === role.id ? null : role.id)}
                className="h-7 w-7 shrink-0 rounded-full border border-black/10"
                style={{ background: role.color }}
              />
              <TextInput
                key={role.name}
                defaultValue={role.name}
                className="h-9 font-semibold"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== role.name) store.updateRole(role.id, { name: v });
                }}
              />
              <OrderControls index={ri} count={tree.length} onMove={(to) => store.reorderRoles(moveItem(tree.map((t) => t.role), ri, to))} />
              <IconButton
                label="Delete role"
                onClick={() => {
                  if (window.confirm(`Delete "${role.name}" with all its goals and their history?`)) store.deleteRole(role.id);
                }}
              >
                <Trash size={16} />
              </IconButton>
            </div>
            {colorFor === role.id && (
              <div className="border-t border-line px-3 py-2.5">
                <ColorPicker
                  colors={TAG_PALETTE}
                  value={role.color}
                  onChange={(c) => {
                    store.updateRole(role.id, { color: c });
                    setColorFor(null);
                  }}
                />
              </div>
            )}

            <GoalList goals={node.direct} current={current} onEdit={onEditGoal} onReorder={(g) => store.reorderGoals(g)} />
            <div className="border-t border-line px-3 py-1.5">
              <Button size="sm" variant="ghost" onClick={() => onNewGoal(role.id, null)}>
                <Plus size={14} /> Goal
              </Button>
            </div>

            {node.subs.map((s, si) => (
              <div key={s.sub.id} className="border-t border-line">
                <div className="flex items-center gap-1.5 bg-canvas/70 px-2.5 py-1.5">
                  <TextInput
                    key={s.sub.name}
                    defaultValue={s.sub.name}
                    className="h-8 border-transparent bg-transparent text-[12px] font-semibold uppercase tracking-wider text-muted focus:bg-surface"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== s.sub.name) store.updateSubgroup(s.sub.id, v);
                    }}
                  />
                  <OrderControls index={si} count={node.subs.length} onMove={(to) => store.reorderSubgroups(moveItem(node.subs.map((x) => x.sub), si, to))} />
                  <IconButton
                    label="Delete subgroup"
                    onClick={() => {
                      if (window.confirm(`Delete subgroup "${s.sub.name}"? Its goals move up to ${role.name}.`)) store.deleteSubgroup(s.sub.id);
                    }}
                  >
                    <Trash size={15} />
                  </IconButton>
                </div>
                <GoalList goals={s.goals} current={current} onEdit={onEditGoal} onReorder={(g) => store.reorderGoals(g)} />
                <div className="px-3 py-1.5">
                  <Button size="sm" variant="ghost" onClick={() => onNewGoal(role.id, s.sub.id)}>
                    <Plus size={14} /> Goal in {s.sub.name}
                  </Button>
                </div>
              </div>
            ))}

            <div className="border-t border-line px-3 py-2">
              <AddInline placeholder="New subgroup (e.g. Sleep)" label="Subgroup" onAdd={(name) => store.addSubgroup(role.id, name)} />
            </div>
          </section>
        );
      })}

      <div className="flex gap-2">
        <TextInput
          placeholder="New role (e.g. Friend, Professional)"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addRole();
          }}
        />
        <Button variant="primary" onClick={addRole} disabled={!newRole.trim()}>
          <Plus size={16} /> Role
        </Button>
      </div>

      {archived.length > 0 && (
        <section className="rounded-xl border border-line bg-surface">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="flex w-full items-center gap-2 px-3.5 py-3 text-left">
            <span className="text-[14px] font-semibold text-ink">Archived goals</span>
            <span className="text-[13px] text-faint">{archived.length}</span>
            <ChevronDown size={16} className={cx("ml-auto text-faint transition-transform", !showArchived && "-rotate-90")} />
          </button>
          {showArchived && (
            <ul>
              {archived.map(({ g, role }) => (
                <li key={g.id} className="flex items-center gap-3 border-t border-line px-3.5 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: role.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] text-ink">{g.name}</div>
                    <div className="text-[12px] text-faint">
                      {role.name} · archived {g.archived_on ? fmtMonthDay(g.archived_on) : ""}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => store.setArchived(g, false)}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function GoalList({
  goals,
  current,
  onEdit,
  onReorder,
}: {
  goals: Goal[];
  current: (g: Goal) => GoalTarget | null;
  onEdit: (g: Goal) => void;
  onReorder: (ordered: Goal[]) => void;
}) {
  if (!goals.length) return null;
  return (
    <ul>
      {goals.map((g, i) => (
        <li key={g.id} className="flex items-center gap-2 border-t border-line py-1.5 pl-3.5 pr-2">
          <button type="button" onClick={() => onEdit(g)} className="min-w-0 flex-1 text-left">
            <div className="truncate text-[14.5px] text-ink">{g.name}</div>
            <div className="text-[12px] text-muted">{describeTarget(current(g))}</div>
          </button>
          <OrderControls index={i} count={goals.length} onMove={(to) => onReorder(moveItem(goals, i, to))} />
          <IconButton label={`Edit ${g.name}`} onClick={() => onEdit(g)}>
            <Pencil size={15} />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

function AddInline({ placeholder, label, onAdd }: { placeholder: string; label: string; onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  const submit = () => {
    const name = v.trim();
    if (!name) return;
    onAdd(name);
    setV("");
  };
  return (
    <div className="flex gap-2">
      <TextInput
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        className="h-9"
      />
      <Button size="sm" onClick={submit} disabled={!v.trim()} className="h-9">
        <Plus size={14} /> {label}
      </Button>
    </div>
  );
}
