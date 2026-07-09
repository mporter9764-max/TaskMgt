"use client";

import { useEffect, useState } from "react";
import type { NoteTag } from "@/lib/types";
import { updateNoteTag, deleteNoteTag, reorderNoteTags } from "@/lib/api";
import { NOTE_TAG_PALETTE, deepen } from "@/lib/colors";
import { Modal, Button } from "./ui";
import { Trash, Check, ChevronUp, ChevronDown, Star, ChevronsUp } from "./icons";

export function NoteTagManager({
  open,
  tags,
  onClose,
  onChanged,
}: {
  open: boolean;
  tags: NoteTag[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<NoteTag[]>(tags);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setOrder(tags), [tags]);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    try {
      await reorderNoteTags(next.map((t) => t.id));
      onChanged();
    } catch (e: any) {
      setOrder(order);
      setErr(e?.message ?? "Couldn't save the new order.");
    }
  }

  async function moveToTop(index: number) {
    if (index === 0) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.unshift(item);
    setOrder(next);
    try {
      await reorderNoteTags(next.map((t) => t.id));
      onChanged();
    } catch (e: any) {
      setOrder(order);
      setErr(e?.message ?? "Couldn't save the new order.");
    }
  }

  async function toggleRecap(t: NoteTag) {
    try {
      await updateNoteTag(t.id, { show_in_recap: !t.show_in_recap });
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't update that tag.");
    }
  }

  async function rename(t: NoteTag, name: string) {
    const clean = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean || clean === t.name) return;
    try {
      await updateNoteTag(t.id, { name: clean });
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't rename that tag.");
    }
  }

  async function recolor(t: NoteTag, color: string) {
    try {
      await updateNoteTag(t.id, { color });
      onChanged();
    } catch {
      /* ignore transient */
    }
  }

  async function remove(t: NoteTag) {
    if (!window.confirm(`Remove the "#${t.name}" tag from your filters? Any #${t.name} text already in your notes is left as-is.`)) return;
    try {
      await deleteNoteTag(t.id);
      onChanged();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't remove that tag.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage tags">
      <div className="space-y-3">
        <p className="text-xs text-muted">
          Tags are created automatically the first time you type <code className="rounded bg-black/[0.06] px-1">#tagname</code> in a
          note. Removing one here only stops it from being tracked and colored — it won't touch your notes' text.
        </p>
        <p className="text-xs text-muted">
          Tap the <Star width={11} height={11} className="inline-block align-text-bottom text-faint" /> star to show that tag's
          items in a recap section at the bottom of every note — handy for things like your action items.
        </p>

        {order.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
            No tags yet — type <code className="rounded bg-black/[0.06] px-1">#something</code> in a note to create one.
          </p>
        ) : (
          <div className="space-y-2">
            {order.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-line p-2">
                <div className="flex flex-none flex-col items-center">
                  <button
                    aria-label={`Move #${t.name} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="flex h-4 w-6 items-center justify-center rounded text-faint hover:bg-black/[0.05] hover:text-ink disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ChevronUp width={13} height={13} />
                  </button>
                  <button
                    aria-label={`Move #${t.name} down`}
                    disabled={i === order.length - 1}
                    onClick={() => move(i, 1)}
                    className="flex h-4 w-6 items-center justify-center rounded text-faint hover:bg-black/[0.05] hover:text-ink disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ChevronDown width={13} height={13} />
                  </button>
                </div>
                {i > 1 && (
                  <button
                    aria-label={`Move #${t.name} to top`}
                    title="Move to top"
                    onClick={() => moveToTop(i)}
                    className="flex h-6 w-5 flex-none items-center justify-center rounded text-faint hover:bg-black/[0.05] hover:text-ink"
                  >
                    <ChevronsUp width={13} height={13} />
                  </button>
                )}
                <button
                  aria-label={t.show_in_recap ? `Remove #${t.name} from note recap` : `Show #${t.name} in note recap`}
                  title={t.show_in_recap ? "Shown in note recap" : "Show in note recap"}
                  onClick={() => toggleRecap(t)}
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded transition-colors ${
                    t.show_in_recap ? "text-amber-500" : "text-faint hover:text-ink"
                  }`}
                >
                  <Star width={14} height={14} fill={t.show_in_recap ? "currentColor" : "none"} />
                </button>
                <ColorDots value={t.color} onPick={(c) => recolor(t, c)} />
                <span className="text-sm text-faint">#</span>
                <input
                  defaultValue={t.name}
                  onBlur={(e) => rename(t, e.target.value)}
                  className="flex-1 rounded-md border border-transparent px-2 py-1 text-sm text-ink focus:border-line focus:outline-none"
                />
                <button
                  aria-label={`Remove #${t.name}`}
                  onClick={() => remove(t)}
                  className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-red-50 hover:text-red-600"
                >
                  <Trash width={15} height={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      </div>
    </Modal>
  );
}

function ColorDots({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-1">
      {NOTE_TAG_PALETTE.map((c) => {
        const active = c.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c}
            aria-label={`Use color ${c}`}
            onClick={() => onPick(c)}
            className="flex h-5 w-5 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{ backgroundColor: c, boxShadow: active ? `0 0 0 2px ${deepen(c)}` : "none" }}
          >
            {active && <Check width={10} height={10} color={deepen(c)} />}
          </button>
        );
      })}
    </div>
  );
}
