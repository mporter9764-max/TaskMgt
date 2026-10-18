"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { onToast } from "@/lib/toast";
import { X, Check } from "./icons";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-3.5 text-sm",
        variant === "primary" && "bg-accent text-white hover:bg-accent-deep",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-sunken",
        variant === "ghost" && "text-muted hover:bg-sunken hover:text-ink",
        variant === "danger" && "text-danger hover:bg-danger-soft",
        className
      )}
      {...rest}
    />
  );
}

export function IconButton({
  label,
  className,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30",
        active ? "bg-accent-soft text-accent-deep" : "text-muted hover:bg-sunken hover:text-ink",
        className
      )}
      {...rest}
    />
  );
}

/** Labeled form row. A div (not <label>) so rows holding several buttons don't forward taps to the first one. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...rest}
    />
  );
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] leading-relaxed text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-[15px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cx("inline-flex rounded-lg bg-sunken p-0.5", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
            size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[13px]",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  color,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  color?: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
        active ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-ink",
        className
      )}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-[13px] text-muted"
    >
      <span className={cx("relative block h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-line")}>
        <span
          className={cx(
            "absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  color,
  size = 22,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  color?: string;
  size?: number;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 transition-colors"
      style={{
        width: size,
        height: size,
        borderColor: checked ? color ?? "#256abf" : "#c9c7c0",
        background: checked ? color ?? "#256abf" : "transparent",
      }}
    >
      {checked && <Check size={size * 0.62} className="text-white" strokeWidth={3} />}
    </button>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  headerRight,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  headerRight?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "relative flex max-h-[94dvh] w-full flex-col rounded-t-2xl bg-surface shadow-pop sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{title}</div>
          {headerRight}
          <IconButton label="Close" onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="flex items-center gap-2 border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1.5 text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ColorPicker({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={cx(
            "h-7 w-7 rounded-full border transition-transform",
            value.toLowerCase() === c.toLowerCase() ? "scale-110 border-ink ring-2 ring-ink/15" : "border-black/10"
          )}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

export function Toaster() {
  const [msgs, setMsgs] = useState<Array<{ id: number; text: string }>>([]);
  useEffect(
    () =>
      onToast((text) => {
        const id = Date.now() + Math.random();
        setMsgs((m) => [...m, { id, text }]);
        setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 4500);
      }),
    []
  );
  if (!msgs.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {msgs.map((m) => (
        <div key={m.id} className="pointer-events-auto max-w-md rounded-lg bg-ink px-4 py-2.5 text-sm text-white shadow-pop">
          {m.text}
        </div>
      ))}
    </div>
  );
}

/** Up / down / to-top controls for ordered lists. */
export function OrderControls({
  index,
  count,
  onMove,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <IconButton label="Move to top" disabled={index === 0} onClick={() => onMove(0)} className="h-8 w-8">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5h12M12 19V9M7 13l5-5 5 5" /></svg>
      </IconButton>
      <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(index - 1)} className="h-8 w-8">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
      </IconButton>
      <IconButton label="Move down" disabled={index === count - 1} onClick={() => onMove(index + 1)} className="h-8 w-8">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </IconButton>
    </div>
  );
}

/** Visual-only check circle, for use inside a larger tappable row. */
export function CheckDot({ checked, color, size = 22 }: { checked: boolean; color?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 transition-colors"
      style={{
        width: size,
        height: size,
        borderColor: checked ? color ?? "#256abf" : "#c9c7c0",
        background: checked ? color ?? "#256abf" : "transparent",
      }}
    >
      {checked && <Check size={size * 0.62} className="text-white" strokeWidth={3} />}
    </span>
  );
}
