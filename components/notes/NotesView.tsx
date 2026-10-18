"use client";

import { useMemo, useState } from "react";
import type { Note } from "@/lib/types";
import type { NotesStore } from "@/lib/useNotesStore";
import { extractSnippets, extractTagNames, previewText, tagColorMap, type Snippet } from "@/lib/noteTags";
import { fmtTimestamp } from "@/lib/dates";
import { alpha, deepen } from "@/lib/colors";
import { NoteEditor } from "./NoteEditor";
import { NoteTagManager } from "./NoteTagManager";
import { TagPill } from "./NoteContent";
import { Button, Checkbox, Chip, EmptyState, IconButton, Segmented, Select, Switch, TextInput, cx } from "../ui";
import { Cog, Hash, NoteIcon, Plus, Search, Send } from "../icons";

type Mode = "notes" | "tagged";

export function NotesView({ store, onSendToTask }: { store: NotesStore; onSendToTask: (title: string) => void }) {
  const [mode, setMode] = useState<Mode>("notes");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<{ open: boolean; note: Note | null }>({ open: false, note: null });
  const [manageTags, setManageTags] = useState(false);

  const colors = useMemo(() => tagColorMap(store.tags), [store.tags]);
  const tagsByNote = useMemo(() => new Map(store.notes.map((n) => [n.id, extractTagNames(n.content)])), [store.notes]);
  const usedTags = useMemo(() => {
    const used = new Set<string>();
    tagsByNote.forEach((ts) => ts.forEach((t) => used.add(t)));
    const ordered = store.tags.map((t) => t.name).filter((n) => used.has(n));
    const extra = Array.from(used).filter((n) => !colors.has(n)).sort();
    return [...ordered, ...extra];
  }, [tagsByNote, store.tags, colors]);

  const q = query.trim().toLowerCase();
  const visibleNotes = store.notes.filter((n) => {
    const ts = tagsByNote.get(n.id) ?? [];
    if (tagFilter.size && !ts.some((t) => tagFilter.has(t))) return false;
    if (q && !(n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))) return false;
    return true;
  });

  function openNote(note: Note | null) {
    setEditor({ open: true, note });
  }

  return (
    <div className="pb-28">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "notes", label: <><NoteIcon size={15} /> Notes</> },
            { value: "tagged", label: <><Hash size={15} /> Tagged items</> },
          ]}
        />
        <div className="flex-1" />
        <IconButton label="Manage tags" onClick={() => setManageTags(true)}>
          <Cog />
        </IconButton>
        <Button variant="primary" className="hidden sm:inline-flex" onClick={() => openNote(null)}>
          <Plus size={16} /> New note
        </Button>
      </div>

      {mode === "notes" ? (
        <>
          <div className="relative mb-3">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <TextInput placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          {usedTags.length > 0 && (
            <div className="scrollbar-thin -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {usedTags.map((t) => (
                <Chip
                  key={t}
                  active={tagFilter.has(t)}
                  color={colors.get(t) ?? "#97958e"}
                  onClick={() =>
                    setTagFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t);
                      else next.add(t);
                      return next;
                    })
                  }
                >
                  #{t}
                </Chip>
              ))}
            </div>
          )}
          {visibleNotes.length === 0 ? (
            store.notes.length === 0 ? (
              <EmptyState
                title="No notes yet"
                body="Use notes for meetings and projects. Tag lines with #action or highlight a phrase and tag it, then review everything in Tagged items."
                action={
                  <Button variant="primary" onClick={() => openNote(null)}>
                    <Plus size={16} /> New note
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No matching notes" />
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visibleNotes.map((n) => {
                const ts = tagsByNote.get(n.id) ?? [];
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNote(n)}
                    className="flex min-h-[120px] flex-col rounded-xl border border-line bg-surface p-3.5 text-left shadow-card transition-colors hover:border-faint"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{n.title.trim() || "Untitled note"}</span>
                      <span className="shrink-0 text-xs text-faint">{fmtTimestamp(n.updated_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted">{previewText(n.content) || "Empty note"}</p>
                    {ts.length > 0 && (
                      <div className="mt-auto flex flex-wrap gap-1 pt-2.5">
                        {ts.slice(0, 5).map((t) => (
                          <TagPill key={t} small tag={t} color={colors.get(t)} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <TaggedItems store={store} onOpenNote={openNote} onSendToTask={onSendToTask} />
      )}

      <button
        type="button"
        aria-label="New note"
        onClick={() => openNote(null)}
        className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-pop sm:hidden"
      >
        <Plus size={24} />
      </button>

      <NoteEditor
        open={editor.open}
        note={editor.note}
        store={store}
        onClose={() => setEditor({ open: false, note: null })}
        onSendToTask={onSendToTask}
      />
      <NoteTagManager open={manageTags} onClose={() => setManageTags(false)} store={store} />
    </div>
  );
}

function TaggedItems({
  store,
  onOpenNote,
  onSendToTask,
}: {
  store: NotesStore;
  onOpenNote: (n: Note) => void;
  onSendToTask: (title: string) => void;
}) {
  const [noteFilter, setNoteFilter] = useState("all");
  const [showDone, setShowDone] = useState(false);
  const colors = useMemo(() => tagColorMap(store.tags), [store.tags]);

  const groups = useMemo(() => {
    const notes = noteFilter === "all" ? store.notes : store.notes.filter((n) => n.id === noteFilter);
    const all: Snippet[] = notes.flatMap((n) => extractSnippets(n));
    const byTag = new Map<string, Snippet[]>();
    for (const s of all) {
      const list = byTag.get(s.tag) ?? [];
      list.push(s);
      byTag.set(s.tag, list);
    }
    const order = store.tags.map((t) => t.name);
    const extra = Array.from(byTag.keys()).filter((t) => !order.includes(t)).sort();
    return [...order, ...extra]
      .filter((t) => byTag.has(t))
      .map((tag) => {
        const items = byTag.get(tag) as Snippet[];
        const done = items.filter((s) => store.snippetDone.has(`${s.noteId}:${s.hash}`));
        const open = items.filter((s) => !store.snippetDone.has(`${s.noteId}:${s.hash}`));
        return { tag, open, done };
      });
  }, [store.notes, store.tags, store.snippetDone, noteFilter]);

  const noteById = useMemo(() => new Map(store.notes.map((n) => [n.id, n])), [store.notes]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={noteFilter} onChange={(e) => setNoteFilter(e.target.value)} className="max-w-xs flex-1">
          <option value="all">All notes</option>
          {store.notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title.trim() || "Untitled note"}
            </option>
          ))}
        </Select>
        <Switch checked={showDone} onChange={setShowDone} label="Show done" />
      </div>

      {groups.length === 0 && (
        <EmptyState title="No tagged items" body="Add #tags to lines in your notes, or select text and tap a tag, and they collect here." />
      )}

      <div className="space-y-4">
        {groups.map(({ tag, open, done }) => {
          const color = colors.get(tag) ?? "#97958e";
          const rows = showDone ? [...open, ...done] : open;
          if (!rows.length && !showDone) {
            return (
              <div key={tag} className="flex items-center gap-2 px-1 text-[13px] text-faint">
                <TagPill tag={tag} color={color} /> all {done.length} done
              </div>
            );
          }
          return (
            <section key={tag} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2" style={{ background: alpha(color, 0.06) }}>
                <TagPill tag={tag} color={color} />
                <span className="text-xs text-muted">
                  {open.length} open{done.length ? ` · ${done.length} done` : ""}
                </span>
              </div>
              <ul>
                {rows.map((s) => {
                  const isDone = store.snippetDone.has(`${s.noteId}:${s.hash}`);
                  const note = noteById.get(s.noteId);
                  return (
                    <li key={`${s.noteId}:${s.hash}`} className="flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                      <div className="pt-0.5">
                        <Checkbox
                          size={20}
                          checked={isDone}
                          color={deepen(color, 0.1)}
                          label={isDone ? "Restore item" : "Mark item done"}
                          onChange={() => store.toggleSnippet(s.noteId, s.hash)}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cx("text-[14.5px] leading-snug text-ink", isDone && "text-faint line-through")}>{s.text}</p>
                        {noteFilter === "all" && note && (
                          <button type="button" onClick={() => onOpenNote(note)} className="mt-0.5 text-[12px] text-muted hover:text-ink hover:underline">
                            {s.noteTitle}
                          </button>
                        )}
                      </div>
                      {!isDone && (
                        <Button size="sm" variant="ghost" onClick={() => onSendToTask(s.text)}>
                          <Send size={14} /> Task
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
