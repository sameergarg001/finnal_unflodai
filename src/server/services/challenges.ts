import { db } from "@/lib/db";
import { AiError } from "@/ai/types";
import { generateStructured } from "@/ai/client";
import {
  EVALUATION_SYSTEM,
  TASK_SYSTEM,
  TURN_SYSTEM,
  evaluationPrompt,
  evaluationSchema,
  taskPrompt,
  taskSchema,
  turnPrompt,
  turnSchema,
  type DesignedTask,
  type Evaluation,
  type TaskRequest,
  type Turn,
  type TurnMode,
} from "@/ai/intelligencePrompts";
import { rateLimit } from "@/lib/rateLimit";
import { evaluateAttempt, nextDifficulty, subskillDelta, type AttemptResult, type CompletionStatus, type Dimensions } from "../engine/scoring";
import { selectNextSkill, type SkillCandidate } from "../engine/selectSkill";
import { buildMentorContext, loadSkillState, type SkillState, type StoredPlan } from "../intelligence/context";
import { recordContradictions, recordObservations } from "../intelligence/evidence";
import { explainScoreChange, groundObservations, quoteSupported, validSubskill } from "../intelligence/guards";
import { currentSituation, saveSituation } from "../intelligence/situation";
import { getSkillForUser } from "./skills";

export type { StoredPlan } from "../intelligence/context";

// The mentoring engine.
//
// Conversation: every user message gets ONE structured AI turn that
// understands intent, extracts the situation and evidence, updates memory and
// decides the next step. Nothing the user sees is scripted, and when the AI
// is unavailable the user is told so instead of getting a canned answer.
//
// Task lifecycle: proposed → active (accepted) → done (feedback) → evaluated
//                 proposed → discarded · active → abandoned (never penalised)
// Conversation phases guide the engine without trapping the user:
//   understanding (goal · situation · difficulty) → proposed → active →
//   feedback (analysing) → reviewed (next task) — the user can ask anything at any point.

export class CoachError extends Error {}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as object;

/** AI calls per user per hour (protects cost/quota). */
const AI_CALLS_PER_HOUR = 60;
function checkAiBudget(userId: string) {
  if (!rateLimit(`ai:${userId}`, AI_CALLS_PER_HOUR, 3600_000)) {
    throw new CoachError("You're going fast! Please wait a few minutes before sending more.");
  }
}

/** One turn at a time per conversation (protects against double submits). */
const busy = new Set<string>();
async function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (busy.has(key)) throw new CoachError("Still working on your last message — one moment.");
  busy.add(key);
  try {
    return await fn();
  } finally {
    busy.delete(key);
  }
}

export type AnalysisReport = { wentWell: string[]; toImprove: string[]; nextFocus: string; nextSubskill: string | null; overcamePrevious: boolean; explanation?: string };

type ConvContext = {
  goal?: string | null;
  situation?: unknown;
  questions?: number;
  questionsInRow?: number;
  suggestions?: string[];
  replan?: boolean;
};

// ─── Reading ──────────────────────────────────────────────────────────────

export async function getActiveChallenges(userId: string) {
  return db.challenge.findMany({ where: { userId, status: "active" }, include: { skill: true }, orderBy: { acceptedAt: "desc" } });
}

export async function getChallengeForUser(userId: string, challengeId: string) {
  return db.challenge.findFirst({ where: { id: challengeId, userId }, include: { skill: true, reflection: { include: { analysis: true } } } });
}

export async function getConversationForUser(userId: string, conversationId: string) {
  return db.conversation.findFirst({
    where: { id: conversationId, userId },
    include: { skill: true, messages: { orderBy: { createdAt: "asc" } }, challenges: { orderBy: { assignedAt: "asc" } } },
  });
}

/** Quick replies the mentor suggested for this moment (generated, never fixed). */
export function quickRepliesFor(conv: { phase: string; context: unknown }): string[] | null {
  const s = ((conv.context ?? {}) as ConvContext).suggestions;
  return s?.length ? s.slice(0, 3) : null;
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

export function labelStatus(s: string): string {
  return ({ completed: "Completed successfully", partial: "Partially completed", unsuccessful: "Attempted but unsuccessful", not_attempted: "Could not attempt" } as Record<string, string>)[s] ?? s;
}

// ─── Conversation engine ─────────────────────────────────────────────────

async function addMessage(conversationId: string, role: "user" | "coach", content: string, kind = "text", challengeId?: string) {
  const m = await db.conversationMessage.create({ data: { conversationId, role, content, kind, challengeId } });
  await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  return m;
}

/** Recent messages for the AI (task cards and analyses summarised, events kept short). */
async function recentMessages(conversationId: string, limit = 10) {
  const rows = await db.conversationMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take: limit });
  return rows.reverse().map((m) => ({
    role: m.role === "user" ? "person" : "mentor",
    content: m.kind === "challenge" ? `[proposed task: ${m.content}]` : m.kind === "event" ? `[${m.content}]` : m.content.slice(0, 700),
  }));
}

/** One structured AI turn. Throws CoachError if no AI could answer (no scripted fallback). */
async function runTurn(userId: string, state: SkillState, conv: { id: string; phase: string; summary: string | null; context: unknown }, message: string, mode: TurnMode): Promise<Turn> {
  const ctx = await buildMentorContext(userId, state, conv);
  const recent = await recentMessages(conv.id);
  try {
    const { data } = await generateStructured(turnSchema, { system: TURN_SYSTEM, prompt: turnPrompt(ctx, recent, message, mode), temperature: 0.6, timeoutMs: 45_000 });
    return data;
  } catch (e) {
    console.warn("[coach] turn failed:", (e as Error).message);
    throw new CoachError("Your mentor couldn't reply just now (the AI service is busy). Please send that again in a moment.");
  }
}

/** Stores what the turn learned: situation, evidence-backed observations, progress, goal, summary. */
async function applyTurnMemory(userId: string, state: SkillState, conv: { id: string; context: unknown; summary: string | null }, turn: Turn, message: string, messageId: string | null, nextAction: Turn["nextAction"]) {
  const c = (conv.context ?? {}) as ConvContext;
  if (message && messageId && turn.intent !== "off_topic" && turn.intent !== "smalltalk") {
    if (turn.situation) await saveSituation(userId, state.skill.id, conv.id, turn.situation);
    const grounded = groundObservations(turn.observations, message, state.framework.subskills);
    await recordObservations(userId, state.skill.id, grounded, { source: "message", refId: messageId });
    const known = new Set(state.insights.map((i) => i.id));
    const contra = turn.contradictions.filter((x) => known.has(x.insightId) && quoteSupported(x.quote, message));
    await recordContradictions(userId, contra, { source: "message", refId: messageId });
  }
  const context: ConvContext = {
    ...c,
    goal: turn.goal ?? c.goal ?? null,
    situation: turn.situation ?? c.situation ?? null,
    questions: (c.questions ?? 0) + (nextAction === "ask_followup" ? 1 : 0),
    questionsInRow: nextAction === "ask_followup" ? (c.questionsInRow ?? 0) + 1 : 0,
    suggestions: turn.suggestedReplies,
  };
  await db.conversation.update({ where: { id: conv.id }, data: { context: json(context), summary: turn.summary || conv.summary } });
}

/**
 * Opens the mentoring session for a skill. With an active task, returns that
 * task's conversation. Otherwise resumes an open session or starts a new one
 * whose opening line is generated from memory (first time, return visit or replan).
 */
export async function startCoachSession(userId: string, skillId: string, opts: { fresh?: boolean; firstMessage?: string; interview?: boolean } = {}) {
  const skill = await getSkillForUser(userId, skillId);
  if (!skill) throw new CoachError("Skill not found");
  const us = await db.userSkill.findUnique({ where: { userId_skillId: { userId, skillId } } });
  if (!us?.isActive) throw new CoachError(`Add ${skill.name} to your dashboard first`);

  const active = await db.challenge.findFirst({ where: { userId, skillId, status: "active" } });
  if (active?.conversationId && !opts.interview) {
    if (opts.firstMessage) await sendCoachMessage(userId, active.conversationId, opts.firstMessage);
    return { conversationId: active.conversationId, activeChallengeId: active.id };
  }

  if (!opts.fresh && !opts.interview) {
    const open = await db.conversation.findFirst({ where: { userId, skillId, status: "open", phase: { in: ["intake", "understanding", "proposed", "reviewed"] } }, orderBy: { updatedAt: "desc" } });
    if (open) {
      if (opts.firstMessage) await sendCoachMessage(userId, open.id, opts.firstMessage);
      return { conversationId: open.id, activeChallengeId: null };
    }
  }
  checkAiBudget(userId);
  await db.conversation.updateMany({ where: { userId, skillId, status: "open" }, data: { status: "closed" } });
  await db.challenge.updateMany({ where: { userId, skillId, status: "proposed" }, data: { status: "discarded" } });

  const state = await loadSkillState(userId, skillId);
  const hasHistory = (await db.challenge.count({ where: { userId, skillId, status: { in: ["active", "done", "abandoned"] } } })) > 0;
  const mode: TurnMode = opts.interview ? "replan" : !state.plan && !hasHistory ? "first_time" : "opening";
  const conv = await db.conversation.create({ data: { userId, skillId, phase: "understanding", context: { replan: !!opts.interview } } });

  // With a first message, the AI's reply to it is the opening — no separate greeting call.
  if (opts.firstMessage) {
    await sendCoachMessage(userId, conv.id, opts.firstMessage);
    return { conversationId: conv.id, activeChallengeId: null };
  }
  try {
    const turn = await runTurn(userId, state, { ...conv, summary: null }, "", mode);
    await addMessage(conv.id, "coach", turn.reply);
    await applyTurnMemory(userId, state, conv, turn, "", null, "ask_followup");
  } catch {
    // The AI is down: a short, honest opener (the only fixed line in the flow).
    await addMessage(conv.id, "coach", `Hi — I'm ${state.teacher.name}. What's going on with your ${state.skill.name.toLowerCase()} right now?`);
  }
  return { conversationId: conv.id, activeChallengeId: null };
}

/** Handles a user message: understand → remember → reply → act (task / revise / answer). */
export async function sendCoachMessage(userId: string, conversationId: string, text: string) {
  const message = text.trim().slice(0, 1500);
  if (message.length < 1) throw new CoachError("Type a message");
  return exclusive(conversationId, async () => {
    const conv = await getConversationForUser(userId, conversationId);
    if (!conv) throw new CoachError("Conversation not found");
    checkAiBudget(userId);

    const userMsg = await addMessage(conv.id, "user", message);
    const state = await loadSkillState(userId, conv.skillId);
    let turn: Turn;
    try {
      turn = await runTurn(userId, state, conv, message, "message");
    } catch (e) {
      // Keep the chat honest: remove the unanswered message so it can simply be resent.
      await db.conversationMessage.delete({ where: { id: userMsg.id } }).catch(() => {});
      throw e;
    }

    const proposed = conv.challenges.find((ch) => ch.status === "proposed");
    const active = conv.challenges.find((ch) => ch.status === "active");
    let action = turn.nextAction;
    if (turn.intent === "safety") action = "answer";
    if (active && (action === "propose_task" || action === "revise_task")) action = "answer";
    if (action === "revise_task" && !proposed) action = "propose_task";
    if (conv.phase === "feedback" && action === "propose_task") action = "answer";
    // Safety net against interview-style chats: after two questions in a row, act.
    const inRow = ((conv.context ?? {}) as ConvContext).questionsInRow ?? 0;
    if (action === "ask_followup" && inRow >= 2 && !active && !["ask_question", "off_topic", "smalltalk", "safety"].includes(turn.intent)) action = proposed ? "answer" : "propose_task";

    await applyTurnMemory(userId, state, conv, turn, message, userMsg.id, action);
    await addMessage(conv.id, "coach", turn.reply, "text", active?.id);

    if (action === "propose_task" || action === "revise_task") {
      const mode: TaskRequest["mode"] = action === "revise_task" ? "updated" : proposed ? "another" : "new";
      await proposeChallenge(userId, conv.id, { mode, note: turn.taskNote ?? (action === "revise_task" ? message : null) });
    } else if (conv.phase === "reviewed" || conv.phase === "intake") {
      await db.conversation.update({ where: { id: conv.id }, data: { phase: "understanding" } });
    }
  });
}

// ─── Task engine ─────────────────────────────────────────────────────────

/** Backend choice of what the next task targets: the most relevant remaining weakness and subskill. */
export async function chooseTarget(userId: string, state: SkillState) {
  const last = await db.challenge.findFirst({
    where: { userId, skillId: state.skill.id, status: "done" },
    include: { reflection: { include: { analysis: true } } },
    orderBy: { completedAt: "desc" },
  });
  const lastTier = last?.reflection?.analysis?.tier;
  const lastReport = last?.reflection?.analysis?.report as AnalysisReport | null | undefined;
  const dayAgo = Date.now() - 86_400_000;
  const weaknesses = state.insights
    .filter((i) => i.kind === "blocker" && i.status !== "improving")
    // Moved on: don't target the same weakness again right after an excellent attempt on it.
    .filter((i) => !(lastTier === "excellent" && last?.targetInsightId === i.id))
    .sort((a, b) => Number(b.lastSeen.getTime() > dayAgo) - Number(a.lastSeen.getTime() > dayAgo) || Number(b.status === "confirmed") - Number(a.status === "confirmed") || b.confidence - a.confidence);
  const target = weaknesses[0] ?? null;
  const assessedSubs = [...state.subskillScores.entries()].filter(([, v]) => v.evidenceCount > 0).sort((a, b) => a[1].score - b[1].score);
  const subskill =
    validSubskill(target?.subskill, state.framework.subskills) ??
    validSubskill(lastReport?.nextSubskill, state.framework.subskills) ??
    assessedSubs[0]?.[0] ??
    validSubskill(state.plan?.startSubskill, state.framework.subskills) ??
    state.framework.subskills[0]?.key ??
    null;
  return { target, subskill, last };
}

/** Designs a task (status "proposed") and posts it into the conversation. */
async function proposeChallenge(userId: string, conversationId: string, opts: { mode: TaskRequest["mode"]; note?: string | null }) {
  const conv = await db.conversation.findFirstOrThrow({ where: { id: conversationId, userId }, include: { challenges: true } });
  const state = await loadSkillState(userId, conv.skillId);
  const c = (conv.context ?? {}) as ConvContext;
  const { target, subskill, last } = await chooseTarget(userId, state);
  const hasHistory = !!last || (await db.challenge.count({ where: { userId, skillId: conv.skillId, status: { in: ["active", "abandoned"] } } })) > 0;

  // Difficulty is decided here, never by the AI: adaptive level, anchored to the stage until there's history.
  let difficulty = hasHistory ? state.difficulty : state.stage.baseDifficulty;
  const proposedNow = conv.challenges.filter((ch) => ch.status === "proposed");
  if (opts.mode === "easier") difficulty = Math.min(difficulty, ...proposedNow.map((p) => p.difficulty)) - 1;
  difficulty = Math.max(1, Math.min(5, difficulty));

  const situation = (await currentSituation(userId, conv.skillId, conv.id)) ?? null;
  const avoid = (await db.challenge.findMany({ where: { userId, skillId: conv.skillId }, orderBy: { assignedAt: "desc" }, take: 8, select: { title: true } })).map((x) => x.title);
  const needsPlan = !state.plan || !!c.replan;
  const req: TaskRequest = {
    difficulty,
    target: {
      weakness: target?.text ?? null,
      evidence: target?.evidence.filter((e) => e.direction === "supports").at(-1)?.quote ?? null,
      subskill,
      subskillLabel: state.framework.subskills.find((s) => s.key === subskill)?.label ?? null,
    },
    situation: situation ? { summary: situation.summary, ...(situation.details as object) } : null,
    mode: opts.mode,
    note: opts.note ?? null,
    avoidTitles: avoid,
    needsPlan,
  };
  const ctx = await buildMentorContext(userId, state, conv);
  let draft: DesignedTask;
  let modelVersion: string;
  try {
    const res = await generateStructured(taskSchema, { system: TASK_SYSTEM, prompt: taskPrompt({ ...ctx, needsPlan }, req), temperature: 0.7, timeoutMs: 60_000, reasoning: "medium" });
    draft = res.data;
    modelVersion = res.modelVersion;
  } catch (e) {
    console.warn("[coach] task design failed:", (e as Error).message);
    await db.conversation.update({ where: { id: conversationId }, data: { context: json({ ...c, suggestions: ["Give me a task now"] }) } });
    throw new CoachError("Your mentor couldn't design the task just now (the AI service is busy). Tap “Give me a task now” to try again.");
  }

  if (needsPlan && draft.plan) {
    const stored: StoredPlan = {
      goal: draft.plan.goal,
      currentLevel: draft.plan.currentLevel,
      timeline: draft.plan.timeline,
      targetDate: null,
      startSubskill: subskill,
      firstFocus: draft.plan.firstFocus,
      summary: `${draft.plan.goal} — starting with ${draft.plan.firstFocus.replace(/\.$/, "")}.`,
    };
    await db.userSkill.update({ where: { userId_skillId: { userId, skillId: conv.skillId } }, data: { plan: stored, planAt: new Date() } });
    await addMessage(conversationId, "coach", `Goal: ${stored.goal}\nWhere you are now: ${stored.currentLevel}\nFirst focus: ${stored.firstFocus}`, "plan");
  }

  const chosenSub = validSubskill(draft.subskill, state.framework.subskills) ?? subskill;
  await db.challenge.updateMany({ where: { conversationId, status: "proposed" }, data: { status: "discarded" } });
  const ch = await db.challenge.create({
    data: {
      userId,
      skillId: conv.skillId,
      conversationId,
      situation: situation?.summary ?? null,
      struggle: draft.struggle,
      previousId: last?.id ?? null,
      stepNumber: (await db.challenge.count({ where: { userId, skillId: conv.skillId, status: { in: ["done", "active", "abandoned"] } } })) + 1,
      subskill: chosenSub,
      title: draft.title,
      objective: draft.objective,
      instructions: draft.instructions,
      steps: draft.steps,
      expectedOutcome: draft.successCriteria.join("; "),
      example: draft.example,
      feedbackInstructions: draft.observe,
      feedbackQuestions: draft.feedbackQuestions,
      alternative: draft.alternative,
      targetInsightId: target?.id ?? null,
      successCriteria: draft.successCriteria,
      whyThisChallenge: draft.whyThisChallenge,
      difficulty,
      estimatedMinutes: draft.estimatedMinutes,
      status: "proposed",
      generationContext: JSON.parse(JSON.stringify({ request: req, stage: state.stage.key, score: state.score })),
      modelVersion,
    },
  });
  await db.conversation.update({ where: { id: conversationId }, data: { phase: "proposed", context: json({ ...c, replan: false, suggestions: [] }) } });
  await addMessage(conversationId, "coach", draft.title, "challenge", ch.id);
  return ch;
}

export type ChallengeAction = "accept" | "another" | "easier" | "explain";

export async function challengeAction(userId: string, challengeId: string, action: ChallengeAction) {
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId }, include: { skill: true } });
  if (!ch?.conversationId) throw new CoachError("Task not found");
  if (ch.status !== "proposed" && action !== "explain") throw new CoachError("This task can't be changed any more");
  checkAiBudget(userId);
  const convId = ch.conversationId;

  return exclusive(convId, async () => {
    switch (action) {
      case "accept": {
        const other = await db.challenge.findFirst({ where: { userId, skillId: ch.skillId, status: "active" } });
        if (other) throw new CoachError(`You already have an active ${ch.skill.name} task. Finish or set it aside first.`);
        await db.challenge.update({ where: { id: ch.id }, data: { status: "active", acceptedAt: new Date() } });
        await db.conversation.update({ where: { id: convId }, data: { phase: "active" } });
        await addMessage(convId, "user", "Task accepted · saved in Tasks", "event", ch.id);
        return ch;
      }
      case "another":
        await addMessage(convId, "user", "Asked for a different task", "event");
        return proposeChallenge(userId, convId, { mode: "another" });
      case "easier":
        await addMessage(convId, "user", "Asked for an easier task", "event");
        return proposeChallenge(userId, convId, { mode: "easier" });
      case "explain": {
        const conv = await db.conversation.findUniqueOrThrow({ where: { id: convId } });
        const state = await loadSkillState(userId, ch.skillId);
        await addMessage(convId, "user", "Explain how to do it.", "event");
        const turn = await runTurn(userId, state, conv, `Explain how to do the task "${ch.title}" step by step, for my situation.`, "explain");
        await addMessage(convId, "coach", turn.reply, "text", ch.id);
        await applyTurnMemory(userId, state, conv, turn, "", null, "answer");
        return ch;
      }
    }
  });
}

/** The user sets an active task aside. Never a failure: difficulty eases, and the mentor asks what got in the way. */
export async function abandonChallenge(userId: string, challengeId: string) {
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId, status: "active" } });
  if (!ch) throw new CoachError("This task isn't active");
  await db.challenge.update({ where: { id: ch.id }, data: { status: "abandoned", completedAt: new Date() } });
  const sc = await db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId: ch.skillId } } });
  if (sc && sc.difficulty > 1) await db.skillScore.update({ where: { userId_skillId: { userId, skillId: ch.skillId } }, data: { difficulty: sc.difficulty - 1 } });
  if (!ch.conversationId) return;
  const conv = await db.conversation.update({ where: { id: ch.conversationId }, data: { phase: "understanding" } });
  await addMessage(conv.id, "user", "Task set aside", "event", ch.id);
  try {
    const state = await loadSkillState(userId, ch.skillId);
    const turn = await runTurn(userId, state, conv, `(I set the task "${ch.title}" aside without doing it.)`, "message");
    await addMessage(conv.id, "coach", turn.reply);
    await applyTurnMemory(userId, state, conv, turn, "", null, "ask_followup");
  } catch {
    /* the mentor will respond to their next message */
  }
}

// ─── Feedback & evaluation ───────────────────────────────────────────────

export interface FeedbackInput {
  completionStatus: CompletionStatus;
  responses: { question: string; answer: string }[];
  selfRating?: number | null;
  perceivedDifficulty?: number | null;
}

/** Saves the experience instantly (once). Evaluation runs in the background. */
export async function saveFeedback(userId: string, challengeId: string, input: FeedbackInput) {
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId, status: "active" } });
  if (!ch) throw new CoachError("This task isn't waiting for feedback");
  const answers = input.responses.filter((r) => r.answer.trim()).map((r) => ({ question: r.question.slice(0, 300), answer: r.answer.slice(0, 3000) }));
  if (!answers.length) throw new CoachError("Tell your mentor at least a little about what happened");
  const find = (re: RegExp) => answers.find((r) => re.test(r.question))?.answer ?? null;

  const reflection = await db.$transaction(async (tx) => {
    // Only flips an *active* task → a second submit finds nothing to update and fails.
    const flipped = await tx.challenge.updateMany({ where: { id: ch.id, status: "active" }, data: { status: "done", completedAt: new Date() } });
    if (flipped.count !== 1) throw new CoachError("This feedback was already sent");
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
        whatLearned: find(/differently|change|next time|learn/i),
      },
    });
  });
  if (ch.conversationId) {
    await db.conversation.update({ where: { id: ch.conversationId }, data: { phase: "feedback" } });
    await addMessage(ch.conversationId, "user", `Feedback sent: ${labelStatus(input.completionStatus)}`, "event", ch.id);
  }
  return reflection;
}

const EMPTY_DIMS: Dimensions = { completion: null, execution: null, skillShown: null, situationDifficulty: null, discomfort: null, improvement: null, reflection: null };

/** Evaluation when no AI has answered for a day: records the attempt, never changes a score. */
function unevaluated(status: CompletionStatus): Evaluation {
  return {
    attempted: status !== "not_attempted",
    dimensions: EMPTY_DIMS,
    evidenceStrength: 0,
    selfReportOnly: false,
    evidenceSummary: "",
    evidence: [],
    wentWell: [],
    toImprove: [],
    nextFocus: "Pick up where this task left off.",
    nextSubskill: null,
    subskills: [],
    observations: [],
    contradictions: [],
    difficultyRecommendation: status === "completed" ? "same" : "easier",
    feedback: "Your mentor couldn't analyse this one (the AI service was unavailable for a long time), so your scores weren't changed. Your account is saved and the next task will take it into account.",
    followUpQuestion: null,
  };
}

/** Evidence-based inputs from this skill's evaluation history. */
async function historySignals(userId: string, skillId: string, excludeChallengeId: string) {
  const prior = await db.aiAnalysis.findMany({
    where: { reflection: { challenge: { userId, skillId, id: { not: excludeChallengeId } } } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { tier: true, performance: true, evidenceStrength: true, createdAt: true },
  });
  const twoWeeks = Date.now() - 14 * 86_400_000;
  const recentGood = prior.filter((p) => (p.tier === "excellent" || p.tier === "good") && p.createdAt.getTime() >= twoWeeks).length;
  let priorPoorStreak = 0;
  for (const p of prior) {
    if (p.performance != null && p.performance <= 0.25 && p.evidenceStrength >= 0.6) priorPoorStreak++;
    else break;
  }
  let previousGoodStreak = 0;
  for (const p of prior) {
    if (p.tier === "excellent" || p.tier === "good") previousGoodStreak++;
    else break;
  }
  return { recentGood, priorPoorStreak, previousGoodStreak };
}

function taskForPrompt(ch: { title: string; objective: string | null; steps: unknown; successCriteria: unknown; difficulty: number; subskill: string | null; situation: string | null; targetInsightId: string | null }) {
  return { title: ch.title, objective: ch.objective, steps: asStrings(ch.steps), successCriteria: asStrings(ch.successCriteria), difficulty: ch.difficulty, subskill: ch.subskill, situation: ch.situation, targetWeaknessId: ch.targetInsightId };
}

/**
 * Background step: the AI evaluates the attempt against a rubric; the backend
 * scoring engine decides whether the evidence justifies a change, writes the
 * audit trail and updates memory. Idempotent (one evaluation per feedback).
 */
export async function analyzeFeedback(reflectionId: string) {
  const reflection = await db.reflection.findUnique({ where: { id: reflectionId }, include: { analysis: true, challenge: { include: { skill: true } } } });
  if (!reflection || reflection.analysis) return;
  const ch = reflection.challenge;
  const userId = ch.userId;
  const status = reflection.completionStatus as CompletionStatus;
  const responses = (Array.isArray(reflection.responses) ? reflection.responses : [{ question: "What happened?", answer: reflection.whatHappened }]) as { question: string; answer: string }[];
  const feedbackText = responses.map((r) => r.answer).join("\n");

  const state = await loadSkillState(userId, ch.skillId);
  const conv = ch.conversationId ? await db.conversation.findUnique({ where: { id: ch.conversationId } }) : null;
  const ctx = await buildMentorContext(userId, state, conv);
  let ev: Evaluation;
  let modelVersion = "unevaluated";
  try {
    const res = await generateStructured(evaluationSchema, {
      system: EVALUATION_SYSTEM,
      prompt: evaluationPrompt(ctx, taskForPrompt(ch), { completionStatus: status, responses }),
      temperature: 0.2,
      timeoutMs: 90_000,
      reasoning: "medium",
    });
    ev = res.data;
    modelVersion = res.modelVersion;
  } catch (e) {
    const ageH = (Date.now() - reflection.createdAt.getTime()) / 3600_000;
    console.warn(`[feedback] evaluation failed (${ageH.toFixed(1)}h old):`, (e as Error).message);
    if (ageH < 24) return; // stays "analysing"; retried on the next visit
    ev = unevaluated(status);
  }
  return applyEvaluation({ userId, state, ch, reflectionId: reflection.id, status, ev, feedbackText, modelVersion });
}

async function applyEvaluation(a: {
  userId: string;
  state: SkillState;
  ch: { id: string; title: string; skillId: string; difficulty: number; subskill: string | null; conversationId: string | null };
  reflectionId: string;
  status: CompletionStatus;
  ev: Evaluation;
  feedbackText: string;
  modelVersion: string;
}) {
  const { userId, state, ch, status, ev } = a;
  const fw = state.framework;
  const sc = await db.skillScore.findUnique({ where: { userId_skillId: { userId, skillId: ch.skillId } } });
  const before = sc?.score ?? state.score;
  const signals = await historySignals(userId, ch.skillId, ch.id);
  const evidenceOk = ev.evidence;
  const result: AttemptResult = evaluateAttempt({
    score: before,
    completionStatus: status,
    dimensions: ev.dimensions,
    evidenceStrength: a.modelVersion === "unevaluated" ? 0 : ev.evidenceStrength,
    selfReportOnly: ev.selfReportOnly,
    challengeDifficulty: ch.difficulty,
    expectedDifficulty: state.stage.baseDifficulty,
    recentGood: signals.recentGood,
    priorPoorStreak: signals.priorPoorStreak,
  });
  const difficulty = nextDifficulty(sc?.difficulty ?? ch.difficulty, {
    completionStatus: status,
    recommendation: ev.difficultyRecommendation,
    tier: result.tier,
    previousGoodStreak: signals.previousGoodStreak,
    judged: result.performance != null,
  });
  const explanation = a.modelVersion === "unevaluated" ? "" : explainScoreChange(state.skill.name, before, result, ev.evidenceSummary);

  // Subskills genuinely exercised by this attempt (validated keys only).
  const subs = new Map<string, number>();
  for (const s of ev.subskills) {
    const key = validSubskill(s.key, fw.subskills);
    if (key && s.signal > 0 && subs.size < 2) subs.set(key, s.signal);
  }
  if (result.delta < 0) {
    subs.clear();
    if (ch.subskill) subs.set(ch.subskill, 1);
  }
  const nextSub = validSubskill(ev.nextSubskill, fw.subskills);
  const known = new Set(state.insights.map((i) => i.id));
  const contradictions = ev.contradictions.filter((x) => known.has(x.insightId) && quoteSupported(x.quote, a.feedbackText));
  const report: AnalysisReport = { wentWell: ev.wentWell, toImprove: ev.toImprove, nextFocus: ev.nextFocus, nextSubskill: nextSub, overcamePrevious: contradictions.length > 0, explanation };
  const attempted = status !== "not_attempted";

  try {
    await db.$transaction(async (tx) => {
      // Unique per feedback: a second run fails here and the whole update rolls back.
      await tx.aiAnalysis.create({
        data: {
          reflectionId: a.reflectionId,
          evidence: evidenceOk,
          painPoints: ev.observations.filter((o) => o.kind === "blocker").map((o) => o.label),
          nextFocus: ev.nextFocus,
          skillSignal: ev.dimensions.skillShown ?? 0,
          evidenceStrength: ev.evidenceStrength,
          difficultyRecommendation: ev.difficultyRecommendation,
          insights: { items: ev.observations.map((o) => ({ kind: o.kind, text: o.label })), feedback: ev.feedback, followUpQuestion: ev.followUpQuestion },
          report,
          dimensions: ev.dimensions,
          performance: result.performance,
          tier: result.tier,
          modelVersion: a.modelVersion,
        },
      });
      await tx.skillScore.upsert({
        where: { userId_skillId: { userId, skillId: ch.skillId } },
        create: { userId, skillId: ch.skillId, score: result.score, baselineScore: before, confidence: result.confidence, difficulty, evidenceCount: attempted ? 1 : 0 },
        update: {
          score: result.score,
          confidence: Math.min(0.95, Math.max(sc?.confidence ?? 0.2, (sc?.confidence ?? 0.2) * 0.8 + result.confidence * 0.2)),
          difficulty,
          evidenceCount: { increment: attempted && a.modelVersion !== "unevaluated" ? 1 : 0 },
        },
      });
      await tx.skillScoreEvent.create({
        data: {
          userId,
          skillId: ch.skillId,
          subskill: "",
          delta: result.delta,
          previousScore: before,
          newScore: result.score,
          source: "challenge",
          sourceId: ch.id,
          reason: explanation || "Not evaluated — no change.",
          confidence: result.confidence,
          evidence: {
            challenge: ch.title,
            completionStatus: status,
            evidence: evidenceOk,
            evidenceSummary: ev.evidenceSummary,
            dimensions: ev.dimensions,
            performance: result.performance,
            tier: result.tier,
            evidenceStrength: ev.evidenceStrength,
            selfReportOnly: ev.selfReportOnly,
            difficulty: ch.difficulty,
            rule: result.rule,
            analysedBy: a.modelVersion,
          },
        },
      });
      for (const [key, signal] of subs) {
        const d = result.delta < 0 ? result.delta : subskillDelta(result.delta, signal);
        const cur = await tx.subskillScore.findUnique({ where: { userId_skillId_subskill: { userId, skillId: ch.skillId, subskill: key } } });
        const base = cur?.score ?? before;
        const next = Math.min(100, Math.max(0, Math.round((base + d) * 10) / 10));
        await tx.subskillScore.upsert({
          where: { userId_skillId_subskill: { userId, skillId: ch.skillId, subskill: key } },
          create: { userId, skillId: ch.skillId, subskill: key, score: next, baseline: before, evidenceCount: attempted ? 1 : 0, confidence: result.confidence },
          update: { score: next, evidenceCount: { increment: attempted ? 1 : 0 }, confidence: result.confidence },
        });
        await tx.skillScoreEvent.create({
          data: {
            userId,
            skillId: ch.skillId,
            subskill: key,
            delta: Math.round((next - base) * 10) / 10,
            previousScore: base,
            newScore: next,
            source: "challenge",
            sourceId: ch.id,
            reason: `${fw.subskills.find((s) => s.key === key)?.label ?? key}: exercised by "${ch.title}" (signal ${signal.toFixed(2)}).`,
            confidence: result.confidence,
            evidence: { signal, tier: result.tier, skillDelta: result.delta },
          },
        });
      }
    });
  } catch (e) {
    console.warn("[feedback] evaluation already stored:", (e as Error).message.split("\n")[0]);
    return;
  }

  // Memory: grounded observations + progress against known weaknesses.
  await recordObservations(userId, ch.skillId, groundObservations(ev.observations, a.feedbackText, fw.subskills), { source: "feedback", refId: ch.id });
  await recordContradictions(userId, contradictions, { source: "feedback", refId: ch.id });

  if (ch.conversationId) {
    const convRow = await db.conversation.findUnique({ where: { id: ch.conversationId } });
    const cc = (convRow?.context ?? {}) as ConvContext;
    await db.conversation.update({
      where: { id: ch.conversationId },
      data: {
        phase: "reviewed",
        summary: `Last task: ${ch.title} (${labelStatus(status)}, ${result.tier}). Next focus: ${ev.nextFocus}`,
        context: json({ ...cc, suggestions: ["Give me my next task", ...(ev.followUpQuestion ? [] : ["Why did my score change?"])].slice(0, 3) }),
      },
    });
    await addMessage(ch.conversationId, "coach", explanation ? `${ev.feedback}\n\n${explanation}` : ev.feedback, "report", ch.id);
    if (ev.followUpQuestion) await addMessage(ch.conversationId, "coach", ev.followUpQuestion);
  }
  return { delta: result.delta, score: result.score, tier: result.tier };
}

/**
 * The user disputes an evaluation. The AI re-reads the account with their note;
 * the backend recomputes with the same rules and applies the difference once.
 */
export async function requestReview(userId: string, challengeId: string, note: string) {
  const text = note.trim().slice(0, 1000);
  if (text.length < 10) throw new CoachError("Tell your mentor what was missed (a sentence or two).");
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId, status: "done" }, include: { skill: true, reflection: { include: { analysis: true } } } });
  const analysis = ch?.reflection?.analysis;
  if (!ch || !analysis) throw new CoachError("This task hasn't been evaluated yet");
  if (analysis.reviewedAt) throw new CoachError("This evaluation was already reviewed once");
  checkAiBudget(userId);
  const original = await db.skillScoreEvent.findFirst({ where: { userId, source: "challenge", sourceId: ch.id, subskill: "" } });
  if (!original) throw new CoachError("No score change to review");

  const state = await loadSkillState(userId, ch.skillId);
  const status = ch.reflection!.completionStatus as CompletionStatus;
  const responses = (Array.isArray(ch.reflection!.responses) ? ch.reflection!.responses : []) as { question: string; answer: string }[];
  const ctx = await buildMentorContext(userId, state, null);
  let ev: Evaluation;
  try {
    ev = (
      await generateStructured(evaluationSchema, {
        system: EVALUATION_SYSTEM,
        prompt: evaluationPrompt(ctx, taskForPrompt(ch), { completionStatus: status, responses }, { previous: { dimensions: analysis.dimensions, tier: analysis.tier, evidenceStrength: analysis.evidenceStrength }, note: text }),
        temperature: 0.2,
        timeoutMs: 90_000,
      })
    ).data;
  } catch (e) {
    if (e instanceof AiError) throw new CoachError("Your mentor couldn't review this right now. Please try again in a few minutes.");
    throw e;
  }
  const signals = await historySignals(userId, ch.skillId, ch.id);
  const prev = original.previousScore ?? original.newScore - original.delta;
  const redo = evaluateAttempt({
    score: prev,
    completionStatus: status,
    dimensions: ev.dimensions,
    evidenceStrength: ev.evidenceStrength,
    selfReportOnly: ev.selfReportOnly,
    challengeDifficulty: ch.difficulty,
    expectedDifficulty: state.stage.baseDifficulty,
    recentGood: signals.recentGood,
    priorPoorStreak: signals.priorPoorStreak,
  });
  const correction = Math.round((redo.delta - original.delta) * 10) / 10;
  const sc = await db.skillScore.findUniqueOrThrow({ where: { userId_skillId: { userId, skillId: ch.skillId } } });
  const newScore = Math.min(100, Math.max(0, Math.round((sc.score + correction) * 10) / 10));
  const message =
    correction === 0
      ? `I re-read your account with your note. The evaluation stays the same (${redo.tier}): ${explainScoreChange(ch.skill.name, prev, redo, ev.evidenceSummary)}`
      : `I re-read your account with your note and updated the evaluation (${analysis.tier} → ${redo.tier}). Your ${ch.skill.name} score is now ${newScore} (${correction > 0 ? "+" : ""}${correction}).`;
  await db.$transaction(async (tx) => {
    const flipped = await tx.aiAnalysis.updateMany({ where: { id: analysis.id, reviewedAt: null }, data: { reviewedAt: new Date(), reviewNote: text, dimensions: ev.dimensions, performance: redo.performance, tier: redo.tier } });
    if (flipped.count !== 1) throw new CoachError("This evaluation was already reviewed once");
    await tx.skillScore.update({ where: { userId_skillId: { userId, skillId: ch.skillId } }, data: { score: newScore } });
    await tx.skillScoreEvent.create({
      data: {
        userId,
        skillId: ch.skillId,
        subskill: "",
        delta: Math.round((newScore - sc.score) * 10) / 10,
        previousScore: sc.score,
        newScore,
        source: "review",
        sourceId: ch.id,
        reason: correction === 0 ? "Reviewed at your request — evaluation unchanged." : `Reviewed at your request: ${analysis.tier} → ${redo.tier}.`,
        confidence: redo.confidence,
        evidence: { note: text, dimensions: ev.dimensions, performance: redo.performance, tier: redo.tier, rule: redo.rule, evidenceSummary: ev.evidenceSummary },
      },
    });
  });
  if (ch.conversationId) await addMessage(ch.conversationId, "coach", message, "report", ch.id);
  return { correction, score: newScore, tier: redo.tier };
}

/** Next task right after an evaluation: the mentor already knows the context. */
export async function nextChallenge(userId: string, challengeId: string) {
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId, status: "done" }, include: { reflection: { include: { analysis: true } } } });
  if (!ch?.conversationId) throw new CoachError("Task not found");
  if (!ch.reflection?.analysis && ch.reflection) await analyzeFeedback(ch.reflection.id);
  checkAiBudget(userId);
  const active = await db.challenge.findFirst({ where: { userId, skillId: ch.skillId, status: "active" } });
  if (active) return { conversationId: active.conversationId! };
  const existing = await db.challenge.findFirst({ where: { conversationId: ch.conversationId, status: "proposed" } });
  if (!existing) {
    await addMessage(ch.conversationId, "user", "Asked for the next task", "event");
    await exclusive(ch.conversationId, () => proposeChallenge(userId, ch.conversationId!, { mode: "new" }));
  }
  return { conversationId: ch.conversationId };
}

/** Re-runs evaluation for feedback whose background evaluation never finished. */
export async function analyzePendingFeedback(userId: string) {
  const pending = await db.reflection.findMany({
    where: { challenge: { userId }, analysis: null, createdAt: { lt: new Date(Date.now() - 2 * 60_000) } },
    select: { id: true },
    take: 3,
  });
  for (const r of pending) await analyzeFeedback(r.id);
}
