import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { frameworkOf, getSkillForUser, teacherOf } from "@/server/services/skills";
import { getSkillHistory } from "@/server/services/progress";
import { labelStatus, type StoredPlan } from "@/server/services/challenges";
import { AppShell, More } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { SelfScoreSlider } from "@/components/SelfScoreSlider";
import { Card, DIFFICULTY_NAMES, EmptyState, Notice, Pill, ProgressBar, SERIES, SectionTitle, Sparkline, TeacherAvatar, btnSecondary, input } from "@/components/ui";
import { redoInterviewAction, removeSkillAction, startCoachAction, updateSelfScoreAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function SkillPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const user = await requireReadyUser();
  const { id } = await params;
  const { added } = await searchParams;
  const skill = await getSkillForUser(user.id, id);
  if (!skill) notFound();

  const [us, sc, history, openConv] = await Promise.all([
    db.userSkill.findUnique({ where: { userId_skillId: { userId: user.id, skillId: id } } }),
    db.skillScore.findUnique({ where: { userId_skillId: { userId: user.id, skillId: id } } }),
    getSkillHistory(user.id, id),
    db.conversation.findFirst({ where: { userId: user.id, skillId: id, status: "open", phase: { in: ["intake", "understanding", "proposed"] } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const fw = frameworkOf(skill);
  const teacher = teacherOf(skill);
  const active = history.challenges.find((c) => c.status === "active");
  const assessed = (sc?.evidenceCount ?? 0) > 0;
  const trendEvents = history.events.filter((e) => e.source === "challenge").reverse();
  const trend = trendEvents.length ? [trendEvents[0].previousScore ?? trendEvents[0].newScore, ...trendEvents.map((e) => e.newScore)] : [];
  const doneBySub = new Map<string, number>();
  for (const c of history.challenges) {
    if (c.subskill && c.reflection && ["completed", "partial"].includes(c.reflection.completionStatus)) doneBySub.set(c.subskill, (doneBySub.get(c.subskill) ?? 0) + 1);
  }
  const past = history.challenges.filter((c) => c.status !== "active");
  const plan = (us?.plan ?? null) as StoredPlan | null;
  const startLabel = plan?.startSubskill ? fw.subskills.find((x) => x.key === plan.startSubskill)?.label : null;

  return (
    <AppShell title={skill.name} back="/dashboard">
      {added && <Notice tone="success">✓ {skill.name} added to your dashboard</Notice>}
      {!us?.isActive && <Notice>This skill isn&apos;t on your dashboard. Add it again from “Add skill” to start a session.</Notice>}

      <div className="flex items-center gap-3.5 rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/15 to-card p-4">
        <TeacherAvatar emoji={teacher.emoji} size={52} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Your teacher</p>
          <p className="font-bold">{teacher.name} <span className="font-normal text-muted">· {teacher.title}</span></p>
          <p className="text-sm text-muted">{teacher.tagline}</p>
        </div>
      </div>

      <Card>
        <p className="text-sm leading-relaxed text-muted">{skill.description}</p>
        <div className="mt-5 space-y-4">
          <ScoreRow label="UnfoldAI assessment" sub={assessed ? `based on ${sc!.evidenceCount} task${sc!.evidenceCount === 1 ? "" : "s"}` : "not assessed yet — complete a task"} value={assessed ? sc!.score : null} color={SERIES.evidence} />
          <ScoreRow label="Your self-assessment" sub="your own rating, not verified" value={sc?.selfScore ?? null} color={SERIES.self} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="text-muted">Trend</span>
          <Sparkline values={trend} width={140} height={32} />
        </div>
      </Card>

      {plan && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-2">📋 Your plan</p>
            {plan.targetDate && <Pill tone="accent">by {new Date(plan.targetDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</Pill>}
          </div>
          <PlanRow label="Goal">{plan.goal}</PlanRow>
          <PlanRow label="Where you are now">{plan.currentLevel}</PlanRow>
          <PlanRow label="Timeline">{plan.timeline}</PlanRow>
          <PlanRow label="Starting with">{startLabel ? `${startLabel} — ` : ""}{plan.firstFocus}</PlanRow>
        </Card>
      )}

      {active ? (
        <Link href={`/challenge/${active.id}`} className="block rounded-3xl border border-accent-2/30 bg-accent-2/10 p-5 active:scale-[0.99]">
          <p className="text-xs font-semibold text-accent-2">⏳ Your task is waiting for you</p>
          <p className="mt-1 text-lg font-bold">{active.title}</p>
          <p className="mt-1 text-sm text-muted">Tap to see it, ask for help, or tell your coach how it went.</p>
        </Link>
      ) : (
        <div className="space-y-3">
          <ActionForm action={startCoachAction}>
            <input type="hidden" name="skillId" value={skill.id} />
            {!openConv && <input type="hidden" name="fresh" value="1" />}
            <SubmitButton pendingText={`Opening ${teacher.name}…`}>✨ {openConv ? `Continue with ${teacher.name}` : `Start improving with ${teacher.name}`}</SubmitButton>
          </ActionForm>
          <Link href={`/skills/${skill.id}/history`} className={btnSecondary}>↺ Revise previous progress</Link>
        </div>
      )}

      <ActionForm action={startCoachAction} className="rounded-3xl border border-line bg-card p-3">
        <input type="hidden" name="skillId" value={skill.id} />
        <div className="flex gap-2">
          <textarea name="message" rows={1} required maxLength={1500} placeholder={`Message ${teacher.name}…`} className={`${input} !mt-0 min-h-12 flex-1 resize-none !border-0 !bg-transparent`} />
          <SubmitButton className="!min-h-12 !w-12 !rounded-full !p-0" pendingText="">➤</SubmitButton>
        </div>
      </ActionForm>

      <SectionTitle>Subskills</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {fw.subskills.map((s) => (
          <span key={s.key} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm">
            {s.label}
            {doneBySub.get(s.key) ? <span className="ml-1.5 text-success">✓{doneBySub.get(s.key)}</span> : null}
          </span>
        ))}
      </div>

      {history.weaknesses.length > 0 && (
        <>
          <SectionTitle>What we&apos;re working on</SectionTitle>
          <Card>
            <ul className="space-y-2 text-sm">
              {history.weaknesses.slice(0, 4).map((w) => <li key={w.text} className="flex gap-2"><span className="text-warn">•</span>{w.text}</li>)}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle action={past.length > 0 && <Link href={`/skills/${skill.id}/history`} className="text-sm font-medium text-accent">See all</Link>}>Previous activity</SectionTitle>
      {past.length ? (
        <Card className="divide-y divide-line !py-1">
          {past.slice(0, 3).map((c) => (
            <Link key={c.id} href={`/challenge/${c.id}`} className="flex items-center justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.title}</p>
                <p className="text-xs text-muted">{c.reflection ? labelStatus(c.reflection.completionStatus) : c.status} · {DIFFICULTY_NAMES[c.difficulty]}</p>
              </div>
              <span className="text-muted">›</span>
            </Link>
          ))}
        </Card>
      ) : (
        <EmptyState icon="🎯" title="No tasks yet" body={`Start improving and ${teacher.name} will design your first task around your real situation.`} />
      )}

      {plan && !active && (
        <More label="Goals changed? Redo the interview">
          <p className="mb-3 text-sm text-muted">{teacher.name} will ask the 3 questions again and make a new plan. Your history is kept.</p>
          <ActionForm action={redoInterviewAction}>
            <input type="hidden" name="skillId" value={skill.id} />
            <SubmitButton variant="secondary" pendingText="Opening…">Redo interview</SubmitButton>
          </ActionForm>
        </More>
      )}

      <More label="Update my self-assessment">
        <ActionForm action={updateSelfScoreAction} className="space-y-3">
          <input type="hidden" name="skillId" value={skill.id} />
          <SelfScoreSlider initial={sc?.selfScore ?? 50} />
          <p className="text-xs text-muted">Your self-rating is shown next to UnfoldAI&apos;s assessment. Once there is evidence from tasks, changing it won&apos;t change UnfoldAI&apos;s score.</p>
          <SubmitButton variant="secondary">Save self-assessment</SubmitButton>
        </ActionForm>
      </More>

      {skill.category !== "core" && us?.isActive && (
        <form action={removeSkillAction} className="pt-2 text-center">
          <input type="hidden" name="skillId" value={skill.id} />
          <button className="text-sm text-muted underline">Remove from dashboard (history is kept)</button>
        </form>
      )}
      {fw.progression && <p className="px-1 text-xs leading-relaxed text-muted">How this skill progresses: {fw.progression}</p>}
    </AppShell>
  );
}

function PlanRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-[15px]">{children}</p>
    </div>
  );
}

function ScoreRow({ label, sub, value, color }: { label: string; sub: string; value: number | null; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</p>
          <p className="text-[11px] text-muted">{sub}</p>
        </div>
        <p className="text-xl font-bold tabular-nums">{value == null ? "—" : Math.round(value)}<span className="text-xs text-muted">/100</span></p>
      </div>
      <ProgressBar value={value ?? 0} color={color} label={label} />
    </div>
  );
}
