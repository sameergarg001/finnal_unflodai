import { db } from "@/lib/db";
import { AiError } from "@/ai/types";
import { generateStructured, generateText } from "@/ai/client";
import {
  ANALYSIS_SYSTEM,
  CHALLENGE_SYSTEM,
  COACH_TURN_SYSTEM,
  HELP_SYSTEM,
  analysisPrompt,
  analysisSchema,
  challengePrompt,
  challengeSchema,
  coachTurnPrompt,
  coachTurnSchema,
  helpPrompt,
  type Analysis,
  type ChallengeRequest,
  type CoachTurn,
  type GeneratedChallenge,
  type SkillContext,
} from "@/ai/prompts";
import { rateLimit } from "@/lib/rateLimit";
import { fallbackChallenge } from "../engine/fallbackChallenges";
import { recallInsights, rememberInsights } from "../engine/memory";
import { evidenceUpdate, nextDifficulty, type CompletionStatus } from "../engine/scoring";
import { selectNextSkill, type SkillCandidate } from "../engine/selectSkill";
import { frameworkOf, getSkillForUser } from "./skills";

// Challenge lifecycle: proposed → active (accepted) → done (feedback given)
//                      proposed → discarded (user asked for another)
//                      active   → abandoned (user gave up; never penalised)
// Rule: at most one active challenge per skill. Nothing expires on its own —
// the challenge waits for the user, however long they take.

export class CoachError extends Error {}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const firstName = (name: string | null | undefined) => (name ?? "there").trim().split(/\s+/)[0] || "there";

/** AI calls per user per hour (protects cost/quota). */
const AI_CALLS_PER_HOUR = 60;
function checkAiBudget(userId: string) {
  if (!rateLimit(`ai:${userId}`, AI_CALLS_PER_HOUR, 3600_000)) {
    throw new CoachError("You're going fast! Please wait a few minutes before sending more.");
  }
}

export type AnalysisReport = { wentWell: string[]; toImprove: string[]; nextFocus: string; nextSubskill: string | null; overcamePrevious: boolean };

// ─── Context management ──────────────────────────────────────────────────

/** Gathers everything the coach should know about the user for one skill. */
export async function buildSkillContext(userId: string, skillId: string): Promise<SkillContext> {
  const [user, skill, sc, recent, active, lastConv, insights] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } }),
    db.skill.findUniqueOrThrow({ where: { id: skillId } }),
    db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId } } }),
    db.challenge.findMany({
      where: { userId, skillId, status: { in: ["done", "abandoned", "active"] } },
      include: { reflection: { include: { analysis: true } } },
      orderBy: { assignedAt: "desc" },
      take: 6,
    }),
    db.challenge.findFirst({ where: { userId, skillId, status: "active" } }),
    db.conversation.findFirst({ where: { userId, skillId, summary: { not: null } }, orderBy: { updatedAt: "desc" } }),
    recallInsights(userId, skillId, 8),
  ]);
  const fw = frameworkOf(skill);
  const skillInsights = insights.filter((i) => i.skillId === skillId || i.skillId === null);
  return {
    firstName: firstName(user.name),
    profile: { age: user.age, profession: user.profile?.occupation, goal: user.profile?.goals, about: user.profile?.about },
    skill: {
      name: skill.name,
      description: skill.description,
      subskills: fw.subskills,
      criteria: fw.criteria,
      categories: fw.categories,
      progression: fw.progression,
    },
    scores: {
      selfAssessment: sc?.selfScore ?? null,
      evidenceBased: sc && sc.evidenceCount > 0 ? sc.score : null,
      evidenceCount: sc?.evidenceCount ?? 0,
      difficulty: sc?.difficulty ?? 2,
    },
    weaknesses: skillInsights.filter((i) => i.kind === "blocker").map((i) => i.text).slice(0, 5),
    strengths: skillInsights.filter((i) => i.kind === "strength").map((i) => i.text).slice(0, 3),
    previousChallenges: recent.map((c) => {
      const report = c.reflection?.analysis?.report as AnalysisReport | null | undefined;
      return {
        title: c.title,
        subskill: c.subskill,
        difficulty: c.difficulty,
        status: c.status,
        outcome: c.reflection?.completionStatus ?? null,
        whatHappened: c.reflection?.whatHappened?.slice(0, 400) ?? null,
        wentWell: report?.wentWell,
        toImprove: report?.toImprove,
        nextFocus: c.reflection?.analysis?.nextFocus ?? null,
      };
    }),
    activeChallenge: active ? { title: active.title, acceptedAt: (active.acceptedAt ?? active.assignedAt).toISOString() } : null,
    lastSessionSummary: lastConv?.summary ?? null,
  };
}

// ─── Reading ──────────────────────────────────────────────────────────────

export async function getActiveChallenges(userId: string) {
  return db.challenge.findMany({
    where: { userId, status: "active" },
    include: { skill: true },
    orderBy: { acceptedAt: "desc" },
  });
}

export async function getChallengeForUser(userId: string, challengeId: string) {
  return db.challenge.findFirst({
    where: { id: challengeId, userId },
    include: { skill: true, reflection: { include: { analysis: true } } },
  });
}

export async function getConversationForUser(userId: string, conversationId: string) {
  return db.conversation.findFirst({
    where: { id: conversationId, userId },
    include: { skill: true, messages: { orderBy: { createdAt: "asc" } }, challenges: { orderBy: { assignedAt: "asc" } } },
  });
}

/** Suggests which skill to work on (weak, not practised recently). */
export async function suggestSkillId(userId: string): Promise<string | null> {
  const [active, scores, last, lastPracticed] = await Promise.all([
    db.userSkill.findMany({ where: { userId, isActive: true }, include: { skill: true } }),
    db.skillScore.findMany({ where: { userId } }),
    db.challenge.findFirst({ where: { userId, status: { not: "discarded" } }, orderBy: { assignedAt: "desc" } }),
    db.challenge.groupBy({ by: ["skillId"], where: { userId, status: "done" }, _max: { completedAt: true } }),
  ]);
  const scoreBySkill = new Map(scores.map((s) => [s.skillId, s]));
  const lastBySkill = new Map(lastPracticed.map((l) => [l.skillId, l._max.completedAt]));
  const candidates: SkillCandidate[] = active.map((us) => ({
    skillId: us.skillId,
    category: us.skill.category === "core" ? "core" : "specific",
    score: scoreBySkill.get(us.skillId)?.score ?? 50,
    confidence: scoreBySkill.get(us.skillId)?.confidence ?? 0.1,
    lastPracticedAt: lastBySkill.get(us.skillId) ?? null,
  }));
  return selectNextSkill(candidates, { lastSkillId: last?.skillId, random: () => 0 })?.skillId ?? null;
}

// ─── Conversations ───────────────────────────────────────────────────────

async function addMessage(conversationId: string, role: "user" | "coach", content: string, kind = "text", challengeId?: string) {
  await db.conversationMessage.create({ data: { conversationId, role, content, kind, challengeId } });
  await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
}

/** Opening line: knows the user's history so they never repeat themselves. */
function greeting(ctx: SkillContext): string {
  const last = ctx.previousChallenges.find((c) => c.status === "done");
  if (last?.nextFocus) {
    return `Welcome back, ${ctx.firstName}. Last time you did "${last.title}". The next focus we found was: ${last.nextFocus.replace(/\.$/, "")}. Is that still what you want to work on, or is something else going on?`;
  }
  if (ctx.weaknesses[0]) {
    return `Hi ${ctx.firstName}. Earlier you mentioned: "${ctx.weaknesses[0]}". Do you want to work on that in ${ctx.skill.name}, or something else?`;
  }
  return `Hi ${ctx.firstName}! What would you like to improve in ${ctx.skill.name.toLowerCase()}?`;
}

/**
 * Opens the coaching session for a skill. If the skill has an active challenge,
 * returns that challenge's conversation (the coach waits for feedback).
 * Otherwise resumes an open session or starts a new one.
 */
export async function startCoachSession(userId: string, skillId: string, opts: { fresh?: boolean; firstMessage?: string } = {}) {
  const skill = await getSkillForUser(userId, skillId);
  if (!skill) throw new CoachError("Skill not found");
  const us = await db.userSkill.findUnique({ where: { userId_skillId: { userId, skillId } } });
  if (!us?.isActive) throw new CoachError(`Add ${skill.name} to your dashboard first`);

  const active = await db.challenge.findFirst({ where: { userId, skillId, status: "active" } });
  if (active?.conversationId) return { conversationId: active.conversationId, activeChallengeId: active.id };

  if (!opts.fresh) {
    const open = await db.conversation.findFirst({
      where: { userId, skillId, status: "open", phase: { in: ["understanding", "proposed"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (open) {
      if (opts.firstMessage) await sendCoachMessage(userId, open.id, opts.firstMessage);
      return { conversationId: open.id, activeChallengeId: null };
    }
  }
  // Close earlier open sessions for this skill; their proposals are dropped.
  await db.conversation.updateMany({ where: { userId, skillId, status: "open" }, data: { status: "closed" } });
  await db.challenge.updateMany({ where: { userId, skillId, status: "proposed" }, data: { status: "discarded" } });

  const ctx = await buildSkillContext(userId, skillId);
  const conv = await db.conversation.create({ data: { userId, skillId } });
  await addMessage(conv.id, "coach", greeting(ctx));
  if (opts.firstMessage) await sendCoachMessage(userId, conv.id, opts.firstMessage);
  return { conversationId: conv.id, activeChallengeId: null };
}

type ConvContext = { situation?: string; barriers?: string[]; goal?: string; focusSubskill?: string | null; questions?: number };

/**
 * Scripted interview used only when the AI is unavailable:
 * 1st answer = goal, 2nd = situation, 3rd = barrier → challenge.
 */
function scriptedTurn(userTurns: string[], c: ConvContext): CoachTurn {
  const n = userTurns.length;
  const last = userTurns[n - 1] ?? "";
  const goal = c.goal || userTurns[0]?.slice(0, 300) || "";
  const situation = n >= 2 ? (c.situation || userTurns[1].slice(0, 600)) : c.situation ?? "";
  const barriers = n >= 3 ? [...(c.barriers ?? []), last.slice(0, 200)].slice(-4) : c.barriers ?? [];
  if (n >= 3 || /challenge|task|give me/i.test(last)) {
    return { reply: "Got it — here's a challenge for that.", ready: true, situation, barriers, goal, focusSubskill: null };
  }
  const reply = n === 1 ? "Where do you usually face this — what kind of situation?" : "What stops you in that moment? What goes through your mind?";
  return { reply, ready: false, situation, barriers, goal, focusSubskill: null };
}

/** Handles a user message in a coaching conversation, depending on its phase. */
export async function sendCoachMessage(userId: string, conversationId: string, text: string) {
  const message = text.trim().slice(0, 1500);
  if (message.length < 1) throw new CoachError("Type a message");
  const conv = await getConversationForUser(userId, conversationId);
  if (!conv) throw new CoachError("Conversation not found");
  checkAiBudget(userId);

  await addMessage(conv.id, "user", message);
  const ctx = await buildSkillContext(userId, conv.skillId);
  const c = (conv.context ?? {}) as ConvContext;

  // Active challenge (or waiting for analysis): the message is a request for help.
  const active = conv.challenges.find((ch) => ch.status === "active");
  if (conv.phase === "active" && active) {
    await addMessage(conv.id, "coach", await helpWith(ctx, active, message, conv.messages), "text", active.id);
    return;
  }

  // A challenge is on the table: the user is telling us more about their situation.
  const proposed = conv.challenges.find((ch) => ch.status === "proposed");
  if (conv.phase === "proposed" && proposed) {
    await proposeChallenge(userId, conv.id, { mode: "updated", userNote: message });
    return;
  }

  // After feedback was reviewed, a new message starts the next round of understanding.
  if (conv.phase === "reviewed" || conv.phase === "feedback") {
    await db.conversation.update({ where: { id: conv.id }, data: { phase: "understanding" } });
  }

  const history = [...conv.messages.filter((m) => m.kind === "text"), { role: "user", content: message }]
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content }));
  let turn: CoachTurn;
  try {
    turn = (await generateStructured(coachTurnSchema, { system: COACH_TURN_SYSTEM, prompt: coachTurnPrompt(ctx, history), temperature: 0.5, timeoutMs: 45_000 })).data;
  } catch (e) {
    console.warn("[coach] AI turn failed, using scripted question:", (e as Error).message);
    const sinceStart = conv.messages.filter((m) => m.role === "user" && m.kind === "text").map((m) => m.content);
    turn = scriptedTurn([...sinceStart, message], c);
  }
  // Safety net: never more than 4 questions before a challenge.
  const questions = (c.questions ?? 0) + 1;
  if (questions >= 4) turn.ready = true;

  const context: ConvContext = {
    situation: turn.situation || c.situation,
    barriers: turn.barriers.length ? turn.barriers : c.barriers,
    goal: turn.goal || c.goal,
    focusSubskill: turn.focusSubskill ?? c.focusSubskill ?? null,
    questions,
  };
  const summary = [context.goal && `Goal: ${context.goal}`, context.situation && `Situation: ${context.situation}`, context.barriers?.length && `Barriers: ${context.barriers.join("; ")}`]
    .filter(Boolean)
    .join("\n");
  await db.conversation.update({ where: { id: conv.id }, data: { context, summary: summary || null } });
  await addMessage(conv.id, "coach", turn.reply);
  if (turn.ready) await proposeChallenge(userId, conv.id, { mode: "new" });
}

async function helpWith(ctx: SkillContext, ch: { title: string; objective: string | null; instructions: string; steps: unknown }, question: string, msgs: { role: string; content: string }[]) {
  try {
    const res = await generateText({
      system: HELP_SYSTEM,
      prompt: helpPrompt(ctx, { title: ch.title, objective: ch.objective, instructions: ch.instructions, steps: asStrings(ch.steps) }, question, msgs.slice(-6).map((m) => ({ role: m.role, content: m.content }))),
      temperature: 0.6,
      timeoutMs: 45_000,
    });
    return res.text.slice(0, 2000);
  } catch (e) {
    console.warn("[coach] help failed:", (e as Error).message);
    if (e instanceof AiError) throw new CoachError("Your coach couldn't answer right now (the AI service is busy). Please try again in a minute.");
    throw e;
  }
}

// ─── Challenge generation & actions ──────────────────────────────────────

/** Generates a challenge (status "proposed") and posts it into the conversation. */
async function proposeChallenge(userId: string, conversationId: string, opts: { mode: ChallengeRequest["mode"]; userNote?: string | null; easier?: boolean }) {
  const conv = await db.conversation.findFirstOrThrow({ where: { id: conversationId, userId }, include: { skill: true, challenges: true } });
  const ctx = await buildSkillContext(userId, conv.skillId);
  const c = (conv.context ?? {}) as ConvContext;
  const proposedNow = conv.challenges.filter((ch) => ch.status === "proposed");
  const sc = await db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId: conv.skillId } } });

  let difficulty = sc?.difficulty ?? 2;
  if (opts.mode === "easier") difficulty = Math.max(1, Math.min(difficulty, ...proposedNow.map((p) => p.difficulty)) - 1);
  const last = await db.challenge.findFirst({
    where: { userId, skillId: conv.skillId, status: "done" },
    include: { reflection: { include: { analysis: true } } },
    orderBy: { completedAt: "desc" },
  });
  const lastReport = last?.reflection?.analysis?.report as AnalysisReport | null | undefined;

  const avoid = (await db.challenge.findMany({ where: { userId, skillId: conv.skillId }, orderBy: { assignedAt: "desc" }, take: 8, select: { title: true } })).map((x) => x.title);
  const req: ChallengeRequest = {
    difficulty,
    situation: c.situation ?? "",
    barriers: c.barriers ?? [],
    goal: c.goal ?? "",
    focusSubskill: c.focusSubskill ?? lastReport?.nextSubskill ?? null,
    mode: opts.mode,
    avoidTitles: avoid,
    userNote: opts.userNote ?? null,
  };

  let draft: GeneratedChallenge;
  let modelVersion = "fallback";
  try {
    const res = await generateStructured(challengeSchema, { system: CHALLENGE_SYSTEM, prompt: challengePrompt(ctx, req), temperature: 0.7, timeoutMs: 60_000 });
    draft = res.data;
    modelVersion = res.modelVersion;
  } catch (e) {
    console.warn("[coach] AI challenge failed, using built-in:", (e as Error).message);
    const fb = fallbackChallenge(conv.skill.slug, difficulty, { recentTitles: avoid, painPoint: ctx.weaknesses[0], skillName: conv.skill.name });
    const sentences = fb.instructions.split(/(?<=[.!?])\s+(?=[A-Z"])/).map((x) => x.trim()).filter((x) => x.length > 3);
    const multi = sentences.length >= 2;
    draft = {
      title: fb.title,
      struggle: c.barriers?.[0] ?? ctx.weaknesses[0] ?? `Building your ${conv.skill.name.toLowerCase()}`,
      objective: fb.whyThisChallenge,
      instructions: multi ? `Built-in challenge (your AI coach is offline right now). ${fb.whyThisChallenge}` : fb.instructions,
      steps: multi ? sentences.slice(0, 7) : [],
      expectedOutcome: fb.successCriteria.join("; "),
      subskill: "",
      example: null,
      feedbackInstructions: "Afterwards, notice what you did, how it felt and what was hard.",
      successCriteria: fb.successCriteria,
      estimatedMinutes: fb.estimatedMinutes,
      whyThisChallenge: fb.whyThisChallenge,
    };
  }
  const fw = frameworkOf(conv.skill);
  const subskill = fw.subskills.find((s) => s.key === draft.subskill || s.label.toLowerCase() === draft.subskill.toLowerCase())?.key ?? null;

  // Only one proposal at a time in a conversation.
  await db.challenge.updateMany({ where: { conversationId, status: "proposed" }, data: { status: "discarded" } });
  const ch = await db.challenge.create({
    data: {
      userId,
      skillId: conv.skillId,
      conversationId,
      situation: req.situation || null,
      struggle: draft.struggle,
      previousId: last?.id ?? null,
      stepNumber: (await db.challenge.count({ where: { userId, skillId: conv.skillId, status: { in: ["done", "active", "abandoned"] } } })) + 1,
      subskill,
      title: draft.title,
      objective: draft.objective,
      instructions: draft.instructions,
      steps: draft.steps,
      expectedOutcome: draft.expectedOutcome,
      example: draft.example,
      feedbackInstructions: draft.feedbackInstructions,
      successCriteria: draft.successCriteria,
      whyThisChallenge: draft.whyThisChallenge,
      difficulty, // decided by the backend, not the AI
      estimatedMinutes: draft.estimatedMinutes,
      status: "proposed",
      generationContext: JSON.parse(JSON.stringify({ request: req, scores: ctx.scores })),
      modelVersion,
    },
  });
  await db.conversation.update({ where: { id: conversationId }, data: { phase: "proposed" } });
  await addMessage(conversationId, "coach", draft.title, "challenge", ch.id);
  return ch;
}

export type ChallengeAction = "accept" | "another" | "easier" | "explain";

export async function challengeAction(userId: string, challengeId: string, action: ChallengeAction) {
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId }, include: { skill: true } });
  if (!ch?.conversationId) throw new CoachError("Challenge not found");
  if (ch.status !== "proposed" && action !== "explain") throw new CoachError("This challenge can't be changed any more");
  checkAiBudget(userId);

  switch (action) {
    case "accept": {
      const other = await db.challenge.findFirst({ where: { userId, skillId: ch.skillId, status: "active" } });
      if (other) throw new CoachError(`You already have an active ${ch.skill.name} challenge. Finish or abandon it first.`);
      const now = new Date();
      await db.challenge.update({ where: { id: ch.id }, data: { status: "active", acceptedAt: now } });
      await db.conversation.update({ where: { id: ch.conversationId }, data: { phase: "active" } });
      await addMessage(ch.conversationId, "user", "I'll take this challenge.", "event", ch.id);
      await addMessage(ch.conversationId, "coach", "Great. Your challenge is saved — do it whenever the moment comes, then come back and tell me how it went. I'll wait. If you get stuck, ask me here.", "text", ch.id);
      return ch;
    }
    case "another":
      await addMessage(ch.conversationId, "user", "Give me another challenge.", "event");
      return proposeChallenge(userId, ch.conversationId, { mode: "another" });
    case "easier":
      await addMessage(ch.conversationId, "user", "Make it easier.", "event");
      return proposeChallenge(userId, ch.conversationId, { mode: "easier" });
    case "explain": {
      const ctx = await buildSkillContext(userId, ch.skillId);
      await addMessage(ch.conversationId, "user", "Explain how to do it.", "event");
      const msgs = await db.conversationMessage.findMany({ where: { conversationId: ch.conversationId }, orderBy: { createdAt: "desc" }, take: 6 });
      await addMessage(ch.conversationId, "coach", await helpWith(ctx, ch, "Explain how to do this challenge, step by step, for my situation.", msgs.reverse()), "text", ch.id);
      return ch;
    }
  }
}

/** The user gives up on an active challenge. Not a failure: difficulty eases a little. */
export async function abandonChallenge(userId: string, challengeId: string) {
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId, status: "active" } });
  if (!ch) throw new CoachError("This challenge isn't active");
  await db.challenge.update({ where: { id: ch.id }, data: { status: "abandoned", completedAt: new Date() } });
  const sc = await db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId: ch.skillId } } });
  if (sc && sc.difficulty > 1) {
    await db.skillScore.update({ where: { userId_skillId: { userId, skillId: ch.skillId } }, data: { difficulty: sc.difficulty - 1 } });
  }
  if (ch.conversationId) {
    await db.conversation.update({ where: { id: ch.conversationId }, data: { phase: "understanding" } });
    await addMessage(ch.conversationId, "coach", "No problem — we'll set it aside. Tell me what got in the way, or start fresh and I'll find something that fits better.", "text", ch.id);
  }
}

// ─── Feedback ────────────────────────────────────────────────────────────

export interface FeedbackInput {
  completionStatus: CompletionStatus;
  responses: { question: string; answer: string }[];
  selfRating?: number | null;
  perceivedDifficulty?: number | null;
}

/** Saves the user's experience (instant). Analysis runs in the background. */
export async function saveFeedback(userId: string, challengeId: string, input: FeedbackInput) {
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId, status: "active" } });
  if (!ch) throw new CoachError("This challenge isn't waiting for feedback");
  const answers = input.responses.filter((r) => r.answer.trim());
  if (!answers.length) throw new CoachError("Tell your coach at least a little about what happened");
  const find = (re: RegExp) => answers.find((r) => re.test(r.question))?.answer ?? null;

  const reflection = await db.$transaction(async (tx) => {
    await tx.challenge.update({ where: { id: ch.id }, data: { status: "done", completedAt: new Date() } });
    return tx.reflection.create({
      data: {
        challengeId: ch.id,
        completed: input.completionStatus === "completed" || input.completionStatus === "partial",
        completionStatus: input.completionStatus,
        responses: answers,
        selfRating: input.selfRating ?? null,
        perceivedDifficulty: input.perceivedDifficulty ?? null,
        whatHappened: answers.map((r) => `${r.question} ${r.answer}`).join("\n").slice(0, 4000),
        whatWasHard: find(/difficult|hard|stuck|in the way|pulled|stop/i),
        whatLearned: find(/differently|change|next time/i),
      },
    });
  });
  if (ch.conversationId) {
    await db.conversation.update({ where: { id: ch.conversationId }, data: { phase: "feedback" } });
    await addMessage(ch.conversationId, "user", `Feedback sent: ${labelStatus(input.completionStatus)}.`, "event", ch.id);
  }
  return reflection;
}

export function labelStatus(s: string): string {
  return (
    { completed: "Completed successfully", partial: "Partially completed", unsuccessful: "Attempted but unsuccessful", not_attempted: "Could not attempt" } as Record<string, string>
  )[s] ?? s;
}

/** Rule-based analysis used when the AI is unavailable. Low evidence strength by design. */
function heuristicAnalysis(status: CompletionStatus, responses: { question: string; answer: string }[]): Analysis {
  const text = responses.map((r) => r.answer).join(" ");
  const hard = responses.find((r) => /difficult|hard|in the way|stuck/i.test(r.question))?.answer?.trim();
  const good = responses.find((r) => /went well|helped|better/i.test(r.question))?.answer?.trim();
  const detail = Math.min(1, text.length / 600);
  return {
    wentWell: good ? [good.slice(0, 200)] : status === "completed" ? ["You followed through on the challenge"] : [],
    toImprove: hard ? [hard.slice(0, 200)] : [],
    evidence: [],
    painPoints: hard ? [hard.slice(0, 200)] : [],
    overcamePrevious: false,
    nextFocus: hard ? `Work through: ${hard.slice(0, 200)}` : "Build on what worked this time.",
    nextSubskill: null,
    skillSignal: status === "completed" ? 0.4 : status === "partial" ? 0.2 : 0,
    evidenceStrength: Math.min(0.45, 0.2 + 0.3 * detail), // capped: no AI judgement available
    difficultyRecommendation: status === "completed" ? "same" : "easier",
    insights: [],
    feedback:
      status === "completed" || status === "partial"
        ? "Thanks for reporting back. (Basic analysis — the AI coach was unavailable.) Your next challenge will build on how it went."
        : "Thanks for being honest — that's useful. (Basic analysis — the AI coach was unavailable.) Next time we'll try something smaller and easier to start.",
  };
}

/**
 * Background step: AI analyses the feedback; the backend scoring engine then
 * decides whether evidence justifies a score change. Safe to call twice.
 */
export async function analyzeFeedback(reflectionId: string) {
  const reflection = await db.reflection.findUnique({
    where: { id: reflectionId },
    include: { analysis: true, challenge: { include: { skill: true } } },
  });
  if (!reflection || reflection.analysis) return;
  const ch = reflection.challenge;
  const userId = ch.userId;
  const status = reflection.completionStatus as CompletionStatus;
  const responses = (Array.isArray(reflection.responses) ? reflection.responses : [{ question: "What happened?", answer: reflection.whatHappened }]) as { question: string; answer: string }[];

  const ctx = await buildSkillContext(userId, ch.skillId);
  // "Overcame a previous difficulty" only counts if a difficulty was known before this challenge.
  const hadPriorDifficulty =
    (await db.userInsight.count({ where: { userId, kind: "blocker", createdAt: { lt: reflection.createdAt }, OR: [{ skillId: ch.skillId }, { skillId: null }] } })) > 0;
  let analysis: Analysis;
  let modelVersion = "heuristic";
  try {
    const res = await generateStructured(analysisSchema, {
      system: ANALYSIS_SYSTEM,
      prompt: analysisPrompt(
        ctx,
        { title: ch.title, objective: ch.objective, steps: asStrings(ch.steps), successCriteria: asStrings(ch.successCriteria), difficulty: ch.difficulty, subskill: ch.subskill },
        { completionStatus: status, responses },
      ),
      temperature: 0.3,
      timeoutMs: 90_000,
    });
    analysis = res.data;
    modelVersion = res.modelVersion;
  } catch (e) {
    console.warn("[feedback] AI analysis failed, using heuristic:", (e as Error).message);
    analysis = heuristicAnalysis(status, responses);
  }

  const sc = await db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId: ch.skillId } } });
  const base = sc ?? { score: 40, confidence: 0.1, difficulty: ch.difficulty, evidenceCount: 0 };
  const recentCompletions = await db.reflection.count({
    where: { completionStatus: "completed", challenge: { userId, skillId: ch.skillId, id: { not: ch.id }, completedAt: { gte: new Date(Date.now() - 14 * 86_400_000) } } },
  });
  const upd = evidenceUpdate({
    score: base.score,
    confidence: base.confidence,
    evidenceCount: base.evidenceCount,
    difficulty: ch.difficulty,
    completionStatus: status,
    skillSignal: analysis.skillSignal,
    evidenceStrength: analysis.evidenceStrength,
    overcamePrevious: analysis.overcamePrevious && hadPriorDifficulty,
    recentCompletions,
  });
  const difficulty = nextDifficulty(base.difficulty, { completionStatus: status, recommendation: analysis.difficultyRecommendation });
  const fw = frameworkOf(ch.skill);
  const nextSubskill = fw.subskills.find((s) => s.key === analysis.nextSubskill)?.key ?? null;
  const report: AnalysisReport = {
    wentWell: analysis.wentWell,
    toImprove: analysis.toImprove,
    nextFocus: analysis.nextFocus,
    nextSubskill,
    overcamePrevious: analysis.overcamePrevious && hadPriorDifficulty,
  };

  try {
    await db.$transaction(async (tx) => {
      await tx.aiAnalysis.create({
        data: {
          reflectionId: reflection.id,
          evidence: analysis.evidence,
          painPoints: analysis.painPoints,
          nextFocus: analysis.nextFocus,
          skillSignal: analysis.skillSignal,
          evidenceStrength: analysis.evidenceStrength,
          difficultyRecommendation: analysis.difficultyRecommendation,
          insights: { items: analysis.insights, feedback: analysis.feedback },
          report,
          modelVersion,
        },
      });
      await tx.skillScore.upsert({
        where: { userId_skillId: { userId, skillId: ch.skillId } },
        create: { userId, skillId: ch.skillId, score: upd.score, confidence: upd.confidence, difficulty, evidenceCount: 1 },
        update: { score: upd.score, confidence: upd.confidence, difficulty, evidenceCount: { increment: status === "not_attempted" ? 0 : 1 } },
      });
      await tx.skillScoreEvent.create({
        data: {
          userId,
          skillId: ch.skillId,
          delta: upd.delta,
          previousScore: base.score,
          newScore: upd.score,
          source: "challenge",
          sourceId: ch.id,
          reason: upd.reason,
          evidence: {
            challenge: ch.title,
            completionStatus: status,
            evidence: analysis.evidence,
            skillSignal: analysis.skillSignal,
            evidenceStrength: analysis.evidenceStrength,
            difficulty: ch.difficulty,
            overcamePrevious: analysis.overcamePrevious && hadPriorDifficulty,
            analysedBy: modelVersion,
          },
        },
      });
    });
  } catch (e) {
    console.warn("[feedback] analysis already stored:", (e as Error).message.split("\n")[0]);
    return;
  }

  await rememberInsights(userId, ch.skillId, [...analysis.insights, ...analysis.painPoints.map((text) => ({ kind: "blocker" as const, text }))]);
  if (ch.conversationId) {
    await db.conversation.update({
      where: { id: ch.conversationId },
      data: { phase: "reviewed", summary: `Last challenge: ${ch.title} (${labelStatus(status)}). Next focus: ${analysis.nextFocus}` },
    });
    await addMessage(ch.conversationId, "coach", analysis.feedback, "report", ch.id);
  }
  return { delta: upd.delta, score: upd.score };
}

/** Next challenge right after a reviewed feedback: no need to ask again, the coach knows the context. */
export async function nextChallenge(userId: string, challengeId: string) {
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId, status: "done" }, include: { reflection: { include: { analysis: true } } } });
  if (!ch?.conversationId) throw new CoachError("Challenge not found");
  if (!ch.reflection?.analysis) {
    if (ch.reflection) await analyzeFeedback(ch.reflection.id);
  }
  checkAiBudget(userId);
  const active = await db.challenge.findFirst({ where: { userId, skillId: ch.skillId, status: "active" } });
  if (active) return { conversationId: active.conversationId! };
  const existing = await db.challenge.findFirst({ where: { conversationId: ch.conversationId, status: "proposed" } });
  if (!existing) {
    await addMessage(ch.conversationId, "user", "Give me my next challenge.", "event");
    await proposeChallenge(userId, ch.conversationId, { mode: "new" });
  }
  return { conversationId: ch.conversationId };
}

/** Re-runs analysis for feedback whose background analysis never finished (e.g. server restart). */
export async function analyzePendingFeedback(userId: string) {
  const pending = await db.reflection.findMany({
    where: { challenge: { userId }, analysis: null, createdAt: { lt: new Date(Date.now() - 3 * 60_000) } },
    select: { id: true },
    take: 3,
  });
  for (const r of pending) await analyzeFeedback(r.id);
}
