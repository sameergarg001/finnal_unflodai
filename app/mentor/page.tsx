import Link from "next/link";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { getMentorMessages } from "@/server/services/mentor";
import { AppShell } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { MentorChat } from "@/components/MentorChat";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, SectionTitle } from "@/components/ui";
import { startCoachAction } from "../actions";

export const dynamic = "force-dynamic";

const PHASE: Record<string, string> = {
  understanding: "Talking",
  proposed: "Challenge to decide",
  active: "⏳ Challenge waiting",
  feedback: "Analysing your feedback",
  reviewed: "Ready for next challenge",
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 font-bold text-white">{c.skill.name[0]}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{c.skill.name}</p>
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

      <SectionTitle>Start with a skill</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {skills.map(({ skill }) => (
          <ActionForm key={skill.id} action={startCoachAction}>
            <input type="hidden" name="skillId" value={skill.id} />
            <SubmitButton variant="secondary" pendingText="…" className="!min-h-10 !w-auto !rounded-full !px-4 !py-2 !text-sm">{skill.name}</SubmitButton>
          </ActionForm>
        ))}
      </div>

      <SectionTitle>Ask anything</SectionTitle>
      <p className="-mt-1 px-1 text-sm text-muted">Quick questions about any situation — your coach knows your skills and challenges.</p>
      <MentorChat messages={messages} placeholder="Ask your coach anything…" />
    </AppShell>
  );
}
