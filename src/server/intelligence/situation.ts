import { db } from "@/lib/db";
import type { ExtractedSituation } from "@/ai/intelligencePrompts";

// Situation memory: real-world situations the person chose to describe
// ("college canteen, students I don't know around"). Only what they said is
// stored — the app never infers location from devices.

/** Saves a described situation; updates the conversation's latest one instead of duplicating it. */
export async function saveSituation(userId: string, skillId: string | null, conversationId: string | null, s: ExtractedSituation) {
  const details = {
    location: s.location,
    activity: s.activity,
    people: s.people,
    opportunities: s.opportunities,
    constraints: s.constraints,
    immediateGoal: s.immediateGoal,
    difficulty: s.difficulty,
    possibleActions: s.possibleActions,
  };
  const recent = conversationId
    ? await db.userSituation.findFirst({ where: { userId, conversationId, lastSeenAt: { gte: new Date(Date.now() - 6 * 3600_000) } }, orderBy: { lastSeenAt: "desc" } })
    : null;
  if (recent) {
    const prev = (recent.details ?? {}) as Record<string, unknown>;
    // Keep earlier details the new extraction didn't mention.
    const merged = Object.fromEntries(Object.entries({ ...prev, ...details }).map(([k, v]) => [k, v == null || (Array.isArray(v) && !v.length) ? (prev[k] ?? v) : v]));
    return db.userSituation.update({ where: { id: recent.id }, data: { summary: s.summary, details: merged, lastSeenAt: new Date() } });
  }
  return db.userSituation.create({ data: { userId, skillId, conversationId, summary: s.summary, details } });
}

/** The most recent situation that is still plausibly current (default: last 3 days). */
export async function currentSituation(userId: string, skillId: string, conversationId?: string, maxAgeHours = 72) {
  const since = new Date(Date.now() - maxAgeHours * 3600_000);
  if (conversationId) {
    const inConv = await db.userSituation.findFirst({ where: { userId, conversationId }, orderBy: { lastSeenAt: "desc" } });
    if (inConv) return inConv;
  }
  return db.userSituation.findFirst({ where: { userId, OR: [{ skillId }, { skillId: null }], lastSeenAt: { gte: since } }, orderBy: { lastSeenAt: "desc" } });
}
