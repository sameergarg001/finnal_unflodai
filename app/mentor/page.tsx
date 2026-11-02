import Link from "next/link";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { getMentorMessages } from "@/server/services/mentor";
import { teacherOf } from "@/server/services/skills";
import { AppShell } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { MentorChat } from "@/components/MentorChat";
import { Card, SectionTitle, TeacherAvatar } from "@/components/ui";
import { startCoachAction } from "../actions";

export const dynamic = "force-dynamic";

const PHASE: Record<string, string> = {
  intake: "Getting to know you",
  understanding: "Talking",
  proposed: "Task to decide",
  active: "⏳ Task waiting",
  feedback: "Analysing your feedback",
  reviewed: "Ready for next task",
};

/** Coach hub: all coaching sessions in one place + a general "ask anything" chat. */
export default async function CoachTabPage() {
  const user = await requireReadyUser();
  const [convs, skills, messages] = await Promise.all([
    db.conversation.findMany({
      where: { userId: user.id },
      include: { skill: true, messages: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    db.userSkill.findMany({ where: { userId: user.id, isActive: true }, include: { skill: true }, orderBy: { skill: { sortOrder: "asc" } } }),
    getMentorMessages(user.id, null),
  ]);
  // Latest session per skill, only if the user actually talked in it.
  const seen = new Set<string>();
  const sessions = convs.filter((c) => {
    if (seen.has(c.skillId) || c._count.messages <= 1) return false;
    seen.add(c.skillId);
    return true;
  });

  return (
    <AppShell title="Coach">
      <SectionTitle>Your coaching sessions</SectionTitle>
      {sessions.length > 0 ? (
        <Card className="divide-y divide-line !py-1">
          {sessions.map((c) => (
            <Link key={c.id} href={`/coach/${c.id}`} className="flex items-center gap-3 py-3.5">
              <TeacherAvatar emoji={teacherOf(c.skill).emoji} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{teacherOf(c.skill).name} <span className="font-normal text-muted">· {c.skill.name}</span></p>
                  <span className="shrink-0 text-[11px] text-muted">{PHASE[c.phase] ?? c.phase}</span>
                </div>
                <p className="truncate text-sm text-muted">{c.messages[0]?.content ?? "Start talking"}</p>
              </div>
            </Link>
          ))}
        </Card>
      ) : (
        <p className="px-1 text-sm text-muted">No sessions yet. Pick a skill to start — your coach asks 2–3 quick questions, then gives you a challenge.</p>
      )}

      <SectionTitle>Your teachers</SectionTitle>
      <p className="-mt-1 px-1 text-sm text-muted">Every skill has its own expert. Tap one to start.</p>
      <div className="grid grid-cols-2 gap-3">
        {skills.map(({ skill }) => {
          const t = teacherOf(skill);
          return (
            <ActionForm key={skill.id} action={startCoachAction}>
              <input type="hidden" name="skillId" value={skill.id} />
              <button className="flex w-full flex-col items-center rounded-3xl border border-line bg-card p-4 text-center transition active:scale-[0.97]">
                <TeacherAvatar emoji={t.emoji} size={52} />
                <span className="mt-2 font-bold">{t.name}</span>
                <span className="text-xs text-muted">{skill.name}</span>
              </button>
            </ActionForm>
          );
        })}
      </div>
      <p className="px-1 text-center text-xs text-muted">Want another teacher? <Link href="/skills/add" className="font-semibold text-accent">Add a skill</Link></p>

      <SectionTitle>Ask anything</SectionTitle>
      <p className="-mt-1 px-1 text-sm text-muted">Quick questions about any situation — your coach knows your skills and challenges.</p>
      <MentorChat messages={messages} placeholder="Ask your coach anything…" />
    </AppShell>
  );
}
