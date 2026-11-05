import { db } from "@/lib/db";
import { frameworkOf, teacherOf } from "../services/skills";
import { getInsights, type InsightView } from "./evidence";
import { stageForScore, type Stage } from "./stages";

// Context retrieval. Instead of sending raw chat history, each AI call gets a
// compact, relevant snapshot built from separate memories:
//   person profile · skill stage & scores · subskill scores · evidence-based
//   observations · recent situations · task history & evaluations ·
//   current task state · this conversation's running summary · last sessions.

const firstName = (name: string | null | undefined) => (name ?? "there").trim().split(/\s+/)[0] || "there";
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const daysAgo = (d: Date) => Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
const cut = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null);

export type StoredPlan = {
  goal: string;
  currentLevel: string;
  timeline: string;
  targetDate: string | null;
  startSubskill: string | null;
  firstFocus: string;
  summary: string;
};

export interface SkillState {
  skill: { id: string; slug: string; name: string; description: string };
  framework: ReturnType<typeof frameworkOf>;
  teacher: ReturnType<typeof teacherOf>;
  stage: Stage;
  /** Current score used for mentoring (evidence-based, or the self-rating before any evidence). */
  score: number;
  assessed: boolean;
  baseline: number | null;
  selfScore: number | null;
  difficulty: number;
  subskillScores: Map<string, { score: number; evidenceCount: number }>;
  insights: InsightView[];
  plan: StoredPlan | null;
}

/** Everything the engine needs to reason about one skill for one person. */
export async function loadSkillState(userId: string, skillId: string): Promise<SkillState> {
  const [skill, sc, subs, insights, us] = await Promise.all([
    db.skill.findUniqueOrThrow({ where: { id: skillId } }),
    db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId } } }),
    db.subskillScore.findMany({ where: { userId, skillId } }),
    getInsights(userId, skillId),
    db.userSkill.findUnique({ where: { userId_skillId: { userId, skillId } }, select: { plan: true } }),
  ]);
  const assessed = (sc?.evidenceCount ?? 0) > 0;
  const score = sc ? (assessed ? sc.score : (sc.selfScore ?? sc.score)) : 40;
  return {
    skill: { id: skill.id, slug: skill.slug, name: skill.name, description: skill.description },
    framework: frameworkOf(skill),
    teacher: teacherOf(skill),
    stage: stageForScore(score),
    score,
    assessed,
    baseline: sc?.baselineScore ?? sc?.selfScore ?? null,
    selfScore: sc?.selfScore ?? null,
    difficulty: sc?.difficulty ?? stageForScore(score).baseDifficulty,
    subskillScores: new Map(subs.map((s) => [s.subskill, { score: s.score, evidenceCount: s.evidenceCount }])),
    insights,
    plan: (us?.plan as StoredPlan | null) ?? null,
  };
}

const insightLine = (i: InsightView) => ({
  id: i.id,
  text: i.text,
  subskill: i.subskill,
  status: i.status, // hypothesis = not yet confirmed
  confidence: i.confidence,
  seen: i.count,
  lastEvidence: cut(i.evidence.filter((e) => e.direction === "supports").at(-1)?.quote, 160),
  where: i.situations.slice(-2),
});

export interface ConversationLike {
  id: string;
  phase: string;
  summary: string | null;
  context: unknown;
}

/** Compact context object sent to the AI for a skill conversation. */
export async function buildMentorContext(userId: string, state: SkillState, conv?: ConversationLike | null) {
  const skillId = state.skill.id;
  const [user, history, situations, pastSessions, active, proposed] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } }),
    db.challenge.findMany({
      where: { userId, skillId, status: { in: ["done", "abandoned"] } },
      include: { reflection: { include: { analysis: true } } },
      orderBy: { assignedAt: "desc" },
      take: 5,
    }),
    db.userSituation.findMany({ where: { userId, OR: [{ skillId }, { skillId: null }] }, orderBy: { lastSeenAt: "desc" }, take: 3 }),
    db.conversation.findMany({
      where: { userId, skillId, summary: { not: null }, ...(conv ? { id: { not: conv.id } } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 2,
      select: { summary: true, updatedAt: true },
    }),
    db.challenge.findFirst({ where: { userId, skillId, status: "active" } }),
    conv ? db.challenge.findFirst({ where: { conversationId: conv.id, status: "proposed" } }) : null,
  ]);
  const fw = state.framework;
  const c = (conv?.context ?? {}) as { goal?: string; situation?: unknown; questions?: number; questionsInRow?: number };
  const lastActivity = pastSessions[0]?.updatedAt ?? history[0]?.completedAt ?? null;

  return {
    mentor: { name: state.teacher.name, title: state.teacher.title, style: state.teacher.style },
    person: {
      firstName: firstName(user.name),
      age: user.age,
      profession: user.profile?.occupation ?? null,
      overallGoal: cut(user.profile?.goals, 200),
      about: cut(user.profile?.about, 300),
    },
    skill: {
      name: state.skill.name,
      description: state.skill.description,
      criteria: fw.criteria,
      subskills: fw.subskills.map((s) => {
        const sub = state.subskillScores.get(s.key);
        return { key: s.key, label: s.label, score: sub && sub.evidenceCount > 0 ? Math.round(sub.score) : null };
      }),
    },
    stage: {
      name: state.stage.name,
      guidance: state.stage.guidance,
      score: Math.round(state.score),
      scoreBasis: state.assessed ? "evidence from tasks" : "self-assessment only (not yet verified)",
      baseline: state.baseline,
    },
    weaknesses: state.insights.filter((i) => i.kind === "blocker").slice(0, 5).map(insightLine),
    strengths: state.insights.filter((i) => i.kind === "strength").slice(0, 3).map(insightLine),
    patternsAndPreferences: state.insights.filter((i) => i.kind === "pattern" || i.kind === "preference").slice(0, 3).map((i) => i.text),
    recentSituations: situations.map((s) => ({ summary: s.summary, daysAgo: daysAgo(s.lastSeenAt) })),
    plan: state.plan ? { goal: state.plan.goal, currentLevel: state.plan.currentLevel, timeline: state.plan.timeline, firstFocus: state.plan.firstFocus } : null,
    taskHistory: history.map((h) => {
      const a = h.reflection?.analysis;
      return {
        title: h.title,
        subskill: h.subskill,
        difficulty: h.difficulty,
        outcome: h.status === "abandoned" ? "set aside" : h.reflection?.completionStatus,
        evaluation: a?.tier ?? null,
        whatHappened: cut(h.reflection?.whatHappened, 220),
        nextFocus: a?.nextFocus ?? null,
        scoreChange: (a?.report as { explanation?: string } | null)?.explanation ?? null,
        daysAgo: daysAgo(h.completedAt ?? h.assignedAt),
      };
    }),
    activeTask: active
      ? { title: active.title, objective: active.objective, steps: asStrings(active.steps), alternative: active.alternative, acceptedDaysAgo: daysAgo(active.acceptedAt ?? active.assignedAt) }
      : null,
    proposedTask: proposed ? { title: proposed.title, objective: proposed.objective, difficulty: proposed.difficulty } : null,
    memory: {
      daysSinceLastSession: lastActivity ? daysAgo(lastActivity) : null,
      previousSessions: pastSessions.map((p) => cut(p.summary, 300)),
    },
    conversation: conv
      ? { phase: conv.phase, summary: cut(conv.summary, 500), goal: c.goal ?? null, currentSituation: c.situation ?? null, questionsAskedSoFar: c.questions ?? 0, questionsInARow: c.questionsInRow ?? 0 }
      : null,
    readiness: readinessOf({
      goal: !!(c.goal || state.plan?.goal),
      situation: !!(c.situation || situations.some((s) => Date.now() - s.lastSeenAt.getTime() < 3 * 86_400_000)),
      difficulty: state.insights.some((i) => i.kind === "blocker"),
      history: history.length > 0,
      questionsInRow: c.questionsInRow ?? 0,
    }),
  };
}
export type MentorContext = Awaited<ReturnType<typeof buildMentorContext>>;

/**
 * Does the mentor know enough to act? Sent to the AI (and enforced by the
 * backend) so conversations move to real action instead of endless questions.
 */
export function readinessOf(k: { goal: boolean; situation: boolean; difficulty: boolean; history: boolean; questionsInRow: number }) {
  const missing = [!k.goal && !k.difficulty ? "what they want or what's hard" : null, !k.situation && !k.history ? "a real situation where it happens" : null].filter(Boolean) as string[];
  const ready = k.questionsInRow >= 2 || (k.situation && (k.goal || k.difficulty)) || (k.history && k.difficulty);
  return ready ? { status: "ready" as const, note: "You know enough: act now (task or concrete guidance) instead of asking more." } : { status: "exploring" as const, missing };
}
