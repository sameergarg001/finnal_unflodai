import { test } from "node:test";
import assert from "node:assert/strict";
import { POLICY, evaluateAttempt, nextDifficulty, overallScore, performanceOf, subskillDelta, tierOf, type AttemptInput, type Dimensions } from "../engine/scoring";
import { addContradiction, addSupport, computeStatus, findMatch, type EvidenceItem, type InsightState } from "./evidence";
import { explainScoreChange, groundObservations, quoteSupported, validSubskill } from "./guards";
import { stageForScore } from "./stages";

const dims = (v: number, extra: Partial<Dimensions> = {}): Dimensions => ({
  completion: v, execution: v, skillShown: v, situationDifficulty: 0.5, discomfort: v, improvement: null, reflection: v, ...extra,
});
const base: AttemptInput = {
  score: 35, completionStatus: "completed", dimensions: dims(0.85), evidenceStrength: 0.8, selfReportOnly: false,
  challengeDifficulty: 2, expectedDifficulty: 2, recentGood: 0, priorPoorStreak: 0,
};

// ─── Stages ────────────────────────────────────────────────────────────────
test("stages follow the score table", () => {
  assert.equal(stageForScore(0).name, "Foundation");
  assert.equal(stageForScore(20).name, "Foundation");
  assert.equal(stageForScore(21).name, "Beginner");
  assert.equal(stageForScore(40).name, "Beginner");
  assert.equal(stageForScore(41).name, "Developing");
  assert.equal(stageForScore(61).name, "Improving");
  assert.equal(stageForScore(81).name, "Advanced");
  assert.equal(stageForScore(100).name, "Advanced");
  assert.ok(stageForScore(15).baseDifficulty < stageForScore(75).baseDifficulty);
});

// ─── Scoring policy ────────────────────────────────────────────────────────
test("tiers map to the configured bands", () => {
  const ex = evaluateAttempt(base);
  assert.equal(ex.tier, "excellent");
  assert.ok(ex.delta >= 1 && ex.delta <= 3, `excellent delta ${ex.delta}`);
  const good = evaluateAttempt({ ...base, dimensions: dims(0.65) });
  assert.equal(good.tier, "good");
  assert.ok(good.delta >= 0.5 && good.delta <= 1.5, `good delta ${good.delta}`);
  const partial = evaluateAttempt({ ...base, dimensions: dims(0.45) });
  assert.equal(partial.tier, "partial");
  assert.ok(partial.delta >= 0 && partial.delta <= 0.5);
  assert.equal(evaluateAttempt({ ...base, dimensions: dims(0.3) }).delta, 0);
});

test("clicking complete / vague or feelings-only feedback never raises a score", () => {
  assert.equal(evaluateAttempt({ ...base, evidenceStrength: 0.2 }).delta, 0);
  assert.equal(evaluateAttempt({ ...base, selfReportOnly: true }).delta, 0);
  assert.equal(evaluateAttempt({ ...base, dimensions: { ...dims(0.9), skillShown: null } }).delta, 0);
});

test("a failed or skipped attempt is never penalised", () => {
  assert.equal(evaluateAttempt({ ...base, completionStatus: "not_attempted" }).delta, 0);
  const failed = evaluateAttempt({ ...base, completionStatus: "unsuccessful", dimensions: dims(0.1) });
  assert.equal(failed.delta, 0);
  // Even a strong, well-told unsuccessful attempt is capped at "partial".
  const brave = evaluateAttempt({ ...base, completionStatus: "unsuccessful", dimensions: dims(0.9) });
  assert.equal(brave.tier, "partial");
  assert.ok(brave.delta >= 0 && brave.delta <= 0.5);
});

test("only repeated, well-evidenced regression lowers a score, by a small amount", () => {
  const poor = { ...base, dimensions: dims(0.1), evidenceStrength: 0.8 };
  assert.equal(evaluateAttempt({ ...poor, priorPoorStreak: 0 }).delta, 0);
  assert.equal(evaluateAttempt({ ...poor, priorPoorStreak: 1 }).delta, 0);
  const r = evaluateAttempt({ ...poor, priorPoorStreak: 2 });
  assert.equal(r.tier, "regression");
  assert.equal(r.delta, POLICY.regression.delta);
  assert.equal(evaluateAttempt({ ...poor, priorPoorStreak: 2, evidenceStrength: 0.5 }).delta, 0, "weak evidence never lowers");
});

test("harder tasks and stronger evidence count more; bonus for consistency; bounded", () => {
  const easy = evaluateAttempt({ ...base, challengeDifficulty: 1, evidenceStrength: 0.5 }).delta;
  const hard = evaluateAttempt({ ...base, challengeDifficulty: 4, evidenceStrength: 0.95 }).delta;
  assert.ok(hard > easy);
  const consistent = evaluateAttempt({ ...base, dimensions: dims(0.65), recentGood: 3 }).delta;
  assert.ok(consistent >= evaluateAttempt({ ...base, dimensions: dims(0.65) }).delta);
  assert.ok(evaluateAttempt({ ...base, score: 99.5, challengeDifficulty: 5 }).score <= 100);
  assert.ok(evaluateAttempt({ ...base, score: 0.2, dimensions: dims(0.1), priorPoorStreak: 5 }).score >= 0);
});

test("performance ignores dimensions the AI couldn't judge; tier caps by completion", () => {
  assert.equal(performanceOf(dims(0.8, { improvement: null })), 0.8);
  assert.equal(performanceOf({ ...dims(0.8), skillShown: null }), null);
  assert.equal(tierOf(0.95, "partial"), "good");
  assert.equal(tierOf(0.95, "unsuccessful"), "partial");
});

test("subskills move in proportion to how clearly they were shown", () => {
  assert.equal(subskillDelta(1, 0), 0);
  assert.ok(subskillDelta(1, 1) > subskillDelta(1, 0.4));
  assert.equal(subskillDelta(-0.5, 1), -0.5);
});

test("overall score compares the same skills at start and now (no fake progress from adding skills)", () => {
  const o = overallScore([{ current: 40, baseline: 30 }, { current: 60, baseline: 60 }, { current: 50, baseline: null }, { current: null, baseline: null }]);
  assert.equal(o.current, 50);
  assert.equal(o.initial, 45);
  assert.equal(o.change, 5);
  assert.equal(o.skillsCounted, 3);
});

test("difficulty rises after an excellent result or consistent success, one step at a time", () => {
  assert.equal(nextDifficulty(3, { completionStatus: "completed", recommendation: "same", tier: "excellent" }), 4);
  assert.equal(nextDifficulty(3, { completionStatus: "completed", recommendation: "same", tier: "good", previousGoodStreak: 0 }), 3);
  assert.equal(nextDifficulty(3, { completionStatus: "completed", recommendation: "same", tier: "good", previousGoodStreak: 1 }), 4);
  assert.equal(nextDifficulty(5, { completionStatus: "completed", recommendation: "same", tier: "excellent" }), 5);
  assert.equal(nextDifficulty(3, { completionStatus: "completed", recommendation: "easier", tier: "none" }), 2);
  assert.equal(nextDifficulty(5, { completionStatus: "completed", recommendation: "easier", tier: "none", judged: false }), 5, "unjudged attempt keeps difficulty");
});

test("difficulty only rises after a good result, one step at a time", () => {
  assert.equal(nextDifficulty(3, { completionStatus: "completed", recommendation: "harder", tier: "partial" }), 3);
  assert.equal(nextDifficulty(3, { completionStatus: "completed", recommendation: "harder", tier: "good" }), 4);
  assert.equal(nextDifficulty(3, { completionStatus: "unsuccessful", recommendation: "harder", tier: "none" }), 2);
});

// ─── Evidence ──────────────────────────────────────────────────────────────
const item = (refId: string, at: string, source: EvidenceItem["source"] = "message", direction: EvidenceItem["direction"] = "supports"): EvidenceItem => ({ quote: "I freeze before talking to new people", source, refId, at, direction });
const empty = (): InsightState => ({ kind: "blocker", text: "Hesitates before approaching new people", subskill: "reducing-hesitation", evidence: [], situations: [], count: 0, status: "hypothesis", confidence: 0.3, lastSeenAt: new Date("2026-11-01") });

test("one sentence is only a hypothesis; repeated evidence from another source confirms", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  let s = addSupport(empty(), item("m1", "2026-11-01T10:00:00Z"), "college canteen", false, now);
  assert.equal(s.status, "hypothesis");
  s = addSupport(s, item("m1", "2026-11-01T10:00:00Z"), null, false, now);
  assert.equal(s.count, 1, "same message never counts twice");
  s = addSupport(s, item("c1", "2026-11-02T10:00:00Z", "feedback"), null, false, new Date("2026-11-02T10:00:00Z"));
  assert.equal(s.status, "confirmed");
  assert.ok(s.confidence > 0.3);
});

test("progress moves a weakness to improving, then resolved; new support re-opens it", () => {
  const t = new Date("2026-11-03T10:00:00Z");
  let s = addSupport(empty(), item("m1", "2026-11-01T10:00:00Z"), null, false, new Date("2026-11-01T10:00:00Z"));
  s = addSupport(s, item("c1", "2026-11-02T10:00:00Z", "feedback"), null, false, new Date("2026-11-02T10:00:00Z"));
  s = addContradiction(s, item("c2", "2026-11-03T10:00:00Z", "feedback", "contradicts"), t);
  assert.equal(s.status, "improving");
  s = addContradiction(s, item("c3", "2026-11-04T10:00:00Z", "feedback", "contradicts"), new Date("2026-11-04T10:00:00Z"));
  assert.equal(s.status, "resolved");
  s = addSupport(s, item("m9", "2026-11-05T10:00:00Z"), null, false, new Date("2026-11-05T10:00:00Z"));
  assert.notEqual(s.status, "resolved");
});

test("one-offs are temporary; old unconfirmed observations become outdated; rejected stays rejected", () => {
  const now = new Date("2026-11-01T10:00:00Z");
  assert.equal(addSupport(empty(), item("m1", now.toISOString()), null, true, now).status, "temporary");
  const old = addSupport(empty(), item("m1", "2026-08-01T10:00:00Z"), null, false, new Date("2026-08-01T10:00:00Z"));
  assert.equal(computeStatus(old, { now }), "outdated");
  assert.equal(computeStatus({ ...old, status: "rejected" }, { now }), "rejected");
});

test("matching merges similar observations and keeps different ones apart", () => {
  const existing = [{ kind: "blocker" as const, text: "Hesitates before approaching new people", subskill: "reducing-hesitation" }];
  assert.ok(findMatch(existing, "blocker", "Hesitation before approaching people", "reducing-hesitation"));
  assert.equal(findMatch(existing, "blocker", "Runs out of things to say", "listening"), undefined);
  assert.equal(findMatch(existing, "strength", "Hesitates before approaching new people", null), undefined);
});

// ─── Guards ────────────────────────────────────────────────────────────────
test("evidence quotes must come from what the user actually wrote", () => {
  const said = "Honestly I think too much about what they will think of me, so I never go up to them.";
  assert.ok(quoteSupported("I think too much about what they will think of me", said));
  assert.ok(!quoteSupported("I am afraid of public speaking in front of large audiences", said));
  const obs = groundObservations(
    [
      { kind: "blocker", label: "Overthinks others' judgement", subskill: "Reducing hesitation", quote: "think too much about what they will think", situation: null, temporary: false },
      { kind: "blocker", label: "Invented", subskill: null, quote: "I hate my job", situation: null, temporary: false },
    ],
    said,
    [{ key: "reducing-hesitation", label: "Reducing hesitation" }],
  );
  assert.equal(obs.length, 1);
  assert.equal(obs[0].subskill, "reducing-hesitation");
  assert.equal(validSubskill("made-up", [{ key: "a", label: "A" }]), null);
});

test("score changes are explained in plain language, including no-change cases", () => {
  const up = evaluateAttempt(base);
  assert.match(explainScoreChange("Confidence", 35, up, "You started a conversation with two classmates you didn't know"), /went from 35 to .* because you started a conversation/);
  const vague = evaluateAttempt({ ...base, evidenceStrength: 0.1 });
  assert.match(explainScoreChange("Confidence", 35, vague, ""), /stays at 35.*specific detail/);
});

// ─── AI output parsing (cases seen from real models) ───────────────────────
test("situations: synonym keys, plain text and list-or-string fields are understood", async () => {
  const { situationSchema } = await import("@/ai/intelligencePrompts");
  const a = situationSchema.parse({ place: "college canteen", people: "second-year students", goal: "talk to them", opportunities: "next table" });
  assert.equal(a?.location, "college canteen");
  assert.equal(a?.immediateGoal, "talk to them");
  assert.deepEqual(a?.opportunities, ["next table"]);
  assert.match(a?.summary ?? "", /canteen/);
  assert.equal(situationSchema.parse("At a networking event with creators")?.summary, "At a networking event with creators");
  assert.equal(situationSchema.parse(null), null);
  assert.equal(situationSchema.parse({}), null);
});

test("turns: unknown observation kinds map to known ones; bad items are dropped, not fatal", async () => {
  const { turnSchema } = await import("@/ai/intelligencePrompts");
  const t = turnSchema.parse({
    reply: "Okay.",
    intent: "made_up_intent",
    nextAction: "propose_task",
    situation: null,
    observations: [{ kind: "weakness", label: "Hesitates to start", quote: "I hesitate" }, { kind: "???", label: "x" }, "junk"],
    suggestedReplies: ["Yes", 42, ""],
  });
  assert.equal(t.intent, "other");
  assert.equal(t.observations.length, 1);
  assert.equal(t.observations[0].kind, "blocker");
  assert.deepEqual(t.suggestedReplies, ["Yes"]);
});

test("tasks: minutes like '10-15 minutes' parse; a text plan is ignored; empty steps dropped", async () => {
  const { taskSchema } = await import("@/ai/intelligencePrompts");
  const t = taskSchema.parse({
    title: "Say hi", struggle: "You freeze", objective: "Break the first barrier", whyThisChallenge: "You said you freeze before saying anything.",
    instructions: "At lunch, greet one classmate.", steps: ["Pick one person", "", "Say hi"], successCriteria: ["Said hi"],
    feedbackQuestions: ["What did you say?", "How did it feel?", ""], estimatedMinutes: "10-15 minutes", plan: "Start small and build up",
  });
  assert.equal(t.estimatedMinutes, 10);
  assert.equal(t.plan, null);
  assert.deepEqual(t.steps, ["Pick one person", "Say hi"]);
  assert.equal(t.feedbackQuestions.length, 2);
});

test("observations about the same behaviour merge despite different word forms", () => {
  const existing = [{ kind: "blocker" as const, text: "Freezing before approaching people", subskill: null }];
  assert.ok(findMatch(existing, "blocker", "Freezes before approaching new people", null));
  assert.equal(validSubskill("reducing_hesitation", [{ key: "reducing-hesitation", label: "Reducing hesitation" }]), "reducing-hesitation");
});

test("explanations read naturally whatever form the evidence summary takes", () => {
  const up = evaluateAttempt(base);
  assert.match(explainScoreChange("Confidence", 35, up, "approached Rahul and asked about his project"), /because you approached Rahul/);
  assert.match(explainScoreChange("Confidence", 35, up, "You approached Rahul"), /because you approached Rahul/);
  assert.match(explainScoreChange("Confidence", 35, up, "I spoke first in the standup"), /because you spoke first/);
});
