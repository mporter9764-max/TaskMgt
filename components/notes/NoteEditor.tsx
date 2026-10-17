"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "@/lib/types";
import type { NotesStore } from "@/lib/useNotesStore";
import { extractSnippets, extractTagNames, normalizeTag, tagColorMap } from "@/lib/noteTags";
import { NoteContent, TagPill } from "./NoteContent";
import { Button, Checkbox, IconButton, Segmented, Sheet, Switch, cx } from "../ui";
import { Plus, Send, Trash } from "../icons";
import { alpha, deepen } from "@/lib/colors";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NoteEditor({
  open,
  note,
  store,
  onClose,
  onSendToTask,
}: {
  open: boolean;
  note: Note | null;
  store: NotesStore;
  onClose: () => void;
  onSendToTask: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const [showDoneRecap, setShowDoneRecap] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // latest values for the debounced saver
  const latest = useRef({ title: "", content: "", noteId: null as string | null, dirty: false });
  const timer = useRef<number | null>(null);
  const saving = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = note?.title ?? "";
    const c = note?.content ?? "";
    setTitle(t);
    setContent(c);
    setNoteId(note?.id ?? null);
    setStatus(note ? "saved" : "idle");
    setMode("write");
    setSel([0, 0]);
    latest.current = { title: t, content: c, noteId: note?.id ?? null, dirty: false };
  }, [open, note]);

  const persist = useCallback(async () => {
    if (saving.current) await saving.current;
    const cur = latest.current;
    if (!cur.dirty) return;
    cur.dirty = false;
    const run = (async () => {
      setStatus("saving");
      let ok = true;
      if (!cur.noteId) {
        if (!cur.title.trim() && !cur.content.trim()) {
          setStatus("idle");
          return;
        }
        const created = await store.createNote(cur.title, cur.content);
        if (created) {
          cur.noteId = created.id;
          setNoteId(created.id);
        } else ok = false;
      } else {
        ok = await store.updateNote(cur.noteId, { title: cur.title, content: cur.content });
      }
      if (ok) await store.registerTags(extractTagNames(cur.content));
      else cur.dirty = true;
      setStatus(ok ? "saved" : "error");
    })();
    saving.current = run;
    await run;
    saving.current = null;
  }, [store]);

  function schedule(nextTitle: string, nextContent: string) {
    latest.current = { ...latest.current, title: nextTitle, content: nextContent, dirty: true };
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      persist();
    }, 800);
  }

  async function close() {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    await persist();
    onClose();
  }

  const colors = useMemo(() => tagColorMap(store.tags), [store.tags]);
  const recapTags = useMemo(() => new Set(store.tags.filter((t) => t.is_recap).map((t) => t.name)), [store.tags]);

  const recap = useMemo(() => {
    if (!recapTags.size) return [];
    const snippets = extractSnippets({ id: noteId ?? "new", title, content, created_at: "", updated_at: "" });
    return snippets.filter((s) => recapTags.has(s.tag)).reverse();
  }, [recapTags, noteId, title, content]);
  const recapDone = (hash: string) => (noteId ? store.snippetDone.has(`${noteId}:${hash}`) : false);
  const recapPending = recap.filter((s) => !recapDone(s.hash));
  const recapCompleted = recap.filter((s) => recapDone(s.hash));

  function applyTag(rawName: string) {
    const tag = normalizeTag(rawName);
    if (!tag) return;
    const ta = taRef.current;
    const [s, e] = ta ? [ta.selectionStart, ta.selectionEnd] : sel;
    let next: string;
    let caret: number;
    const selected = content.slice(s, e);
    if (e > s && selected.trim()) {
      const lead = selected.match(/^\s*/)?.[0] ?? "";
      const trail = selected.match(/\s*$/)?.[0] ?? "";
      const wrapped = `${lead}[[${tag}: ${selected.trim()}]]${trail}`;
      next = content.slice(0, s) + wrapped + content.slice(e);
      caret = s + wrapped.length;
    } else {
      const before = content.slice(0, s);
      const needsSpace = before.length > 0 && !/\s$/.test(before);
      const ins = `${needsSpace ? " " : ""}#${tag} `;
      next = before + ins + content.slice(s);
      caret = s + ins.length;
    }
    setContent(next);
    schedule(title, next);
    setMode("write");
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
        setSel([caret, caret]);
      }
    });
  }

  async function remove() {
    if (!noteId) return onClose();
    if (!window.confirm("Delete this note? Its tagged items go with it.")) return;
    if (timer.current) window.clearTimeout(timer.current);
    latest.current.dirty = false;
    await store.deleteNote(noteId);
    onClose();
  }

  const hasSelection = sel[1] > sel[0] && content.slice(sel[0], sel[1]).trim().length > 0;
  const statusText = status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved" : "";

  return (
    <Sheet
      open={open}
      onClose={close}
      wide
      title={
        <input
          value={title}
          placeholder="Note title"
          onChange={(e) => {
            setTitle(e.target.value);
            schedule(e.target.value, content);
          }}
          className="w-full bg-transparent text-[16px] font-semibold text-ink placeholder:text-faint focus:outline-none"
        />
      }
      headerRight={
        <div className="flex items-center gap-1">
          <span className={cx("hidden whitespace-nowrap text-xs sm:inline", status === "error" ? "text-danger" : "text-faint")}>{statusText}</span>
          {noteId && (
            <IconButton label="Delete note" onClick={remove}>
              <Trash size={16} />
            </IconButton>
          )}
        </div>
      }
    >
      <div className="flex min-h-[60dvh] flex-col">
        <div className="mb-2 flex items-center gap-2">
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "write", label: "Write" },
              { value: "preview", label: "Preview" },
            ]}
          />
          <span className={cx("ml-auto text-xs sm:hidden", status === "error" ? "text-danger" : "text-faint")}>{statusText}</span>
        </div>

        {mode === "write" && (
          <div className="sticky top-0 z-10 -mx-4 mb-2 border-b border-line bg-surface/95 px-4 pb-2 pt-1 backdrop-blur">
            <p className="mb-1.5 text-[12px] text-muted">
              {hasSelection ? (
                <span className="font-medium text-accent-deep">Tap a tag to highlight-tag the selected text</span>
              ) : (
                "Tap a tag to add it at the cursor. A #tag marks its whole line."
              )}
            </p>
            <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-0.5">
              {store.tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyTag(t.name)}
                  className="h-7 shrink-0 rounded-full px-2.5 text-[12px] font-medium"
                  style={{ background: alpha(t.color, hasSelection ? 0.24 : 0.12), color: deepen(t.color, 0.3) }}
                >
                  #{t.name}
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const name = window.prompt("New tag name (letters, numbers, - or _)");
                  if (name) applyTag(name);
                }}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-2.5 text-[12px] text-muted"
              >
                <Plus size={12} /> tag
              </button>
            </div>
          </div>
        )}

        {mode === "write" ? (
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              schedule(title, e.target.value);
            }}
            onSelect={(e) => {
              const t = e.currentTarget;
              setSel([t.selectionStart, t.selectionEnd]);
            }}
            placeholder={"Start typing…\n\nExamples:\n- Send revised quote to finance #action\n- We agreed to [[decision: pilot in Q1]]"}
            className="min-h-[45dvh] w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
          />
        ) : (
          <div className="min-h-[45dvh] flex-1">
            {content.trim() ? <NoteContent content={content} colors={colors} /> : <p className="text-sm text-faint">Nothing to preview yet.</p>}
          </div>
        )}

        {recap.length > 0 && (
          <div className="mt-6 rounded-xl border border-line bg-canvas p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-ink">Recap</span>
              <span className="text-xs text-faint">newest first · {recapPending.length} open</span>
              <div className="ml-auto">
                {recapCompleted.length > 0 && <Switch checked={showDoneRecap} onChange={setShowDoneRecap} label={`Done (${recapCompleted.length})`} />}
              </div>
            </div>
            {!noteId && <p className="mb-2 text-xs text-faint">Items can be checked off once the note has saved.</p>}
            <ul className="space-y-1">
              {[...recapPending, ...(showDoneRecap ? recapCompleted : [])].map((s) => {
                const done = recapDone(s.hash);
                return (
                  <li key={s.hash} className="flex items-start gap-2.5 rounded-lg bg-surface px-2.5 py-2">
                    <div className="pt-0.5">
                      <Checkbox
                        size={20}
                        checked={done}
                        color={colors.get(s.tag)}
                        label={done ? "Restore item" : "Mark item done"}
                        onChange={() => noteId && store.toggleSnippet(noteId, s.hash)}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cx("text-[14px] leading-snug text-ink", done && "text-faint line-through")}>{s.text}</p>
                      <div className="mt-0.5">
                        <TagPill small tag={s.tag} color={colors.get(s.tag)} />
                      </div>
                    </div>
                    {!done && (
                      <Button size="sm" variant="ghost" onClick={() => onSendToTask(s.text)}>
                        <Send size={14} /> Task
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
