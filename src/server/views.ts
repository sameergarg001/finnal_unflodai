import type { Challenge, Skill } from "@prisma/client";
import type { ChallengeView } from "@/components/ChallengeCard";
import { frameworkOf } from "./services/skills";

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function toChallengeView(c: Challenge, skill: Skill): ChallengeView {
  const fw = frameworkOf(skill);
  return {
    id: c.id,
    title: c.title,
    struggle: c.struggle,
    objective: c.objective,
    instructions: c.instructions,
    steps: asStrings(c.steps),
    expectedOutcome: c.expectedOutcome,
    example: c.example,
    feedbackInstructions: c.feedbackInstructions,
    difficulty: c.difficulty,
    estimatedMinutes: c.estimatedMinutes,
    subskillLabel: fw.subskills.find((s) => s.key === c.subskill)?.label ?? null,
    skillName: skill.name,
    status: c.status,
  };
}
