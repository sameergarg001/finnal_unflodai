import Link from "next/link";
import type { SkillCardData } from "@/server/services/progress";
import { ProgressBar, SERIES, TeacherAvatar } from "./ui";

/** Home skill card: teacher, name, score. Tap for everything else. */
export function SkillCard({ s }: { s: SkillCardData }) {
  const assessed = s.evidenceScore !== null;
  const value = assessed ? s.evidenceScore! : s.selfScore;
  return (
    <Link href={`/skills/${s.id}`} className="relative block rounded-3xl border border-line bg-card p-4 transition active:scale-[0.98]">
      {s.hasActive && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-accent-2" aria-label="Task waiting" />}
      <TeacherAvatar emoji={s.teacher.emoji} size={34} />
      <p className="mt-2.5 font-semibold leading-tight">{s.name}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">
        {value == null ? "—" : Math.round(value)}
        <span className="text-xs font-medium text-muted">/100</span>
      </p>
      <div className="mt-2">
        <ProgressBar value={value ?? 0} color={assessed ? SERIES.evidence : SERIES.self} label={`${s.name} score`} />
      </div>
    </Link>
  );
}
