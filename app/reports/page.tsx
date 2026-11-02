import Link from "next/link";
import { Suspense } from "react";
import { requireReadyUser } from "@/server/auth/session";
import { getProgressReview, getReports } from "@/server/services/progress";
import { AppShell, More } from "@/components/AppShell";
import { SelfVsEvidence, TrendChart, WeeklyBars } from "@/components/Charts";
import { Card, EmptyState, ProgressBar, SectionTitle, Skeleton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireReadyUser();
  const r = await getReports(user);
  const hasData = r.attempted > 0;

  return (
    <AppShell title="Reports">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={String(r.attempted)} label="attempted" />
        <Stat value={String(r.completed)} label="completed" />
        <Stat value={r.completionRate == null ? "—" : `${r.completionRate}%`} label="completion" />
      </div>

      {!hasData ? (
        <EmptyState icon="📈" title="Your reports start with your first task" body="Everything here is built from tasks you actually report on — nothing is estimated or invented." action={<Link href="/dashboard" className="font-semibold text-accent">Pick a skill →</Link>} />
      ) : (
        <Suspense fallback={<Card className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-14" /></Card>}>
          <OverallReview userId={user.id} />
        </Suspense>
      )}

      {r.trend.length > 0 && (
        <>
          <SectionTitle>Overall development trend</SectionTitle>
          <Card>
            <TrendChart points={r.trend} />
            <p className="mt-2 text-xs text-muted">Average UnfoldAI score of your assessed skills, after each assessed challenge.</p>
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer">View as table</summary>
              <table className="mt-2 w-full">
                <tbody>{r.trend.map((p, i) => <tr key={i} className="border-t border-line"><td className="py-1">{p.date}</td><td className="text-right tabular-nums">{p.value}</td></tr>)}</tbody>
              </table>
            </details>
          </Card>
        </>
      )}

      <SectionTitle>Skill progress</SectionTitle>
      <Card>
        <SelfVsEvidence rows={r.cards.map((c) => ({ name: c.name, self: c.selfScore, evidence: c.evidenceScore }))} />
        <p className="mt-4 text-xs text-muted">Self-assessment is your own rating. UnfoldAI&apos;s assessment only moves with evidence from tasks (— = not assessed yet).</p>
      </Card>

      {r.mostImproved.length > 0 && (
        <>
          <SectionTitle>Most improved</SectionTitle>
          <Card className="space-y-2">
            {r.mostImproved.map((m, i) => (
              <div key={m.name} className="flex items-center justify-between text-sm">
                <span>{["🥇", "🥈", "🥉"][i]} {m.name}</span>
                <span className="font-semibold text-success">+{m.gain}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {r.subskills.length > 0 && (
        <>
          <SectionTitle>Subskill progress</SectionTitle>
          <Card className="space-y-3.5">
            {r.subskills.map((s) => (
              <div key={`${s.skill}:${s.label}`}>
                <div className="mb-1 flex justify-between text-sm"><span>{s.label} <span className="text-xs text-muted">· {s.skill}</span></span><span className="text-xs text-muted">{s.completed}/{s.attempted} completed</span></div>
                <ProgressBar value={(s.completed / s.attempted) * 100} label={s.label} />
              </div>
            ))}
          </Card>
        </>
      )}

      {hasData && (
        <>
          <SectionTitle>Consistency</SectionTitle>
          <Card>
            <WeeklyBars weeks={r.consistency} />
            <p className="mt-1 text-xs text-muted">Tasks you reported on, per week (last 8 weeks).</p>
          </Card>
        </>
      )}

      {r.repeatedWeaknesses.length > 0 && (
        <>
          <SectionTitle>Repeated weaknesses</SectionTitle>
          <Card>
            <ul className="space-y-2 text-sm">{r.repeatedWeaknesses.map((w) => <li key={w.text} className="flex gap-2"><span className="text-warn">•</span>{w.text}</li>)}</ul>
          </Card>
        </>
      )}

      {r.recentInsights.length > 0 && (
        <More label="Recent feedback insights">
          <div className="space-y-4">
            {r.recentInsights.map((i) => (
              <Link key={i.challengeId} href={`/challenge/${i.challengeId}`} className="block">
                <p className="text-xs text-muted">{i.skill} · {i.challenge}</p>
                <p className="mt-0.5 text-sm">{i.feedback}</p>
              </Link>
            ))}
          </div>
        </More>
      )}
    </AppShell>
  );
}

async function OverallReview({ userId }: { userId: string }) {
  const review = await getProgressReview(userId, null);
  if (!review) return null;
  return (
    <Card className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Your development report</p>
      <p className="text-[15px] leading-relaxed">{review.summary}</p>
      {review.improved.length > 0 && <div><p className="text-sm font-semibold text-success">Improved</p><ul className="mt-1 space-y-1 text-sm">{review.improved.map((x) => <li key={x}>• {x}</li>)}</ul></div>}
      {review.stillNeedsWork.length > 0 && <div><p className="text-sm font-semibold text-warn">Still needs work</p><ul className="mt-1 space-y-1 text-sm">{review.stillNeedsWork.map((x) => <li key={x}>• {x}</li>)}</ul></div>}
      <p className="rounded-2xl bg-accent/10 p-3 text-sm"><b className="text-accent">Focus next:</b> {review.focusNext}</p>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl border border-line bg-card py-3.5">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
