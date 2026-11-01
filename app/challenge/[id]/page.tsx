import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { levelChange } from "@/server/assessment/levels";
import { getChallengeForUser } from "@/server/services/challenges";
import { getMentorMessages } from "@/server/services/mentor";
import { AppShell, More } from "@/components/AppShell";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MentorChat } from "@/components/MentorChat";
import { NextStepForm } from "@/components/NextStepForm";
import { ReflectionForm } from "@/components/ReflectionForm";
import { ButtonLink, Card } from "@/components/ui";
import { skipChallengeAction } from "../../actions";

export const dynamic = "force-dynamic";

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export default async function StepPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireReadyUser();
  const { id } = await params;
  const ch = await getChallengeForUser(user.id, id);
  if (!ch) notFound();

  const criteria = asStrings(ch.successCriteria);
  const analysis = ch.reflection?.analysis;
  const meta = (analysis?.insights ?? {}) as { feedback?: string };
  const painPoints = asStrings(analysis?.painPoints);

  const [event, nextStep, chat] = await Promise.all([
    analysis ? db.skillScoreEvent.findFirst({ where: { userId: user.id, source: "challenge", sourceId: ch.id } }) : null,
    analysis ? db.challenge.findFirst({ where: { userId: user.id, previousId: ch.id }, select: { id: true } }) : null,
    getMentorMessages(user.id, ch.id),
  ]);
  const lvl = event ? levelChange(event.newScore - event.delta, event.newScore) : null;
  const analysing = !!ch.reflection && !analysis;

  return (
    <AppShell title={`Step ${ch.stepNumber}`} back="/dashboard">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{ch.skill.name}</p>
        <h2 className="mt-1.5 text-xl font-bold leading-snug">{ch.title}</h2>
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{ch.instructions}</p>
        {criteria.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
            {criteria.map((c) => (
              <li key={c} className="flex gap-2"><span className="text-brand-600">✓</span>{c}</li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-400">~{ch.estimatedMinutes} min{ch.previousId && <> · <Link href={`/challenge/${ch.previousId}`} className="underline">previous step</Link></>}</p>
      </Card>

      {ch.status === "assigned" && (
        <Card>
          <h3 className="mb-3 font-semibold">Check in</h3>
          <ReflectionForm challengeId={ch.id} />
        </Card>
      )}

      {analysing && (
        <AutoRefresh>
          <Card className="text-center">
            <p className="font-semibold">Thanks — sent ✓</p>
            <p className="mt-1 animate-pulse text-sm text-slate-500">Your mentor is reading it…</p>
          </Card>
        </AutoRefresh>
      )}

      {lvl && lvl.change > 0 && (
        <div className="rounded-2xl bg-emerald-500 p-5 text-center text-white">
          <p className="text-3xl">🎉</p>
          <p className="mt-1 text-lg font-bold">Level up!</p>
          <p className="text-emerald-50">{ch.skill.name}: {lvl.from.name} → {lvl.to.name}</p>
        </div>
      )}

      {analysis && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Your mentor</p>
          {meta.feedback && <p className="mt-2 text-[15px] leading-relaxed text-slate-800">{meta.feedback}</p>}
          {painPoints.length > 0 && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Work on</p>
              <ul className="mt-1 space-y-1">
                {painPoints.map((p) => <li key={p}>• {p}</li>)}
              </ul>
            </div>
          )}
          {lvl && lvl.change < 0 && (
            <p className="mt-3 text-xs text-slate-500">{ch.skill.name} adjusted to {lvl.to.name} — normal, you&apos;ll build it back.</p>
          )}
          <div className="mt-5">
            {nextStep ? <ButtonLink href={`/challenge/${nextStep.id}`}>Go to next step →</ButtonLink> : <NextStepForm previousId={ch.id} />}
          </div>
        </Card>
      )}

      {(ch.status === "skipped" || ch.status === "expired") && !ch.reflection && (
        <Card className="text-center">
          <p className="text-slate-600">This step was {ch.status}.</p>
          <div className="mt-3"><ButtonLink href="/dashboard?new=1">Start something new</ButtonLink></div>
        </Card>
      )}

      <More label="💬 Ask your mentor about this step" open={chat.length > 0}>
        <MentorChat messages={chat} challengeId={ch.id} placeholder="e.g. What do I say if they ignore me?" />
      </More>

      {ch.situation && (
        <More label="Your situation">
          <p className="whitespace-pre-line text-sm text-slate-600">{ch.situation}</p>
        </More>
      )}

      {ch.status === "assigned" && (
        <form action={skipChallengeAction} className="text-center">
          <input type="hidden" name="challengeId" value={ch.id} />
          <button className="text-sm text-slate-400 underline">Skip this step</button>
        </form>
      )}
    </AppShell>
  );
}
