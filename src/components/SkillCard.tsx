import Link from "next/link";
import type { SkillCardData } from "@/server/services/progress";
import { ProgressBar, SERIES, Sparkline } from "./ui";

/** Dashboard skill card: score, progress, challenges, trend. Tappable. */
export function SkillCard({ s }: { s: SkillCardData }) {
  const assessed = s.evidenceScore !== null;
  const value = assessed ? s.evidenceScore! : s.selfScore;
  return (
    <Link href={`/skills/${s.id}`} className="block rounded-3xl border border-line bg-card p-4 transition active:scale-[0.98]">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight">{s.name}</p>
        {s.hasActive && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-2" title="Active challenge" />}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">
        {value == null ? "—" : Math.round(value)}
        <span className="text-sm font-medium text-muted">/100</span>
      </p>
      <p className="text-[11px] text-muted">{assessed ? "UnfoldAI assessed" : value == null ? "not rated yet" : "self-rated"}</p>
      <div className="mt-2.5">
        <ProgressBar value={value ?? 0} color={assessed ? SERIES.evidence : SERIES.self} label={`${s.name} score`} />
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className="text-[11px] text-muted">{s.completed} done</span>
        <Sparkline values={s.trend} />
      </div>
    </Link>
  );
}
