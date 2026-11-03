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
import { Card, DifficultyDots, Icon, Notice, Pill, SERIES, ScoreRing, SectionTitle, Sparkline, TeacherAvatar, type IconName } from "@/components/ui";
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

  const doneTotal = [...doneBySub.values()].reduce((a, b) => a + b, 0);
  const firstOpen = fw.subskills.findIndex((x) => !doneBySub.get(x.key));
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <AppShell title={skill.name} back="/dashboard">
      {added && <Notice tone="success">✓ {skill.name} added to your dashboard</Notice>}
      {!us?.isActive && <Notice>This skill isn&apos;t on your dashboard. Add it again from “Add skill” to start a session.</Notice>}

      {/* Hero: score ring + teacher */}
      <Card className="!p-6">
        <div className="flex items-center gap-5">
          <ScoreRing value={assessed ? sc!.score : (sc?.selfScore ?? null)} marker={assessed ? (sc?.selfScore ?? null) : null} size={124} stroke={12} caption={assessed ? "UnfoldAI" : "self-rated"} color={assessed ? "var(--accent)" : "var(--series-self)"} />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Legend color={SERIES.evidence} label="UnfoldAI" value={assessed ? sc!.score : null} />
            <Legend color={SERIES.self} label="You" value={sc?.selfScore ?? null} />
            <div className="pt-1"><Sparkline values={trend} width={120} height={28} /></div>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-full bg-card-2/60 py-1.5 pl-1.5 pr-4">
          <TeacherAvatar emoji={teacher.emoji} size={40} />
          <p className="min-w-0 flex-1 truncate text-sm"><b className="font-semibold">{teacher.name}</b> <span className="text-muted">· {teacher.title}</span></p>
        </div>
      </Card>

      {active ? (
        <Link href={`/challenge/${active.id}`} className="flex items-center gap-4 rounded-[28px] bg-sun-soft p-5 shadow-soft active:scale-[0.99]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sun text-[#3a2a00]"><Icon name="clock" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-sun-ink">Task waiting</p>
            <p className="font-display text-lg font-bold leading-snug">{active.title}</p>
          </div>
          <Icon name="chevron" className="h-5 w-5 text-muted" />
        </Link>
      ) : (
        <div className="flex gap-2">
          <ActionForm action={startCoachAction} className="flex-1">
            <input type="hidden" name="skillId" value={skill.id} />
            {!openConv && <input type="hidden" name="fresh" value="1" />}
            <SubmitButton pendingText={`Opening ${teacher.name}…`}><Icon name="spark" /> {openConv ? `Continue with ${teacher.name}` : `Start improving with ${teacher.name}`}</SubmitButton>
          </ActionForm>
          {past.length > 0 && (
            <Link href={`/skills/${skill.id}/history`} aria-label="Revise previous progress" title="Revise previous progress" className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-card-2 active:scale-95">
              <Icon name="refresh" />
            </Link>
          )}
        </div>
      )}

      <ActionForm action={startCoachAction} className="glass flex items-center gap-2 rounded-full py-1.5 pl-5 pr-1.5">
        <input type="hidden" name="skillId" value={skill.id} />
        <textarea name="message" rows={1} required maxLength={1500} placeholder={`Message ${teacher.name}…`} aria-label={`Message ${teacher.name}`} className="min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base placeholder:text-muted focus:outline-none" />
        <SubmitButton className="!h-11 !min-h-0 !w-11 !rounded-full !p-0 !shadow-none" pendingText=""><Icon name="send" /></SubmitButton>
      </ActionForm>

      {plan && (
        <>
          <SectionTitle action={plan.targetDate ? <Pill tone="sun"><Icon name="calendar" className="h-3.5 w-3.5" />{fmtDate(plan.targetDate)}</Pill> : undefined}>Your plan</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            <PlanTile icon="target" label="Goal">{plan.goal}</PlanTile>
            <PlanTile icon="flag" label="Now">{plan.currentLevel}</PlanTile>
            <PlanTile icon="calendar" label="Timeline">{plan.timeline}</PlanTile>
            <PlanTile icon="spark" label="Start with">{startLabel ?? plan.firstFocus}</PlanTile>
          </div>
        </>
      )}

      <SectionTitle action={<span className="text-sm text-muted">{doneTotal} done</span>}>Path</SectionTitle>
      <Card className="!py-4">
        <ol className="relative">
          {fw.subskills.map((s, i) => {
            const n = doneBySub.get(s.key) ?? 0;
            const current = i === firstOpen;
            return (
              <li key={s.key} className="relative flex items-center gap-3.5 py-2">
                {i < fw.subskills.length - 1 && <span className={`absolute left-[15px] top-[calc(50%+16px)] h-[calc(100%-32px)] w-0.5 rounded ${n ? "bg-accent" : "bg-card-2"}`} aria-hidden />}
                <span className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${n ? "bg-accent text-on-accent" : current ? "bg-sun text-[#3a2a00] ring-4 ring-sun/25" : "bg-card-2 text-muted"}`}>
                  {n ? <Icon name="check" className="h-4 w-4" strokeWidth={2.6} /> : i + 1}
                </span>
                <span className={`flex-1 text-[15px] ${n || current ? "font-semibold" : "text-muted"}`}>{s.label}</span>
                {n > 0 && <span className="text-xs font-semibold text-accent">×{n}</span>}
              </li>
            );
          })}
        </ol>
      </Card>

      {history.weaknesses.length > 0 && (
        <>
          <SectionTitle>Working on</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {history.weaknesses.slice(0, 4).map((w) => <span key={w.text} className="rounded-2xl bg-sun-soft px-3.5 py-2 text-sm">{w.text}</span>)}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle action={<Link href={`/skills/${skill.id}/history`} className="text-sm font-semibold text-accent">See all</Link>}>Recent</SectionTitle>
          <Card className="divide-y divide-line !py-1">
            {past.slice(0, 3).map((c) => (
              <Link key={c.id} href={`/challenge/${c.id}`} className="flex items-center gap-3 py-3.5">
                <StatusDot status={c.reflection?.completionStatus ?? c.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-xs text-muted">{c.reflection ? labelStatus(c.reflection.completionStatus) : c.status}</p>
                </div>
                <DifficultyDots value={c.difficulty} />
              </Link>
            ))}
          </Card>
        </>
      )}
      <div className="space-y-2.5 pt-3">
        {plan && !active && (
          <More label="Goals changed? Redo the interview">
            <p className="mb-3 text-sm text-muted">3 questions again, new plan. History stays.</p>
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
            <p className="text-xs text-muted">Only your own rating changes. UnfoldAI&apos;s score moves with task evidence.</p>
            <SubmitButton variant="secondary">Save self-assessment</SubmitButton>
          </ActionForm>
        </More>

        {(skill.description || fw.progression) && (
          <More label={`About ${skill.name}`}>
            <p className="text-sm leading-relaxed text-muted">{skill.description}</p>
            {fw.progression && <p className="mt-2 text-sm leading-relaxed text-muted">{fw.progression}</p>}
          </More>
        )}
      </div>

      {skill.category !== "core" && us?.isActive && (
        <form action={removeSkillAction} className="pt-2 text-center">
          <input type="hidden" name="skillId" value={skill.id} />
          <button className="text-sm text-muted underline">Remove from dashboard (history is kept)</button>
        </form>
      )}
    </AppShell>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-sm text-muted">{label}</span>
      <span className="font-display text-lg font-bold tabular-nums">{value == null ? "—" : Math.round(value)}</span>
    </div>
  );
}

function PlanTile({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-[22px] p-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon name={icon} className="h-4 w-4" /></span>
      <p className="mt-2.5 text-xs text-muted">{label}</p>
      <p className="mt-0.5 line-clamp-3 text-sm font-medium leading-snug">{children}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone = status === "completed" ? "bg-accent text-on-accent" : status === "partial" ? "bg-sun text-[#3a2a00]" : "bg-card-2 text-muted";
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
      <Icon name={status === "completed" || status === "partial" ? "check" : "refresh"} className="h-4 w-4" />
    </span>
  );
}
