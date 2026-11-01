// Pure scoring functions. The AI only *suggests* signals about an attempt;
// this code decides every number, with fixed, testable rules:
// - a claim of completion alone never raises a score (needs specific evidence)
// - unsuccessful or skipped attempts are never penalised
// - one activity can move a score by at most MAX_DELTA points
// - established scores (lots of evidence) move more slowly

export const MAX_DELTA = 5;
/** Below this evidence strength, an attempt is too vague to raise a score. */
export const MIN_EVIDENCE = 0.3;

export type CompletionStatus = "completed" | "partial" | "unsuccessful" | "not_attempted";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Initial adaptive difficulty (1–5) from a baseline score. */
export function initialDifficulty(score: number): number {
  if (score < 30) return 1;
  if (score < 50) return 2;
  if (score < 70) return 3;
  return 4;
}

export interface EvidenceInput {
  score: number;
  confidence: number;
  /** Number of earlier evidence-based assessments for this skill. */
  evidenceCount: number;
  difficulty: number; // 1–5, of the challenge attempted
  completionStatus: CompletionStatus;
  /** -1..1: how well the attempt demonstrated the skill (from analysis). */
  skillSignal: number;
  /** 0..1: how specific/credible the user's account is (from analysis). */
  evidenceStrength: number;
  /** Analysis found evidence of overcoming a previously identified weakness. */
  overcamePrevious: boolean;
  /** Other completed challenges in this skill in the last 14 days (consistency). */
  recentCompletions: number;
}

export interface EvidenceUpdate {
  delta: number;
  score: number;
  confidence: number;
  /** Human-readable reason, stored with the score change. */
  reason: string;
}

const COMPLETION_FACTOR: Record<CompletionStatus, number> = {
  completed: 1,
  partial: 0.5,
  unsuccessful: 0.15, // an honest attempt can show a little learning
  not_attempted: 0,
};

export function evidenceUpdate(i: EvidenceInput): EvidenceUpdate {
  const signal = clamp(i.skillSignal, -1, 1);
  const strength = clamp(i.evidenceStrength, 0, 1);
  const confidence = clamp(i.confidence + (i.completionStatus === "not_attempted" ? 0 : 0.05 * strength), 0, 0.95);
  const keep = (reason: string): EvidenceUpdate => ({ delta: 0, score: i.score, confidence, reason });

  if (i.completionStatus === "not_attempted") return keep("Not attempted — no change (never a penalty).");
  if (strength < MIN_EVIDENCE) return keep("Feedback too general to count as evidence — no change. Share specific details next time.");
  if (signal <= 0) return keep("Attempt didn't yet show the skill clearly — no change (never a penalty).");

  const difficultyWeight = 0.7 + 0.15 * (clamp(i.difficulty, 1, 5) - 1); // 0.7 .. 1.3
  const damping = 1 / (1 + 0.08 * i.evidenceCount); // established scores move slower
  const headroom = (100 - i.score) / 100; // harder to gain near the top
  let raw = MAX_DELTA * signal * strength * difficultyWeight * COMPLETION_FACTOR[i.completionStatus] * damping * (0.5 + 0.5 * headroom);
  const bonuses: string[] = [];
  if (i.overcamePrevious && i.completionStatus !== "unsuccessful") {
    raw += 0.6;
    bonuses.push("overcame a previous difficulty");
  }
  if (i.recentCompletions >= 2 && i.completionStatus === "completed") {
    raw += 0.4;
    bonuses.push("consistent practice");
  }
  const delta = round1(clamp(raw, 0, MAX_DELTA));
  const score = clamp(round1(i.score + delta), 0, 100);
  const actual = round1(score - i.score);
  const what = { completed: "Completed", partial: "Partly completed", unsuccessful: "Attempted" }[i.completionStatus];
  return {
    delta: actual,
    score,
    confidence,
    reason: `${what} a difficulty-${i.difficulty} challenge with ${strength >= 0.7 ? "specific" : "some"} evidence${bonuses.length ? `; ${bonuses.join(", ")}` : ""} (+${actual}).`,
  };
}

export type DifficultyRecommendation = "easier" | "same" | "harder";

/**
 * Next difficulty: user outcome first, AI recommendation second, never moving
 * more than one level at a time.
 */
export function nextDifficulty(current: number, opts: { completionStatus: CompletionStatus; recommendation: DifficultyRecommendation }): number {
  let step = 0;
  if (opts.completionStatus === "not_attempted" || opts.completionStatus === "unsuccessful") step = -1;
  else if (opts.completionStatus === "partial") step = opts.recommendation === "easier" ? -1 : 0;
  else step = opts.recommendation === "harder" ? 1 : opts.recommendation === "easier" ? -1 : 0;
  return clamp(current + step, 1, 5);
}
