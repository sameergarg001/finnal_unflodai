import { db } from "@/lib/db";

// Long-term memory: compact insights that get reinforced when they recur and
// fade when they don't, so prompts stay small and relevant.

export type InsightKind = "strength" | "blocker" | "pattern" | "preference";
export interface NewInsight {
  kind: InsightKind;
  text: string;
}

const HALF_LIFE_DAYS = 30;
const SIMILARITY = 0.55;

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z']{3,}/g) ?? []);

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

export function decayedStrength(strength: number, lastSeenAt: Date, now = new Date()): number {
  const days = (now.getTime() - lastSeenAt.getTime()) / 86_400_000;
  return strength * Math.pow(0.5, days / HALF_LIFE_DAYS);
}

/** Merge new insights: reinforce similar existing ones, otherwise create. */
export async function rememberInsights(userId: string, skillId: string, insights: NewInsight[]) {
  if (insights.length === 0) return;
  const existing = await db.userInsight.findMany({ where: { userId } });
  const now = new Date();

  for (const ins of insights.slice(0, 4)) {
    const text = ins.text.trim().slice(0, 240);
    if (!text) continue;
    const w = words(text);
    const match = existing.find((e) => e.kind === ins.kind && jaccard(words(e.text), w) >= SIMILARITY);
    if (match) {
      const strength = Math.min(1, decayedStrength(match.strength, match.lastSeenAt, now) + 0.2);
      await db.userInsight.update({ where: { id: match.id }, data: { strength, lastSeenAt: now } });
    } else {
      const created = await db.userInsight.create({
        data: { userId, skillId, kind: ins.kind, text, strength: 0.5, lastSeenAt: now },
      });
      existing.push(created);
    }
  }
}

/** Top insights for prompting: skill-specific first, then general patterns. */
export async function recallInsights(userId: string, skillId: string, limit = 6) {
  // Rejected (by the user), outdated and resolved observations are never recalled.
  const all = await db.userInsight.findMany({ where: { userId, status: { notIn: ["rejected", "outdated", "resolved"] } } });
  const now = new Date();
  return all
    .map((i) => ({
      kind: i.kind,
      text: i.text,
      skillId: i.skillId,
      weight: decayedStrength(i.strength, i.lastSeenAt, now) * (i.skillId === skillId ? 1.5 : 1),
    }))
    .filter((i) => i.weight > 0.1)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}
