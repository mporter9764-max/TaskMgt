"use client";

import { useEffect, useRef, useState } from "react";
import type { Note, NoteTag, NoteSnippetCompletion } from "@/lib/types";
import { createNote, updateNote, deleteNote, ensureNoteTagsExist } from "@/lib/api";
import { extractTagNames } from "@/lib/noteTags";
import { Sheet, Button, Field, TextInput } from "./ui";
import { Trash, Eye, EditIcon, Hash } from "./icons";
import { NoteContent } from "./NoteContent";

export function NoteEditor({
  open,
  note,
  noteTags,
  completions,
  onClose,
  onSaved,
}: {
  open: boolean;
  note: Note | null; // null => creating
  noteTags: NoteTag[];
  completions: NoteSnippetCompletion[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(note);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [newTagDraft, setNewTagDraft] = useState("");
  const [showNewTagInput, setShowNewTagInput] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setMode("edit");
    setSelection(null);
    setShowNewTagInput(false);
    setNewTagDraft("");
    if (note) {
      setTitle(note.title ?? "");
      setContent(note.content);
    } else {
      setTitle("");
      setContent("");
    }
  }, [open, note]);

  function trackSelection() {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end > start && content.slice(start, end).trim().length > 0) {
      setSelection({ start, end });
    } else {
      setSelection(null);
    }
  }

  function wrapSelectionWithTag(tagName: string) {
    const clean = tagName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean || !selection) return;
    const { start, end } = selection;
    const phrase = content.slice(start, end);
    const wrapped = `[[${clean}: ${phrase}]]`;
    const next = content.slice(0, start) + wrapped + content.slice(end);
    setContent(next);
    setSelection(null);
    setShowNewTagInput(false);
    setNewTagDraft("");
    const el = textareaRef.current;
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + wrapped.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function insertTag(name: string) {
    const el = textareaRef.current;
    const token = `#${name} `;
    if (!el) {
      setContent((c) => (c ? c + (c.endsWith("\n") ? "" : "\n") + token : token));
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleSave() {
    if (!content.trim()) return setErr("Write something before saving — or delete this note instead.");
    setBusy(true);
    setErr(null);
    try {
      const draft = { title: title.trim() || null, content };
      const saved = note ? await updateNote(note.id, draft) : await createNote(draft);
      const names = extractTagNames(saved.content);
      if (names.length > 0) await ensureNoteTagsExist(names, noteTags);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong saving.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!note) return;
    if (!window.confirm("Delete this note permanently? This can't be undone.")) return;
    setBusy(true);
    try {
      await deleteNote(note.id);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't delete the note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit note" : "New note"}
      widthClassName="sm:w-[560px] lg:w-[720px] xl:w-[840px]"
      footer={
        <>
          {editing ? (
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={busy}>
              <Trash width={14} height={14} />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Save note"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Title (optional)">
          <TextInput value={title} placeholder="Untitled" onChange={(e) => setTitle(e.target.value)} />
        </Field>

        {/* Quick-insert tag chips */}
        {noteTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Hash width={13} height={13} className="text-faint" />
            {noteTags.map((t) => (
              <button
                key={t.id}
                onClick={() => insertTag(t.name)}
                className="rounded-full px-2 py-0.5 text-xs font-medium text-ink transition-transform hover:scale-105"
                style={{ backgroundColor: t.color }}
              >
                #{t.name}
              </button>
            ))}
          </div>
        )}

        {/* Edit / Preview toggle */}
        <div className="flex overflow-hidden rounded-lg border border-line">
          <button
            onClick={() => setMode("edit")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-sm font-medium transition-colors ${
              mode === "edit" ? "bg-accent text-white" : "text-muted hover:bg-black/[0.04]"
            }`}
          >
            <EditIcon width={14} height={14} />
            Write
          </button>
          <button
            onClick={() => setMode("preview")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-1.5 text-sm font-medium transition-colors ${
              mode === "preview" ? "bg-accent text-white" : "text-muted hover:bg-black/[0.04]"
            }`}
          >
            <Eye width={14} height={14} />
            Preview
          </button>
        </div>

        {/* Highlight-and-tag action bar — appears only when text is selected */}
        {mode === "edit" && selection && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/5 px-2.5 py-2">
            <span className="text-xs font-medium text-muted">Tag selection:</span>
            {noteTags.map((t) => (
              <button
                key={t.id}
                onClick={() => wrapSelectionWithTag(t.name)}
                className="rounded-full px-2 py-0.5 text-xs font-medium text-ink transition-transform hover:scale-105"
                style={{ backgroundColor: t.color }}
              >
                #{t.name}
              </button>
            ))}
            {showNewTagInput ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newTagDraft}
                  onChange={(e) => setNewTagDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && wrapSelectionWithTag(newTagDraft)}
                  placeholder="new-tag"
                  className="w-24 rounded-full border border-line bg-surface px-2 py-0.5 text-xs focus:border-accent focus:outline-none"
                />
                <Button size="sm" variant="ghost" onClick={() => wrapSelectionWithTag(newTagDraft)} className="h-6 px-2 text-xs">
                  Apply
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewTagInput(true)}
                className="rounded-full border border-dashed border-faint px-2 py-0.5 text-xs font-medium text-muted hover:text-ink"
              >
                + new tag
              </button>
            )}
          </div>
        )}

        {mode === "edit" ? (
          <div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onSelect={trackSelection}
              onMouseUp={trackSelection}
              onTouchEnd={trackSelection}
              onKeyUp={trackSelection}
              placeholder={"Write freely. Tag anything as you go — e.g. #followup, #decision, #waiting-on-sam.\n\n# Headers, **bold**, *italic*, and - bullets are all supported.\n\nSelect a phrase to highlight and tag just that part."}
              className="min-h-[440px] w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm leading-relaxed text-ink placeholder:font-sans placeholder:text-faint focus:border-accent focus:outline-none sm:min-h-[520px]"
            />
            <p className="mt-1.5 text-xs text-faint">
              Type <code className="rounded bg-black/[0.06] px-1">#tagname</code> to tag a line, or select text to tag just that phrase.
            </p>
          </div>
        ) : (
          <div className="min-h-[440px] rounded-lg border border-line bg-surface px-3 py-3 sm:min-h-[520px]">
            {content.trim() ? (
              <NoteContent content={content} tags={noteTags} noteId={note?.id} completions={completions} />
            ) : (
              <p className="text-sm text-faint">Nothing to preview yet.</p>
            )}
          </div>
        )}

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      </div>
    </Sheet>
  );
}
