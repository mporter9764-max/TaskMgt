"use client";

import { Fragment } from "react";
import { parseLine } from "@/lib/noteTags";
import { alpha, deepen } from "@/lib/colors";

const FALLBACK = "#97958e";

export function TagPill({ tag, color, small }: { tag: string; color?: string; small?: boolean }) {
  const c = color ?? FALLBACK;
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${small ? "px-1.5 text-[11px] leading-[18px]" : "px-2 text-[12px] leading-5"}`}
      style={{ background: alpha(c, 0.13), color: deepen(c, 0.3) }}
    >
      #{tag}
    </span>
  );
}

/** Read-only rendering of a note: #tags become pills, [[tag: phrase]] becomes a highlighted phrase. */
export function NoteContent({ content, colors }: { content: string; colors: Map<string, string> }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1 text-[15px] leading-relaxed text-ink">
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <div key={i} className="h-3" />
        ) : (
          <p key={i} className="whitespace-pre-wrap break-words">
            {parseLine(line).map((part, j) => {
              if (part.kind === "text") return <Fragment key={j}>{part.text}</Fragment>;
              if (part.kind === "tag") return <TagPill key={j} tag={part.tag} color={colors.get(part.tag)} />;
              const c = colors.get(part.tag) ?? FALLBACK;
              return (
                <mark
                  key={j}
                  className="rounded px-0.5 text-ink"
                  style={{ background: alpha(c, 0.18), boxShadow: `inset 0 -2px 0 ${alpha(c, 0.55)}` }}
                  title={`#${part.tag}`}
                >
                  {part.text}
                </mark>
              );
            })}
          </p>
        )
      )}
    </div>
  );
}
