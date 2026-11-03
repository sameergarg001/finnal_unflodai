import Link from "next/link";
import type { SkillCardData } from "@/server/services/progress";
import { ProgressBar, SERIES, TeacherAvatar } from "./ui";

/** Home skill card: teacher, name, score. Tap for everything else. */
export function SkillCard({ s }: { s: SkillCardData }) {
  const assessed = s.evidenceScore !== null;
  const value = assessed ? s.evidenceScore! : s.selfScore;
  return (
    <Link
      href={`/skills/${s.id}`}
      className="relative flex min-h-36 flex-col rounded-3xl border border-line bg-card p-4 transition hover:border-accent/40 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <TeacherAvatar emoji={s.teacher.emoji} size={34} />
        {s.hasActive && (
          <span className="wait-pulse rounded-full bg-accent-2/15 px-2 py-0.5 text-[10px] font-semibold text-accent-2">
            Waiting
          </span>
        )}
      </div>
      <p className="mt-2.5 font-semibold leading-tight">{s.name}</p>
      <p className="mt-0.5 text-xs text-muted">with {s.teacher.name}</p>
      <p className="mt-auto pt-2 text-xl font-bold tabular-nums">
        {value == null ? "—" : Math.round(value)}
        <span className="text-xs font-medium text-muted">/100</span>
      </p>
      <div className="mt-2">
        <ProgressBar value={value ?? 0} color={assessed ? SERIES.evidence : SERIES.self} label={`${s.name} score`} />
      </div>
    </Link>
  );
}
