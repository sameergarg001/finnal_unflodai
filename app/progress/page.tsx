import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { levelByValue, levelProgress } from "@/server/assessment/levels";
import { recallInsights } from "@/server/engine/memory";
import { getStreak } from "@/server/services/mentor";
import { AppShell, More } from "@/components/AppShell";
import { WeeklyReview, WeeklyReviewSkeleton } from "@/components/WeeklyReview";
import { Card, ScoreBar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireReadyUser();
  const [scores, active, history, insights, streak, done, practised] = await Promise.all([
    db.skillScore.findMany({ where: { userId: user.id }, include: { skill: true } }),
    db.userSkill.findMany({ where: { userId: user.id, isActive: true }, select: { skillId: true } }),
    db.challenge.findMany({
      where: { userId: user.id, status: { not: "assigned" } },
      include: { skill: true },
      orderBy: { assignedAt: "desc" },
      take: 20,
    }),
    recallInsights(user.id, "", 6),
    getStreak(user),
    db.challenge.count({ where: { userId: user.id, status: "completed" } }),
    db.skillScoreEvent.findMany({ where: { userId: user.id, source: "challenge" }, select: { skillId: true }, distinct: ["skillId"] }),
  ]);
  const activeIds = new Set(active.map((a) => a.skillId));
  const skills = scores.filter((s) => activeIds.has(s.skillId)).sort((a, b) => a.skill.sortOrder - b.skill.sortOrder);
  // Minimal: show skills you've actually worked on; the rest stay tucked away.
  const worked = new Set(practised.map((p) => p.skillId));
  const mainSkills = skills.filter((s) => worked.has(s.skillId));
  const otherSkills = skills.filter((s) => !worked.has(s.skillId));

  return (
    <AppShell title="Progress">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={`🔥 ${streak.current}`} label="day streak" />
        <Stat value={String(streak.best)} label="best streak" />
        <Stat value={String(done)} label="steps done" />
      </div>

      <Suspense fallback={<WeeklyReviewSkeleton />}>
        <WeeklyReview user={user} />
      </Suspense>

      {mainSkills.length > 0 ? (
        <Card>
          <h2 className="mb-3 font-semibold">Your levels</h2>
          <LevelList items={mainSkills} />
        </Card>
      ) : (
        <p className="px-1 text-center text-sm text-slate-500">Complete your first step and your levels will show here.</p>
      )}

      {otherSkills.length > 0 && (
        <More label={mainSkills.length ? "Other skills" : "All skills"}>
          <LevelList items={otherSkills} />
        </More>
      )}

      {insights.length > 0 && (
        <More label="What your mentor noticed">
          <ul className="space-y-2 text-sm text-slate-700">
            {insights.map((i) => <li key={i.text}>• {i.text}</li>)}
          </ul>
        </More>
      )}

      {history.length > 0 && (
        <More label="Past steps">
          <ul className="divide-y divide-slate-100 text-sm">
            {history.map((c) => (
              <li key={c.id}>
                <Link href={`/challenge/${c.id}`} className="flex justify-between gap-3 py-2.5">
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{c.status === "completed" ? "✓" : c.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </More>
      )}
    </AppShell>
  );
}

function LevelList({ items }: { items: { skillId: string; score: number; startingLevel: number | null; skill: { name: string } }[] }) {
  return (
    <ul className="space-y-3.5">
      {items.map((s) => {
        const { level, pct } = levelProgress(s.score);
        const started = levelByValue(s.startingLevel);
        const up = started && level.value > started.value;
        return (
          <li key={s.skillId}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>{s.skill.name}</span>
              <span className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-slate-500"}`}>
                {up && "↑ "}{level.name}
              </span>
            </div>
            <ScoreBar score={pct} />
          </li>
        );
      })}
    </ul>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white px-2 py-3 shadow-sm">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
