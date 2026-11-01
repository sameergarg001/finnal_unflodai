// Pure scoring functions. The AI suggests signals; this code decides numbers.

export const MAX_DELTA = 6; // max score change from one challenge

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Initial adaptive difficulty from a baseline score. */
export function initialDifficulty(score: number): number {
  if (score < 35) return 1;
  if (score < 55) return 2;
  if (score < 75) return 3;
  return 4;
}

export interface ScoreUpdateInput {
  score: number;
  confidence: number;
  difficulty: number;
  /** -1..1: how well the attempt demonstrated the skill. */
  skillSignal: number;
  /** 0..1: how concrete/credible the evidence is. */
  evidenceStrength: number;
  completed: boolean;
}

export interface ScoreUpdate {
  delta: number;
  score: number;
  confidence: number;
}

/**
 * Bounded score update. Harder challenges count more; high confidence
 * dampens movement so a single reflection can't swing an established score.
 */
export function updateScore(i: ScoreUpdateInput): ScoreUpdate {
  const signal = clamp(i.skillSignal, -1, 1);
  const strength = clamp(i.evidenceStrength, 0, 1);
  const difficultyWeight = 0.7 + 0.15 * (i.difficulty - 1); // 0.7 .. 1.3
  const damping = 1 - 0.5 * i.confidence;
  const raw = signal * strength * difficultyWeight * damping * MAX_DELTA;
  const delta = Math.round(clamp(raw, -MAX_DELTA, MAX_DELTA) * 10) / 10;
  const score = clamp(Math.round((i.score + delta) * 10) / 10, 0, 100);
  const confidence = clamp(i.confidence + (i.completed ? 0.06 : 0.02) * strength, 0, 0.95);
  return { delta: Math.round((score - i.score) * 10) / 10, score, confidence };
}

export type DifficultyRecommendation = "easier" | "same" | "harder";

/**
 * Next difficulty. Combines user-reported difficulty (objective-ish) with the
 * AI recommendation; user signals win when they clearly disagree.
 */
export function nextDifficulty(
  current: number,
  opts: { completed: boolean; perceivedDifficulty: number; recommendation: DifficultyRecommendation },
): number {
  let step = 0;
  if (!opts.completed || opts.perceivedDifficulty >= 5) step = -1;
  else if (opts.perceivedDifficulty <= 2) step = 1;
  else step = opts.recommendation === "harder" ? 1 : opts.recommendation === "easier" ? -1 : 0;
  return clamp(current + step, 1, 5);
}
