"use client";

import { useEffect, useState } from "react";
import type { Group } from "@/lib/types";
import { createGroup, updateGroup, deleteGroup, reorderGroups } from "@/lib/api";
import { PASTEL_PALETTE, deepen } from "@/lib/colors";
import { Modal, Button, TextInput } from "./ui";
import { Plus, Trash, Check, ChevronUp, ChevronDown } from "./icons";

export function GroupManager({
  open,
  groups,
  taskCountByGroup,
  onClose,
  onChanged,
}: {
  open: boolean;
  groups: Group[];
  taskCountByGroup: Record<string, number>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PASTEL_PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Local ordering so an arrow click reorders instantly, before the DB round-trip finishes.
  const [order, setOrder] = useState<Group[]>(groups);
  useEffect(() => {
    setOrder(groups);
  }, [groups]);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next); // optimistic
    try {
      await reorderGroups(next.map((g) => g.id));
      onChanged();
    } catch (e: any) {
      setOrder(order); // revert on failure
      setErr(e?.message ?? "Couldn't save the new order.");
    }
  }

  async function addGroup() {
    if (!newName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createGroup(newName.trim(), newColor, order.length + 1);
      setNewName("");
      setNewColor(PASTEL_PALETTE[(order.length + 1) % PASTEL_PALETTE.length]);
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't add the group.");
    } finally {
      setBusy(false);
    }
  }

  async function rename(g: Group, name: string) {
    try {
      await updateGroup(g.id, { name });
      onChanged();
    } catch {
      /* ignore transient */
    }
  }

  async function recolor(g: Group, color: string) {
    try {
      await updateGroup(g.id, { color });
      onChanged();
    } catch {
      /* ignore */
    }
  }

  async function remove(g: Group) {
    const count = taskCountByGroup[g.id] ?? 0;
    if (count > 0) {
      setErr(`"${g.name}" still has ${count} task${count === 1 ? "" : "s"}. Move or delete those first.`);
      return;
    }
    if (!window.confirm(`Delete the "${g.name}" group?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteGroup(g.id);
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't delete the group.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Groups">
      <div className="space-y-4">
        {/* Existing groups */}
        <div className="space-y-2">
          {order.map((g, i) => (
            <div key={g.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
              <div className="flex flex-none flex-col">
                <button
                  aria-label={`Move ${g.name} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="flex h-4 w-6 items-center justify-center rounded text-faint hover:bg-black/[0.05] hover:text-ink disabled:opacity-20 disabled:hover:bg-transparent"
                >
                  <ChevronUp width={13} height={13} />
                </button>
                <button
                  aria-label={`Move ${g.name} down`}
                  disabled={i === order.length - 1}
                  onClick={() => move(i, 1)}
                  className="flex h-4 w-6 items-center justify-center rounded text-faint hover:bg-black/[0.05] hover:text-ink disabled:opacity-20 disabled:hover:bg-transparent"
                >
                  <ChevronDown width={13} height={13} />
                </button>
              </div>
              <ColorDots value={g.color} onPick={(c) => recolor(g, c)} />
              <input
                defaultValue={g.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== g.name && rename(g, e.target.value.trim())}
                className="flex-1 rounded-md border border-transparent px-2 py-1 text-sm text-ink focus:border-line focus:outline-none"
              />
              <span className="text-xs text-faint">{taskCountByGroup[g.id] ?? 0}</span>
              <button
                aria-label={`Delete ${g.name}`}
                onClick={() => remove(g)}
                className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-red-50 hover:text-red-600"
              >
                <Trash width={15} height={15} />
              </button>
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="rounded-lg border border-dashed border-line p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">New group</p>
          <div className="flex items-center gap-2">
            <TextInput
              value={newName}
              placeholder="e.g. Brady, Finance, Health"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGroup()}
            />
            <Button size="sm" onClick={addGroup} disabled={busy || !newName.trim()}>
              <Plus width={14} height={14} />
              Add
            </Button>
          </div>
          <div className="mt-3">
            <ColorDots value={newColor} onPick={setNewColor} />
          </div>
        </div>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      </div>
    </Modal>
  );
}

function ColorDots({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PASTEL_PALETTE.map((c) => {
        const active = c.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c}
            aria-label={`Use color ${c}`}
            onClick={() => onPick(c)}
            className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{ backgroundColor: c, boxShadow: active ? `0 0 0 2px ${deepen(c)}` : "none" }}
          >
            {active && <Check width={12} height={12} color={deepen(c)} />}
          </button>
        );
      })}
    </div>
  );
}
