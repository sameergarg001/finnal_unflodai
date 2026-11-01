import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { DEFAULT_FEEDBACK_QUESTIONS, customFramework, type SkillFramework } from "../skills/catalog";
import { initialDifficulty } from "../engine/scoring";

/** Baseline for an added skill the user didn't rate (shown as "not yet assessed"). */
const ADDED_BASELINE = 40;

export class SkillError extends Error {}

export async function getActiveSkills(userId: string) {
  const rows = await db.userSkill.findMany({
    where: { userId, isActive: true },
    include: { skill: true },
    orderBy: { skill: { sortOrder: "asc" } },
  });
  return rows.map((r) => r.skill);
}

export function rubricOf(skill: { rubric: Prisma.JsonValue }): { key: string; label: string }[] {
  const r = skill.rubric as { dimensions?: { key: string; label: string }[] } | null;
  return r?.dimensions ?? [];
}

export function frameworkOf(skill: { rubric: Prisma.JsonValue }): SkillFramework & { feedbackQuestions: string[] } {
  const r = (skill.rubric ?? {}) as Partial<SkillFramework> & { dimensions?: SkillFramework["subskills"] };
  return {
    subskills: r.subskills ?? r.dimensions ?? [],
    criteria: r.criteria ?? [],
    categories: r.categories ?? [],
    feedbackQuestions: r.feedbackQuestions?.length ? r.feedbackQuestions : DEFAULT_FEEDBACK_QUESTIONS,
    progression: r.progression ?? "",
  };
}

/** Makes sure the five fixed core skills are on the user's dashboard. */
export async function ensureCoreSkills(userId: string) {
  const core = await db.skill.findMany({ where: { category: "core" }, select: { id: true } });
  await db.$transaction(
    core.map((s) =>
      db.userSkill.upsert({
        where: { userId_skillId: { userId, skillId: s.id } },
        create: { userId, skillId: s.id },
        update: { isActive: true, removedAt: null },
      }),
    ),
  );
}

/** A skill the current user may see: catalog skills, or their own custom skills. */
export async function getSkillForUser(userId: string, skillId: string) {
  const skill = await db.skill.findFirst({ where: { id: skillId, OR: [{ ownerId: null }, { ownerId: userId }] } });
  return skill;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Catalog + own custom skills matching a search, with "already added" flags. */
export async function searchSkills(userId: string, q: string) {
  const [skills, mine] = await Promise.all([
    db.skill.findMany({ where: { category: { not: "core" }, OR: [{ ownerId: null }, { ownerId: userId }] }, orderBy: { sortOrder: "asc" } }),
    db.userSkill.findMany({ where: { userId, isActive: true }, select: { skillId: true } }),
  ]);
  const active = new Set(mine.map((m) => m.skillId));
  const query = norm(q);
  return skills
    .filter((s) => !query || norm(s.name).includes(query) || norm(s.description).includes(query))
    .map((s) => ({ id: s.id, name: s.name, description: s.description, custom: s.category === "custom", added: active.has(s.id) }));
}

async function activate(userId: string, skillId: string, selfScore?: number | null) {
  await db.userSkill.upsert({
    where: { userId_skillId: { userId, skillId } },
    create: { userId, skillId },
    update: { isActive: true, removedAt: null },
  });
  const existing = await db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId } } });
  if (existing) {
    if (selfScore != null) await setSelfScore(userId, skillId, selfScore, "Self-assessment when re-adding skill");
    return;
  }
  const base = selfScore ?? ADDED_BASELINE;
  await db.skillScore.create({
    data: { userId, skillId, score: base, selfScore: selfScore ?? null, confidence: 0.1, difficulty: initialDifficulty(base) },
  });
  await db.skillScoreEvent.create({
    data: {
      userId,
      skillId,
      delta: 0,
      previousScore: null,
      newScore: base,
      source: "assessment",
      reason: selfScore != null ? "Self-assessment when adding skill" : "Starting baseline (not yet assessed)",
    },
  });
}

/** Adds a catalog skill by id. Prevents duplicates. */
export async function addCatalogSkill(userId: string, skillId: string, selfScore?: number | null) {
  const skill = await getSkillForUser(userId, skillId);
  if (!skill) throw new SkillError("Skill not found");
  const us = await db.userSkill.findUnique({ where: { userId_skillId: { userId, skillId } } });
  if (us?.isActive) throw new SkillError(`${skill.name} is already on your dashboard`);
  await activate(userId, skillId, selfScore);
  return skill;
}

/**
 * Adds a skill by name. Reuses a catalog skill (or the user's own custom skill)
 * with the same name instead of creating a duplicate.
 */
export async function addSkillByName(userId: string, rawName: string, subskills: string[], selfScore?: number | null) {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 60);
  if (name.length < 2) throw new SkillError("Type the name of the skill");
  const key = norm(name);
  const candidates = await db.skill.findMany({ where: { OR: [{ ownerId: null }, { ownerId: userId }] } });
  const match = candidates.find((s) => norm(s.name) === key || norm(s.slug) === key);
  if (match) {
    if (match.category === "core") throw new SkillError(`${match.name} is one of your core skills — it's always on your dashboard`);
    return addCatalogSkill(userId, match.id, selfScore);
  }
  const framework = customFramework(name, subskills);
  const skill = await db.skill.create({
    data: {
      slug: `custom-${userId}-${key.replace(/ /g, "-")}`.slice(0, 120),
      name: name[0].toUpperCase() + name.slice(1),
      category: "custom",
      description: `Your own skill: ${name}.`,
      rubric: { dimensions: framework.subskills, ...framework },
      sortOrder: 1000,
      ownerId: userId,
    },
  });
  await activate(userId, skill.id, selfScore);
  return skill;
}

/** Removes an added skill from the dashboard. Core skills can't be removed; history is kept. */
export async function removeSkill(userId: string, skillId: string) {
  const skill = await getSkillForUser(userId, skillId);
  if (!skill) throw new SkillError("Skill not found");
  if (skill.category === "core") throw new SkillError("Core skills always stay on your dashboard");
  await db.userSkill.updateMany({ where: { userId, skillId }, data: { isActive: false, removedAt: new Date() } });
  // An open proposal is dropped; an active challenge is kept so feedback can still be given.
  await db.challenge.updateMany({ where: { userId, skillId, status: "proposed" }, data: { status: "discarded" } });
}

/**
 * Records a self-assessment. The evidence-based score starts at the
 * self-rating, but only until real evidence exists — after that, self-ratings
 * never overwrite what UnfoldAI has measured.
 */
export async function setSelfScore(userId: string, skillId: string, selfScore: number, reason = "Self-assessment") {
  const value = Math.round(Math.min(100, Math.max(0, selfScore)));
  const sc = await db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId } } });
  const useAsBaseline = !sc || sc.evidenceCount === 0;
  const score = useAsBaseline ? value : sc.score;
  await db.$transaction([
    db.skillScore.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: { userId, skillId, score, selfScore: value, confidence: 0.2, difficulty: initialDifficulty(value) },
      update: useAsBaseline ? { score, selfScore: value, difficulty: initialDifficulty(value) } : { selfScore: value },
    }),
    db.skillScoreEvent.create({
      data: {
        userId,
        skillId,
        delta: useAsBaseline ? value - (sc?.score ?? value) : 0,
        previousScore: sc?.score ?? null,
        newScore: score,
        source: "assessment",
        reason: useAsBaseline ? `${reason}: ${value}/100 (used as starting baseline)` : `${reason}: ${value}/100 (evidence score unchanged)`,
        evidence: { selfScore: value },
      },
    }),
  ]);
}
