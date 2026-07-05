"use client";

import type { Group, Task } from "@/lib/types";
import { fullLabel } from "@/lib/dates";
import { deepen } from "@/lib/colors";
import { EmptyState, Button } from "./ui";
import { Undo } from "./icons";

export function CompletedView({
  tasks,
  groupsById,
  onToggleComplete,
  onEdit,
}: {
  tasks: Task[]; // completed only
  groupsById: Map<string, Group>;
  onToggleComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
}) {
  const sorted = [...tasks].sort((a, b) => {
    const av = a.completed_at ?? "";
    const bv = b.completed_at ?? "";
    return bv.localeCompare(av);
  });

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {sorted.length === 0 ? (
        <EmptyState title="No completed tasks yet" hint="Tasks you finish will collect here, and you can restore any of them." />
      ) : (
        <div className="space-y-2">
          {sorted.map((t) => {
            const g = groupsById.get(t.group_id);
            const color = g?.color ?? "#E7E9EE";
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl2 border border-line bg-surface p-3 shadow-card"
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onEdit(t)}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: deepen(color) }} />
                    <span className="text-xs font-medium text-muted">{g?.name}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-faint line-through">{t.title}</p>
                  {t.completed_at && (
                    <p className="text-xs text-faint">Completed {fullLabel(t.completed_at.slice(0, 10))}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => onToggleComplete(t)}>
                  <Undo width={14} height={14} />
                  Restore
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
