import { notFound } from "next/navigation";
import { requireReadyUser } from "@/server/auth/session";
import { getConversationForUser, quickRepliesFor } from "@/server/services/challenges";
import { toChallengeView } from "@/server/views";
import { teacherOf } from "@/server/services/skills";
import { TeacherAvatar } from "@/components/ui";
import { AppShell } from "@/components/AppShell";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CoachChat } from "@/components/CoachChat";

export const dynamic = "force-dynamic";

const PLACEHOLDER: Record<string, string> = {
  intake: "Type your answer…",
  understanding: "Type your answer…",
  proposed: "Tell me more about your situation…",
  active: "Stuck? Ask your coach for help…",
  feedback: "Your coach is reading your feedback…",
  reviewed: "Tell your coach what's next…",
};

export default async function CoachPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireReadyUser();
  const { id } = await params;
  const conv = await getConversationForUser(user.id, id);
  if (!conv) notFound();

  const teacher = teacherOf(conv.skill);
  const challenges = Object.fromEntries(conv.challenges.map((c) => [c.id, toChallengeView(c, conv.skill)]));
  const chat = (
    <CoachChat
      conversationId={conv.id}
      phase={conv.phase}
      activeChallengeId={conv.challenges.find((c) => c.status === "active")?.id ?? null}
      quick={quickRepliesFor(conv)}
      placeholder={PLACEHOLDER[conv.phase] ?? "Message your coach…"}
      challenges={challenges}
      messages={conv.messages.map((m) => ({ id: m.id, role: m.role, kind: m.kind, content: m.content, challengeId: m.challengeId }))}
    />
  );
  return (
    <AppShell
      tabs={false}
      header={
        <div className="flex h-14 items-center gap-3 px-4">
          <a href={`/skills/${conv.skillId}`} aria-label="Back" className="-ml-2 rounded-full p-2 text-muted active:bg-card-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </a>
          <TeacherAvatar emoji={teacher.emoji} size={38} />
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{teacher.name}</p>
            <p className="truncate text-[11px] text-muted"><span className="text-success">●</span> {teacher.title} · knows your history</p>
          </div>
        </div>
      }
    >
      {conv.phase === "feedback" ? <AutoRefresh>{chat}</AutoRefresh> : chat}
    </AppShell>
  );
}
