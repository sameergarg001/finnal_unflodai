// Pure, configurable scoring rules. The AI only *describes* an attempt (rubric
// dimensions + how specific the account is); this code decides every number.
//
//   performance = weighted mean of the rubric dimensions the AI could judge
//   tier        = excellent ≥ 0.80 · good ≥ 0.60 · partial ≥ 0.40 · otherwise none
//   delta band  = excellent +1…+3 · good +0.5…+1.5 · partial 0…+0.5 · none 0
//   position in band = evidence strength, task difficulty vs. stage, situation difficulty
//
// Guarantees: no points for a click or vague/feelings-only feedback; an
// unsuccessful attempt is never penalised; a small −0.5 only after three
// poor, well-evidenced attempts in a row; scores always stay within 0–100.

export type CompletionStatus = "completed" | "partial" | "unsuccessful" | "not_attempted";
export type Tier = "excellent" | "good" | "partial" | "none" | "regression";

export const POLICY = {
  /** Below this evidence strength an account is too vague to change a score. */
  minEvidence: 0.35,
  weights: { skillShown: 0.3, execution: 0.2, discomfort: 0.15, completion: 0.15, improvement: 0.1, reflection: 0.1 },
  tiers: [
    { tier: "excellent" as const, min: 0.8, band: [1, 3] as const },
    { tier: "good" as const, min: 0.6, band: [0.5, 1.5] as const },
    { tier: "partial" as const, min: 0.4, band: [0, 0.5] as const },
  ],
  consistencyBonus: 0.2,
  regression: { delta: -0.5, maxPerformance: 0.25, minEvidence: 0.6, priorPoorAttempts: 2 },
  /** Subskills an evaluation can touch at most. */
  maxSubskills: 2,
};

export interface Dimensions {
  completion: number | null; // did they do what the task asked
  execution: number | null; // quality of how they did it
  skillShown: number | null; // the target skill was clearly demonstrated
  situationDifficulty: number | null; // how hard the real situation was
  discomfort: number | null; // acted despite nerves / discomfort
  improvement: number | null; // better than previous attempts
  reflection: number | null; // quality of their reflection
}

export interface AttemptInput {
  score: number;
  completionStatus: CompletionStatus;
  dimensions: Dimensions;
  /** 0–1: how specific and concrete the account is. */
  evidenceStrength: number;
  /** The account is only feelings/claims, with no described actions. */
  selfReportOnly: boolean;
  challengeDifficulty: number; // 1–5
  /** Difficulty that fits the current stage (1–5). */
  expectedDifficulty: number;
  /** Good-or-better evaluations in this skill in the last 14 days. */
  recentGood: number;
  /** Immediately preceding evaluations in this skill that were poor and well evidenced. */
  priorPoorStreak: number;
}

export interface AttemptResult {
  delta: number;
  score: number;
  tier: Tier;
  performance: number | null;
  /** 0–1 confidence in this evaluation. */
  confidence: number;
  /** Short, factual rule trace stored with the change. */
  rule: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const n01 = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? null : clamp(v, 0, 1));

/** Weighted mean of the dimensions that could be judged; null if the skill itself couldn't be. */
export function performanceOf(d: Dimensions): number | null {
  if (n01(d.skillShown) == null) return null;
  let sum = 0;
  let w = 0;
  for (const [k, weight] of Object.entries(POLICY.weights)) {
    const v = n01(d[k as keyof Dimensions]);
    if (v == null) continue;
    sum += v * weight;
    w += weight;
  }
  return w ? Math.round((sum / w) * 100) / 100 : null;
}

export function tierOf(performance: number, status: CompletionStatus): Exclude<Tier, "regression"> {
  let t: Exclude<Tier, "regression"> = POLICY.tiers.find((x) => performance >= x.min)?.tier ?? "none";
  // An unsuccessful attempt can show partial learning at most; a partial one, "good" at most.
  if (status === "unsuccessful" && (t === "excellent" || t === "good")) t = "partial";
  if (status === "partial" && t === "excellent") t = "good";
  return t;
}

export function evaluateAttempt(i: AttemptInput): AttemptResult {
  const strength = clamp(i.evidenceStrength, 0, 1);
  const confidence = Math.round(clamp(0.3 + 0.6 * strength - (i.selfReportOnly ? 0.3 : 0), 0.1, 0.95) * 100) / 100;
  const same = (tier: Tier, rule: string, performance: number | null = null): AttemptResult => ({ delta: 0, score: i.score, tier, performance, confidence, rule });

  if (i.completionStatus === "not_attempted") return same("none", "not attempted — no change, never a penalty");
  if (i.selfReportOnly) return same("none", "only feelings or claims, no described actions — needs more evidence");
  if (strength < POLICY.minEvidence) return same("none", `evidence strength ${strength.toFixed(2)} below ${POLICY.minEvidence} — needs more specific details`);
  const performance = performanceOf(i.dimensions);
  if (performance == null) return same("none", "the skill itself couldn't be judged from the account");

  // Repeated, well-evidenced regression → a small, reviewable decrease.
  const r = POLICY.regression;
  if (performance <= r.maxPerformance && strength >= r.minEvidence && i.priorPoorStreak >= r.priorPoorAttempts) {
    const score = clamp(round1(i.score + r.delta), 0, 100);
    return { delta: round1(score - i.score), score, tier: "regression", performance, confidence, rule: `performance ${performance} after ${i.priorPoorStreak} earlier poor attempts — small decrease (${r.delta})` };
  }

  const tier = tierOf(performance, i.completionStatus);
  const def = POLICY.tiers.find((x) => x.tier === tier);
  if (!def) return same("none", `performance ${performance} — no demonstrated improvement yet`, performance);

  const [lo, hi] = def.band;
  const challengeFactor = clamp((i.challengeDifficulty - i.expectedDifficulty + 2) / 4, 0, 1);
  const situation = n01(i.dimensions.situationDifficulty) ?? 0.5;
  const position = clamp(0.5 * strength + 0.3 * challengeFactor + 0.2 * situation, 0, 1);
  let delta = lo + (hi - lo) * position;
  const bonus = i.recentGood >= 2 && (tier === "excellent" || tier === "good") ? POLICY.consistencyBonus : 0;
  delta = Math.min(hi, delta + bonus);
  // Harder to gain near the top, but never below the band floor.
  const headroom = (100 - i.score) / 100;
  delta = Math.max(lo, delta * (0.7 + 0.3 * headroom));
  const score = clamp(round1(i.score + delta), 0, 100);
  return {
    delta: round1(score - i.score),
    score,
    tier,
    performance,
    confidence,
    rule: `performance ${performance} → ${tier} band +${lo}…+${hi}; strength ${strength.toFixed(2)}, difficulty ${i.challengeDifficulty} vs stage ${i.expectedDifficulty}${bonus ? ", consistency bonus" : ""}`,
  };
}

/**
 * Subskill change from the same evaluation: only subskills that were genuinely
 * exercised (signal > 0) move, in proportion to how clearly they were shown.
 */
export function subskillDelta(skillDelta: number, signal: number): number {
  if (skillDelta < 0) return round1(skillDelta); // regression applies to the targeted subskill only (caller decides)
  return round1(skillDelta * clamp(signal, 0, 1) * 1.2);
}

/** Overall progress: mean of the current scores of rated skills (transparent, count-independent). */
export function overallScore(skills: { current: number | null; baseline: number | null }[]) {
  const rated = skills.filter((s) => s.current != null);
  const withBase = rated.filter((s) => s.baseline != null);
  const mean = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    current: mean(rated.map((s) => s.current!)),
    initial: mean(withBase.map((s) => s.baseline!)),
    /** Same skills compared on both sides, so adding a skill doesn't fake progress. */
    change: withBase.length ? round1(mean(withBase.map((s) => s.current!))! - mean(withBase.map((s) => s.baseline!))!) : null,
    skillsCounted: rated.length,
  };
}

/** Initial adaptive difficulty (1–5) from a baseline score. */
export function initialDifficulty(score: number): number {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

export type DifficultyRecommendation = "easier" | "same" | "harder";

/**
 * Next difficulty, one level at a time:
 *  - down after a skipped/unsuccessful attempt (or "easier" advice on a partial one)
 *  - up after an excellent result, or after consistent success (good-or-better
 *    twice in a row) — decided by the backend, not only by the AI's advice
 *  - up when the AI says "harder" after a good result; otherwise stay.
 */
export function nextDifficulty(
  current: number,
  opts: { completionStatus: CompletionStatus; recommendation: DifficultyRecommendation; tier?: Tier; previousGoodStreak?: number; judged?: boolean },
): number {
  const good = opts.tier === "excellent" || opts.tier === "good";
  let step = 0;
  if (opts.completionStatus === "not_attempted" || opts.completionStatus === "unsuccessful") step = -1;
  // Couldn't judge the attempt (vague or off-task account): no evidence either way → stay.
  else if (opts.judged === false) step = 0;
  else if (opts.completionStatus === "partial") step = opts.recommendation === "easier" ? -1 : 0;
  else if (opts.recommendation === "easier" && !good) step = -1;
  else if (opts.tier === "excellent" || (good && (opts.previousGoodStreak ?? 0) >= 1)) step = 1;
  else if (opts.recommendation === "harder" && (good || !opts.tier)) step = 1;
  return clamp(current + step, 1, 5);
}
