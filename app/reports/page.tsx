import Link from "next/link";
import { Suspense } from "react";
import { requireReadyUser } from "@/server/auth/session";
import { getProgressReview, getReports } from "@/server/services/progress";
import { AppShell, More } from "@/components/AppShell";
import { SelfVsEvidence, TrendChart, WeeklyBars } from "@/components/Charts";
import { Card, EmptyState, Icon, Pill, ProgressBar, ScoreRing, SectionTitle, Skeleton, btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireReadyUser();
  const r = await getReports(user);
  const hasData = r.attempted > 0;

  return (
    <AppShell title="Reports">
      <Card className="flex items-center gap-5">
        <ScoreRing value={r.completionRate} size={104} stroke={11} caption="completion" color="var(--sun)" />
        <div className="grid flex-1 grid-cols-2 gap-3">
          <Stat value={String(r.attempted)} label="attempted" />
          <Stat value={String(r.completed)} label="completed" />
        </div>
      </Card>

      {!hasData ? (
        <EmptyState icon="📈" title="Starts with your first task" body="Built only from tasks you report on." action={<Link href="/dashboard" className={`${btnPrimary} !w-auto`}>Pick a skill</Link>} />
      ) : (
        <Suspense fallback={<Card className="space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-14" /></Card>}>
          <OverallReview userId={user.id} />
        </Suspense>
      )}

      {r.trend.length > 0 && (
        <>
          <SectionTitle>Overall trend</SectionTitle>
          <Card>
            <TrendChart points={r.trend} />
            <p className="mt-2 text-xs text-muted">Average UnfoldAI score, after each task.</p>
            <details className="mt-2 text-xs text-muted">
              <summary className="cursor-pointer">View as table</summary>
              <table className="mt-2 w-full">
                <tbody>{r.trend.map((p, i) => <tr key={i} className="border-t border-line"><td className="py-1">{p.date}</td><td className="text-right tabular-nums">{p.value}</td></tr>)}</tbody>
              </table>
            </details>
          </Card>
        </>
      )}

      <SectionTitle>Skills</SectionTitle>
      <Card>
        <SelfVsEvidence rows={r.cards.map((c) => ({ name: c.name, self: c.selfScore, evidence: c.evidenceScore }))} />
        <p className="mt-4 text-xs text-muted">UnfoldAI&apos;s score moves only with task evidence.</p>
      </Card>

      {r.mostImproved.length > 0 && (
        <>
          <SectionTitle>Most improved</SectionTitle>
          <Card className="space-y-2.5">
            {r.mostImproved.map((m, i) => (
              <div key={m.name} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2/70 text-lg">{["🥇", "🥈", "🥉"][i]}</span>
                <span className="flex-1 font-medium">{m.name}</span>
                <Pill tone="success">+{m.gain}</Pill>
              </div>
            ))}
          </Card>
        </>
      )}

      {r.subskills.length > 0 && (
        <>
          <SectionTitle>Subskills</SectionTitle>
          <Card className="space-y-3.5">
            {r.subskills.map((s) => (
              <div key={`${s.skill}:${s.label}`}>
                <div className="mb-1 flex justify-between text-sm"><span>{s.label} <span className="text-xs text-muted">· {s.skill}</span></span><span className="text-xs text-muted">{s.completed}/{s.attempted} completed</span></div>
                <ProgressBar thick value={(s.completed / s.attempted) * 100} label={s.label} />
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
            <p className="mt-1 text-xs text-muted">Tasks per week</p>
          </Card>
        </>
      )}

      {r.repeatedWeaknesses.length > 0 && (
        <>
          <SectionTitle>Keeps coming up</SectionTitle>
          <div className="flex flex-wrap gap-2">{r.repeatedWeaknesses.map((w) => <span key={w.text} className="rounded-2xl bg-sun-soft px-3.5 py-2 text-sm">{w.text}</span>)}</div>
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
      <p className="flex items-center gap-1.5 font-display text-lg font-bold"><Icon name="spark" className="h-5 w-5 text-sun-ink" />Your report</p>
      <p className="text-[15px] leading-relaxed">{review.summary}</p>
      {review.improved.length > 0 && <div><p className="text-sm font-semibold text-success">Improved</p><ul className="mt-1 space-y-1 text-sm">{review.improved.map((x) => <li key={x}>• {x}</li>)}</ul></div>}
      {review.stillNeedsWork.length > 0 && <div><p className="text-sm font-semibold text-warn">Still needs work</p><ul className="mt-1 space-y-1 text-sm">{review.stillNeedsWork.map((x) => <li key={x}>• {x}</li>)}</ul></div>}
      <div className="flex gap-3 rounded-[20px] bg-accent-soft p-4 text-sm"><Icon name="target" className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><p><b className="text-accent">Focus next</b><br />{review.focusNext}</p></div>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[20px] bg-card-2/60 px-3 py-3">
      <p className="font-display text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
