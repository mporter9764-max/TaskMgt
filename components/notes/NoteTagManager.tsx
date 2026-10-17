"use client";

import { useState } from "react";
import type { NotesStore } from "@/lib/useNotesStore";
import { TAG_PALETTE } from "@/lib/colors";
import { moveItem } from "@/lib/db";
import { ColorPicker, IconButton, OrderControls, Sheet, TextInput } from "../ui";
import { Star, Trash } from "../icons";

export function NoteTagManager({ open, onClose, store }: { open: boolean; onClose: () => void; store: NotesStore }) {
  const [colorFor, setColorFor] = useState<string | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Manage tags">
      <div className="mb-4 space-y-1 text-[13px] text-muted">
        <p>Order here sets the order of Tagged Items. Starred tags show in each note&apos;s Recap.</p>
        <p>Renaming updates the tag inside every note. Removing only stops tracking it; your notes are not changed.</p>
      </div>
      {store.tags.length === 0 && <p className="text-sm text-faint">No tags yet. Type #something in a note and it appears here.</p>}
      <div className="space-y-2">
        {store.tags.map((t, i) => (
          <div key={t.id} className="rounded-xl border border-line p-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Change color"
                onClick={() => setColorFor(colorFor === t.id ? null : t.id)}
                className="h-7 w-7 shrink-0 rounded-full border border-black/10"
                style={{ background: t.color }}
              />
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">#</span>
                <TextInput
                  key={t.name}
                  defaultValue={t.name}
                  className="h-9 pl-6"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== t.name) store.renameTag(t.id, v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
              <IconButton
                label={t.is_recap ? "Remove from recap" : "Show in recap"}
                active={t.is_recap}
                onClick={() => store.updateTag(t.id, { is_recap: !t.is_recap })}
              >
                <Star size={17} filled={t.is_recap} />
              </IconButton>
              <OrderControls index={i} count={store.tags.length} onMove={(to) => store.reorderTags(moveItem(store.tags, i, to))} />
              <IconButton
                label="Stop tracking tag"
                onClick={() => {
                  if (window.confirm(`Stop tracking #${t.name}? Your notes keep the text.`)) store.deleteTag(t.id);
                }}
              >
                <Trash size={16} />
              </IconButton>
            </div>
            {colorFor === t.id && (
              <div className="mt-2 px-1 pb-1">
                <ColorPicker
                  colors={TAG_PALETTE}
                  value={t.color}
                  onChange={(c) => {
                    store.updateTag(t.id, { color: c });
                    setColorFor(null);
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
