"use client";

import type { NoteTag, NoteSnippetCompletion } from "@/lib/types";
import { tint, deepen } from "@/lib/colors";
import { extractInlineHashTags, cleanLineText, hashString } from "@/lib/noteTags";

// Matches EITHER a highlight span [[tag: phrase]] OR a plain #tag token.
const COMBINED = /\[\[(?<hTag>[a-zA-Z][a-zA-Z0-9_-]*):\s*(?<hText>[^\]]+?)\]\]|#(?<tag>[a-zA-Z][a-zA-Z0-9_-]*)/g;
const BOLD = /\*\*(.+?)\*\*/g;
const ITALIC = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;

/** Render one line's inline markup: **bold**, *italic*, #tag chips, and [[tag: phrase]] highlights. */
function renderInline(
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
      // Highlighted, precisely-tagged phrase.
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
      // Whole-line style tag chip.
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

export function NoteContent({
  content,
  tags,
  noteId,
  completions,
}: {
  content: string;
  tags: NoteTag[];
  noteId?: string;
  completions?: NoteSnippetCompletion[];
}) {
  const colorByTag = new Map(tags.map((t) => [t.name, t.color]));
  const lines = content.split("\n");

  const doneKeys = new Set(
    (noteId ? completions?.filter((c) => c.note_id === noteId) : [])?.map((c) => `${c.tag}|${c.snippet_hash}`) ?? []
  );

  /** True if this raw line carries a literal #tag whose whole-line hash is marked done.
   * (Highlight-span done-state is handled per-span inside renderInline instead.) */
  function isLineDone(line: string): boolean {
    if (!noteId || doneKeys.size === 0) return false;
    const tagsOnLine = extractInlineHashTags(line);
    if (tagsOnLine.length === 0) return false;
    const cleaned = cleanLineText(line);
    return tagsOnLine.some((tag) => doneKeys.has(`${tag}|${hashString(`${noteId}|${tag}|${cleaned}`)}`));
  }

  const blocks: React.ReactNode[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`list-${key++}`} className={listBuffer.ordered ? "list-decimal pl-5 space-y-0.5" : "list-disc pl-5 space-y-0.5"}>
        {listBuffer.items.map((item, i) => {
          const done = isLineDone(item);
          return (
            <li key={i} className={`text-sm ${done ? "text-faint line-through" : "text-ink"}`}>
              {renderInline(item, colorByTag, `li-${key}-${i}`, noteId, doneKeys)}
            </li>
          );
        })}
      </Tag>
    );
    listBuffer = null;
  };

  lines.forEach((raw, i) => {
    const line = raw;
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList();
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)/);

    if (bulletMatch) {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(bulletMatch[1]);
      return;
    }
    if (numberedMatch) {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(numberedMatch[1]);
      return;
    }
    flushList();

    const h3 = trimmed.match(/^###\s+(.*)/);
    const h2 = trimmed.match(/^##\s+(.*)/);
    const h1 = trimmed.match(/^#\s+(.*)/);
    // A bare '#tag' at line-start would match h1's pattern too; require a space after
    // the hashes AND that what follows isn't immediately another tag-like token glued on—
    // simplest disambiguation: headers need a space right after the #'s, tags don't have one
    // before the word. Since both patterns already require '\s+' after the hashes, a typed
    // tag like '#followup' (no space) never matches these header patterns. Safe.

    const done = isLineDone(line);
    const doneCls = done ? "text-faint line-through" : "";

    if (h3) {
      blocks.push(
        <h3 key={i} className={`mt-1 text-sm font-semibold ${done ? doneCls : "text-ink"}`}>
          {renderInline(h3[1], colorByTag, `h3-${i}`, noteId, doneKeys)}
        </h3>
      );
      return;
    }
    if (h2) {
      blocks.push(
        <h2 key={i} className={`mt-1 text-base font-semibold ${done ? doneCls : "text-ink"}`}>
          {renderInline(h2[1], colorByTag, `h2-${i}`, noteId, doneKeys)}
        </h2>
      );
      return;
    }
    if (h1) {
      blocks.push(
        <h1 key={i} className={`mt-1 text-lg font-bold ${done ? doneCls : "text-ink"}`}>
          {renderInline(h1[1], colorByTag, `h1-${i}`, noteId, doneKeys)}
        </h1>
      );
      return;
    }

    blocks.push(
      <p key={i} className={`text-sm leading-relaxed ${done ? doneCls : "text-ink"}`}>
        {renderInline(line, colorByTag, `p-${i}`, noteId, doneKeys)}
      </p>
    );
  });
  flushList();

  return <div className="space-y-0.5">{blocks}</div>;
}
