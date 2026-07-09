"use client";

import { useMemo, useState } from "react";
import type { Note, NoteTag, NoteSnippetCompletion } from "@/lib/types";
import { extractTagNames, extractTaggedSnippets, previewText } from "@/lib/noteTags";
import { monthDay } from "@/lib/dates";
import { tint, deepen } from "@/lib/colors";
import { EmptyState, IconButton, TextInput } from "./ui";
import { Search, Cog, Hash } from "./icons";
import { TaggedSnippetRow } from "./TaggedSnippetRow";

type ViewMode = "notes" | "review";

export function NotesView({
  notes,
  noteTags,
  completions,
  onOpenNote,
  onManageTags,
  onSendToTask,
  onCompleteSnippet,
  onUncompleteSnippet,
}: {
  notes: Note[];
  noteTags: NoteTag[];
  completions: NoteSnippetCompletion[];
  onOpenNote: (note: Note) => void;
  onManageTags: () => void;
  onSendToTask: (title: string) => void;
  onCompleteSnippet: (noteId: string, tag: string, hash: string) => void;
  onUncompleteSnippet: (noteId: string, tag: string, hash: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ViewMode>("notes");
  const [showDone, setShowDone] = useState(false);

  const colorByTag = useMemo(() => new Map(noteTags.map((t) => [t.name, t.color])), [noteTags]);

  const tagsByNote = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of notes) m.set(n.id, extractTagNames(n.content));
    return m;
  }, [notes]);

  function toggleTag(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  const q = query.trim().toLowerCase();

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const noteTagNames = tagsByNote.get(n.id) ?? [];
      const matchesTags = selected.size === 0 || noteTagNames.some((t) => selected.has(t));
      const matchesQuery = q === "" || n.content.toLowerCase().includes(q) || (n.title ?? "").toLowerCase().includes(q);
      return matchesTags && matchesQuery;
    });
  }, [notes, tagsByNote, selected, q]);

  const doneSet = useMemo(
    () => new Set(completions.map((c) => `${c.note_id}|${c.tag}|${c.snippet_hash}`)),
    [completions]
  );

  const allSnippets = useMemo(() => {
    const out = notes.flatMap((n) => extractTaggedSnippets(n));
    return out.filter((s) => (selected.size === 0 || selected.has(s.tag)) && (q === "" || s.text.toLowerCase().includes(q)));
  }, [notes, selected, q]);

  const openSnippets = useMemo(
    () => allSnippets.filter((s) => !doneSet.has(`${s.noteId}|${s.tag}|${s.hash}`)),
    [allSnippets, doneSet]
  );
  const doneCount = allSnippets.length - openSnippets.length;
  const visibleSnippets = showDone ? allSnippets : openSnippets;

  const snippetsByTag = useMemo(() => {
    const m = new Map<string, typeof allSnippets>();
    for (const s of visibleSnippets) {
      const arr = m.get(s.tag) ?? [];
      arr.push(s);
      m.set(s.tag, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return m;
  }, [visibleSnippets]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search width={15} height={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="pl-9"
          />
        </div>
        <IconButton label="Manage tags" onClick={onManageTags}>
          <Cog />
        </IconButton>
      </div>

      {noteTags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {noteTags.map((t) => {
            const active = selected.has(t.name);
            return (
              <button
                key={t.id}
                onClick={() => toggleTag(t.name)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active ? "border-transparent" : "border-line text-muted"
                }`}
                style={active ? { backgroundColor: t.color, color: deepen(t.color, 0.5) } : undefined}
              >
                <Hash width={11} height={11} />
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex overflow-hidden rounded-lg border border-line" style={{ width: 220 }}>
        <button
          onClick={() => setMode("notes")}
          className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
            mode === "notes" ? "bg-accent text-white" : "text-muted hover:bg-black/[0.04]"
          }`}
        >
          Notes
        </button>
        <button
          onClick={() => setMode("review")}
          className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
            mode === "review" ? "bg-accent text-white" : "text-muted hover:bg-black/[0.04]"
          }`}
        >
          Tagged items
        </button>
      </div>

      {mode === "notes" ? (
        filteredNotes.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={notes.length === 0 ? "No notes yet" : "Nothing matches"}
              hint={
                notes.length === 0
                  ? "Tap New note to start writing freely — tag anything as you go with #tagname."
                  : "Try a different search or clear your tag filters."
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredNotes.map((n) => {
              const tags = tagsByNote.get(n.id) ?? [];
              return (
                <button
                  key={n.id}
                  onClick={() => onOpenNote(n)}
                  className="flex flex-col items-start rounded-xl2 border border-line bg-surface p-3 text-left shadow-card transition-colors hover:border-faint"
                >
                  <p className="truncate text-sm font-medium text-ink">{n.title?.trim() || "Untitled note"}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{previewText(n) || "No content yet"}</p>
                  <div className="mt-2 flex w-full flex-wrap items-center gap-1">
                    {tags.slice(0, 4).map((tag) => {
                      const color = colorByTag.get(tag) ?? "#E7E9EE";
                      return (
                        <span
                          key={tag}
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: tint(color, 0.35), color: deepen(color, 0.55) }}
                        >
                          #{tag}
                        </span>
                      );
                    })}
                    <span className="ml-auto text-[11px] text-faint">{monthDay(n.updated_at.slice(0, 10))}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : allSnippets.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing tagged yet"
            hint="Snippets you tag in your notes (like #followup or #decision) will collect here so you can review and send them to Tasks."
          />
        </div>
      ) : (
        <div className="mt-4">
          {doneCount > 0 && (
            <button
              onClick={() => setShowDone((v) => !v)}
              className="mb-3 text-xs font-medium text-muted hover:text-ink"
            >
              {showDone ? "Hide" : "Show"} {doneCount} done item{doneCount === 1 ? "" : "s"}
            </button>
          )}
          {visibleSnippets.length === 0 ? (
            <EmptyState title="All caught up" hint="Everything matching your filters is marked done." />
          ) : (
            <div className="space-y-5">
              {noteTags
                .filter((t) => snippetsByTag.has(t.name))
                .map((t) => {
                  const tag = t.name;
                  const snippets = snippetsByTag.get(tag)!;
                  const color = t.color;
                  return (
                  <div key={tag}>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ backgroundColor: color, color: deepen(color, 0.5) }}
                      >
                        #{tag}
                      </span>
                      <span className="text-xs text-faint">{snippets.length}</span>
                    </div>
                    <div className="space-y-2">
                      {snippets.map((s, i) => {
                        const done = doneSet.has(`${s.noteId}|${s.tag}|${s.hash}`);
                        return (
                          <TaggedSnippetRow
                            key={i}
                            text={s.text}
                            subtitle={`${s.noteTitle} · ${monthDay(s.updatedAt.slice(0, 10))}`}
                            done={done}
                            onToggleDone={() =>
                              done
                                ? onUncompleteSnippet(s.noteId, s.tag, s.hash)
                                : onCompleteSnippet(s.noteId, s.tag, s.hash)
                            }
                            onSendToTask={() => onSendToTask(s.text)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
