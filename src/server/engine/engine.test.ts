import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_DELTA, initialDifficulty, nextDifficulty, updateScore } from "./scoring";
import { selectNextSkill, type SkillCandidate } from "./selectSkill";
import { decayedStrength } from "./memory";
import { LEVELS, levelChange, levelForScore, levelProgress, levelToScore } from "../assessment/levels";
import { ALL_SKILLS } from "../skills/catalog";

test("catalog has 12 core and 12 specific skills", () => {
  assert.equal(ALL_SKILLS.filter((s) => s.category === "core").length, 12);
  assert.equal(ALL_SKILLS.filter((s) => s.category === "specific").length, 12);
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

test("updateScore is bounded and moves in the signal direction", () => {
  const base = { score: 50, confidence: 0, difficulty: 5, evidenceStrength: 1, completed: true };
  const up = updateScore({ ...base, skillSignal: 1 });
  const down = updateScore({ ...base, skillSignal: -1 });
  assert.ok(up.delta > 0 && up.delta <= MAX_DELTA);
  assert.ok(down.delta < 0 && down.delta >= -MAX_DELTA);
  assert.ok(up.confidence > 0);
});

test("updateScore: vague evidence and high confidence dampen change", () => {
  const strong = updateScore({ score: 50, confidence: 0.1, difficulty: 3, skillSignal: 1, evidenceStrength: 1, completed: true });
  const vague = updateScore({ score: 50, confidence: 0.1, difficulty: 3, skillSignal: 1, evidenceStrength: 0.2, completed: true });
  const confident = updateScore({ score: 50, confidence: 0.9, difficulty: 3, skillSignal: 1, evidenceStrength: 1, completed: true });
  assert.ok(vague.delta < strong.delta);
  assert.ok(confident.delta < strong.delta);
});

test("updateScore clamps to 0..100", () => {
  assert.equal(updateScore({ score: 99, confidence: 0, difficulty: 5, skillSignal: 1, evidenceStrength: 1, completed: true }).score, 100);
  assert.equal(updateScore({ score: 1, confidence: 0, difficulty: 5, skillSignal: -1, evidenceStrength: 1, completed: false }).score, 0);
});

test("difficulty adapts", () => {
  assert.equal(initialDifficulty(20), 1);
  assert.equal(initialDifficulty(80), 4);
  assert.equal(nextDifficulty(3, { completed: false, perceivedDifficulty: 3, recommendation: "harder" }), 2);
  assert.equal(nextDifficulty(3, { completed: true, perceivedDifficulty: 1, recommendation: "same" }), 4);
  assert.equal(nextDifficulty(3, { completed: true, perceivedDifficulty: 3, recommendation: "harder" }), 4);
  assert.equal(nextDifficulty(5, { completed: true, perceivedDifficulty: 1, recommendation: "harder" }), 5);
  assert.equal(nextDifficulty(1, { completed: false, perceivedDifficulty: 5, recommendation: "easier" }), 1);
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
