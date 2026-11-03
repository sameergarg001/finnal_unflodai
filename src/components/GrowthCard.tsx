import Link from "next/link";
import { overallFrom, type SkillCardData } from "@/server/services/progress";
import { SERIES, ScoreRing } from "./ui";

/** Home hero: overall score ring + one bar per skill (pine = UnfoldAI, sun = self-rated). */
export function GrowthCard({ cards }: { cards: SkillCardData[] }) {
  const o = overallFrom(cards);
  const verified = o.evidenceAverage != null;
  const overall = verified ? o.evidenceAverage : o.selfAverage;
  const gain = verified && o.evidenceBaseline != null ? Math.round((o.evidenceAverage! - o.evidenceBaseline) * 10) / 10 : null;
  const shown = cards.slice(0, 8);

  return (
    <Link href="/reports" className="glass block rounded-[32px] p-5 transition active:scale-[0.99]" aria-label="Your growth — open reports">
      <div className="flex items-center gap-5">
        <ScoreRing value={overall} size={112} stroke={11} caption={verified ? "UnfoldAI" : "self-rated"} color={verified ? "var(--accent)" : "var(--series-self)"} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-bold leading-tight">Your growth</h2>
          <div className="mt-3 flex gap-5">
            <Stat value={o.completed} label="tasks done" />
            {gain != null && gain !== 0 ? <Stat value={`${gain > 0 ? "+" : ""}${gain}`} label="since start" tone={gain > 0 ? "text-success" : undefined} /> : <Stat value={cards.length} label="skills" />}
          </div>
        </div>
      </div>

      {shown.length > 1 && (
        <div className="mt-5 flex items-end gap-2" role="img" aria-label={shown.map((c) => `${c.name} ${c.evidenceScore ?? c.selfScore ?? "not rated"}`).join(", ")}>
          {shown.map((c, i) => {
            const raw = c.evidenceScore ?? c.selfScore;
            const v = raw ?? 0;
            return (
              <div key={c.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold tabular-nums text-muted">{raw == null ? "—" : Math.round(v)}</span>
                <div className="flex h-20 w-full max-w-7 items-end overflow-hidden rounded-[10px] bg-card-2/70">
                  {raw != null && <div
                    className="bar-grow w-full rounded-[10px]"
                    style={{ height: `${Math.max(6, v)}%`, background: c.evidenceScore != null ? SERIES.evidence : SERIES.self, animationDelay: `${i * 50}ms` }}
                  />}
                </div>
                <span className="w-full truncate text-center text-[15px]" title={c.name}>
                  {c.teacher.emoji}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}

function Stat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div>
      <p className={`font-display text-xl font-bold tabular-nums leading-none ${tone ?? ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
