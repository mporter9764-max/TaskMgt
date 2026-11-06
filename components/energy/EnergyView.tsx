"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EnergyStore } from "@/lib/useEnergyStore";
import { computeTdee, fmtKcal, kcalPerStep, tefRate, type Breakdown, type EnergySettings } from "@/lib/energy";
import { addDays, diffDays, fmtLong, fmtMonthDay, fmtRelative, fmtShort, todayStr } from "@/lib/dates";
import { Button, Field, IconButton, Sheet, TextInput, cx } from "../ui";
import { Check, ChevronLeft, ChevronRight, Cog, Info } from "../icons";

const BACKFILL_DAYS = 60;

/* Component colors: one validated categorical order, in a fixed sequence. */
const PARTS: Array<{ key: keyof Omit<Breakdown, "tdee">; label: string; color: string }> = [
  { key: "rmr", label: "Resting (RMR)", color: "#2a78d6" },
  { key: "living", label: "Daily living", color: "#1baf7a" },
  { key: "steps", label: "Steps", color: "#eb6834" },
  { key: "lifting", label: "Lifting", color: "#6250d6" },
  { key: "tef", label: "Digesting food", color: "#eda100" },
];

export function EnergyView({ store }: { store: EnergyStore }) {
  const today = useToday();
  const [date, setDate] = useState(today);
  const [stepsText, setStepsText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const s = store.settings;

  useEffect(() => setDate(today), [today]);

  const log = store.logs.get(date);
  useEffect(() => {
    setStepsText(log ? String(log.steps) : "");
    // only when switching days or when the stored value arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, log?.steps]);

  const typedSteps = parseSteps(stepsText);
  const lifted = log?.lifted ?? false;
  const hasData = Boolean(log) || stepsText.trim() !== "";
  const breakdown = computeTdee(typedSteps ?? 0, lifted, s);

  function commitSteps(text: string) {
    const v = parseSteps(text);
    if (v === null) return;
    if (log && log.steps === v) return;
    store.saveLog(date, { steps: v });
  }

  function onStepsChange(text: string) {
    setStepsText(text);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commitSteps(text), 700);
  }

  function toggleLifted() {
    if (timer.current) window.clearTimeout(timer.current);
    store.saveLog(date, { lifted: !lifted, steps: typedSteps ?? log?.steps ?? 0 });
  }

  const earliest = addDays(today, -BACKFILL_DAYS);

  /* averages over logged days */
  const stats = useMemo(() => {
    const window = (days: number) => {
      const from = addDays(today, -(days - 1));
      const rows = Array.from(store.logs.values()).filter((l) => l.log_date >= from && l.log_date <= today);
      if (!rows.length) return null;
      const tdees = rows.map((r) => computeTdee(r.steps, r.lifted, s).tdee);
      return {
        n: rows.length,
        tdee: tdees.reduce((a, b) => a + b, 0) / rows.length,
        steps: rows.reduce((a, r) => a + r.steps, 0) / rows.length,
        lifts: rows.filter((r) => r.lifted).length,
      };
    };
    return { w7: window(7), w30: window(30) };
  }, [store.logs, s, today]);

  const series = useMemo(() => {
    const out: Array<{ date: string; tdee: number | null; steps: number; lifted: boolean }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      const l = store.logs.get(d);
      out.push({ date: d, tdee: l ? computeTdee(l.steps, l.lifted, s).tdee : null, steps: l?.steps ?? 0, lifted: l?.lifted ?? false });
    }
    return out;
  }, [store.logs, s, today]);

  return (
    <div className="pb-28">
      <div className="mb-3 flex items-center gap-2">
        <IconButton label="Previous day" disabled={date <= earliest} onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft />
        </IconButton>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[17px] font-semibold text-ink">{fmtRelative(date, today)}</div>
          <div className="text-[12px] text-faint">{fmtLong(date)}</div>
        </div>
        <IconButton label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight />
        </IconButton>
        <IconButton label="TDEE settings" onClick={() => setSettingsOpen(true)}>
          <Cog />
        </IconButton>
      </div>
      {date !== today && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent-deep">
          Editing {diffDays(date, today)} {diffDays(date, today) === 1 ? "day" : "days"} ago
          <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setDate(today)}>
            Back to today
          </button>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* inputs + result */}
        <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Steps">
              <TextInput
                inputMode="numeric"
                placeholder="0"
                value={stepsText}
                onChange={(e) => onStepsChange(e.target.value)}
                onBlur={(e) => commitSteps(e.target.value)}
                className="h-12 text-[20px] font-semibold tabular-nums"
              />
            </Field>
            <Field label="Weightlifting">
              <button
                type="button"
                aria-pressed={lifted}
                onClick={toggleLifted}
                className={cx(
                  "flex h-12 w-full items-center justify-center gap-2 rounded-lg border text-[15px] font-medium transition-colors",
                  lifted ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted hover:text-ink"
                )}
              >
                {lifted && <Check size={18} strokeWidth={2.6} />}
                {lifted ? "Lifted" : "No session"}
              </button>
            </Field>
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className={cx("text-[34px] font-semibold leading-none tabular-nums", hasData ? "text-ink" : "text-faint")}>
              {fmtKcal(breakdown.tdee)}
            </span>
            <span className="text-[14px] text-muted">calories {hasData ? "burned" : "(enter steps)"}</span>
          </div>
          <p className="mt-1 text-[12px] text-faint">
            {(breakdown.tdee / s.rmr).toFixed(2)} × RMR · estimate, typically within 10 to 15%
          </p>

          <StackedBar b={breakdown} />

          <ul className="mt-3 space-y-1.5">
            {PARTS.map((p) => (
              <li key={p.key} className="flex items-center gap-2.5 text-[14px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
                <span className="flex-1 text-ink">{p.label}</span>
                <span className="tabular-nums text-ink">{fmtKcal(breakdown[p.key])}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
            <button type="button" onClick={() => setHowOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
              <Info size={15} /> How this is calculated
            </button>
            {log && (
              <button
                type="button"
                className="ml-auto text-[13px] text-faint hover:text-danger"
                onClick={() => {
                  if (timer.current) window.clearTimeout(timer.current);
                  store.clearLog(date);
                  setStepsText("");
                }}
              >
                Clear day
              </button>
            )}
          </div>
        </section>

        {/* averages + history */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Tile label="Avg burn, last 7 days" value={stats.w7 ? fmtKcal(stats.w7.tdee) : "–"} sub={stats.w7 ? `${stats.w7.n} logged ${stats.w7.n === 1 ? "day" : "days"}` : "No days logged"} />
            <Tile label="Avg burn, last 30 days" value={stats.w30 ? fmtKcal(stats.w30.tdee) : "–"} sub={stats.w30 ? `${stats.w30.n} logged days` : "No days logged"} />
            <Tile label="Avg steps, last 7 days" value={stats.w7 ? fmtKcal(stats.w7.steps) : "–"} />
            <Tile label="Lifting, last 7 days" value={stats.w7 ? String(stats.w7.lifts) : "–"} sub={stats.w7 ? (stats.w7.lifts === 1 ? "session" : "sessions") : undefined} />
          </div>
          <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <h3 className="mb-2 text-[14px] font-semibold text-ink">Last 30 days</h3>
            <HistoryChart series={series} selected={date} onPick={(d) => d >= earliest && setDate(d)} />
          </section>
        </div>
      </div>

      <SettingsSheet open={settingsOpen} settings={s} onClose={() => setSettingsOpen(false)} onSave={store.saveSettings} />
      <HowSheet open={howOpen} settings={s} onClose={() => setHowOpen(false)} />
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function parseSteps(text: string): number | null {
  const t = text.replace(/[,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 200000) : null;
}

function useToday(): string {
  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const tick = () => setToday((prev) => (todayStr() !== prev ? todayStr() : prev));
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return today;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-semibold leading-none tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-faint">{sub}</div>}
    </div>
  );
}

function StackedBar({ b }: { b: Breakdown }) {
  return (
    <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
      {PARTS.map((p) =>
        b[p.key] > 0 ? <div key={p.key} style={{ width: `${(b[p.key] / b.tdee) * 100}%`, background: p.color }} /> : null
      )}
    </div>
  );
}

function HistoryChart({
  series,
  selected,
  onPick,
}: {
  series: Array<{ date: string; tdee: number | null; steps: number; lifted: boolean }>;
  selected: string;
  onPick: (d: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vals = series.map((p) => p.tdee).filter((v): v is number => v !== null);
  if (!vals.length) {
    return (
      <div ref={box}>
        <p className="py-8 text-center text-sm text-faint">Log a few days and your history appears here.</p>
      </div>
    );
  }
  const H = 160;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const lo = Math.floor((Math.min(...vals) - 100) / 100) * 100;
  const hi = Math.ceil((Math.max(...vals) + 100) / 100) * 100;
  const n = series.length;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  let path = "";
  let pen = false;
  series.forEach((p, i) => {
    if (p.tdee === null) {
      pen = false;
      return;
    }
    path += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.tdee).toFixed(1)}`;
    pen = true;
  });

  const selIdx = series.findIndex((p) => p.date === selected);
  const shownIdx = hover ?? (selIdx >= 0 ? selIdx : n - 1);
  const shown = series[shownIdx];
  const ticks = [lo, Math.round((lo + hi) / 2 / 100) * 100, hi];
  const colW = (W - padL - padR) / (n - 1);

  return (
    <div ref={box}>
      <div className="mb-1 min-h-[18px] text-[12px] text-muted">
        <span className="font-medium text-ink">{fmtShort(shown.date)}</span>
        {": "}
        {shown.tdee === null ? "not logged" : `${fmtKcal(shown.tdee)} calories · ${fmtKcal(shown.steps)} steps${shown.lifted ? " · lifted" : ""}`}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#ecebe6" />
            <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="#97958e">
              {fmtKcal(t)}
            </text>
          </g>
        ))}
        {[0, Math.floor(n / 2), n - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={10} fill="#97958e">
            {fmtMonthDay(series[i].date)}
          </text>
        ))}
        {shownIdx >= 0 && <line x1={x(shownIdx)} x2={x(shownIdx)} y1={padT} y2={H - padB} stroke="#d9d7d0" strokeDasharray="3 3" />}
        <path d={path} fill="none" stroke="#2a78d6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {series.map((p, i) =>
          p.tdee === null ? null : (
            <circle
              key={p.date}
              cx={x(i)}
              cy={y(p.tdee)}
              r={i === shownIdx ? 5 : p.lifted ? 4 : 3}
              fill={p.lifted ? "#6250d6" : "#2a78d6"}
              stroke="#fff"
              strokeWidth={2}
            />
          )
        )}
        {series.map((p, i) => (
          <rect
            key={`hit-${p.date}`}
            x={x(i) - colW / 2}
            y={padT}
            width={colW}
            height={H - padT - padB}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHover(i)}
            onClick={() => onPick(p.date)}
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2a78d6" }} /> Day
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#6250d6" }} /> Lifting day
        </span>
        <span className="text-faint">Tap a day to edit it</span>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <TextInput
          inputMode="decimal"
          value={Number.isFinite(value) ? String(value) : ""}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d.]/g, "")))}
          className={suffix ? "pr-12" : ""}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">{suffix}</span>}
      </div>
    </Field>
  );
}

function SettingsSheet({
  open,
  settings,
  onClose,
  onSave,
}: {
  open: boolean;
  settings: EnergySettings;
  onClose: () => void;
  onSave: (s: EnergySettings) => Promise<void>;
}) {
  const [d, setD] = useState(settings);
  useEffect(() => {
    if (open) setD(settings);
  }, [open, settings]);
  const set = (k: keyof EnergySettings) => (v: number) => setD((p) => ({ ...p, [k]: v }));
  const macroSum = d.proteinPct + d.carbPct + d.fatPct;
  const ft = Math.floor(d.heightIn / 12);
  const inch = Math.round(d.heightIn - ft * 12);
  const valid = macroSum === 100 && d.weightLb > 0 && d.heightIn > 0 && d.rmr > 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="TDEE settings"
      footer={
        <>
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={async () => {
              await onSave(d);
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumField label="RMR" value={d.rmr} onChange={set("rmr")} suffix="cal" />
          <NumField label="Weight" value={d.weightLb} onChange={set("weightLb")} suffix="lb" />
        </div>
        <Field label="Height" hint="Used to estimate step length for step calories.">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <TextInput inputMode="numeric" value={String(ft)} onChange={(e) => setD((p) => ({ ...p, heightIn: Number(e.target.value || 0) * 12 + inch }))} className="pr-10" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">ft</span>
            </div>
            <div className="relative">
              <TextInput inputMode="numeric" value={String(inch)} onChange={(e) => setD((p) => ({ ...p, heightIn: ft * 12 + Number(e.target.value || 0) }))} className="pr-10" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">in</span>
            </div>
          </div>
        </Field>
        <NumField label="Lifting session" value={d.liftKcal} onChange={set("liftKcal")} suffix="cal" hint="Net calories added on days you lift." />
        <Field label="Macro mix" hint={macroSum === 100 ? "Sets the thermic effect of food." : `Must add up to 100% (now ${macroSum}%).`}>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["proteinPct", "Protein"],
                ["carbPct", "Carbs"],
                ["fatPct", "Fat"],
              ] as const
            ).map(([k, l]) => (
              <div key={k}>
                <span className="mb-1 block text-[12px] text-faint">{l}</span>
                <div className="relative">
                  <TextInput inputMode="numeric" value={String(d[k])} onChange={(e) => set(k)(Number(e.target.value.replace(/\D/g, "")))} className="pr-7" />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-faint">%</span>
                </div>
              </div>
            ))}
          </div>
        </Field>
        <NumField
          label="Daily living (non-step activity)"
          value={d.livingPct}
          onChange={set("livingPct")}
          suffix="% RMR"
          hint="Standing, fidgeting and moving around that steps don't capture. 5% is the recommended starting point."
        />
      </div>
    </Sheet>
  );
}

function HowSheet({ open, settings: s, onClose }: { open: boolean; settings: EnergySettings; onClose: () => void }) {
  const per10k = kcalPerStep(s) * 10000;
  const tef = tefRate(s) * 100;
  return (
    <Sheet open={open} onClose={onClose} title="How TDEE is calculated">
      <div className="space-y-3 text-[14px] leading-relaxed text-ink">
        <p>
          <b>TDEE</b> = resting + daily living + steps + lifting + digesting food.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-muted">
          <li>
            <span className="text-ink">Resting:</span> your measured RMR, {fmtKcal(s.rmr)} calories.
          </li>
          <li>
            <span className="text-ink">Daily living:</span> {s.livingPct}% of RMR ({fmtKcal((s.rmr * s.livingPct) / 100)} calories) for standing and
            moving around that steps miss. Set so a low-step day lands near the standard sedentary level of about 1.2 × RMR.
          </li>
          <li>
            <span className="text-ink">Steps:</span> calories above resting, about 0.5 calories per kg of body weight per km walked, with step
            length estimated from height. At {s.weightLb} lb that is about {fmtKcal(per10k)} calories per 10,000 steps.
          </li>
          <li>
            <span className="text-ink">Lifting:</span> a flat {fmtKcal(s.liftKcal)} calories on days you lift.
          </li>
          <li>
            <span className="text-ink">Digesting food:</span> protein costs about 25% of its calories to digest, carbs 7.5%, fat 2%. Your{" "}
            {s.proteinPct}/{s.carbPct}/{s.fatPct} mix works out to {tef.toFixed(1)}% of what you eat, assuming you eat near maintenance.
          </li>
        </ul>
        <p className="rounded-lg bg-sunken px-3 py-2 text-[13px] text-muted">
          Any formula like this is an estimate, typically within 10 to 15% of your true burn. Steps are the noisiest part, since step counters
          and walking pace vary.
        </p>
      </div>
    </Sheet>
  );
}
