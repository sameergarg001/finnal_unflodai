import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { initialDifficulty } from "../engine/scoring";
import { levelForScore } from "../assessment/levels";

// Default baseline for a specific skill added after the initial assessment.
const LATE_BASELINE = 45;

export type ActiveSkill = Awaited<ReturnType<typeof getActiveSkills>>[number];

export async function getActiveSkills(userId: string) {
  const rows = await db.userSkill.findMany({
    where: { userId, isActive: true },
    include: { skill: true },
    orderBy: { skill: { sortOrder: "asc" } },
  });
  return rows.map((r) => r.skill);
}

export function rubricOf(skill: { rubric: Prisma.JsonValue }): { key: string; label: string }[] {
  const r = skill.rubric as { dimensions?: { key: string; label: string }[] } | null;
  return r?.dimensions ?? [];
}

/**
 * Sets the user's specific skills. Core skills are always ensured active.
 * Deselected specific skills are deactivated (history kept), never deleted.
 */
export async function setUserSkills(userId: string, specificSlugs: string[]) {
  const skills = await db.skill.findMany();
  const wanted = new Set(specificSlugs);
  const now = new Date();

  await db.$transaction(
    skills.map((s) => {
      const active = s.category === "core" || wanted.has(s.slug);
      return db.userSkill.upsert({
        where: { userId_skillId: { userId, skillId: s.id } },
        create: { userId, skillId: s.id, isActive: active, removedAt: active ? null : now },
        update: active ? { isActive: true, removedAt: null } : { isActive: false, removedAt: now },
      });
    }),
  );

  // Newly activated skills without a score get a provisional baseline.
  const hasAssessment = await db.assessment.findFirst({
    where: { userId, completedAt: { not: null } },
    select: { id: true },
  });
  if (!hasAssessment) return;

  const active = await db.userSkill.findMany({ where: { userId, isActive: true } });
  const scored = new Set(
    (await db.skillScore.findMany({ where: { userId }, select: { skillId: true } })).map((s) => s.skillId),
  );
  for (const us of active) {
    if (scored.has(us.skillId)) continue;
    await db.skillScore.create({
      data: {
        userId,
        skillId: us.skillId,
        score: LATE_BASELINE,
        confidence: 0.1,
        difficulty: initialDifficulty(LATE_BASELINE),
        startingLevel: levelForScore(LATE_BASELINE).value,
      },
    });
    await db.skillScoreEvent.create({
      data: {
        userId,
        skillId: us.skillId,
        delta: 0,
        newScore: LATE_BASELINE,
        source: "assessment",
        reason: "Provisional baseline for newly added skill",
      },
    });
  }
}
