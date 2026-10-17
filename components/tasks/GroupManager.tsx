"use client";

import { useState } from "react";
import type { TasksStore } from "@/lib/useTasksStore";
import { GROUP_PALETTE } from "@/lib/colors";
import { moveItem } from "@/lib/db";
import { Button, ColorPicker, IconButton, OrderControls, Sheet, TextInput } from "../ui";
import { Plus, Trash } from "../icons";

export function GroupManager({ open, onClose, store }: { open: boolean; onClose: () => void; store: TasksStore }) {
  const [newName, setNewName] = useState("");
  const [colorFor, setColorFor] = useState<string | null>(null);

  function add() {
    const name = newName.trim();
    if (!name) return;
    const used = new Set(store.groups.map((g) => g.color));
    const color = GROUP_PALETTE.find((c) => !used.has(c)) ?? GROUP_PALETTE[store.groups.length % GROUP_PALETTE.length];
    store.addGroup(name, color);
    setNewName("");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Groups">
      <div className="space-y-2">
        {store.groups.map((g, i) => (
          <div key={g.id} className="rounded-xl border border-line p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Change color"
                onClick={() => setColorFor(colorFor === g.id ? null : g.id)}
                className="h-8 w-8 shrink-0 rounded-lg border border-black/10"
                style={{ background: g.color }}
              />
              <TextInput
                defaultValue={g.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== g.name) store.updateGroup(g.id, { name: v });
                }}
                className="h-9"
              />
              <OrderControls index={i} count={store.groups.length} onMove={(to) => store.reorderGroups(moveItem(store.groups, i, to))} />
              <IconButton
                label="Delete group"
                onClick={() => {
                  if (window.confirm(`Delete group "${g.name}"? Its tasks stay, just ungrouped.`)) store.deleteGroup(g.id);
                }}
              >
                <Trash size={16} />
              </IconButton>
            </div>
            {colorFor === g.id && (
              <div className="mt-2 px-1 pb-1">
                <ColorPicker
                  colors={GROUP_PALETTE}
                  value={g.color}
                  onChange={(c) => {
                    store.updateGroup(g.id, { color: c });
                    setColorFor(null);
                  }}
                />
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <TextInput
            placeholder="New group name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <Button variant="primary" onClick={add} disabled={!newName.trim()}>
            <Plus size={16} /> Add
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
