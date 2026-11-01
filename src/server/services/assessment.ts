import { db } from "@/lib/db";
import { levelToScore } from "../assessment/levels";
import { initialDifficulty } from "../engine/scoring";
import { getActiveSkills } from "./skills";

/** Skills the user rates during setup (all active core + specific skills). */
export async function getAssessmentSkills(userId: string) {
  const skills = await getActiveSkills(userId);
  return skills.map((s) => ({ id: s.id, slug: s.slug, name: s.name, category: s.category, description: s.description }));
}

/**
 * Stores the self-selected level per skill (1–5) and creates baseline scores.
 * Confidence starts low: a self-rating is a starting point, not evidence.
 */
export async function submitInitialAssessment(userId: string, levels: Record<string, number>) {
  const skills = await getAssessmentSkills(userId);
  const now = new Date();

  await db.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: { userId, type: "initial", completedAt: now },
    });

    for (const skill of skills) {
      const level = levels[skill.id];
      await tx.assessmentAnswer.create({
        data: { assessmentId: assessment.id, skillId: skill.id, questionId: `level:${skill.slug}`, answer: { level: level ?? null } },
      });

      const score = levelToScore(level);
      await tx.skillScore.upsert({
        where: { userId_skillId: { userId, skillId: skill.id } },
        create: { userId, skillId: skill.id, score, confidence: 0.2, difficulty: initialDifficulty(score), startingLevel: level ?? 3 },
        update: { score, confidence: 0.2, difficulty: initialDifficulty(score), startingLevel: level ?? 3 },
      });
      await tx.skillScoreEvent.create({
        data: {
          userId,
          skillId: skill.id,
          delta: 0,
          newScore: score,
          source: "assessment",
          sourceId: assessment.id,
          reason: "Self-selected starting level",
        },
      });
    }
  });
}

/**
 * User optionally corrects their own level for some skills (under "Me").
 * Only skills whose chosen level differs from the current level are reset.
 */
export async function setSelfLevels(userId: string, levels: Record<string, number>) {
  const { levelForScore } = await import("../assessment/levels");
  const scores = await db.skillScore.findMany({ where: { userId } });
  for (const sc of scores) {
    const chosen = levels[sc.skillId];
    if (!chosen || levelForScore(sc.score).value === chosen) continue;
    const score = levelToScore(chosen);
    await db.$transaction([
      db.skillScore.update({
        where: { userId_skillId: { userId, skillId: sc.skillId } },
        data: { score, startingLevel: chosen, difficulty: initialDifficulty(score) },
      }),
      db.skillScoreEvent.create({
        data: { userId, skillId: sc.skillId, delta: score - sc.score, newScore: score, source: "assessment", reason: "Level set by user" },
      }),
    ]);
  }
}
