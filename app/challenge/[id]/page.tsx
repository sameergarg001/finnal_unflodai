import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { levelChange } from "@/server/assessment/levels";
import { getChallengeForUser } from "@/server/services/challenges";
import { getMentorMessages } from "@/server/services/mentor";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MentorChat } from "@/components/MentorChat";
import { Nav } from "@/components/Nav";
import { NextStepForm } from "@/components/NextStepForm";
import { ReflectionForm } from "@/components/ReflectionForm";
import { ButtonLink, Card, btnSecondary } from "@/components/ui";
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
  const evidence = asStrings(analysis?.evidence);
  const painPoints = asStrings(analysis?.painPoints);

  const [event, nextStep] = analysis
    ? await Promise.all([
        db.skillScoreEvent.findFirst({ where: { userId: user.id, source: "challenge", sourceId: ch.id } }),
        db.challenge.findFirst({ where: { userId: user.id, previousId: ch.id }, select: { id: true } }),
      ])
    : [null, null];
  const lvl = event ? levelChange(event.newScore - event.delta, event.newScore) : null;
  const analysing = !!ch.reflection && !analysis;
  const chat = await getMentorMessages(user.id, ch.id);

  return (
    <>
      <Nav name={user.name} />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        {ch.situation && (
          <div className="rounded-xl bg-slate-100 px-5 py-4 text-sm text-slate-700">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Your situation</p>
            <p className="whitespace-pre-line">{ch.situation}</p>
          </div>
        )}

        <Card>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{ch.skill.name}</span>
            <span className="text-slate-500">Step {ch.stepNumber} · Difficulty {ch.difficulty}/5 · ~{ch.estimatedMinutes} min</span>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 capitalize text-slate-600">{ch.status}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold">{ch.title}</h1>
          <p className="mt-3 whitespace-pre-line text-slate-700">{ch.instructions}</p>
          {criteria.length > 0 && (
            <>
              <h2 className="mt-5 text-sm font-semibold">You&apos;ve done it when…</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {criteria.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </>
          )}
          {ch.whyThisChallenge && <p className="mt-4 text-sm italic text-slate-500">Why this step: {ch.whyThisChallenge}</p>}
          {ch.previousId && (
            <Link href={`/challenge/${ch.previousId}`} className="mt-3 inline-block text-xs text-brand-600">
              ← Previous step
            </Link>
          )}
        </Card>

        {ch.status === "assigned" && (
          <Card>
            <h2 className="mb-1 text-lg font-semibold">Tell UnfoldAI how it went</h2>
            <p className="mb-5 text-sm text-slate-600">
              Done it (or tried)? Your honest, specific feedback is how UnfoldAI finds your pain points and designs the next step.
            </p>
            <ReflectionForm challengeId={ch.id} />
            <form action={skipChallengeAction} className="mt-6 border-t border-slate-100 pt-4">
              <input type="hidden" name="challengeId" value={ch.id} />
              <button className={btnSecondary}>Skip — this step doesn&apos;t fit</button>
            </form>
          </Card>
        )}

        {analysing && (
          <AutoRefresh>
            <Card className="text-center">
              <p className="text-2xl">🧠</p>
              <h2 className="mt-1 text-lg font-semibold">Thanks — your feedback is saved.</h2>
              <p className="mt-1 animate-pulse text-sm text-slate-600">
                Your mentor is analysing it to find your pain points and plan your next step. This page updates automatically.
              </p>
            </Card>
          </AutoRefresh>
        )}

        {lvl && lvl.change > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-3xl">🎉</p>
            <h2 className="mt-1 text-xl font-bold text-emerald-800">Level up in {ch.skill.name}!</h2>
            <p className="mt-1 text-emerald-700">
              {lvl.from.name} → <span className="font-semibold">{lvl.to.name}</span> (Level {lvl.to.value})
            </p>
          </div>
        )}
        {lvl && lvl.change < 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Your {ch.skill.name} level was adjusted to {lvl.to.name} based on this step. That&apos;s normal — the next
            steps will help you build it back up.
          </div>
        )}

        {analysis && (
          <Card>
            <h2 className="text-lg font-semibold">UnfoldAI&apos;s feedback</h2>
            {event && lvl && (
              <p className="mt-1 text-sm text-slate-500">
                {ch.skill.name}: {event.delta > 0 ? "+" : ""}{event.delta.toFixed(1)} points · now Level {lvl.to.value} ({lvl.to.name})
              </p>
            )}
            {meta.feedback && <p className="mt-3 text-slate-700">{meta.feedback}</p>}

            {painPoints.length > 0 && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-semibold text-amber-900">Pain points we identified</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {painPoints.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            )}
            {evidence.length > 0 && (
              <>
                <h3 className="mt-4 text-sm font-semibold">What we noticed</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {evidence.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </>
            )}
            {analysis.nextFocus && (
              <p className="mt-4 text-sm text-slate-700">
                <span className="font-semibold">Next step will focus on:</span> {analysis.nextFocus}
              </p>
            )}

            <div className="mt-6 border-t border-slate-100 pt-5">
              {nextStep ? (
                <ButtonLink href={`/challenge/${nextStep.id}`}>Go to your next step →</ButtonLink>
              ) : (
                <>
                  <NextStepForm previousId={ch.id} />
                  <p className="mt-4 text-sm text-slate-500">
                    Or <Link href="/dashboard?new=1" className="font-medium text-brand-600">work on a different skill or situation</Link>.
                  </p>
                </>
              )}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="text-lg font-semibold">Ask your mentor about this step</h2>
          <p className="mb-4 text-sm text-slate-600">Stuck, nervous, or not sure what to say? Your mentor knows your situation.</p>
          <MentorChat messages={chat} challengeId={ch.id} placeholder="e.g. What exactly should I say if they ignore my point?" />
        </Card>

        {(ch.status === "skipped" || ch.status === "expired") && !ch.reflection && (
          <Card>
            <p className="text-slate-700">This step was {ch.status}.</p>
            <div className="mt-4"><ButtonLink href="/dashboard?new=1">Start a new session</ButtonLink></div>
          </Card>
        )}
      </main>
    </>
  );
}
