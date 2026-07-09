"use client";

import type { NoteTag, NoteSnippetCompletion } from "@/lib/types";
import { classifyLine, isLineDone, renderInline } from "./inlineMarkup";

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

  const blocks: React.ReactNode[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!listBuffer) return;
    const Tag = listBuffer.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`list-${key++}`} className={listBuffer.ordered ? "list-decimal pl-5 space-y-0.5" : "list-disc pl-5 space-y-0.5"}>
        {listBuffer.items.map((item, i) => {
          const done = isLineDone(item, noteId, doneKeys);
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
    const kind = classifyLine(raw);

    if (kind.type === "blank") {
      flushList();
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
      return;
    }
    if (kind.type === "bullet") {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(kind.text);
      return;
    }
    if (kind.type === "numbered") {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(kind.text);
      return;
    }
    flushList();

    const done = isLineDone(raw, noteId, doneKeys);
    const doneCls = done ? "text-faint line-through" : "text-ink";

    if (kind.type === "h3") {
      blocks.push(
        <h3 key={i} className={`mt-1 text-sm font-semibold ${doneCls}`}>
          {renderInline(kind.text, colorByTag, `h3-${i}`, noteId, doneKeys)}
        </h3>
      );
      return;
    }
    if (kind.type === "h2") {
      blocks.push(
        <h2 key={i} className={`mt-1 text-base font-semibold ${doneCls}`}>
          {renderInline(kind.text, colorByTag, `h2-${i}`, noteId, doneKeys)}
        </h2>
      );
      return;
    }
    if (kind.type === "h1") {
      blocks.push(
        <h1 key={i} className={`mt-1 text-lg font-bold ${doneCls}`}>
          {renderInline(kind.text, colorByTag, `h1-${i}`, noteId, doneKeys)}
        </h1>
      );
      return;
    }

    blocks.push(
      <p key={i} className={`text-sm leading-relaxed ${doneCls}`}>
        {renderInline(kind.text, colorByTag, `p-${i}`, noteId, doneKeys)}
      </p>
    );
  });
  flushList();

  return <div className="space-y-0.5">{blocks}</div>;
}
