"use client";

import { useState } from "react";
import { MUSCLE_GROUPS, bandStatus, fmtNum, type BandStatus } from "@/lib/workouts";
import { Segmented, cx } from "../ui";

/* Sequential blue ramp (validated reference palette), light to dark. */
const SEQ = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab"];

function cellColor(v: number): { bg: string; fg: string } | null {
  if (v <= 0) return null;
  if (v <= 1) return { bg: SEQ[0], fg: "#1d1d1b" };
  if (v <= 3) return { bg: SEQ[1], fg: "#1d1d1b" };
  if (v <= 5) return { bg: SEQ[2], fg: "#ffffff" };
  return { bg: SEQ[3], fg: "#ffffff" };
}

const STATUS: Record<BandStatus, { bg: string; fg: string; mark: string; label: string }> = {
  in: { bg: "#e3f4ea", fg: "#0f7a52", mark: "✓", label: "in range" },
  below: { bg: "#fdf1dc", fg: "#9a5b00", mark: "▼", label: "below range" },
  above: { bg: "#fdeee6", fg: "#b4461b", mark: "▲", label: "above range" },
  none: { bg: "transparent", fg: "#97958e", mark: "", label: "none planned" },
};

export interface HeatColumn {
  key: string;
  label: string;
  title?: string;
}

/**
 * Muscle x column grid. Cells are shaded by planned sets. With `band`, a Week column sums each row
 * and flags it against the target range. Tapping a cell calls onPick(muscleIds, columnIndex).
 */
export function MuscleHeatmap({
  columns,
  values,
  band,
  selected,
  onPick,
}: {
  columns: HeatColumn[];
  values: Map<string, number[]>;
  band: { low: number; high: number } | null;
  selected?: { key: string; col: number } | null;
  onPick?: (rowKey: string, muscles: string[], col: number) => void;
}) {
  const [view, setView] = useState<"muscles" | "groups">("muscles");
  const zero = columns.map(() => 0);

  const sections =
    view === "muscles"
      ? MUSCLE_GROUPS.map((g) => ({
          title: g.label,
          rows: g.muscles.map((m) => ({ key: m.id, label: m.label, muscles: [m.id], vals: values.get(m.id) ?? zero })),
        }))
      : [
          {
            title: "",
            rows: MUSCLE_GROUPS.map((g) => ({
              key: g.id,
              label: g.label,
              muscles: g.muscles.map((m) => m.id),
              vals: columns.map((_, i) => g.muscles.reduce((s, m) => s + (values.get(m.id)?.[i] ?? 0), 0)),
            })),
          },
        ];

  const showWeek = Boolean(band);
  const template = `minmax(84px, 132px) repeat(${columns.length}, minmax(26px, 1fr))${showWeek ? " minmax(46px, 60px)" : ""}`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-end">
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "muscles", label: "Muscles" },
            { value: "groups", label: "Groups" },
          ]}
        />
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: template }} role="table">
        <div />
        {columns.map((c) => (
          <div key={c.key} className="pb-1 text-center text-[11px] font-medium text-faint" title={c.title}>
            {c.label}
          </div>
        ))}
        {showWeek && <div className="pb-1 text-center text-[11px] font-semibold text-muted">Week</div>}

        {sections.map((sec) => (
          <Section key={sec.title || "all"} title={sec.title} span={columns.length + (showWeek ? 2 : 1)}>
            {sec.rows.map((r) => {
              const total = r.vals.reduce((a, b) => a + b, 0);
              const st = band && view === "muscles" ? STATUS[bandStatus(total, band.low, band.high)] : null;
              const empty = total === 0;
              return (
                <Row key={r.key}>
                  <div className={cx("flex items-center truncate pr-1 text-[12.5px]", empty ? "text-faint" : "text-ink")}>{r.label}</div>
                  {r.vals.map((v, i) => {
                    const c = cellColor(v);
                    const isSel = selected?.key === r.key && selected.col === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!onPick || v <= 0}
                        onClick={() => onPick?.(r.key, r.muscles, i)}
                        title={`${r.label}, ${columns[i].title ?? columns[i].label}: ${fmtNum(v)} sets`}
                        className={cx(
                          "flex h-7 items-center justify-center rounded-[4px] text-[11.5px] font-semibold tabular-nums",
                          isSel && "ring-2 ring-ink/70 ring-offset-1"
                        )}
                        style={c ? { background: c.bg, color: c.fg } : { background: "#f3f2ee" }}
                      >
                        {v > 0 ? fmtNum(v) : ""}
                      </button>
                    );
                  })}
                  {showWeek && (
                    <div
                      className="flex h-7 items-center justify-center gap-0.5 rounded-[4px] text-[12px] font-semibold tabular-nums"
                      style={st ? { background: st.bg, color: st.fg } : { background: "#f3f2ee", color: empty ? "#97958e" : "#1d1d1b" }}
                      title={st ? `${r.label}: ${fmtNum(total)} sets a week, ${st.label}` : undefined}
                    >
                      {fmtNum(total)}
                      {st?.mark && <span className="text-[9px]">{st.mark}</span>}
                    </div>
                  )}
                </Row>
              );
            })}
          </Section>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          Fewer
          {SEQ.map((c) => (
            <span key={c} className="h-2.5 w-3 rounded-[2px]" style={{ background: c }} />
          ))}
          More sets
        </span>
        {band && view === "muscles" && (
          <>
            <span style={{ color: STATUS.in.fg }}>✓ {band.low}–{band.high} a week</span>
            <span style={{ color: STATUS.below.fg }}>▼ below</span>
            <span style={{ color: STATUS.above.fg }}>▲ above</span>
          </>
        )}
        <span className="text-faint">Secondary muscles count as half a set.</span>
      </div>
    </div>
  );
}

function Section({ title, span, children }: { title: string; span: number; children: React.ReactNode }) {
  return (
    <>
      {title && (
        <div className="pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-faint" style={{ gridColumn: `1 / span ${span}` }}>
          {title}
        </div>
      )}
      {children}
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
