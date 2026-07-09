import type { Note } from "./types";

// A tag typed inline as '#word' — letters/numbers/underscore/hyphen after the #.
const TAG_PATTERN = "#([a-zA-Z][a-zA-Z0-9_-]*)";

// A highlighted, precisely-tagged phrase: [[tagname: the exact phrase]]
const HIGHLIGHT_PATTERN = "\\[\\[([a-zA-Z][a-zA-Z0-9_-]*):\\s*([^\\]]+?)\\]\\]";

/** Small, stable, non-cryptographic hash (djb2) — used only to identify a
 * snippet for marking it complete. If you edit the text later, the old
 * completion no longer matches and the (changed) item reappears as new —
 * expected, since the content genuinely changed. */
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Only literal '#tag' tokens on a line — NOT tags embedded in [[tag: ...]] spans. */
export function extractInlineHashTags(text: string): string[] {
  const seen = new Set<string>();
  const re = new RegExp(TAG_PATTERN, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) seen.add(m[1].toLowerCase());
  return Array.from(seen);
}

export type HighlightSpan = { tag: string; text: string };

/** Every [[tag: phrase]] span anywhere in a string. */
export function extractHighlightSpans(content: string): HighlightSpan[] {
  const re = new RegExp(HIGHLIGHT_PATTERN, "g");
  const out: HighlightSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) out.push({ tag: m[1].toLowerCase(), text: m[2].trim() });
  return out;
}

/** All distinct tag names anywhere in a note — from '#tag' tokens AND [[tag: ...]] spans. */
export function extractTagNames(content: string): string[] {
  const seen = new Set(extractInlineHashTags(content));
  for (const span of extractHighlightSpans(content)) seen.add(span.tag);
  return Array.from(seen);
}

/** Replace [[tag: phrase]] with just its phrase — used anywhere the raw
 * brackets shouldn't leak into what's displayed (previews, whole-line tags). */
export function stripHighlightMarkup(s: string): string {
  return s.replace(new RegExp(HIGHLIGHT_PATTERN, "g"), (_m, _tag, text) => text.trim());
}

/** Strip tag tokens and highlight-span brackets from a line, collapsing extra
 * whitespace — the exact cleaning used both when a completion's hash was
 * created and whenever we later check if a rendered line matches it. */
export function cleanLineText(line: string): string {
  const flattened = stripHighlightMarkup(line);
  return flattened.replace(new RegExp(TAG_PATTERN, "g"), "").replace(/\s{2,}/g, " ").trim();
}

export type TaggedSnippet = {
  noteId: string;
  noteTitle: string;
  tag: string;
  text: string; // the whole line (for #tag) or the exact phrase (for a highlight span)
  hash: string; // stable id for this (note, tag, text) combination
  updatedAt: string;
};

/**
 * Every taggable item in a note:
 *  - one entry per line that carries a literal '#tag' (whole line, tag stripped)
 *  - one entry per [[tag: phrase]] highlight span (just that exact phrase)
 * A line can produce both kinds at once without duplicating.
 */
export function extractTaggedSnippets(note: Note): TaggedSnippet[] {
  const out: TaggedSnippet[] = [];

  const lines = note.content
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const tags = extractInlineHashTags(line);
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

  for (const span of extractHighlightSpans(note.content)) {
    out.push({
      noteId: note.id,
      noteTitle: note.title?.trim() || span.text.slice(0, 48) || "Untitled note",
      tag: span.tag,
      text: span.text,
      hash: hashString(`${note.id}|${span.tag}|${span.text}`),
      updatedAt: note.updated_at,
    });
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
  return cleanLineText(firstLine).replace(/[#*_>-]/g, "").trim();
}
