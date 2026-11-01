import Link from "next/link";
import { Suspense } from "react";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { levelForScore } from "@/server/assessment/levels";
import { analyzePendingFeedback, getCurrentChallenge, suggestSkillId } from "@/server/services/challenges";
import { getStreak } from "@/server/services/mentor";
import { AppShell } from "@/components/AppShell";
import { MentorBrief, MentorBriefSkeleton, StreakChip } from "@/components/MentorBrief";
import { StartSessionForm } from "@/components/StartSessionForm";
import { ButtonLink, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireReadyUser();
  const params = await searchParams;

  // Finish any feedback analysis that was interrupted (e.g. server restart).
  after(() => analyzePendingFeedback(user.id));

  const [current, streak, suggestedId, scores, active] = await Promise.all([
    getCurrentChallenge(user.id),
    getStreak(user),
    suggestSkillId(user.id),
    db.skillScore.findMany({ where: { userId: user.id }, include: { skill: true } }),
    db.userSkill.findMany({ where: { userId: user.id, isActive: true }, select: { skillId: true } }),
  ]);
  const activeIds = new Set(active.map((a) => a.skillId));
  const options = scores
    .filter((s) => activeIds.has(s.skillId))
    .sort((a, b) => a.skill.sortOrder - b.skill.sortOrder)
    .map((s) => {
      const lvl = levelForScore(s.score);
      return { id: s.skillId, name: s.skill.name, category: s.skill.category, levelName: lvl.name, levelValue: lvl.value };
    });

  return (
    <AppShell title="Today" right={<StreakChip current={streak.current} />}>
      <Suspense fallback={<MentorBriefSkeleton />}>
        <MentorBrief user={user} />
      </Suspense>

      {current && !params.new ? (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{current.skill.name} · today&apos;s step</p>
          <h2 className="mt-1.5 text-lg font-bold leading-snug">{current.title}</h2>
          <p className="mt-2 line-clamp-3 text-[15px] text-slate-600">{current.instructions}</p>
          <div className="mt-4">
            <ButtonLink href={`/challenge/${current.id}`}>Open step</ButtonLink>
          </div>
          <p className="mt-3 text-center text-sm text-slate-500">
            🌙 Check in tonight ·{" "}
            <Link href="/dashboard?new=1" className="text-slate-400 underline">something else?</Link>
          </p>
        </Card>
      ) : (
        <Card>
          <StartSessionForm skills={options} suggestedId={suggestedId} />
          {current && (
            <p className="mt-3 text-center text-xs text-slate-400">
              This replaces your open step. <Link href="/dashboard" className="underline">Keep it</Link>
            </p>
          )}
        </Card>
      )}
    </AppShell>
  );
}
