// Deterministic choice of which skill to practise next (no AI involved).

export interface SkillCandidate {
  skillId: string;
  category: "core" | "specific";
  score: number;
  confidence: number;
  lastPracticedAt: Date | null;
}

export function priority(c: SkillCandidate, now: Date): number {
  const weakness = (100 - c.score) / 100; // weaker → practise more
  const days = c.lastPracticedAt ? (now.getTime() - c.lastPracticedAt.getTime()) / 86_400_000 : 14;
  const staleness = Math.min(days / 7, 1); // not practised recently
  const uncertainty = 1 - c.confidence; // we know little → gather evidence
  const chosen = c.category === "specific" ? 1 : 0; // user explicitly asked for it
  // Small bonus for skills the user explicitly chose: a tie-breaker, not an override of real weakness.
  return 0.45 * weakness + 0.3 * staleness + 0.15 * uncertainty + 0.05 * chosen;
}

/**
 * Picks the highest-priority skill, never repeating the previous one, with a
 * little randomness among close candidates so it doesn't feel mechanical.
 */
export function selectNextSkill(
  candidates: SkillCandidate[],
  opts: { lastSkillId?: string | null; now?: Date; random?: () => number } = {},
): SkillCandidate | null {
  const now = opts.now ?? new Date();
  const rand = opts.random ?? Math.random;
  const pool = candidates.length > 1 ? candidates.filter((c) => c.skillId !== opts.lastSkillId) : candidates;
  if (pool.length === 0) return null;

  const ranked = pool
    .map((c) => ({ c, p: priority(c, now) + rand() * 0.05 }))
    .sort((a, b) => b.p - a.p);
  return ranked[0].c;
}
