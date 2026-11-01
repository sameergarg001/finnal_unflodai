// Skill levels. During setup the user picks their own level per skill; it
// becomes a starting score in the middle of that level's band. Scores then
// move with challenge performance, and crossing a band boundary = level up/down.

export interface Level {
  value: number; // 1–5
  name: string;
  description: string;
  min: number; // band start (inclusive)
  max: number; // band end (exclusive; 100 inclusive for the top level)
  score: number; // starting score when self-selected
}

export const LEVELS: Level[] = [
  { value: 1, name: "Beginner", description: "I rarely do this or find it very hard", min: 0, max: 25, score: 15 },
  { value: 2, name: "Developing", description: "I can do it sometimes, with effort", min: 25, max: 45, score: 35 },
  { value: 3, name: "Capable", description: "I do it fine in most situations", min: 45, max: 65, score: 55 },
  { value: 4, name: "Strong", description: "I'm good at it, even under pressure", min: 65, max: 85, score: 75 },
  { value: 5, name: "Expert", description: "Others come to me for this", min: 85, max: 100, score: 90 },
];

/** Starting score for a chosen level; unknown/missing → middle level. */
export function levelToScore(value: number | undefined | null): number {
  return LEVELS.find((l) => l.value === value)?.score ?? LEVELS[2].score;
}

export function levelForScore(score: number): Level {
  return LEVELS.find((l) => score < l.max) ?? LEVELS[LEVELS.length - 1];
}

export function levelByValue(value: number | null | undefined): Level | null {
  return LEVELS.find((l) => l.value === value) ?? null;
}

/** Progress within the current level and points needed for the next one. */
export function levelProgress(score: number) {
  const level = levelForScore(score);
  const next = LEVELS.find((l) => l.value === level.value + 1) ?? null;
  const pct = Math.round(((Math.min(score, level.max) - level.min) / (level.max - level.min)) * 100);
  return { level, next, pct: Math.max(0, Math.min(100, pct)), pointsToNext: next ? Math.max(0, next.min - score) : 0 };
}

/** Level change between two scores: positive = level up. */
export function levelChange(before: number, after: number) {
  const from = levelForScore(before);
  const to = levelForScore(after);
  return { from, to, change: to.value - from.value };
}
