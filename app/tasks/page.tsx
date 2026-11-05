import Link from "next/link";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { labelStatus } from "@/server/services/challenges";
import { teacherOf } from "@/server/services/skills";
import { AppShell } from "@/components/AppShell";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Card, DifficultyDots, EmptyState, Icon, SectionTitle, TeacherAvatar, btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";

const daysAgo = (d: Date) => {
  const n = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
};

/** All ongoing tasks in one place. */
export default async function TasksPage() {
  const user = await requireReadyUser();
  const [active, proposed, analysing] = await Promise.all([
    db.challenge.findMany({ where: { userId: user.id, status: "active" }, include: { skill: true }, orderBy: { acceptedAt: "desc" } }),
    db.challenge.findMany({
      where: { userId: user.id, status: "proposed", conversation: { status: "open" } },
      include: { skill: true },
      orderBy: { assignedAt: "desc" },
    }),
    db.challenge.findMany({ where: { userId: user.id, status: "done", reflection: { analysis: null } }, include: { skill: true } }),
  ]);
  const recent = await db.challenge.findMany({
    where: { userId: user.id, OR: [{ status: "abandoned" }, { status: "done", reflection: { analysis: { isNot: null } } }] },
    include: { skill: true, reflection: true },
    orderBy: { completedAt: "desc" },
    take: 10,
  });
  // Conversations still in progress (interview / talking) that have no task on the table yet.
  const talking = (
    await db.conversation.findMany({
      where: { userId: user.id, status: "open", phase: { in: ["intake", "understanding"] }, messages: { some: { role: "user" } } },
      include: { skill: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    })
  ).filter((c) => !active.some((a) => a.skillId === c.skillId));
  const nothing = !active.length && !proposed.length && !analysing.length && !talking.length;

  const content = (
    <>
      {active.length > 0 && (
        <>
          <SectionTitle action={<Count n={active.length} sun />}>Waiting for you</SectionTitle>
          {active.map((ch) => {
            const t = teacherOf(ch.skill);
            return (
              <Card key={ch.id} className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <TeacherAvatar emoji={t.emoji} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">{ch.skill.name} · {daysAgo(ch.acceptedAt ?? ch.assignedAt)}</p>
                    <Link href={`/challenge/${ch.id}`} className="mt-0.5 block font-display text-lg font-bold leading-snug">{ch.title}</Link>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1"><Icon name="clock" className="h-3.5 w-3.5" />{ch.estimatedMinutes} min</span>
                      <DifficultyDots value={ch.difficulty} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/challenge/${ch.id}?feedback=1`} className={`${btnPrimary} flex-1`}><Icon name="check" /> I tried it</Link>
                  <Link href={`/challenge/${ch.id}`} aria-label="Open task" className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-card-2 active:scale-95"><Icon name="chevron" /></Link>
                </div>
              </Card>
            );
          })}
        </>
      )}

      {proposed.length > 0 && (
        <>
          <SectionTitle action={<Count n={proposed.length} />}>To decide</SectionTitle>
          <Card className="divide-y divide-line !py-1">
            {proposed.map((ch) => {
              const t = teacherOf(ch.skill);
              return (
                <Link key={ch.id} href={`/coach/${ch.conversationId}`} className="flex items-center gap-3 py-3.5">
                  <TeacherAvatar emoji={t.emoji} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{ch.title}</p>
                    <p className="text-xs text-muted">Suggested by {t.name}</p>
                  </div>
                  <Icon name="chevron" className="h-4 w-4 text-muted" />
                </Link>
              );
            })}
          </Card>
        </>
      )}

      {talking.length > 0 && (
        <>
          <SectionTitle action={<Count n={talking.length} />}>In conversation</SectionTitle>
          <Card className="divide-y divide-line !py-1">
            {talking.map((c) => {
              const t = teacherOf(c.skill);
              return (
                <Link key={c.id} href={`/coach/${c.id}`} className="flex items-center gap-3 py-3.5">
                  <TeacherAvatar emoji={t.emoji} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Continue with {t.name} <span className="font-normal text-muted">· {c.skill.name}</span></p>
                    <p className="truncate text-xs text-muted">{c.messages[0]?.content}</p>
                  </div>
                  <Icon name="chevron" className="h-4 w-4 text-muted" />
                </Link>
              );
            })}
          </Card>
        </>
      )}

      {analysing.length > 0 && (
        <>
          <SectionTitle>Being analysed</SectionTitle>
          <Card className="divide-y divide-line !py-1">
            {analysing.map((ch) => (
              <Link key={ch.id} href={`/challenge/${ch.id}`} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{ch.title}</p>
                  <p className="animate-pulse text-xs text-muted">{teacherOf(ch.skill).name} is reading your feedback…</p>
                </div>
                <Icon name="chevron" className="h-4 w-4 text-muted" />
              </Link>
            ))}
          </Card>
        </>
      )}

      {nothing && (
        <EmptyState
          icon="🌿"
          title="All clear"
          body="Pick a skill on Home to get today's task."
          action={<Link href="/dashboard" className={`${btnPrimary} !w-auto`}>Go to Home</Link>}
        />
      )}

      {recent.length > 0 && (
        <>
          <SectionTitle>Recently finished</SectionTitle>
          <Card className="divide-y divide-line !py-1">
            {recent.map((ch) => (
              <Link key={ch.id} href={`/challenge/${ch.id}`} className="flex items-center gap-3 py-3.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ch.reflection && ["completed", "partial"].includes(ch.reflection.completionStatus) ? "bg-accent-soft text-accent" : "bg-card-2 text-muted"}`}>
                  <Icon name={ch.reflection && ["completed", "partial"].includes(ch.reflection.completionStatus) ? "check" : "refresh"} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{ch.title}</p>
                  <p className="text-xs text-muted">
                    {ch.skill.name} · {ch.reflection ? labelStatus(ch.reflection.completionStatus) : "Set aside"}
                    {ch.completedAt ? ` · ${daysAgo(ch.completedAt)}` : ""}
                  </p>
                </div>
                <Icon name="chevron" className="h-4 w-4 text-muted" />
              </Link>
            ))}
          </Card>
        </>
      )}
    </>
  );

  return <AppShell title="Tasks">{analysing.length ? <AutoRefresh everyMs={5000}>{content}</AutoRefresh> : content}</AppShell>;
}

function Count({ n, sun }: { n: number; sun?: boolean }) {
  return <span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold ${sun ? "bg-sun text-on-sun" : "bg-card-2 text-muted"}`}>{n}</span>;
}
