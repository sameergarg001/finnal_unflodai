import Link from "next/link";
import type { SkillCardData } from "@/server/services/progress";
import { Icon, ProgressBar, SERIES, TeacherAvatar } from "./ui";

/** Home skill row: teacher orb, name, score/100 and a bar. Tap for everything else. */
export function SkillCard({ s }: { s: SkillCardData }) {
  const assessed = s.evidenceScore !== null;
  const value = assessed ? s.evidenceScore! : s.selfScore;
  return (
    <Link href={`/skills/${s.id}`} className="glass flex items-center gap-3.5 rounded-full py-2.5 pl-2.5 pr-4 transition active:scale-[0.98]">
      <span className="relative">
        <TeacherAvatar emoji={s.teacher.emoji} size={52} />
        {s.hasActive && <span className="wait-pulse absolute -right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-sun ring-[3px] ring-card-solid" aria-label="Task waiting" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-semibold">{s.name}</p>
          <p className="shrink-0 font-display text-[17px] font-bold tabular-nums">
            {value == null ? "—" : Math.round(value)}
            <span className="text-[11px] font-medium text-muted">/100</span>
          </p>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <ProgressBar value={value ?? 0} color={assessed ? SERIES.evidence : SERIES.self} label={`${s.name} score`} />
        </div>
        <p className="mt-1 text-[11.5px] text-muted">{s.hasActive ? "Task waiting" : `with ${s.teacher.name}`}</p>
      </div>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card-2/80 text-muted">
        <Icon name="chevron" className="h-4 w-4" />
      </span>
    </Link>
  );
}
