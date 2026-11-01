import { db } from "@/lib/db";
import { ensureCoreSkills, setSelfScore } from "./skills";

/** The five fixed core skills, in display order. */
export async function getCoreSkills() {
  return db.skill.findMany({ where: { category: "core" }, orderBy: { sortOrder: "asc" } });
}

/**
 * Initial (or repeated) self-assessment of the five core skills, 0–100 each.
 * These are the user's own ratings, stored separately from UnfoldAI's
 * evidence-based scores.
 */
export async function submitSelfAssessment(userId: string, scores: Record<string, number>) {
  await ensureCoreSkills(userId);
  const core = await getCoreSkills();
  const missing = core.filter((s) => typeof scores[s.id] !== "number");
  if (missing.length) throw new Error(`Please rate ${missing.map((s) => s.name).join(", ")}`);

  const assessment = await db.assessment.create({ data: { userId, type: "initial", completedAt: new Date() } });
  for (const s of core) {
    const value = Math.round(Math.min(100, Math.max(0, scores[s.id])));
    await db.assessmentAnswer.create({
      data: { assessmentId: assessment.id, skillId: s.id, questionId: `self:${s.slug}`, answer: { score: value } },
    });
    await setSelfScore(userId, s.id, value);
  }
  await db.userProfile.upsert({
    where: { userId },
    create: { userId, onboardingDone: true, assessmentDone: true },
    update: { assessmentDone: true },
  });
}

export async function getAssessmentHistory(userId: string) {
  return db.skillScoreEvent.findMany({
    where: { userId },
    include: { skill: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
