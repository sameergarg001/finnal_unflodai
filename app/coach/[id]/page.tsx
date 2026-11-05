import { notFound } from "next/navigation";
import { requireReadyUser } from "@/server/auth/session";
import { getConversationForUser, quickRepliesFor } from "@/server/services/challenges";
import { toChallengeView } from "@/server/views";
import { teacherOf } from "@/server/services/skills";
import { Icon, TeacherAvatar, iconBtn } from "@/components/ui";
import { db } from "@/lib/db";
import { getInsights } from "@/server/intelligence/evidence";
import { stageForScore } from "@/server/intelligence/stages";
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
  const [insights, sc] = await Promise.all([
    getInsights(user.id, conv.skillId),
    db.skillScore.findUnique({ where: { userId_skillId: { userId: user.id, skillId: conv.skillId } } }),
  ]);
  const cc = (conv.context ?? {}) as { goal?: string | null; situation?: { summary?: string } | null };
  const focus = insights.find((i) => i.kind === "blocker");
  const score = sc ? (sc.evidenceCount > 0 ? sc.score : (sc.selfScore ?? sc.score)) : null;
  const understood = [
    cc.goal ? { icon: "target" as const, label: "Goal", text: cc.goal } : null,
    cc.situation?.summary ? { icon: "flag" as const, label: "Situation", text: cc.situation.summary } : null,
    focus ? { icon: "trend" as const, label: focus.status === "confirmed" ? "Working on" : "Noticing", text: focus.text } : null,
    score != null ? { icon: "spark" as const, label: "Stage", text: `${stageForScore(score).name} · ${Math.round(score)}` } : null,
  ].filter(Boolean) as { icon: "target" | "flag" | "trend" | "spark"; label: string; text: string }[];
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
      {understood.length > 0 && (
        <details className="glass group rounded-[22px]" open={understood.length >= 3 ? undefined : true}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-muted [&::-webkit-details-marker]:hidden">
            <Icon name="spark" className="h-4 w-4 text-accent" />
            What {teacher.name} understands
            <Icon name="chevron" className="ml-auto h-4 w-4 transition group-open:rotate-90" />
          </summary>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
            {understood.map((u) => (
              <div key={u.label} className="min-w-[9.5rem] max-w-[13rem] shrink-0 rounded-2xl bg-card-2/60 px-3 py-2">
                <p className="flex items-center gap-1 text-[11px] text-muted"><Icon name={u.icon} className="h-3 w-3" />{u.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">{u.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}
      {conv.phase === "feedback" ? <AutoRefresh>{chat}</AutoRefresh> : chat}
    </AppShell>
  );
}
