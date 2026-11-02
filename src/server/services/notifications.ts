import { db } from "@/lib/db";

// In-app notifications, computed from real state (never claims the user did
// something they didn't report). Respects the user's notification preferences.

export interface Preferences {
  theme: "dark" | "light";
  notifications: { activeChallenge: boolean; feedback: boolean; reports: boolean; inactiveSkill: boolean };
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  notifications: { activeChallenge: true, feedback: true, reports: true, inactiveSkill: true },
};

export function preferencesOf(raw: unknown): Preferences {
  const p = (raw ?? {}) as Partial<Preferences>;
  return {
    theme: p.theme === "light" ? "light" : "dark",
    notifications: { ...DEFAULT_PREFERENCES.notifications, ...(p.notifications ?? {}) },
  };
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  href: string;
  at: Date;
}

const DAY = 86_400_000;

export async function getNotifications(userId: string): Promise<{ items: AppNotification[]; unread: number }> {
  const profile = await db.userProfile.findUnique({ where: { userId } });
  const prefs = preferencesOf(profile?.preferences);
  const items: AppNotification[] = [];
  const now = Date.now();

  const active = await db.challenge.findMany({ where: { userId, status: "active" }, include: { skill: true } });
  for (const ch of active) {
    const since = (ch.acceptedAt ?? ch.assignedAt).getTime();
    if (prefs.notifications.feedback && now - since > DAY) {
      items.push({
        id: `feedback:${ch.id}`,
        title: "Your task is waiting for feedback",
        body: `How did "${ch.title}" go? Tell your coach when you've tried it.`,
        href: `/challenge/${ch.id}`,
        at: new Date(since + DAY),
      });
    } else if (prefs.notifications.activeChallenge) {
      items.push({ id: `active:${ch.id}`, title: `Active ${ch.skill.name} task`, body: ch.title, href: `/challenge/${ch.id}`, at: new Date(since) });
    }
  }

  if (prefs.notifications.reports) {
    const lastAnalysis = await db.aiAnalysis.findFirst({ where: { reflection: { challenge: { userId } } }, orderBy: { createdAt: "desc" } });
    if (lastAnalysis && now - lastAnalysis.createdAt.getTime() < 7 * DAY) {
      items.push({ id: `report:${lastAnalysis.id}`, title: "Your development report is updated", body: "See what changed after your latest challenge.", href: "/reports", at: lastAnalysis.createdAt });
    }
  }

  if (prefs.notifications.inactiveSkill) {
    const lastBySkill = await db.challenge.groupBy({ by: ["skillId"], where: { userId, status: "done" }, _max: { completedAt: true } });
    const stale = lastBySkill.filter((l) => l._max.completedAt && now - l._max.completedAt.getTime() > 7 * DAY && !active.some((a) => a.skillId === l.skillId));
    if (stale.length) {
      const oldest = stale.sort((a, b) => a._max.completedAt!.getTime() - b._max.completedAt!.getTime())[0];
      const skill = await db.skill.findUnique({ where: { id: oldest.skillId } });
      if (skill) {
        items.push({
          id: `inactive:${skill.id}`,
          title: `You haven't worked on ${skill.name} recently`,
          body: "A small task keeps the progress going.",
          href: `/skills/${skill.id}`,
          at: new Date(oldest._max.completedAt!.getTime() + 7 * DAY),
        });
      }
    }
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  const seen = profile?.notificationsSeenAt?.getTime() ?? 0;
  return { items, unread: items.filter((i) => i.at.getTime() > seen).length };
}
