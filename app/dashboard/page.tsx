import Link from "next/link";
import { Suspense } from "react";
import { after } from "next/server";
import { requireReadyUser } from "@/server/auth/session";
import { analyzePendingFeedback, labelStatus } from "@/server/services/challenges";
import { getStreak } from "@/server/services/mentor";
import { getNotifications } from "@/server/services/notifications";
import { getRecentActivity, getSkillCards, overallFrom } from "@/server/services/progress";
import { getNextStep } from "@/server/services/nextStep";
import { db } from "@/lib/db";
import { localHour, safeTimeZone } from "@/lib/time";
import { AppShell } from "@/components/AppShell";
import { MentorBrief, MentorBriefSkeleton } from "@/components/MentorBrief";
import { HowItWorks, NextStepCard } from "@/components/NextStepCard";
import { SkillCard } from "@/components/SkillCard";
import { Avatar, Card, EmptyState, Pill, ScoreRing, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireReadyUser();
  after(() => analyzePendingFeedback(user.id));

  const [cards, streak, recent, notes, next, everAccepted] = await Promise.all([
    getSkillCards(user.id),
    getStreak(user),
    getRecentActivity(user.id),
    getNotifications(user.id),
    getNextStep(user.id),
    db.challenge.count({ where: { userId: user.id, acceptedAt: { not: null } } }),
  ]);
  const isNew = everAccepted === 0;
  const overall = overallFrom(cards);
  const first = (user.name ?? "").trim().split(/\s+/)[0];
  const h = localHour(safeTimeZone(user.timezone));
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const core = cards.filter((c) => c.category === "core");
  const added = cards.filter((c) => c.category !== "core");
  const lastReport = recent.lastDone?.reflection?.analysis;
  const lastFeedback = ((lastReport?.insights ?? {}) as { feedback?: string }).feedback;

  return (
    <AppShell
      header={
        <div className="flex h-16 items-center gap-3 px-4">
          <Link href="/profile"><Avatar name={user.name ?? user.email} image={user.image} size={42} /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{greeting}</p>
            <p className="truncate text-lg font-bold">{first || "there"} 👋</p>
          </div>
          <Link href="/notifications" aria-label={`Notifications (${notes.unread} new)`} className="relative rounded-full border border-line bg-card p-2.5">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" />
            </svg>
            {notes.unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{notes.unread}</span>}
          </Link>
        </div>
      }
    >
      {next && <NextStepCard step={next} />}
      {isNew ? (
        <HowItWorks />
      ) : (
        <Suspense fallback={<MentorBriefSkeleton />}>
          <MentorBrief user={user} />
        </Suspense>
      )}

      {/* Overall development — hidden for brand-new users until there is something to show */}
      {!(isNew && overall.completed === 0) && (
      <Card>
        <div className="flex items-center gap-5">
          <ScoreRing value={overall.evidenceAverage} caption={overall.evidenceAverage == null ? "not yet" : "overall"} />
          <div className="min-w-0 flex-1 space-y-1.5 text-sm">
            <p className="font-semibold">Overall development</p>
            {overall.evidenceAverage == null ? (
              <p className="text-muted">Complete your first challenge and UnfoldAI will start measuring real progress.</p>
            ) : (
              <p className="text-muted">
                {overall.evidenceBaseline} → <b className="text-fg">{overall.evidenceAverage}</b> across {overall.assessedSkills} assessed skill{overall.assessedSkills === 1 ? "" : "s"}
              </p>
            )}
            <p className="text-muted">Self-rating avg: <b className="text-fg">{overall.selfAverage ?? "—"}</b></p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat value={String(overall.completed)} label="completed" />
          <Stat value={`🔥 ${streak.current}`} label="day streak" />
          <Stat value={String(recent.active.length)} label="active" />
        </div>
      </Card>
      )}

      {/* Other waiting challenges (the first one is the next step above) */}
      {recent.active.slice(next?.kind === "feedback" ? 1 : 0).map((ch) => (
        <Link key={ch.id} href={`/challenge/${ch.id}`} className="flex items-center gap-3 rounded-3xl border border-accent-2/30 bg-accent-2/10 p-4 active:scale-[0.99]">
          <span className="text-2xl">⏳</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-accent-2">{ch.skill.name} · waiting for you</p>
            <p className="truncate font-semibold">{ch.title}</p>
          </div>
          <span className="text-muted">›</span>
        </Link>
      ))}

      <SectionTitle>My skills</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {core.map((s) => <SkillCard key={s.id} s={s} />)}
        {added.map((s) => <SkillCard key={s.id} s={s} />)}
        <Link href="/skills/add" className="flex min-h-36 flex-col items-center justify-center rounded-3xl border border-dashed border-line text-muted active:scale-[0.98]">
          <span className="text-3xl leading-none text-accent">+</span>
          <span className="mt-2 text-sm font-medium">Add skill</span>
        </Link>
      </div>

      <SectionTitle>Recent activity</SectionTitle>
      {recent.lastDone || recent.active.length ? (
        <Card className="space-y-4">
          {recent.lastDone && (
            <Link href={`/challenge/${recent.lastDone.id}`} className="block">
              <p className="text-xs text-muted">Last challenge · {recent.lastDone.skill.name}</p>
              <p className="mt-0.5 font-semibold">{recent.lastDone.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Pill>{labelStatus(recent.lastDone.reflection?.completionStatus ?? "")}</Pill>
                {recent.lastEvent && recent.lastEvent.delta > 0 && <Pill tone="success">+{recent.lastEvent.delta} progress</Pill>}
              </div>
            </Link>
          )}
          {lastFeedback && (
            <div className="border-t border-line pt-4">
              <p className="text-xs text-muted">Previous feedback from your coach</p>
              <p className="mt-1 line-clamp-3 text-sm">{lastFeedback}</p>
            </div>
          )}
          {recent.lastSkill && (
            <div className="border-t border-line pt-4 text-sm">
              <span className="text-muted">Last active skill: </span>
              <Link href={`/skills/${recent.lastSkill.id}`} className="font-semibold text-accent">{recent.lastSkill.name}</Link>
            </div>
          )}
        </Card>
      ) : (
        <EmptyState icon="🌱" title="No activity yet" body="Tap any skill, tell your coach what's going on, and get your first real-life challenge." />
      )}
    </AppShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-card-2 px-2 py-2.5">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
