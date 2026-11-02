import { db } from "@/lib/db";
import { suggestSkillId } from "./challenges";
import { teacherOf } from "./skills";

/**
 * The single most useful thing for the user to do right now — so the home
 * screen always answers "what should I do next?".
 */
export type NextStep =
  | { kind: "feedback"; challengeId: string; title: string; skill: string; extraActive: number }
  | { kind: "continue"; conversationId: string; skill: string; proposedTitle: string | null; teacher: string; emoji: string }
  | { kind: "next"; challengeId: string; skill: string; nextFocus: string | null }
  | { kind: "start"; skillId: string; skill: string; reason: string; teacher: string; emoji: string };

const WEEK = 7 * 86_400_000;

export async function getNextStep(userId: string): Promise<NextStep | null> {
  const active = await db.challenge.findMany({ where: { userId, status: "active" }, include: { skill: true }, orderBy: { acceptedAt: "desc" } });
  if (active.length) {
    const ch = active[0];
    return { kind: "feedback", challengeId: ch.id, title: ch.title, skill: ch.skill.name, extraActive: active.length - 1 };
  }

  const open = await db.conversation.findFirst({
    where: { userId, status: "open", phase: { in: ["understanding", "proposed"] }, updatedAt: { gte: new Date(Date.now() - WEEK) } },
    include: { skill: true, challenges: { where: { status: "proposed" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  // Only worth resuming if the user actually said something in it.
  if (open && (await db.conversationMessage.count({ where: { conversationId: open.id, role: "user" } })) > 0) {
    const t = teacherOf(open.skill);
    return { kind: "continue", conversationId: open.id, skill: open.skill.name, proposedTitle: open.challenges[0]?.title ?? null, teacher: t.name, emoji: t.emoji };
  }

  const lastDone = await db.challenge.findFirst({
    where: { userId, status: "done" },
    include: { skill: true, reflection: { include: { analysis: true } } },
    orderBy: { completedAt: "desc" },
  });
  if (lastDone && lastDone.completedAt && Date.now() - lastDone.completedAt.getTime() < WEEK) {
    const later = await db.challenge.count({ where: { userId, skillId: lastDone.skillId, assignedAt: { gt: lastDone.assignedAt }, status: { in: ["active", "done", "proposed"] } } });
    if (!later) return { kind: "next", challengeId: lastDone.id, skill: lastDone.skill.name, nextFocus: lastDone.reflection?.analysis?.nextFocus ?? null };
  }

  const skillId = await suggestSkillId(userId);
  if (!skillId) return null;
  const [skill, sc] = await Promise.all([
    db.skill.findUniqueOrThrow({ where: { id: skillId } }),
    db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId } } }),
  ]);
  const value = sc ? (sc.evidenceCount > 0 ? sc.score : sc.selfScore) : null;
  const t = teacherOf(skill);
  return {
    kind: "start",
    skillId,
    skill: skill.name,
    teacher: t.name,
    emoji: t.emoji,
    reason: value != null ? `It's one of your lower-rated skills (${Math.round(value)}/100) — small wins here show up fast.` : "A good place to begin.",
  };
}
