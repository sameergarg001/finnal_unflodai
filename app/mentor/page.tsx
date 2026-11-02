import { requireReadyUser } from "@/server/auth/session";
import { getMentorMessages } from "@/server/services/mentor";
import { AppShell } from "@/components/AppShell";
import { MentorChat } from "@/components/MentorChat";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";

/** "Ask anything": a general chat with the coach (reached from Home). */
export default async function AskAnythingPage() {
  const user = await requireReadyUser();
  const messages = await getMentorMessages(user.id, null);

  return (
    <AppShell title="Ask anything" back="/dashboard">
      {messages.length === 0 && (
        <div className="px-2 pb-2 pt-8 text-center">
          <div className="flex justify-center"><Logo size={56} /></div>
          <p className="mt-4 text-lg font-semibold">Ask your coach anything</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">I know your skills, your tasks and what you find hard. For today&apos;s task, open a skill on Home.</p>
        </div>
      )}
      <MentorChat messages={messages} placeholder="Ask your coach anything…" />
    </AppShell>
  );
}
