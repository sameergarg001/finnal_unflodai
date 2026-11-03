import Link from "next/link";
import { after } from "next/server";
import { requireReadyUser } from "@/server/auth/session";
import { analyzePendingFeedback } from "@/server/services/challenges";
import { getNotifications } from "@/server/services/notifications";
import { getSkillCards } from "@/server/services/progress";
import { getNextStep, type NextStep } from "@/server/services/nextStep";
import { localHour, safeTimeZone } from "@/lib/time";
import { AppShell } from "@/components/AppShell";
import { NextStepCard } from "@/components/NextStepCard";
import { SkillCard } from "@/components/SkillCard";
import { HomeAsk } from "@/components/HomeAsk";
import { Avatar, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Home: greeting, one next step, your skills. Nothing else. */
export default async function DashboardPage() {
  const user = await requireReadyUser();
  after(() => analyzePendingFeedback(user.id));

  const [cards, notes, next] = await Promise.all([getSkillCards(user.id), getNotifications(user.id), getNextStep(user.id)]);
  const first = (user.name ?? "").trim().split(/\s+/)[0];
  const h = localHour(safeTimeZone(user.timezone));
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell
      header={
        <div className="flex h-16 items-center gap-3 px-4">
          <Link href="/profile"><Avatar name={user.name ?? user.email} image={user.image} size={42} /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">{greeting}</p>
            <p className="truncate text-lg font-bold">Hey, {first || "there"}</p>
          </div>
          <Link href="/notifications" aria-label={`Notifications (${notes.unread} new)`} className="relative rounded-full border border-line bg-card p-2.5 transition hover:border-accent/40 active:scale-95">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0" />
            </svg>
            {notes.unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">{notes.unread}</span>}
          </Link>
        </div>
      }
    >
      <p className="px-1 text-sm leading-relaxed text-muted">{lineFor(next, h)}</p>

      {next && <NextStepCard step={next} />}

      <SectionTitle>My skills</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((s) => <SkillCard key={s.id} s={s} />)}
        <Link href="/skills/add" className="flex min-h-36 flex-col items-center justify-center rounded-3xl border border-dashed border-line text-muted transition hover:border-accent/40 hover:text-fg active:scale-[0.98]">
          <span className="text-3xl leading-none text-accent">+</span>
          <span className="mt-1.5 text-sm font-medium">Add skill</span>
          <span className="mt-1 px-3 text-center text-[11px] leading-snug">Something you want to get better at</span>
        </Link>
      </div>

      <HomeAsk />
    </AppShell>
  );
}

function lineFor(next: NextStep | null, hour: number): string {
  if (next?.kind === "feedback") return `${next.teacher} is waiting to hear how the task went. No need to make it sound good.`;
  if (next?.kind === "continue") return `${next.teacher} is still in the chat for ${next.skill}.`;
  if (next?.kind === "next") return `Another small ${next.skill} task, if you've got a few minutes.`;
  if (next?.kind === "start") return `${next.teacher} is ready when you are. One skill, one small start.`;
  if (hour < 12) return "Pick one small thing. That's enough for this morning.";
  if (hour < 17) return "Still time for one task. Keep it small.";
  return "A short one is enough tonight.";
}
