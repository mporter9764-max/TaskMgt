"use client";

import { monthDay } from "@/lib/dates";
import { Button } from "./ui";
import { Check, Send } from "./icons";

export function TaggedSnippetRow({
  text,
  subtitle,
  done,
  onToggleDone,
  onSendToTask,
}: {
  text: string;
  subtitle?: string;
  done: boolean;
  onToggleDone: () => void;
  onSendToTask?: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl2 border border-line bg-surface p-3 shadow-card ${
        done ? "opacity-60" : ""
      }`}
    >
      <button
        aria-label={done ? "Mark not done" : "Mark done"}
        onClick={onToggleDone}
        className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border transition-colors ${
          done ? "border-accent bg-accent text-white" : "border-faint text-transparent hover:border-accent"
        }`}
      >
        <Check width={12} height={12} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? "text-faint line-through" : "text-ink"}`}>{text}</p>
        {subtitle && <p className="mt-1 text-xs text-faint">{subtitle}</p>}
      </div>
      {!done && onSendToTask && (
        <Button variant="ghost" size="sm" onClick={onSendToTask} className="flex-none">
          <Send width={13} height={13} />
          Task
        </Button>
      )}
    </div>
  );
}
