"use client";

import type { NoteSnippetCompletion } from "@/lib/types";
import { tint, deepen } from "@/lib/colors";
import { extractInlineHashTags, cleanLineText, hashString } from "@/lib/noteTags";

// Matches EITHER a highlight span [[tag: phrase]] OR a plain #tag token.
const COMBINED = /\[\[(?<hTag>[a-zA-Z][a-zA-Z0-9_-]*):\s*(?<hText>[^\]]+?)\]\]|#(?<tag>[a-zA-Z][a-zA-Z0-9_-]*)/g;
const BOLD = /\*\*(.+?)\*\*/g;
const ITALIC = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;

/** Render one line's inline markup: **bold**, *italic*, #tag chips, and [[tag: phrase]] highlights. */
export function renderInline(
  text: string,
  colorByTag: Map<string, string>,
  keyPrefix: string,
  noteId: string | undefined,
  doneKeys: Set<string>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(COMBINED);
  let idx = 0;

  const renderPlain = (segment: string, keyBase: string): React.ReactNode => {
    const boldSplit = segment.split(BOLD);
    return boldSplit.map((chunk, i) => {
      if (i % 2 === 1) {
        return <strong key={`${keyBase}-b-${i}`}>{chunk}</strong>;
      }
      const italicSplit = chunk.split(ITALIC);
      return (
        <span key={`${keyBase}-p-${i}`}>
          {italicSplit.map((ic, j) =>
            j % 2 === 1 ? <em key={`${keyBase}-i-${i}-${j}`}>{ic}</em> : <span key={`${keyBase}-t-${i}-${j}`}>{ic}</span>
          )}
        </span>
      );
    });
  };

  while ((m = re.exec(text))) {
    if (m.index > lastIndex) {
      parts.push(renderPlain(text.slice(lastIndex, m.index), `${keyPrefix}-${idx++}`));
    }

    if (m.groups?.hTag) {
      const tag = m.groups.hTag.toLowerCase();
      const phrase = m.groups.hText.trim();
      const color = colorByTag.get(tag) ?? "#E7E9EE";
      const done = noteId ? doneKeys.has(`${tag}|${hashString(`${noteId}|${tag}|${phrase}`)}`) : false;
      parts.push(
        <mark
          key={`${keyPrefix}-hl-${idx++}`}
          title={`#${tag}`}
          className={`rounded px-0.5 ${done ? "line-through opacity-60" : ""}`}
          style={{ backgroundColor: tint(color, 0.4), color: "inherit" }}
        >
          {phrase}
        </mark>
      );
    } else if (m.groups?.tag) {
      const tagName = m.groups.tag.toLowerCase();
      const color = colorByTag.get(tagName) ?? "#E7E9EE";
      parts.push(
        <span
          key={`${keyPrefix}-tag-${idx++}`}
          className="mx-0.5 inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium align-middle"
          style={{ backgroundColor: tint(color, 0.3), color: deepen(color, 0.55) }}
        >
          #{m.groups.tag}
        </span>
      );
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(renderPlain(text.slice(lastIndex), `${keyPrefix}-${idx++}`));
  }
  return parts;
}

export type LineKind =
  | { type: "blank" }
  | { type: "bullet"; text: string }
  | { type: "numbered"; text: string }
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "text"; text: string };

/** Classify a single raw line for rendering — bullet/numbered/header/plain text. */
export function classifyLine(raw: string): LineKind {
  const trimmed = raw.trim();
  if (trimmed === "") return { type: "blank" };

  const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);
  if (bulletMatch) return { type: "bullet", text: bulletMatch[1] };

  const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)/);
  if (numberedMatch) return { type: "numbered", text: numberedMatch[1] };

  // A bare '#tag' at line-start would match h1's pattern too; header patterns require a
  // space right after the hashes, and a typed tag like '#followup' never has that space —
  // so this disambiguation is safe.
  const h3 = trimmed.match(/^###\s+(.*)/);
  if (h3) return { type: "h3", text: h3[1] };
  const h2 = trimmed.match(/^##\s+(.*)/);
  if (h2) return { type: "h2", text: h2[1] };
  const h1 = trimmed.match(/^#\s+(.*)/);
  if (h1) return { type: "h1", text: h1[1] };

  return { type: "text", text: raw };
}

/** True if this raw line carries a literal #tag whose whole-line hash is marked done. */
export function isLineDone(line: string, noteId: string | undefined, doneKeys: Set<string>): boolean {
  if (!noteId || doneKeys.size === 0) return false;
  const tagsOnLine = extractInlineHashTags(line);
  if (tagsOnLine.length === 0) return false;
  const cleaned = cleanLineText(line);
  return tagsOnLine.some((tag) => doneKeys.has(`${tag}|${hashString(`${noteId}|${tag}|${cleaned}`)}`));
}

/** Render a single line's fully-formatted, read-only content (used for both
 * the whole-note Preview and the "inactive" lines in the live write editor). */
export function FormattedLine({
  line,
  colorByTag,
  noteId,
  doneKeys,
  keyPrefix,
}: {
  line: string;
  colorByTag: Map<string, string>;
  noteId: string | undefined;
  doneKeys: Set<string>;
  keyPrefix: string;
}) {
  const kind = classifyLine(line);
  const done = isLineDone(line, noteId, doneKeys);
  const doneCls = done ? "text-faint line-through" : "text-ink";

  switch (kind.type) {
    case "blank":
      return <div className="h-2" />;
    case "bullet":
      return (
        <div className={`flex gap-2 pl-1 text-sm ${doneCls}`}>
          <span className="text-faint">•</span>
          <span>{renderInline(kind.text, colorByTag, keyPrefix, noteId, doneKeys)}</span>
        </div>
      );
    case "numbered":
      return (
        <div className={`flex gap-2 pl-1 text-sm ${doneCls}`}>
          <span className="text-faint">·</span>
          <span>{renderInline(kind.text, colorByTag, keyPrefix, noteId, doneKeys)}</span>
        </div>
      );
    case "h3":
      return <h3 className={`mt-1 text-sm font-semibold ${doneCls}`}>{renderInline(kind.text, colorByTag, keyPrefix, noteId, doneKeys)}</h3>;
    case "h2":
      return <h2 className={`mt-1 text-base font-semibold ${doneCls}`}>{renderInline(kind.text, colorByTag, keyPrefix, noteId, doneKeys)}</h2>;
    case "h1":
      return <h1 className={`mt-1 text-lg font-bold ${doneCls}`}>{renderInline(kind.text, colorByTag, keyPrefix, noteId, doneKeys)}</h1>;
    default:
      return <p className={`text-sm leading-relaxed ${doneCls}`}>{renderInline(kind.text, colorByTag, keyPrefix, noteId, doneKeys)}</p>;
  }
}
