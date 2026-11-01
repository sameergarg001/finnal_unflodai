import { requireReadyUser } from "@/server/auth/session";
import { getMentorMessages } from "@/server/services/mentor";
import { AppShell } from "@/components/AppShell";
import { MentorChat } from "@/components/MentorChat";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoachTabPage() {
  const user = await requireReadyUser();
  const messages = await getMentorMessages(user.id, null);

  return (
    <AppShell title="Coach">
      {messages.length === 0 && (
        <div className="px-2 pb-2 pt-8 text-center">
          <div className="flex justify-center"><Logo size={56} /></div>
          <p className="mt-4 text-lg font-semibold">Ask your mentor anything</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">I know your skills, your challenges and what you find hard. For a new challenge, open a skill from Home.</p>
        </div>
      )}
      <MentorChat messages={messages} placeholder="Ask your coach…" />
    </AppShell>
  );
}
