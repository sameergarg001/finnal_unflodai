import { requireReadyUser } from "@/server/auth/session";
import { getMentorMessages } from "@/server/services/mentor";
import { AppShell } from "@/components/AppShell";
import { MentorChat } from "@/components/MentorChat";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";

/** "Ask anything": a general chat with the coach (reached from Home). */
export default async function AskAnythingPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireReadyUser();
  const { q } = await searchParams;
  const messages = await getMentorMessages(user.id, null);
  const draft = (q ?? "").trim().slice(0, 1000);

  return (
    <AppShell title="Ask anything" back="/dashboard">
      {messages.length === 0 && (
        <div className="px-2 pb-4 pt-10 text-center">
          <div className="flex justify-center"><Logo size={64} /></div>
          <p className="mt-4 font-display text-2xl font-bold">What&apos;s on your mind?</p>
          <p className="mx-auto mt-1 max-w-[16rem] text-sm text-muted">I know your skills and your tasks.</p>
        </div>
      )}
      <MentorChat messages={messages} placeholder="Ask your coach anything…" draft={draft} />
    </AppShell>
  );
}
