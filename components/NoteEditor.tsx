"use client";

import { useEffect, useRef, useState } from "react";
import type { Note, NoteTag, NoteSnippetCompletion } from "@/lib/types";
import { createNote, updateNote, deleteNote, ensureNoteTagsExist } from "@/lib/api";
import { extractTagNames, extractTaggedSnippets } from "@/lib/noteTags";
import { Sheet, Button, Field, TextInput } from "./ui";
import { Trash, Eye, EditIcon, Hash } from "./icons";
import { NoteContent } from "./NoteContent";
import { TaggedSnippetRow } from "./TaggedSnippetRow";

export function NoteEditor({
  open,
  note,
  noteTags,
  completions,
  onClose,
  onSaved,
  onCompleteSnippet,
  onUncompleteSnippet,
}: {
  open: boolean;
  note: Note | null; // null => creating
  noteTags: NoteTag[];
  completions: NoteSnippetCompletion[];
  onClose: () => void;
  onSaved: () => void;
  onCompleteSnippet: (noteId: string, tag: string, hash: string) => void;
  onUncompleteSnippet: (noteId: string, tag: string, hash: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false); // only for Delete now
  const [err, setErr] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autosave bookkeeping. localNoteId starts as the note's id (or undefined for
  // a brand-new note) and gets set the moment the first autosave creates it —
  // independent of the `note` prop, which won't update until the sheet reopens.
  const [localNoteId, setLocalNoteId] = useState<string | undefined>(note?.id);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const editing = Boolean(localNoteId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRunRef = useRef(true);

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
    setLocalNoteId(note?.id);
    setSaveStatus("idle");
    firstRunRef.current = true;
    if (note) {
      setTitle(note.title ?? "");
      setContent(note.content);
    } else {
      setTitle("");
      setContent("");
    }
  }, [open, note]);

  /** Save now (create on first save, update after). Shared by the debounce
   * timer and the close-flush, so both paths behave identically. */
  async function flushSave(currentTitle: string, currentContent: string) {
    if (!currentTitle.trim() && !currentContent.trim()) return; // nothing to save yet
    setSaveStatus("saving");
    try {
      const draft = { title: currentTitle.trim() || null, content: currentContent };
      const saved = localNoteId ? await updateNote(localNoteId, draft) : await createNote(draft);
      if (!localNoteId) setLocalNoteId(saved.id);
      const names = extractTagNames(saved.content);
      if (names.length > 0) await ensureNoteTagsExist(names, noteTags);
      onSaved();
      setSaveStatus("saved");
      setErr(null);
    } catch (e: any) {
      setSaveStatus("error");
      setErr(e?.message ?? "Couldn't save just now — it'll retry as you keep typing.");
    }
  }

  // Debounced autosave: 800ms after the last change to title/content.
  useEffect(() => {
    if (!open) return;
    if (firstRunRef.current) {
      firstRunRef.current = false; // skip the run caused by loading the note in
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushSave(title, content);
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  /** Close the sheet, flushing any pending edit first so nothing typed in the
   * last moment before closing gets lost. */
  async function handleClose() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await flushSave(title, content);
    onClose();
  }

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

  function wrapSelectionWithMarkup(before: string, after: string) {
    const el = textareaRef.current;
    const start = selection?.start ?? el?.selectionStart ?? content.length;
    const end = selection?.end ?? el?.selectionEnd ?? content.length;
    const selected = content.slice(start, end);
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    setSelection(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = selected ? start + before.length + selected.length + after.length : start + before.length;
      el.setSelectionRange(pos, pos);
    });
  }

  /** Toggle a prefix (like '# ' or '- ') on the current line, so tapping the
   * same button again removes it. */
  function toggleLinePrefix(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? content.length;
    const lineStart = content.lastIndexOf("\n", pos - 1) + 1;
    const already = content.slice(lineStart, lineStart + prefix.length) === prefix;
    let next: string;
    let newPos: number;
    if (already) {
      next = content.slice(0, lineStart) + content.slice(lineStart + prefix.length);
      newPos = Math.max(lineStart, pos - prefix.length);
    } else {
      next = content.slice(0, lineStart) + prefix + content.slice(lineStart);
      newPos = pos + prefix.length;
    }
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
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

  async function handleDelete() {
    if (!localNoteId) return;
    if (!window.confirm("Delete this note permanently? This can't be undone.")) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setBusy(true);
    try {
      await deleteNote(localNoteId);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't delete the note.");
    } finally {
      setBusy(false);
    }
  }

  const recapTagNames = new Set(noteTags.filter((t) => t.show_in_recap).map((t) => t.name));
  const recapSnippets =
    localNoteId && recapTagNames.size > 0
      ? extractTaggedSnippets({
          id: localNoteId,
          title,
          content,
          created_at: note?.created_at ?? new Date().toISOString(),
          updated_at: note?.updated_at ?? new Date().toISOString(),
        })
          .filter((s) => recapTagNames.has(s.tag))
          .reverse() // most-recently-written (further down the note) first
      : [];
  const doneKeys = new Set(completions.map((c) => `${c.note_id}|${c.tag}|${c.snippet_hash}`));

  return (
    <Sheet
      open={open}
      onClose={handleClose}
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-faint">
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "Saved"}
              {saveStatus === "error" && "Couldn't save"}
            </span>
            <Button size="sm" onClick={handleClose} disabled={busy}>
              Done
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
            <div className="mb-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => wrapSelectionWithMarkup("**", "**")}
                title="Bold"
                className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-ink hover:bg-black/[0.06]"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => wrapSelectionWithMarkup("*", "*")}
                title="Italic"
                className="flex h-7 w-7 items-center justify-center rounded-md text-sm italic text-ink hover:bg-black/[0.06]"
              >
                I
              </button>
              <div className="mx-1 h-4 w-px bg-line" />
              <button
                type="button"
                onClick={() => toggleLinePrefix("# ")}
                title="Header"
                className="flex h-7 items-center justify-center rounded-md px-2 text-xs font-semibold text-ink hover:bg-black/[0.06]"
              >
                Header
              </button>
              <button
                type="button"
                onClick={() => toggleLinePrefix("- ")}
                title="Bullet list"
                className="flex h-7 items-center justify-center rounded-md px-2 text-sm text-ink hover:bg-black/[0.06]"
              >
                • List
              </button>
            </div>
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
              Type <code className="rounded bg-black/[0.06] px-1">#tagname</code> to tag a line, or select text to tag just that phrase. Saves automatically as you write.
            </p>
          </div>
        ) : (
          <div className="min-h-[440px] rounded-lg border border-line bg-surface px-3 py-3 sm:min-h-[520px]">
            {content.trim() ? (
              <NoteContent content={content} tags={noteTags} noteId={localNoteId} completions={completions} />
            ) : (
              <p className="text-sm text-faint">Nothing to preview yet.</p>
            )}
          </div>
        )}

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

        {/* Per-note recap — only the tags you've starred in Manage Tags, scoped to this note */}
        {localNoteId && recapTagNames.size > 0 && (
          <div className="mt-2 border-t border-line pt-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {recapTagNames.size === 1 ? `#${Array.from(recapTagNames)[0]}` : "Recap"} in this note
            </h3>
            {recapSnippets.length === 0 ? (
              <p className="text-sm text-faint">Nothing tagged here yet.</p>
            ) : (
              <div className="space-y-2">
                {recapSnippets.map((s, i) => {
                  const done = doneKeys.has(`${s.noteId}|${s.tag}|${s.hash}`);
                  return (
                    <TaggedSnippetRow
                      key={i}
                      text={s.text}
                      subtitle={`#${s.tag}`}
                      done={done}
                      onToggleDone={() =>
                        done
                          ? onUncompleteSnippet(s.noteId, s.tag, s.hash)
                          : onCompleteSnippet(s.noteId, s.tag, s.hash)
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
