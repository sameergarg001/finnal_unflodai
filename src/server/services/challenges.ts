import { db } from "@/lib/db";
import { generateStructured } from "@/ai/client";
import {
  ANALYSIS_SYSTEM,
  CHALLENGE_SYSTEM,
  analysisPrompt,
  analysisSchema,
  challengePrompt,
  challengeSchema,
  type Analysis,
  type ChallengePromptInput,
} from "@/ai/prompts";
import { levelForScore } from "../assessment/levels";
import { fallbackChallenge } from "../engine/fallbackChallenges";
import { rememberInsights, recallInsights } from "../engine/memory";
import { nextDifficulty, updateScore } from "../engine/scoring";
import { selectNextSkill, type SkillCandidate } from "../engine/selectSkill";
import { rubricOf } from "./skills";

// A practical step stays open for 3 days — real situations take time to arise.
const STEP_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export class SessionError extends Error {}

// ─── Reading ──────────────────────────────────────────────────────────────

async function expireOverdue(userId: string) {
  await db.challenge.updateMany({
    where: { userId, status: "assigned", dueAt: { lt: new Date() } },
    data: { status: "expired" },
  });
}

/** The user's open practical step, if any. */
export async function getCurrentChallenge(userId: string) {
  await expireOverdue(userId);
  return db.challenge.findFirst({
    where: { userId, status: "assigned" },
    include: { skill: true },
    orderBy: { assignedAt: "desc" },
  });
}

export async function getChallengeForUser(userId: string, challengeId: string) {
  return db.challenge.findFirst({
    where: { id: challengeId, userId },
    include: { skill: true, reflection: { include: { analysis: true } } },
  });
}

/** Suggests which skill to work on (weak, not practised recently). The user decides. */
export async function suggestSkillId(userId: string): Promise<string | null> {
  const [active, scores, last, lastPracticed] = await Promise.all([
    db.userSkill.findMany({ where: { userId, isActive: true }, include: { skill: true } }),
    db.skillScore.findMany({ where: { userId } }),
    db.challenge.findFirst({ where: { userId }, orderBy: { assignedAt: "desc" } }),
    db.challenge.groupBy({ by: ["skillId"], where: { userId, status: "completed" }, _max: { completedAt: true } }),
  ]);
  const scoreBySkill = new Map(scores.map((s) => [s.skillId, s]));
  const lastBySkill = new Map(lastPracticed.map((l) => [l.skillId, l._max.completedAt]));
  const candidates: SkillCandidate[] = active.map((us) => ({
    skillId: us.skillId,
    category: us.skill.category as "core" | "specific",
    score: scoreBySkill.get(us.skillId)?.score ?? 50,
    confidence: scoreBySkill.get(us.skillId)?.confidence ?? 0.1,
    lastPracticedAt: lastBySkill.get(us.skillId) ?? null,
  }));
  return selectNextSkill(candidates, { lastSkillId: last?.skillId, random: () => 0 })?.skillId ?? null;
}

// ─── Creating steps ───────────────────────────────────────────────────────

/** Starts a new session: the user picked a skill and described their situation. */
export async function startSession(userId: string, skillId: string, situation: string) {
  const active = await db.userSkill.findUnique({ where: { userId_skillId: { userId, skillId } } });
  if (!active?.isActive) throw new SessionError("Please choose one of your skills");

  // Only one open step at a time; an abandoned one simply expires.
  await db.challenge.updateMany({ where: { userId, status: "assigned" }, data: { status: "expired" } });
  return createStep(userId, { skillId, situation, previous: null });
}

/** Continues a session with the next step, based on feedback from the previous one. */
export async function continueSession(userId: string, previousId: string, update?: string) {
  const prev = await db.challenge.findFirst({
    where: { id: previousId, userId },
    include: { reflection: { include: { analysis: true } } },
  });
  if (!prev?.reflection) throw new SessionError("Give feedback on this step first");
  const already = await db.challenge.findFirst({ where: { previousId: prev.id, userId } });
  if (already) return already;

  const situation = update?.trim()
    ? `${prev.situation ?? ""}\n\nUpdate from the user: ${update.trim()}`.trim()
    : (prev.situation ?? "");
  await db.challenge.updateMany({ where: { userId, status: "assigned" }, data: { status: "expired" } });
  return createStep(userId, { skillId: prev.skillId, situation, previous: prev });
}

type PrevStep = NonNullable<Awaited<ReturnType<typeof loadPrev>>>;
const loadPrev = (id: string) =>
  db.challenge.findUnique({ where: { id }, include: { reflection: { include: { analysis: true } } } });

async function createStep(
  userId: string,
  opts: { skillId: string; situation: string; previous: PrevStep | null },
) {
  const [skill, sc, profile] = await Promise.all([
    db.skill.findUniqueOrThrow({ where: { id: opts.skillId } }),
    db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId: opts.skillId } } }),
    db.userProfile.findUnique({ where: { userId } }),
  ]);
  const score = sc?.score ?? 50;
  const difficulty = sc?.difficulty ?? 2;
  const insights = (await recallInsights(userId, skill.id)).map(({ kind, text }) => ({ kind, text }));

  const p = opts.previous;
  const promptInput: ChallengePromptInput = {
    skill: { name: skill.name, description: skill.description, rubric: rubricOf(skill) },
    level: levelForScore(score).name,
    difficulty,
    situation: opts.situation,
    profile: { occupation: profile?.occupation, goals: profile?.goals },
    previousStep: p?.reflection
      ? {
          title: p.title,
          instructions: p.instructions,
          completed: p.reflection.completed,
          whatHappened: p.reflection.whatHappened,
          whatWasHard: p.reflection.whatWasHard,
          painPoints: asStrings(p.reflection.analysis?.painPoints),
          nextFocus: p.reflection.analysis?.nextFocus,
        }
      : null,
    insights,
  };

  let draft;
  let modelVersion = "fallback";
  try {
    const res = await generateStructured(challengeSchema, {
      system: CHALLENGE_SYSTEM,
      prompt: challengePrompt(promptInput),
      temperature: 0.7,
    });
    draft = res.data;
    modelVersion = res.modelVersion;
  } catch (e) {
    console.warn("[step] AI generation failed, using fallback:", (e as Error).message);
    draft = fallbackChallenge(skill.slug, difficulty);
  }

  return db.challenge.create({
    data: {
      userId,
      skillId: skill.id,
      situation: opts.situation,
      previousId: p?.id ?? null,
      stepNumber: (p?.stepNumber ?? 0) + 1,
      title: draft.title,
      instructions: draft.instructions,
      successCriteria: draft.successCriteria,
      whyThisChallenge: draft.whyThisChallenge,
      estimatedMinutes: draft.estimatedMinutes,
      difficulty,
      dueAt: new Date(Date.now() + STEP_TTL_MS),
      generationContext: JSON.parse(JSON.stringify(promptInput)),
      modelVersion,
    },
    include: { skill: true },
  });
}

// ─── Skipping & feedback ──────────────────────────────────────────────────

/** Skipping is a gentle "too hard / not now" signal: lowers difficulty. */
export async function skipChallenge(userId: string, challengeId: string) {
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId, status: "assigned" } });
  if (!ch) return;
  await db.challenge.update({ where: { id: ch.id }, data: { status: "skipped" } });
  const sc = await db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId: ch.skillId } } });
  if (sc && sc.difficulty > 1) {
    await db.skillScore.update({
      where: { userId_skillId: { userId, skillId: ch.skillId } },
      data: { difficulty: sc.difficulty - 1 },
    });
  }
}

export interface ReflectionInput {
  completed: boolean;
  selfRating: number;
  perceivedDifficulty: number;
  whatHappened: string;
  whatWasHard?: string;
  whatLearned?: string;
}

/** Rule-based analysis used when the AI is unavailable. */
function heuristicAnalysis(r: ReflectionInput): Analysis {
  const detail = Math.min(1, (r.whatHappened.length + (r.whatWasHard?.length ?? 0)) / 400);
  const hard = r.whatWasHard?.trim();
  return {
    evidence: [],
    painPoints: hard ? [hard.slice(0, 200)] : [],
    nextFocus: hard ? `Work through: ${hard.slice(0, 200)}` : "Build on what worked in this step.",
    skillSignal: r.completed ? ((r.selfRating - 3) / 2) * 0.6 + 0.2 : -0.2,
    // Detailed feedback counts as stronger evidence (max 0.7; AI analysis can go higher).
    evidenceStrength: 0.35 + 0.35 * detail,
    difficultyRecommendation: !r.completed ? "easier" : r.perceivedDifficulty <= 2 ? "harder" : "same",
    insights: [],
    feedback: r.completed
      ? "Nice work taking this step. Your next step will build on how it went."
      : "Thanks for being honest. Your next step will be smaller and easier to start.",
  };
}

/** Saves feedback, finds pain points, and updates score, level, difficulty and memory. */
export async function submitReflection(userId: string, challengeId: string, input: ReflectionInput) {
  const ch = await db.challenge.findFirst({
    where: { id: challengeId, userId, status: "assigned" },
    include: { skill: true },
  });
  if (!ch) throw new SessionError("This step is not open any more");

  let analysis: Analysis;
  let modelVersion = "heuristic";
  try {
    const res = await generateStructured(analysisSchema, {
      system: ANALYSIS_SYSTEM,
      prompt: analysisPrompt({
        skill: { name: ch.skill.name, rubric: rubricOf(ch.skill) },
        situation: ch.situation,
        challenge: {
          title: ch.title,
          instructions: ch.instructions,
          successCriteria: asStrings(ch.successCriteria),
          difficulty: ch.difficulty,
        },
        reflection: input,
      }),
      temperature: 0.3,
    });
    analysis = res.data;
    modelVersion = res.modelVersion;
  } catch (e) {
    console.warn("[feedback] AI analysis failed, using heuristic:", (e as Error).message);
    analysis = heuristicAnalysis(input);
  }

  const sc = await db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId: ch.skillId } } });
  const base = sc ?? { score: 50, confidence: 0.1, difficulty: ch.difficulty };
  const upd = updateScore({
    score: base.score,
    confidence: base.confidence,
    difficulty: ch.difficulty,
    skillSignal: analysis.skillSignal,
    evidenceStrength: analysis.evidenceStrength,
    completed: input.completed,
  });
  const difficulty = nextDifficulty(base.difficulty, {
    completed: input.completed,
    perceivedDifficulty: input.perceivedDifficulty,
    recommendation: analysis.difficultyRecommendation,
  });

  await db.$transaction(async (tx) => {
    await tx.challenge.update({
      where: { id: ch.id },
      data: { status: input.completed ? "completed" : "skipped", completedAt: new Date() },
    });
    const reflection = await tx.reflection.create({
      data: {
        challengeId: ch.id,
        completed: input.completed,
        selfRating: input.selfRating,
        perceivedDifficulty: input.perceivedDifficulty,
        whatHappened: input.whatHappened,
        whatWasHard: input.whatWasHard || null,
        whatLearned: input.whatLearned || null,
      },
    });
    await tx.aiAnalysis.create({
      data: {
        reflectionId: reflection.id,
        evidence: analysis.evidence,
        painPoints: analysis.painPoints,
        nextFocus: analysis.nextFocus,
        skillSignal: analysis.skillSignal,
        evidenceStrength: analysis.evidenceStrength,
        difficultyRecommendation: analysis.difficultyRecommendation,
        insights: { items: analysis.insights, feedback: analysis.feedback },
        modelVersion,
      },
    });
    await tx.skillScore.upsert({
      where: { userId_skillId: { userId, skillId: ch.skillId } },
      create: {
        userId,
        skillId: ch.skillId,
        score: upd.score,
        confidence: upd.confidence,
        difficulty,
        startingLevel: levelForScore(base.score).value,
      },
      update: { score: upd.score, confidence: upd.confidence, difficulty },
    });
    await tx.skillScoreEvent.create({
      data: {
        userId,
        skillId: ch.skillId,
        delta: upd.delta,
        newScore: upd.score,
        source: "challenge",
        sourceId: ch.id,
        reason: ch.title,
      },
    });
  });

  // Pain points are also remembered as blockers so future sessions avoid them.
  await rememberInsights(userId, ch.skillId, [
    ...analysis.insights,
    ...analysis.painPoints.map((text) => ({ kind: "blocker" as const, text })),
  ]);
  return { delta: upd.delta, score: upd.score, feedback: analysis.feedback };
}
