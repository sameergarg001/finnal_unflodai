import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { getChallengeForUser, labelStatus, type AnalysisReport } from "@/server/services/challenges";
import { frameworkOf } from "@/server/services/skills";
import { toChallengeView } from "@/server/views";
import { AppShell, More } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ChallengeBody } from "@/components/ChallengeCard";
import { FeedbackFlow } from "@/components/FeedbackFlow";
import { SubmitButton } from "@/components/SubmitButton";
import { ButtonLink, Card, Notice, Pill, Skeleton, btnSecondary } from "@/components/ui";
import { abandonChallengeAction, nextChallengeAction } from "../../actions";

export const dynamic = "force-dynamic";

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ accepted?: string; feedback?: string }> }) {
  const user = await requireReadyUser();
  const { id } = await params;
  const sp = await searchParams;
  const ch = await getChallengeForUser(user.id, id);
  if (!ch) notFound();
  if (ch.status === "proposed" && ch.conversationId) redirect(`/coach/${ch.conversationId}`);

  const view = toChallengeView(ch, ch.skill);
  const analysis = ch.reflection?.analysis;
  const report = analysis?.report as AnalysisReport | null | undefined;
  const feedback = ((analysis?.insights ?? {}) as { feedback?: string }).feedback;
  const [event, next] = await Promise.all([
    analysis ? db.skillScoreEvent.findFirst({ where: { userId: user.id, source: "challenge", sourceId: ch.id } }) : null,
    ch.status === "done" ? db.challenge.findFirst({ where: { userId: user.id, skillId: ch.skillId, assignedAt: { gt: ch.assignedAt }, status: { in: ["active", "proposed", "done"] } }, orderBy: { assignedAt: "asc" } }) : null,
  ]);
  const responses = (Array.isArray(ch.reflection?.responses) ? ch.reflection!.responses : []) as { question: string; answer: string }[];
  const waitingSince = ch.acceptedAt ?? ch.assignedAt;

  return (
    <AppShell title={ch.skill.name} back={`/skills/${ch.skillId}`}>
      {ch.status === "active" && (
        <>
          <div className="rounded-3xl bg-gradient-to-br from-accent-2/25 to-accent/20 p-5 text-center">
            <p className="text-3xl">⏳</p>
            <p className="mt-1 text-lg font-bold">Your challenge is waiting for you</p>
            <p className="mt-1 text-sm text-muted">
              Accepted {waitingSince.toLocaleDateString(undefined, { day: "numeric", month: "short" })}. Take your time — it&apos;s saved even if you close the app.
            </p>
          </div>
          {sp.accepted && <Notice tone="success">✓ Challenge accepted. Come back here after you try it.</Notice>}

          {sp.feedback ? (
            <Card>
              <FeedbackFlow challengeId={ch.id} questions={frameworkOf(ch.skill).feedbackQuestions} />
            </Card>
          ) : (
            <>
              <Card><ChallengeBody c={view} /></Card>
              <div className="space-y-2">
                <ButtonLink href={`/challenge/${ch.id}?feedback=1`}>✓ I tried it — submit my experience</ButtonLink>
                {ch.conversationId && <Link href={`/coach/${ch.conversationId}`} className={btnSecondary}>💬 Ask AI for help</Link>}
              </div>
              <ActionForm action={abandonChallengeAction} confirm="Abandon this challenge? That's okay — it won't count against you." className="pt-2 text-center">
                <input type="hidden" name="challengeId" value={ch.id} />
                <button className="text-sm text-muted underline">Abandon challenge</button>
              </ActionForm>
            </>
          )}
        </>
      )}

      {ch.status === "done" && (
        <>
          {!analysis ? (
            <AutoRefresh>
              <Card className="space-y-3 text-center">
                <p className="text-lg font-semibold">Thanks — feedback received ✓</p>
                <p className="animate-pulse text-sm text-muted">Your coach is analysing your experience…</p>
                <Skeleton className="h-4" /><Skeleton className="h-4 w-2/3" />
              </Card>
            </AutoRefresh>
          ) : (
            <>
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">📊 Coach analysis</p>
                  <Pill>{labelStatus(ch.reflection!.completionStatus)}</Pill>
                </div>
                {feedback && <p className="text-[15px] leading-relaxed">{feedback}</p>}
                <List title="What went well" items={report?.wentWell ?? []} tone="text-success" />
                <List title="Areas to improve" items={report?.toImprove ?? asStrings(analysis.painPoints)} tone="text-warn" />
                {analysis.nextFocus && (
                  <div className="rounded-2xl bg-accent/10 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">Next development focus</p>
                    <p className="mt-1 text-[15px] font-medium">{analysis.nextFocus}</p>
                  </div>
                )}
                {analysis.modelVersion === "heuristic" && <p className="text-xs text-muted">Basic analysis — the AI coach was unavailable when you sent this.</p>}
              </Card>

              {event && (
                <Card>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">Progress assessment</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {Math.round((event.previousScore ?? event.newScore) * 10) / 10} → <span className={event.delta > 0 ? "text-success" : ""}>{event.newScore}</span>
                    {event.delta > 0 && <span className="ml-2 text-base text-success">+{event.delta}</span>}
                  </p>
                  <p className="mt-1 text-sm text-muted">{event.reason}</p>
                </Card>
              )}

              {next ? (
                <ButtonLink href={next.status === "proposed" && next.conversationId ? `/coach/${next.conversationId}` : `/challenge/${next.id}`}>Go to your next challenge →</ButtonLink>
              ) : (
                <ActionForm action={nextChallengeAction}>
                  <input type="hidden" name="challengeId" value={ch.id} />
                  <SubmitButton pendingText="Designing your next challenge…">🎯 Get my next challenge</SubmitButton>
                </ActionForm>
              )}
            </>
          )}

          <More label="The challenge">
            <ChallengeBody c={view} />
          </More>
          {responses.length > 0 && (
            <More label="Your experience">
              <div className="space-y-3 text-sm">
                {responses.map((r) => (
                  <div key={r.question}><p className="text-muted">{r.question}</p><p className="mt-0.5 whitespace-pre-line">{r.answer}</p></div>
                ))}
              </div>
            </More>
          )}
        </>
      )}

      {ch.status === "abandoned" && (
        <>
          <Card className="text-center">
            <p className="text-lg font-semibold">Challenge set aside</p>
            <p className="mt-1 text-sm text-muted">That&apos;s fine — it doesn&apos;t count against you. Your coach will suggest something that fits better.</p>
          </Card>
          <Card><ChallengeBody c={view} /></Card>
          <ButtonLink href={`/skills/${ch.skillId}`}>Back to {ch.skill.name}</ButtonLink>
        </>
      )}

      {ch.status === "discarded" && <Notice>This challenge was replaced by another one.</Notice>}
    </AppShell>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={`text-sm font-semibold ${tone}`}>{title}</p>
      <ul className="mt-1.5 space-y-1 text-[15px]">{items.map((i) => <li key={i}>• {i}</li>)}</ul>
    </div>
  );
}
