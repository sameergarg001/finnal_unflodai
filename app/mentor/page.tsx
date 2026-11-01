import { requireReadyUser } from "@/server/auth/session";
import { getMentorMessages } from "@/server/services/mentor";
import { AppShell } from "@/components/AppShell";
import { MentorChat } from "@/components/MentorChat";

export const dynamic = "force-dynamic";

export default async function MentorPage() {
  const user = await requireReadyUser();
  const messages = await getMentorMessages(user.id, null);

  return (
    <AppShell title="Mentor">
      {messages.length === 0 && (
        <div className="px-2 pb-2 pt-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white">U</div>
          <p className="mt-3 font-semibold">Ask me anything</p>
          <p className="mt-1 text-sm text-slate-500">I know your steps, your situation and what you find hard.</p>
        </div>
      )}
      <MentorChat messages={messages} placeholder="Ask your mentor…" />
    </AppShell>
  );
}
