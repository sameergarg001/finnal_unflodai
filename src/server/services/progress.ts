import { db } from "@/lib/db";
import { generateStructured } from "@/ai/client";
import { REVIEW_SYSTEM, reviewPrompt, reviewSchema, type ProgressReview } from "@/ai/prompts";
import { localDateKey, safeTimeZone, weekStartKey, addDays } from "@/lib/time";
import { recallInsights } from "../engine/memory";
import { overallScore } from "../engine/scoring";
import { frameworkOf, teacherOf } from "./skills";
import type { AnalysisReport } from "./challenges";

// Everything here is computed from real stored activity. Nothing is invented:
// with no data, the UI shows empty states.

export interface SkillCardData {
  id: string;
  name: string;
  category: string;
  selfScore: number | null;
  /** UnfoldAI evidence-based score; null until at least one assessed challenge. */
  evidenceScore: number | null;
  baseline: number;
  /** Score used for overall progress: UnfoldAI's if assessed, else the self-rating. */
  current: number | null;
  /** First self-assessment (never overwritten). */
  initial: number | null;
  completed: number;
  attempted: number;
  trend: number[];
  hasActive: boolean;
  teacher: { name: string; emoji: string };
}

export async function getSkillCards(userId: string): Promise<SkillCardData[]> {
  const [mine, scores, events, counts, active] = await Promise.all([
    db.userSkill.findMany({ where: { userId, isActive: true }, include: { skill: true }, orderBy: { skill: { sortOrder: "asc" } } }),
    db.skillScore.findMany({ where: { userId } }),
    db.skillScoreEvent.findMany({ where: { userId, source: { in: ["challenge", "review"] }, subskill: "" }, orderBy: { createdAt: "asc" }, select: { skillId: true, newScore: true, previousScore: true } }),
    db.challenge.groupBy({ by: ["skillId", "status"], where: { userId, status: { in: ["done", "abandoned"] } }, _count: true }),
    db.challenge.findMany({ where: { userId, status: "active" }, select: { skillId: true } }),
  ]);
  const completedBySkill = new Map<string, number>();
  for (const r of await db.reflection.findMany({ where: { challenge: { userId }, completionStatus: { in: ["completed", "partial"] } }, select: { challenge: { select: { skillId: true } } } })) {
    completedBySkill.set(r.challenge.skillId, (completedBySkill.get(r.challenge.skillId) ?? 0) + 1);
  }
  const scoreBy = new Map(scores.map((s) => [s.skillId, s]));
  const activeSet = new Set(active.map((a) => a.skillId));
  return mine.map(({ skill }) => {
    const sc = scoreBy.get(skill.id);
    const ev = events.filter((e) => e.skillId === skill.id);
    const attempted = counts.filter((c) => c.skillId === skill.id).reduce((a, c) => a + c._count, 0);
    return {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      selfScore: sc?.selfScore ?? null,
      evidenceScore: sc && sc.evidenceCount > 0 ? sc.score : null,
      baseline: ev[0]?.previousScore ?? sc?.score ?? 0,
      // Overall progress only moves with task evidence: unassessed skills count at their baseline,
      // so re-rating yourself never shows up as "progress".
      current: sc ? (sc.evidenceCount > 0 ? sc.score : (sc.baselineScore ?? sc.selfScore ?? null)) : null,
      initial: sc?.baselineScore ?? sc?.selfScore ?? null,
      completed: completedBySkill.get(skill.id) ?? 0,
      attempted,
      trend: ev.length ? [ev[0].previousScore ?? ev[0].newScore, ...ev.map((e) => e.newScore)] : [],
      hasActive: activeSet.has(skill.id),
      teacher: { name: teacherOf(skill).name, emoji: teacherOf(skill).emoji },
    };
  });
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function overallFrom(cards: SkillCardData[]) {
  const core = cards.filter((c) => c.category === "core");
  const assessed = cards.filter((c) => c.evidenceScore !== null);
  return {
    selfAverage: avg(core.map((c) => c.selfScore).filter((x): x is number => x !== null)),
    evidenceAverage: avg(assessed.map((c) => c.evidenceScore!)),
    evidenceBaseline: avg(assessed.map((c) => c.baseline)),
    assessedSkills: assessed.length,
    /** Transparent overall: mean of current skill scores vs. mean of the same skills' baselines. */
    overall: overallScore(cards.map((c) => ({ current: c.current, baseline: c.initial }))),
    completed: cards.reduce((a, c) => a + c.completed, 0),
    attempted: cards.reduce((a, c) => a + c.attempted, 0),
  };
}

/** Data behind the Reports tab. */
export async function getReports(user: { id: string; timezone: string }) {
  const userId = user.id;
  const tz = safeTimeZone(user.timezone);
  const [cards, challenges, events, insights, analyses] = await Promise.all([
    getSkillCards(userId),
    db.challenge.findMany({
      where: { userId, status: { in: ["done", "abandoned", "active"] } },
      include: { skill: true, reflection: true },
      orderBy: { assignedAt: "asc" },
    }),
    db.skillScoreEvent.findMany({ where: { userId, source: { in: ["challenge", "review"] }, subskill: "" }, include: { skill: true }, orderBy: { createdAt: "asc" } }),
    recallInsights(userId, "", 20),
    db.aiAnalysis.findMany({
      where: { reflection: { challenge: { userId } } },
      include: { reflection: { include: { challenge: { include: { skill: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const attempted = challenges.filter((c) => c.status !== "active").length;
  const completed = challenges.filter((c) => c.reflection && ["completed", "partial"].includes(c.reflection.completionStatus)).length;

  // Overall trend: average evidence score of assessed skills after each assessment.
  const current = new Map<string, number>();
  const trend: { date: string; value: number }[] = [];
  for (const e of events) {
    if (!current.has(e.skillId) && e.previousScore != null) current.set(e.skillId, e.previousScore);
    current.set(e.skillId, e.newScore);
    trend.push({ date: localDateKey(tz, e.createdAt), value: avg([...current.values()])! });
  }

  // Most improved: total evidence-based gain per skill.
  const gains = new Map<string, { name: string; gain: number }>();
  for (const e of events) {
    const g = gains.get(e.skillId) ?? { name: e.skill.name, gain: 0 };
    g.gain = Math.round((g.gain + e.delta) * 10) / 10;
    gains.set(e.skillId, g);
  }
  const mostImproved = [...gains.values()].filter((g) => g.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3);

  // Subskill progress: tasks completed per subskill.
  const skills = await db.skill.findMany({ where: { id: { in: [...new Set(challenges.map((c) => c.skillId))] } } });
  const subskills: { skill: string; label: string; completed: number; attempted: number }[] = [];
  for (const s of skills) {
    const fw = frameworkOf(s);
    for (const ss of fw.subskills) {
      const list = challenges.filter((c) => c.skillId === s.id && c.subskill === ss.key && c.status !== "active");
      if (!list.length) continue;
      subskills.push({
        skill: s.name,
        label: ss.label,
        attempted: list.length,
        completed: list.filter((c) => c.reflection && ["completed", "partial"].includes(c.reflection.completionStatus)).length,
      });
    }
  }

  // Consistency: tasks with feedback per week, last 8 weeks.
  const thisWeek = weekStartKey(localDateKey(tz));
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i)));
  const perWeek = new Map(weeks.map((w) => [w, 0]));
  for (const c of challenges) {
    if (!c.reflection) continue;
    const w = weekStartKey(localDateKey(tz, c.reflection.createdAt));
    if (perWeek.has(w)) perWeek.set(w, perWeek.get(w)! + 1);
  }

  return {
    cards,
    overall: overallFrom(cards),
    attempted,
    completed,
    completionRate: attempted ? Math.round((completed / attempted) * 100) : null,
    trend,
    mostImproved,
    subskills,
    consistency: weeks.map((w) => ({ week: w, count: perWeek.get(w)! })),
    repeatedWeaknesses: insights.filter((i) => i.kind === "blocker" && i.weight >= 0.55).slice(0, 4),
    recentInsights: analyses.map((a) => ({
      skill: a.reflection.challenge.skill.name,
      challenge: a.reflection.challenge.title,
      challengeId: a.reflection.challenge.id,
      feedback: ((a.insights ?? {}) as { feedback?: string }).feedback ?? "",
      date: a.createdAt,
    })),
  };
}

/** Skill history for "Revise previous progress". */
export async function getSkillHistory(userId: string, skillId: string) {
  const [challenges, events, insights] = await Promise.all([
    db.challenge.findMany({
      where: { userId, skillId, status: { in: ["active", "done", "abandoned"] } },
      include: { reflection: { include: { analysis: true } } },
      orderBy: { assignedAt: "desc" },
    }),
    db.skillScoreEvent.findMany({ where: { userId, skillId, subskill: "" }, orderBy: { createdAt: "desc" } }),
    recallInsights(userId, skillId, 10),
  ]);
  return { challenges, events, weaknesses: insights.filter((i) => i.kind === "blocker" && (i.skillId === skillId || !i.skillId)) };
}

/**
 * AI progress review for a skill (or overall when skillId is null).
 * Cached until new feedback exists. Without AI, a summary is built directly
 * from the stored analyses (still real data).
 */
export async function getProgressReview(userId: string, skillId: string | null): Promise<(ProgressReview & { basedOn: number }) | null> {
  const analyses = await db.aiAnalysis.findMany({
    where: { reflection: { challenge: { userId, ...(skillId ? { skillId } : {}) } } },
    include: { reflection: { include: { challenge: { include: { skill: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  if (!analyses.length) return null;
  const key = `${analyses.length}:${analyses[analyses.length - 1].id}`;
  const cached = await db.report.findFirst({ where: { userId, skillId }, orderBy: { generatedAt: "desc" } });
  if (cached && cached.evidenceKey === key && (cached.modelVersion !== "summary" || Date.now() - cached.generatedAt.getTime() < 30 * 60_000)) {
    return cached.reportData as ProgressReview & { basedOn: number };
  }

  const data = analyses.map((a) => {
    const r = a.report as AnalysisReport | null;
    return {
      skill: a.reflection.challenge.skill.name,
      challenge: a.reflection.challenge.title,
      outcome: a.reflection.completionStatus,
      whatHappened: a.reflection.whatHappened.slice(0, 500),
      wentWell: r?.wentWell ?? [],
      toImprove: r?.toImprove ?? [],
      nextFocus: a.nextFocus,
    };
  });
  let review: ProgressReview;
  let modelVersion = "summary";
  try {
    const res = await generateStructured(reviewSchema, { system: REVIEW_SYSTEM, prompt: reviewPrompt(data), temperature: 0.3, timeoutMs: 45_000 });
    review = res.data;
    modelVersion = res.modelVersion;
  } catch (e) {
    console.warn("[review] AI failed, summarising stored analyses:", (e as Error).message);
    const last = data[data.length - 1];
    review = {
      improved: [...new Set(data.flatMap((d) => d.wentWell))].slice(-4),
      stillNeedsWork: [...new Set(data.slice(-3).flatMap((d) => d.toImprove))].slice(0, 4),
      focusNext: last.nextFocus ?? "Keep building on your last challenge.",
      summary: `Based on ${data.length} task${data.length === 1 ? "" : "s"} you reported on.`,
    };
  }
  const reportData = { ...review, basedOn: data.length };
  await db.report.create({ data: { userId, skillId, reportData, evidenceKey: key, modelVersion } });
  return reportData;
}
