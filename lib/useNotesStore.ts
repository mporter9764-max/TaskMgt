"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { fetchAll, saveOrder } from "./db";
import { reportError, toast } from "./toast";
import { nextTagColor, normalizeTag, renameTagInContent } from "./noteTags";
import type { Note, NoteTag, SnippetCompletion } from "./types";

export interface NotesStore {
  loading: boolean;
  error: string | null;
  notes: Note[];
  tags: NoteTag[];
  snippetDone: Set<string>;
  reload: () => Promise<void>;
  createNote: (title: string, content: string) => Promise<Note | null>;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "content">>) => Promise<boolean>;
  deleteNote: (id: string) => Promise<void>;
  registerTags: (names: string[]) => Promise<void>;
  updateTag: (id: string, patch: Partial<Pick<NoteTag, "color" | "is_recap">>) => Promise<void>;
  renameTag: (id: string, newName: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  reorderTags: (ordered: NoteTag[]) => Promise<void>;
  toggleSnippet: (noteId: string, hash: string) => Promise<void>;
}

function byUpdatedDesc(a: Note, b: Note): number {
  return a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0;
}

export function useNotesStore(enabled: boolean): NotesStore {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [snippetDone, setSnippetDone] = useState<Set<string>>(new Set());
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const doneRef = useRef(snippetDone);
  doneRef.current = snippetDone;

  const reload = useCallback(async () => {
    try {
      const [n, t, c] = await Promise.all([
        fetchAll<Note>("notes", "updated_at", false),
        fetchAll<NoteTag>("note_tags", "sort_order"),
        fetchAll<SnippetCompletion>("note_snippet_completions", "completed_at"),
      ]);
      setNotes(n);
      setTags(t);
      setSnippetDone(new Set(c.map((x) => `${x.note_id}:${x.snippet_hash}`)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  const createNote = useCallback(async (title: string, content: string): Promise<Note | null> => {
    const { data, error } = await supabase.from("notes").insert({ title, content }).select().single();
    if (reportError(error, "create the note")) return null;
    setNotes((prev) => [data as Note, ...prev]);
    return data as Note;
  }, []);

  const updateNote = useCallback(async (id: string, patch: Partial<Pick<Note, "title" | "content">>) => {
    const { data, error } = await supabase.from("notes").update(patch).eq("id", id).select().single();
    if (reportError(error, "save the note")) return false;
    setNotes((prev) => prev.map((n) => (n.id === id ? (data as Note) : n)).sort(byUpdatedDesc));
    return true;
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (reportError(error, "delete the note")) reload();
  }, [reload]);

  const registerTags = useCallback(async (names: string[]) => {
    const known = new Set(tagsRef.current.map((t) => t.name));
    const fresh = Array.from(new Set(names.map(normalizeTag))).filter((n) => n && !known.has(n));
    if (!fresh.length) return;
    let order = tagsRef.current.length ? Math.max(...tagsRef.current.map((t) => t.sort_order)) + 1 : 0;
    const pool = [...tagsRef.current];
    const rows = fresh.map((name) => {
      const color = nextTagColor(pool);
      pool.push({ id: name, name, color, sort_order: order, is_recap: false });
      return { name, color, sort_order: order++ };
    });
    const { data, error } = await supabase.from("note_tags").upsert(rows, { onConflict: "name", ignoreDuplicates: true }).select();
    if (reportError(error, "register new tags")) return;
    if (data?.length) setTags((prev) => [...prev, ...(data as NoteTag[])]);
  }, []);

  const updateTag = useCallback(async (id: string, patch: Partial<Pick<NoteTag, "color" | "is_recap">>) => {
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("note_tags").update(patch).eq("id", id);
    if (reportError(error, "update the tag")) reload();
  }, [reload]);

  const renameTag = useCallback(async (id: string, newNameRaw: string) => {
    const tag = tagsRef.current.find((t) => t.id === id);
    const newName = normalizeTag(newNameRaw);
    if (!tag || !newName || newName === tag.name) return;
    if (tagsRef.current.some((t) => t.name === newName)) {
      toast(`A tag named #${newName} already exists.`);
      return;
    }
    const { error } = await supabase.from("note_tags").update({ name: newName }).eq("id", id);
    if (reportError(error, "rename the tag")) return;
    // rewrite the tag inside every note that uses it
    const affected = notesRef.current
      .map((n) => ({ n, content: renameTagInContent(n.content, tag.name, newName) }))
      .filter((x) => x.content !== x.n.content);
    await Promise.all(affected.map((x) => supabase.from("notes").update({ content: x.content }).eq("id", x.n.id)));
    await reload();
    toast(`Renamed #${tag.name} to #${newName}${affected.length ? ` in ${affected.length} note${affected.length === 1 ? "" : "s"}` : ""}.`);
  }, [reload]);

  const deleteTag = useCallback(async (id: string) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("note_tags").delete().eq("id", id);
    if (reportError(error, "remove the tag")) reload();
  }, [reload]);

  const reorderTags = useCallback(async (ordered: NoteTag[]) => {
    setTags(ordered.map((t, i) => ({ ...t, sort_order: i })));
    const err = await saveOrder("note_tags", ordered.map((t) => t.id));
    if (err) {
      toast(`Couldn't save the order: ${err}`);
      reload();
    }
  }, [reload]);

  const toggleSnippet = useCallback(async (noteId: string, hash: string) => {
    const key = `${noteId}:${hash}`;
    const wasDone = doneRef.current.has(key);
    setSnippetDone((prev) => {
      const next = new Set(prev);
      if (wasDone) next.delete(key);
      else next.add(key);
      return next;
    });
    const { error } = wasDone
      ? await supabase.from("note_snippet_completions").delete().eq("note_id", noteId).eq("snippet_hash", hash)
      : await supabase.from("note_snippet_completions").insert({ note_id: noteId, snippet_hash: hash });
    if (reportError(error, "update the item")) reload();
  }, [reload]);

  return {
    loading, error, notes, tags, snippetDone, reload,
    createNote, updateNote, deleteNote,
    registerTags, updateTag, renameTag, deleteTag, reorderTags, toggleSnippet,
  };
}
