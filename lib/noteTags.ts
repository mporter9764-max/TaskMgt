import type { Note } from "./types";

// A tag is typed inline as '#word' — letters/numbers/underscore/hyphen after the #.
const TAG_PATTERN = "#([a-zA-Z][a-zA-Z0-9_-]*)";
const TAG_RE_GLOBAL = new RegExp(TAG_PATTERN, "g");

/** All distinct tag names (lowercase, no '#') typed anywhere in a note's content. */
export function extractTagNames(content: string): string[] {
  const seen = new Set<string>();
  const re = new RegExp(TAG_PATTERN, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) seen.add(m[1].toLowerCase());
  return Array.from(seen);
}

export type TaggedSnippet = {
  noteId: string;
  noteTitle: string;
  tag: string;
  text: string; // the line, with the tag token(s) stripped
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
    const cleaned = line.replace(new RegExp(TAG_PATTERN, "g"), "").replace(/\s{2,}/g, " ").trim();
    for (const tag of tags) {
      out.push({
        noteId: note.id,
        noteTitle: note.title?.trim() || cleaned.slice(0, 48) || "Untitled note",
        tag,
        text: cleaned || "(tag with no other text on the line)",
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
