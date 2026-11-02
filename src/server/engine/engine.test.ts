import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_DELTA, evidenceUpdate, initialDifficulty, nextDifficulty } from "./scoring";
import { selectNextSkill, type SkillCandidate } from "./selectSkill";
import { decayedStrength } from "./memory";
import { LEVELS, levelChange, levelForScore, levelProgress, levelToScore } from "../assessment/levels";
import { ALL_SKILLS } from "../skills/catalog";

test("catalog: five fixed core skills, each with its own framework", () => {
  const core = ALL_SKILLS.filter((s) => s.category === "core").map((s) => s.name);
  assert.deepEqual(core, ["Communication", "Confidence", "Discipline", "Problem-solving", "Adaptability"]);
  assert.equal(new Set(ALL_SKILLS.map((s) => s.slug)).size, ALL_SKILLS.length);
  for (const s of ALL_SKILLS) {
    assert.ok(s.framework.subskills.length >= 3, `${s.name} needs subskills`);
    assert.ok(s.framework.criteria.length >= 1 && s.framework.categories.length >= 1 && s.framework.progression, `${s.name} framework incomplete`);
  }
  assert.ok(ALL_SKILLS.find((s) => s.slug === "networking")!.framework.subskills.some((x) => x.label === "Following up"));
});

test("catalog: every skill has its own expert teacher", () => {
  const names = ALL_SKILLS.map((s) => s.framework.teacher?.name);
  assert.ok(names.every(Boolean), "missing teacher");
  assert.equal(new Set(names).size, ALL_SKILLS.length, "teacher names must be unique");
  for (const s of ALL_SKILLS) assert.ok(s.framework.teacher!.style.length > 20 && s.framework.teacher!.emoji);
});

test("self-selected levels map to scores inside the matching level band", () => {
  for (const l of LEVELS) assert.equal(levelForScore(levelToScore(l.value)).name, l.name);
  assert.equal(levelToScore(undefined), 55);
  assert.ok(levelToScore(1) < levelToScore(5));
});

test("level bands: progress and level-up detection", () => {
  assert.equal(levelForScore(0).name, "Beginner");
  assert.equal(levelForScore(45).name, "Capable");
  assert.equal(levelForScore(100).name, "Expert");
  const p = levelProgress(55);
  assert.equal(p.level.name, "Capable");
  assert.equal(p.pct, 50);
  assert.equal(p.pointsToNext, 10);
  assert.equal(levelProgress(95).next, null);
  assert.equal(levelChange(43, 46).change, 1);
  assert.equal(levelChange(46, 44).change, -1);
  assert.equal(levelChange(50, 60).change, 0);
});

const base = {
  score: 50,
  confidence: 0.1,
  evidenceCount: 0,
  difficulty: 3,
  completionStatus: "completed" as const,
  skillSignal: 1,
  evidenceStrength: 1,
  overcamePrevious: false,
  recentCompletions: 0,
};

test("evidenceUpdate is bounded and only rises with evidence", () => {
  const up = evidenceUpdate({ ...base, difficulty: 5 });
  assert.ok(up.delta > 0 && up.delta <= MAX_DELTA);
  assert.ok(up.reason.length > 0);
  assert.ok(evidenceUpdate({ ...base, difficulty: 5, overcamePrevious: true, recentCompletions: 5 }).delta <= MAX_DELTA);
});

test("evidenceUpdate: a claim without specific evidence never raises the score", () => {
  assert.equal(evidenceUpdate({ ...base, evidenceStrength: 0.2 }).delta, 0);
});

test("evidenceUpdate: unsuccessful or skipped attempts are never penalised", () => {
  assert.equal(evidenceUpdate({ ...base, completionStatus: "not_attempted" }).delta, 0);
  assert.ok(evidenceUpdate({ ...base, completionStatus: "unsuccessful", skillSignal: -1 }).delta >= 0);
  assert.equal(evidenceUpdate({ ...base, skillSignal: -0.8 }).delta, 0);
});

test("evidenceUpdate: partial < completed, established scores move slower, harder counts more", () => {
  const full = evidenceUpdate(base).delta;
  assert.ok(evidenceUpdate({ ...base, completionStatus: "partial" }).delta < full);
  assert.ok(evidenceUpdate({ ...base, evidenceCount: 20 }).delta < full);
  assert.ok(evidenceUpdate({ ...base, difficulty: 1 }).delta < evidenceUpdate({ ...base, difficulty: 5 }).delta);
});

test("evidenceUpdate clamps to 100", () => {
  assert.ok(evidenceUpdate({ ...base, score: 99.5, difficulty: 5 }).score <= 100);
});

test("difficulty adapts one level at a time", () => {
  assert.equal(initialDifficulty(20), 1);
  assert.equal(initialDifficulty(80), 4);
  assert.equal(nextDifficulty(3, { completionStatus: "not_attempted", recommendation: "harder" }), 2);
  assert.equal(nextDifficulty(3, { completionStatus: "unsuccessful", recommendation: "same" }), 2);
  assert.equal(nextDifficulty(3, { completionStatus: "partial", recommendation: "harder" }), 3);
  assert.equal(nextDifficulty(3, { completionStatus: "completed", recommendation: "harder" }), 4);
  assert.equal(nextDifficulty(5, { completionStatus: "completed", recommendation: "harder" }), 5);
  assert.equal(nextDifficulty(1, { completionStatus: "unsuccessful", recommendation: "easier" }), 1);
});

test("selectNextSkill prefers weak, stale skills and never repeats the last one", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  const c = (skillId: string, score: number, daysAgo: number | null): SkillCandidate => ({
    skillId,
    category: "core",
    score,
    confidence: 0.3,
    lastPracticedAt: daysAgo === null ? null : new Date(now.getTime() - daysAgo * 86_400_000),
  });
  const pool = [c("strong-recent", 85, 0), c("weak-stale", 25, 10), c("mid", 55, 3)];
  assert.equal(selectNextSkill(pool, { now, random: () => 0 })?.skillId, "weak-stale");
  assert.notEqual(selectNextSkill(pool, { now, random: () => 0, lastSkillId: "weak-stale" })?.skillId, "weak-stale");
});

test("insight strength halves every 30 days", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  const then = new Date(now.getTime() - 30 * 86_400_000);
  assert.ok(Math.abs(decayedStrength(1, then, now) - 0.5) < 1e-9);
});

test("built-in next steps never repeat and target the pain point", async () => {
  const { fallbackChallenge } = await import("./fallbackChallenges");
  const first = fallbackChallenge("confidence", 3);
  const second = fallbackChallenge("confidence", 3, { recentTitles: [first.title] });
  assert.notEqual(second.title, first.title);
  const third = fallbackChallenge("confidence", 3, { recentTitles: [first.title, second.title], painPoint: "Freezing when seniors talk" });
  assert.ok(third.title.startsWith("Try again:"));
  assert.ok(third.instructions.includes("Freezing when seniors talk"));
});
