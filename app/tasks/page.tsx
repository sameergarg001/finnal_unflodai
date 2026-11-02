import Link from "next/link";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { labelStatus } from "@/server/services/challenges";
import { teacherOf } from "@/server/services/skills";
import { AppShell } from "@/components/AppShell";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Card, DIFFICULTY_NAMES, EmptyState, Pill, SectionTitle, TeacherAvatar, btnPrimary, btnSecondary } from "@/components/ui";

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
          <SectionTitle>⏳ Waiting for you · {active.length}</SectionTitle>
          {active.map((ch) => {
            const t = teacherOf(ch.skill);
            return (
              <Card key={ch.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <TeacherAvatar emoji={t.emoji} size={40} />
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{ch.skill.name} · with {t.name} · taken {daysAgo(ch.acceptedAt ?? ch.assignedAt)}</p>
                    <Link href={`/challenge/${ch.id}`} className="block font-bold leading-snug">{ch.title}</Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pill>{DIFFICULTY_NAMES[ch.difficulty]}</Pill>
                  <Pill>~{ch.estimatedMinutes} min</Pill>
                </div>
                <div className="grid grid-cols-[2fr_1fr] gap-2">
                  <Link href={`/challenge/${ch.id}?feedback=1`} className={btnPrimary}>✓ I tried it</Link>
                  <Link href={`/challenge/${ch.id}`} className={btnSecondary}>Open</Link>
                </div>
              </Card>
            );
          })}
        </>
      )}

      {proposed.length > 0 && (
        <>
          <SectionTitle>🤔 To decide · {proposed.length}</SectionTitle>
          <Card className="divide-y divide-line !py-1">
            {proposed.map((ch) => {
              const t = teacherOf(ch.skill);
              return (
                <Link key={ch.id} href={`/coach/${ch.conversationId}`} className="flex items-center gap-3 py-3.5">
                  <TeacherAvatar emoji={t.emoji} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{ch.title}</p>
                    <p className="text-xs text-muted">{t.name} suggested this · take it, change it or ask for another</p>
                  </div>
                  <span className="text-muted">›</span>
                </Link>
              );
            })}
          </Card>
        </>
      )}

      {talking.length > 0 && (
        <>
          <SectionTitle>💬 In conversation · {talking.length}</SectionTitle>
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
                  <span className="text-muted">›</span>
                </Link>
              );
            })}
          </Card>
        </>
      )}

      {analysing.length > 0 && (
        <>
          <SectionTitle>🔍 Being analysed</SectionTitle>
          <Card className="divide-y divide-line !py-1">
            {analysing.map((ch) => (
              <Link key={ch.id} href={`/challenge/${ch.id}`} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{ch.title}</p>
                  <p className="animate-pulse text-xs text-muted">{teacherOf(ch.skill).name} is reading your feedback…</p>
                </div>
                <span className="text-muted">›</span>
              </Link>
            ))}
          </Card>
        </>
      )}

      {nothing && (
        <EmptyState
          icon="✅"
          title="No ongoing tasks"
          body="Pick a skill on Home, tell its teacher what's going on, and you'll get today's task."
          action={<Link href="/dashboard" className="font-semibold text-accent">Go to Home →</Link>}
        />
      )}

      {recent.length > 0 && (
        <>
          <SectionTitle>Recently finished</SectionTitle>
          <Card className="divide-y divide-line !py-1">
            {recent.map((ch) => (
              <Link key={ch.id} href={`/challenge/${ch.id}`} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{ch.title}</p>
                  <p className="text-xs text-muted">
                    {ch.skill.name} · {ch.reflection ? labelStatus(ch.reflection.completionStatus) : "Set aside"}
                    {ch.completedAt ? ` · ${daysAgo(ch.completedAt)}` : ""}
                  </p>
                </div>
                <span className="text-muted">›</span>
              </Link>
            ))}
          </Card>
        </>
      )}
    </>
  );

  return <AppShell title="Tasks">{analysing.length ? <AutoRefresh everyMs={5000}>{content}</AutoRefresh> : content}</AppShell>;
}
