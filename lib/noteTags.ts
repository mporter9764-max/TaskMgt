import type { Note, NoteTag } from "./types";
import { djb2 } from "./hash";
import { TAG_PALETTE } from "./colors";

/** #tag (letters, digits, - and _), preceded by start of line, whitespace or "(" */
const HASHTAG_RE = /(^|[\s(])#([A-Za-z][\w-]*)/g;
/** [[tag: highlighted phrase]] */
const HIGHLIGHT_RE = /\[\[([A-Za-z][\w-]*):\s*([^\]]+?)\s*\]\]/g;

export interface Snippet {
  noteId: string;
  noteTitle: string;
  tag: string;
  text: string;
  hash: string;
  /** position in the note (line index * 1000 + order within line) for ordering */
  order: number;
}

export function normalizeTag(name: string): string {
  return name.trim().replace(/^#/, "").toLowerCase().replace(/[^\w-]/g, "");
}

export function extractTagNames(content: string): string[] {
  const set = new Set<string>();
  for (const m of content.matchAll(HASHTAG_RE)) set.add(m[2].toLowerCase());
  for (const m of content.matchAll(HIGHLIGHT_RE)) set.add(m[1].toLowerCase());
  return Array.from(set);
}

function cleanLine(line: string): string {
  return line
    .replace(HIGHLIGHT_RE, (_m, _t, phrase: string) => phrase)
    .replace(HASHTAG_RE, (_m, pre: string) => pre)
    .replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]\])\s+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function snippetHash(tag: string, text: string): string {
  return djb2(tag + "|" + text);
}

/** Every tagged snippet in a note. A #tag tags its whole line; [[tag: phrase]] tags just the phrase. */
export function extractSnippets(note: Note): Snippet[] {
  const out: Snippet[] = [];
  const seen = new Set<string>();
  const title = note.title.trim() || "Untitled note";
  note.content.split("\n").forEach((line, li) => {
    let order = 0;
    for (const m of line.matchAll(HIGHLIGHT_RE)) {
      const tag = m[1].toLowerCase();
      const text = m[2].trim();
      const hash = snippetHash(tag, text);
      if (text && !seen.has(hash)) {
        seen.add(hash);
        out.push({ noteId: note.id, noteTitle: title, tag, text, hash, order: li * 1000 + order++ });
      }
    }
    const lineTags = Array.from(line.matchAll(HASHTAG_RE)).map((m) => m[2].toLowerCase());
    if (lineTags.length) {
      const text = cleanLine(line);
      if (text) {
        for (const tag of new Set(lineTags)) {
          const hash = snippetHash(tag, text);
          if (seen.has(hash)) continue;
          seen.add(hash);
          out.push({ noteId: note.id, noteTitle: title, tag, text, hash, order: li * 1000 + order++ });
        }
      }
    }
  });
  return out;
}

export type ContentPart =
  | { kind: "text"; text: string }
  | { kind: "tag"; tag: string }
  | { kind: "highlight"; tag: string; text: string };

/** Split one line of note text into plain text, #tags and highlights for preview rendering. */
export function parseLine(line: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const re = /\[\[([A-Za-z][\w-]*):\s*([^\]]+?)\s*\]\]|(^|[\s(])#([A-Za-z][\w-]*)/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    const idx = m.index ?? 0;
    if (m[1]) {
      if (idx > last) parts.push({ kind: "text", text: line.slice(last, idx) });
      parts.push({ kind: "highlight", tag: m[1].toLowerCase(), text: m[2] });
    } else {
      const pre = m[3] ?? "";
      const start = idx + pre.length;
      if (start > last) parts.push({ kind: "text", text: line.slice(last, start) });
      parts.push({ kind: "tag", tag: m[4].toLowerCase() });
    }
    last = idx + m[0].length;
  }
  if (last < line.length) parts.push({ kind: "text", text: line.slice(last) });
  return parts;
}

export function previewText(content: string, max = 160): string {
  const flat = content
    .replace(HIGHLIGHT_RE, (_m, _t, p: string) => p)
    .replace(HASHTAG_RE, (_m, pre: string) => pre)
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? flat.slice(0, max - 1) + "…" : flat;
}

/** Rewrite a tag's name inside note text (both #tag and [[tag: ...]] forms). */
export function renameTagInContent(content: string, from: string, to: string): string {
  const esc = from.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return content
    .replace(new RegExp(`(^|[\\s(])#${esc}(?![\\w-])`, "gi"), (_m, pre: string) => `${pre}#${to}`)
    .replace(new RegExp(`\\[\\[${esc}:`, "gi"), `[[${to}:`);
}

export function nextTagColor(tags: NoteTag[]): string {
  return TAG_PALETTE[tags.length % TAG_PALETTE.length];
}

/** Tag color lookup with a neutral fallback for tags not in the registry. */
export function tagColorMap(tags: NoteTag[]): Map<string, string> {
  return new Map(tags.map((t) => [t.name, t.color]));
}
