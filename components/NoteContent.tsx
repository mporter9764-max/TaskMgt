"use client";

import type { NoteTag } from "@/lib/types";
import { tint, deepen } from "@/lib/colors";

const TAG_TOKEN = /#([a-zA-Z][a-zA-Z0-9_-]*)/g;
const BOLD = /\*\*(.+?)\*\*/g;
const ITALIC = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;

/** Render one line's inline markup: **bold**, *italic*, and #tag chips. */
function renderInline(text: string, colorByTag: Map<string, string>, keyPrefix: string): React.ReactNode[] {
  // Tokenize by splitting on tags first (so bold/italic never crosses a tag boundary awkwardly).
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TAG_TOKEN);
  let idx = 0;

  const renderPlain = (segment: string, keyBase: string): React.ReactNode => {
    // Bold, then italic, applied as simple nested replacement via split.
    const boldSplit = segment.split(BOLD);
    // boldSplit alternates: [plain, bold, plain, bold, ...]
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
    const tagName = m[1].toLowerCase();
    const color = colorByTag.get(tagName) ?? "#E7E9EE";
    parts.push(
      <span
        key={`${keyPrefix}-tag-${idx++}`}
        className="mx-0.5 inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium align-middle"
        style={{ backgroundColor: tint(color, 0.3), color: deepen(color, 0.55) }}
      >
        #{m[1]}
      </span>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(renderPlain(text.slice(lastIndex), `${keyPrefix}-${idx++}`));
  }
  return parts;
}

export function NoteContent({ content, tags }: { content: string; tags: NoteTag[] }) {
  const colorByTag = new Map(tags.map((t) => [t.name, t.color]));
  const lines = content.split("\n");

  const blocks: React.ReactNode[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`list-${key++}`} className={listBuffer.ordered ? "list-decimal pl-5 space-y-0.5" : "list-disc pl-5 space-y-0.5"}>
        {listBuffer.items.map((item, i) => (
          <li key={i} className="text-sm text-ink">
            {renderInline(item, colorByTag, `li-${key}-${i}`)}
          </li>
        ))}
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

    if (h3) {
      blocks.push(
        <h3 key={i} className="mt-1 text-sm font-semibold text-ink">
          {renderInline(h3[1], colorByTag, `h3-${i}`)}
        </h3>
      );
      return;
    }
    if (h2) {
      blocks.push(
        <h2 key={i} className="mt-1 text-base font-semibold text-ink">
          {renderInline(h2[1], colorByTag, `h2-${i}`)}
        </h2>
      );
      return;
    }
    if (h1) {
      blocks.push(
        <h1 key={i} className="mt-1 text-lg font-bold text-ink">
          {renderInline(h1[1], colorByTag, `h1-${i}`)}
        </h1>
      );
      return;
    }

    blocks.push(
      <p key={i} className="text-sm leading-relaxed text-ink">
        {renderInline(line, colorByTag, `p-${i}`)}
      </p>
    );
  });
  flushList();

  return <div className="space-y-0.5">{blocks}</div>;
}
