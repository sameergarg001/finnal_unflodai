import { SERIES } from "./ui";

// Small dependency-free SVG charts. Thin marks, recessive grid, hover titles,
// and a text alternative on every chart.

/** Overall development over time (one series → no legend; the title names it). */
export function TrendChart({ points }: { points: { date: string; value: number }[] }) {
  const W = 320, H = 140, P = { l: 28, r: 10, t: 12, b: 22 };
  const vals = points.map((p) => p.value);
  const min = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10);
  const max = Math.min(100, Math.ceil((Math.max(...vals) + 5) / 10) * 10);
  const x = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i / (points.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - (v - min) / (max - min || 1)) * (H - P.t - P.b);
  const ticks = [min, Math.round((min + max) / 2), max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Overall score over time, from ${vals[0]} to ${vals[vals.length - 1]}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
          <text x={P.l - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="var(--muted)">{t}</text>
        </g>
      ))}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} fill="none" stroke={SERIES.evidence} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={4} fill={SERIES.evidence} stroke="var(--card)" strokeWidth={2} />
          <circle cx={x(i)} cy={y(p.value)} r={12} fill="transparent"><title>{`${p.date}: ${p.value}`}</title></circle>
        </g>
      ))}
      <text x={P.l} y={H - 6} fontSize={9} fill="var(--muted)">{points[0].date}</text>
      <text x={W - P.r} y={H - 6} fontSize={9} fill="var(--muted)" textAnchor="end">{points[points.length - 1].date}</text>
    </svg>
  );
}

/** Challenges reported per week (last 8 weeks). */
export function WeeklyBars({ weeks }: { weeks: { week: string; count: number }[] }) {
  const W = 320, H = 110, P = { l: 6, r: 6, t: 14, b: 20 };
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const slot = (W - P.l - P.r) / weeks.length;
  const bw = slot - 2 - 10;
  const base = H - P.b;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Challenges per week: ${weeks.map((w) => w.count).join(", ")}`}>
      <line x1={P.l} x2={W - P.r} y1={base} y2={base} stroke="var(--line)" />
      {weeks.map((w, i) => {
        const h = (w.count / max) * (base - P.t);
        const x = P.l + i * slot + 6;
        return (
          <g key={w.week}>
            {w.count > 0 && <path d={roundedTop(x, base - h, bw, h, 4)} fill={SERIES.evidence}><title>{`Week of ${w.week}: ${w.count}`}</title></path>}
            {w.count > 0 && <text x={x + bw / 2} y={base - h - 4} fontSize={9} textAnchor="middle" fill="var(--muted)">{w.count}</text>}
            <text x={x + bw / 2} y={H - 6} fontSize={8} textAnchor="middle" fill="var(--muted)">{w.week.slice(5)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/** Self-assessment vs UnfoldAI assessment per skill. Two series → legend + direct values. */
export function SelfVsEvidence({ rows }: { rows: { name: string; self: number | null; evidence: number | null }[] }) {
  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES.self }} />Self-assessment</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES.evidence }} />UnfoldAI assessment</span>
      </div>
      <ul className="space-y-3.5">
        {rows.map((r) => (
          <li key={r.name}>
            <p className="mb-1 text-sm font-medium">{r.name}</p>
            <Bar value={r.self} color={SERIES.self} label="Self-assessment" />
            <div className="h-0.5" />
            <Bar value={r.evidence} color={SERIES.evidence} label="UnfoldAI assessment" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bar({ value, color, label }: { value: number | null; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2" title={`${label}: ${value ?? "not yet"}`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-card-2">
        {value != null && <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />}
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-muted">{value == null ? "—" : Math.round(value)}</span>
    </div>
  );
}
