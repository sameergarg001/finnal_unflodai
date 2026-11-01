import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireReadyUser } from "@/server/auth/session";
import { getSkillForUser } from "@/server/services/skills";
import { getProgressReview, getSkillHistory } from "@/server/services/progress";
import { labelStatus, type AnalysisReport } from "@/server/services/challenges";
import { AppShell } from "@/components/AppShell";
import { Card, DIFFICULTY_NAMES, EmptyState, Pill, SectionTitle, Skeleton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireReadyUser();
  const { id } = await params;
  const skill = await getSkillForUser(user.id, id);
  if (!skill) notFound();
  const { challenges, events, weaknesses } = await getSkillHistory(user.id, id);
  const done = challenges.filter((c) => c.reflection && ["completed", "partial"].includes(c.reflection.completionStatus));
  const incomplete = challenges.filter((c) => c.status === "abandoned" || (c.reflection && ["unsuccessful", "not_attempted"].includes(c.reflection.completionStatus)));
  const active = challenges.filter((c) => c.status === "active");
  const changes = events.filter((e) => e.source === "challenge" || e.reason);

  return (
    <AppShell title={`${skill.name} · history`} back={`/skills/${id}`}>
      {challenges.length === 0 ? (
        <EmptyState icon="📖" title="Nothing to revise yet" body="Your challenges, feedback and analyses for this skill will appear here." action={<Link href={`/skills/${id}`} className="font-semibold text-accent">Start improving →</Link>} />
      ) : (
        <>
          <Suspense fallback={<Card className="space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-16" /><Skeleton className="h-16" /></Card>}>
            <Review userId={user.id} skillId={id} />
          </Suspense>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini value={challenges.length} label="challenges" />
            <Mini value={done.length} label="completed" />
            <Mini value={incomplete.length} label="incomplete" />
          </div>

          {active.length > 0 && <List title="Active" items={active} />}
          {done.length > 0 && <List title="Completed" items={done} />}
          {incomplete.length > 0 && <List title="Incomplete — still useful" items={incomplete} />}

          {weaknesses.length > 0 && (
            <>
              <SectionTitle>Identified weaknesses</SectionTitle>
              <Card>
                <ul className="space-y-2 text-sm">{weaknesses.map((w) => <li key={w.text} className="flex gap-2"><span className="text-warn">•</span>{w.text}</li>)}</ul>
              </Card>
            </>
          )}

          <SectionTitle>Progress changes</SectionTitle>
          <Card className="divide-y divide-line !py-1">
            {changes.map((e) => (
              <div key={e.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{e.source === "challenge" ? "Evidence assessment" : "Self-assessment"}</span>
                  <span className={`font-semibold tabular-nums ${e.delta > 0 ? "text-success" : "text-muted"}`}>
                    {e.previousScore != null ? `${Math.round(e.previousScore * 10) / 10} → ` : ""}{e.newScore}
                  </span>
                </div>
                {e.reason && <p className="mt-0.5 text-xs text-muted">{e.reason}</p>}
                <p className="mt-0.5 text-[11px] text-muted/70">{e.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            ))}
          </Card>
        </>
      )}
    </AppShell>
  );
}

async function Review({ userId, skillId }: { userId: string; skillId: string }) {
  const review = await getProgressReview(userId, skillId);
  if (!review) {
    return <Card><p className="text-sm text-muted">Once you&apos;ve reported back on a challenge, your coach will explain what you&apos;ve improved and what to focus on next.</p></Card>;
  }
  return (
    <Card className="space-y-4">
      <p className="text-[15px] leading-relaxed">{review.summary}</p>
      <Block title="What you have improved" items={review.improved} tone="text-success" empty="No clear improvement measured yet — that's normal early on." />
      <Block title="What still needs work" items={review.stillNeedsWork} tone="text-warn" />
      <div className="rounded-2xl bg-accent/10 p-3.5 text-sm"><p className="font-semibold text-accent">What we should focus on next</p><p className="mt-1">{review.focusNext}</p></div>
      <p className="text-[11px] text-muted">Based on {review.basedOn} reported challenge{review.basedOn === 1 ? "" : "s"}.</p>
    </Card>
  );
}

function Block({ title, items, tone, empty }: { title: string; items: string[]; tone: string; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <div>
      <p className={`text-sm font-semibold ${tone}`}>{title}</p>
      {items.length ? <ul className="mt-1.5 space-y-1 text-sm">{items.map((i) => <li key={i}>• {i}</li>)}</ul> : <p className="mt-1 text-sm text-muted">{empty}</p>}
    </div>
  );
}

type Item = { id: string; title: string; difficulty: number; status: string; reflection: { completionStatus: string; analysis: { report: unknown } | null } | null };

function List({ title, items }: { title: string; items: Item[] }) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card className="divide-y divide-line !py-1">
        {items.map((c) => {
          const r = c.reflection?.analysis?.report as AnalysisReport | null | undefined;
          return (
            <Link key={c.id} href={`/challenge/${c.id}`} className="block py-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{c.title}</p>
                <span className="text-muted">›</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Pill>{c.reflection ? labelStatus(c.reflection.completionStatus) : c.status === "active" ? "Waiting for feedback" : "Abandoned"}</Pill>
                <Pill>{DIFFICULTY_NAMES[c.difficulty]}</Pill>
              </div>
              {r?.nextFocus && <p className="mt-1.5 text-xs text-muted">Next focus: {r.nextFocus}</p>}
            </Link>
          );
        })}
      </Card>
    </>
  );
}

function Mini({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card py-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
