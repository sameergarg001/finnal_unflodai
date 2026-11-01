import { notFound } from "next/navigation";
import { requireReadyUser } from "@/server/auth/session";
import { getConversationForUser } from "@/server/services/challenges";
import { toChallengeView } from "@/server/views";
import { AppShell } from "@/components/AppShell";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CoachChat } from "@/components/CoachChat";

export const dynamic = "force-dynamic";

const PLACEHOLDER: Record<string, string> = {
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

  const challenges = Object.fromEntries(conv.challenges.map((c) => [c.id, toChallengeView(c, conv.skill)]));
  const chat = (
    <CoachChat
      conversationId={conv.id}
      phase={conv.phase}
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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-white">U</div>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{conv.skill.name} coach</p>
            <p className="text-[11px] text-success">● knows your history</p>
          </div>
        </div>
      }
    >
      {conv.phase === "feedback" ? <AutoRefresh>{chat}</AutoRefresh> : chat}
    </AppShell>
  );
}
