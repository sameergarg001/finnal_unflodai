import { notFound } from "next/navigation";
import { requireReadyUser } from "@/server/auth/session";
import { getConversationForUser, quickRepliesFor } from "@/server/services/challenges";
import { toChallengeView } from "@/server/views";
import { teacherOf } from "@/server/services/skills";
import { Icon, TeacherAvatar, iconBtn } from "@/components/ui";
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
        <div className="flex h-16 items-center gap-3 px-4">
          <a href={`/skills/${conv.skillId}`} aria-label="Back" className={iconBtn}>
            <Icon name="back" />
          </a>
          <div className="glass flex min-w-0 flex-1 items-center gap-3 rounded-full py-1 pl-1 pr-4">
            <span className="relative">
              <TeacherAvatar emoji={teacher.emoji} size={40} />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success ring-2 ring-card-solid" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display font-bold leading-tight">{teacher.name}</p>
              <p className="truncate text-xs text-muted">{teacher.title}</p>
            </div>
          </div>
        </div>
      }
    >
      {conv.phase === "feedback" ? <AutoRefresh>{chat}</AutoRefresh> : chat}
    </AppShell>
  );
}
