import Link from "next/link";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { analyzePendingFeedback } from "@/server/services/challenges";
import { getNotifications } from "@/server/services/notifications";
import { getSkillCards } from "@/server/services/progress";
import { getNextStep } from "@/server/services/nextStep";
import { localHour, safeTimeZone } from "@/lib/time";
import { AppShell } from "@/components/AppShell";
import { GrowthCard } from "@/components/GrowthCard";
import { NextStepCard } from "@/components/NextStepCard";
import { SkillCard } from "@/components/SkillCard";
import { HomeAsk } from "@/components/HomeAsk";
import { Avatar, Icon, LogoMark, SectionTitle, iconBtn } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Home: your growth, one next step, your skills, ask anything. */
export default async function DashboardPage() {
  const user = await requireReadyUser();
  after(() => analyzePendingFeedback(user.id));

  const [cards, notes, next, latest] = await Promise.all([
    getSkillCards(user.id),
    getNotifications(user.id),
    getNextStep(user.id),
    db.aiAnalysis.findFirst({
      where: { reflection: { challenge: { userId: user.id } }, tier: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { reflection: { include: { challenge: { include: { skill: true } } } } },
    }),
  ]);
  const latestEvent = latest
    ? await db.skillScoreEvent.findFirst({ where: { userId: user.id, source: "challenge", sourceId: latest.reflection.challengeId, subskill: "" } })
    : null;
  const first = (user.name ?? "").trim().split(/\s+/)[0];
  const h = localHour(safeTimeZone(user.timezone));
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell
      header={
        <div className="flex h-[72px] items-center gap-3 px-4">
          <LogoMark size={34} />
          <Link href="/profile" className="glass flex min-w-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-4">
            <Avatar name={user.name ?? user.email} image={user.image} size={38} />
            <span className="truncate text-[15px] font-medium">Hi, {first || "there"}</span>
          </Link>
          <span className="flex-1" />
          <Link href="/notifications" aria-label={`Notifications (${notes.unread} new)`} className={`${iconBtn} relative`}>
            <Icon name="bell" />
            {notes.unread > 0 && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-sun ring-2 ring-card-solid" />}
          </Link>
        </div>
      }
    >
      <h1 className="px-1 pb-1 pt-1 text-[30px] font-extrabold leading-[1.1]">{greeting}</h1>

      <GrowthCard cards={cards} />

      {latest?.nextFocus && (
        <Link href={`/challenge/${latest.reflection.challengeId}`} className="glass flex items-center gap-3.5 rounded-[24px] p-4 active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon name="target" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">
              Focus · {latest.reflection.challenge.skill.name}
              {latestEvent && latestEvent.delta !== 0 ? ` · last task ${latestEvent.delta > 0 ? "+" : ""}${latestEvent.delta}` : ""}
            </p>
            <p className="line-clamp-2 text-sm font-medium leading-snug">{latest.nextFocus}</p>
          </div>
          <Icon name="chevron" className="h-4 w-4 shrink-0 text-muted" />
        </Link>
      )}

      {next && <NextStepCard step={next} />}

      <SectionTitle action={<Link href="/skills/add" className="flex items-center gap-1 text-sm font-semibold text-accent"><Icon name="plus" className="h-4 w-4" />Add</Link>}>
        My skills
      </SectionTitle>
      <div className="space-y-2.5">
        {cards.map((s) => <SkillCard key={s.id} s={s} />)}
        <Link href="/skills/add" className="flex items-center gap-3.5 rounded-full border-2 border-dashed border-line py-2.5 pl-2.5 pr-4 text-muted transition active:scale-[0.98]">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-card-2/70 text-accent"><Icon name="plus" /></span>
          <span className="font-semibold">Add a skill</span>
        </Link>
      </div>

      <HomeAsk />
    </AppShell>
  );
}
