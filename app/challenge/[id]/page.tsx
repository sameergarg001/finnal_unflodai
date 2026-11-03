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
import { ButtonLink, Card, Icon, Notice, Pill, ScoreRing, Skeleton } from "@/components/ui";
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
          <div className="flex items-center gap-3.5 rounded-[28px] bg-sun-soft p-4 shadow-soft">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sun text-[#3a2a00]"><Icon name="clock" /></span>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight">Your task is waiting for you</p>
              <p className="text-sm text-muted">Since {waitingSince.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · saved</p>
            </div>
          </div>
          {sp.accepted && <Notice tone="success">✓ Task accepted. Come back here after you try it.</Notice>}

          {sp.feedback ? (
            <Card>
              <FeedbackFlow challengeId={ch.id} questions={frameworkOf(ch.skill).feedbackQuestions} />
            </Card>
          ) : (
            <>
              <Card><ChallengeBody c={view} /></Card>
              <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[5] flex gap-2">
                <ButtonLink href={`/challenge/${ch.id}?feedback=1`}><Icon name="check" /> I tried it</ButtonLink>
                {ch.conversationId && (
                  <Link href={`/coach/${ch.conversationId}`} aria-label="Ask AI for help" title="Ask AI for help" className="glass flex h-13 w-13 shrink-0 items-center justify-center rounded-full text-accent active:scale-95">
                    <Icon name="chat" />
                  </Link>
                )}
              </div>
              <ActionForm action={abandonChallengeAction} confirm="Abandon this task? That's okay — it won't count against you." className="pt-2 text-center">
                <input type="hidden" name="challengeId" value={ch.id} />
                <button className="text-sm text-muted underline">Abandon task</button>
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
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon name="check" className="h-6 w-6" /></span>
                <p className="font-display text-lg font-bold">Feedback received</p>
                <p className="animate-pulse text-sm text-muted">Your coach is analysing…</p>
                <Skeleton className="h-4" /><Skeleton className="h-4 w-2/3" />
              </Card>
            </AutoRefresh>
          ) : (
            <>
              {event && (
                <Card className="flex items-center gap-5">
                  <ScoreRing value={event.newScore} size={96} stroke={10} caption="UnfoldAI" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted">Progress</p>
                    <p className="font-display text-2xl font-bold tabular-nums">
                      {Math.round((event.previousScore ?? event.newScore) * 10) / 10} → {event.newScore}
                    </p>
                    {event.delta !== 0 && <Pill tone={event.delta > 0 ? "success" : "warn"}>{event.delta > 0 ? "+" : ""}{event.delta}</Pill>}
                    <p className="mt-1.5 line-clamp-3 text-xs text-muted">{event.reason}</p>
                  </div>
                </Card>
              )}

              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 font-display text-lg font-bold"><Icon name="trend" className="h-5 w-5 text-accent" />Coach analysis</p>
                  <Pill tone="accent">{labelStatus(ch.reflection!.completionStatus)}</Pill>
                </div>
                {feedback && <p className="text-[15px] leading-relaxed">{feedback}</p>}
                <List title="Went well" items={report?.wentWell ?? []} good />
                <List title="To improve" items={report?.toImprove ?? asStrings(analysis.painPoints)} />
                {analysis.nextFocus && (
                  <div className="flex gap-3 rounded-[20px] bg-accent-soft p-4">
                    <Icon name="target" className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <div>
                      <p className="text-xs font-semibold text-accent">Next focus</p>
                      <p className="mt-0.5 text-[15px] font-medium">{analysis.nextFocus}</p>
                    </div>
                  </div>
                )}
                {analysis.modelVersion === "heuristic" && <p className="text-xs text-muted">Basic analysis — the AI coach was unavailable when you sent this.</p>}
              </Card>

              {next ? (
                <ButtonLink href={next.status === "proposed" && next.conversationId ? `/coach/${next.conversationId}` : `/challenge/${next.id}`}>Go to your next task</ButtonLink>
              ) : (
                <ActionForm action={nextChallengeAction}>
                  <input type="hidden" name="challengeId" value={ch.id} />
                  <SubmitButton pendingText="Designing your next task…"><Icon name="target" /> Get my next task</SubmitButton>
                </ActionForm>
              )}
            </>
          )}

          <More label="The task">
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
            <p className="font-display text-lg font-bold">Task set aside</p>
            <p className="mt-1 text-sm text-muted">It doesn&apos;t count against you.</p>
          </Card>
          <Card><ChallengeBody c={view} /></Card>
          <ButtonLink href={`/skills/${ch.skillId}`}>Back to {ch.skill.name}</ButtonLink>
        </>
      )}

      {ch.status === "discarded" && <Notice>This task was replaced by another one.</Notice>}
    </AppShell>
  );
}

function List({ title, items, good }: { title: string; items: string[]; good?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={`text-sm font-semibold ${good ? "text-success" : "text-warn"}`}>{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${good ? "bg-success/15 text-success" : "bg-sun-soft text-sun-ink"}`}>
              <Icon name={good ? "check" : "trend"} className="h-3 w-3" strokeWidth={2.6} />
            </span>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
