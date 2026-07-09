import type { Note } from "./types";

// A tag is typed inline as '#word' — letters/numbers/underscore/hyphen after the #.
const TAG_PATTERN = "#([a-zA-Z][a-zA-Z0-9_-]*)";
const TAG_RE_GLOBAL = new RegExp(TAG_PATTERN, "g");

/** Small, stable, non-cryptographic hash (djb2) — used only to identify a
 * snippet for marking it complete. If you edit the line's text later, the
 * old completion no longer matches and the (changed) line reappears as new —
 * expected, since the content genuinely changed. */
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** All distinct tag names (lowercase, no '#') typed anywhere in a note's content. */
export function extractTagNames(content: string): string[] {
  const seen = new Set<string>();
  const re = new RegExp(TAG_PATTERN, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) seen.add(m[1].toLowerCase());
  return Array.from(seen);
}

/** Strip tag tokens from a line and collapse extra whitespace — the exact
 * cleaning used both when a completion's hash was created and whenever we
 * later check if a rendered line matches that completion. */
export function cleanLineText(line: string): string {
  return line.replace(new RegExp(TAG_PATTERN, "g"), "").replace(/\s{2,}/g, " ").trim();
}

export type TaggedSnippet = {
  noteId: string;
  noteTitle: string;
  tag: string;
  text: string; // the line, with the tag token(s) stripped
  hash: string; // stable id for this (note, tag, text) combination
  updatedAt: string;
};

/**
 * Break a note into lines and, for every line that carries a tag, produce one
 * snippet per tag it carries (a line with two tags shows up under both).
 */
export function extractTaggedSnippets(note: Note): TaggedSnippet[] {
  const lines = note.content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out: TaggedSnippet[] = [];
  for (const line of lines) {
    const tags = extractTagNames(line);
    if (tags.length === 0) continue;
    const cleaned = cleanLineText(line);
    for (const tag of tags) {
      out.push({
        noteId: note.id,
        noteTitle: note.title?.trim() || cleaned.slice(0, 48) || "Untitled note",
        tag,
        text: cleaned || "(tag with no other text on the line)",
        hash: hashString(`${note.id}|${tag}|${cleaned}`),
        updatedAt: note.updated_at,
      });
    }
  }
  return out;
}

/** A short, tag-free preview line for note cards. */
export function previewText(note: Note): string {
  const firstLine = note.content
    .split(/\n+/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!firstLine) return "";
  return firstLine.replace(TAG_RE_GLOBAL, "").replace(/[#*_>-]/g, "").trim();
}
