import { db } from "@/lib/db";
import { generateStructured, generateText } from "@/ai/client";
import {
  BRIEF_SYSTEM,
  CHAT_SYSTEM,
  WEEKLY_SYSTEM,
  briefPrompt,
  briefSchema,
  chatPrompt,
  weeklyPrompt,
  weeklySchema,
  type BriefInput,
  type WeeklyContent,
} from "@/ai/mentorPrompts";
import { computeStreak, localDateKey, localHour, safeTimeZone, weekStartKey } from "@/lib/time";
import { levelChange, levelForScore } from "../assessment/levels";
import { recallInsights } from "../engine/memory";
import { suggestSkillId } from "./challenges";

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const firstName = (name: string | null | undefined) => (name ?? "there").trim().split(/\s+/)[0] || "there";

type UserLite = { id: string; name: string | null; timezone: string };

// ─── Streak ───────────────────────────────────────────────────────────────

/** Days in a row (user's local days) on which the user gave feedback on a step. */
export async function getStreak(user: UserLite) {
  const tz = safeTimeZone(user.timezone);
  const rows = await db.reflection.findMany({
    where: { challenge: { userId: user.id } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const today = localDateKey(tz);
  const keys = rows.map((r) => localDateKey(tz, r.createdAt));
  const lastKey = keys[0] ?? null;
  const daysSinceLast = lastKey ? Math.round((Date.parse(today) - Date.parse(lastKey)) / 86_400_000) : null;
  return { ...computeStreak(keys, today), daysSinceLast };
}

// ─── Daily brief ──────────────────────────────────────────────────────────

/** Today's mentor check-in. Generated once per local day, then cached. */
export async function getOrCreateDailyBrief(user: UserLite) {
  const tz = safeTimeZone(user.timezone);
  const date = localDateKey(tz);
  const existing = await db.dailyBrief.findUnique({ where: { userId_date: { userId: user.id, date } } });
  // A fallback brief (AI was down) is retried after 30 minutes; a real one is kept all day.
  if (existing && (existing.modelVersion !== "fallback" || Date.now() - existing.createdAt.getTime() < 30 * 60_000)) {
    return existing;
  }

  const [streak, suggestedId, open, last, levelEvents] = await Promise.all([
    getStreak(user),
    suggestSkillId(user.id),
    db.challenge.findFirst({ where: { userId: user.id, status: "active" }, include: { skill: true }, orderBy: { acceptedAt: "desc" } }),
    db.challenge.findFirst({
      where: { userId: user.id, reflection: { isNot: null } },
      include: { skill: true, reflection: { include: { analysis: true } } },
      orderBy: { assignedAt: "desc" },
    }),
    db.skillScoreEvent.findMany({
      where: { userId: user.id, source: "challenge", createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      include: { skill: true },
    }),
  ]);
  const suggested = suggestedId
    ? await db.skillScore.findUnique({ where: { userId_skillId: { userId: user.id, skillId: suggestedId } }, include: { skill: true } })
    : null;
  const hour = localHour(tz);

  const input: BriefInput = {
    firstName: firstName(user.name),
    partOfDay: hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening",
    streak: { current: streak.current, best: streak.best },
    daysSinceLastActivity: streak.daysSinceLast,
    suggestedSkill: suggested ? { name: suggested.skill.name, level: levelForScore(suggested.score).name } : null,
    openStep: open ? { title: open.title, skill: open.skill.name } : null,
    lastStep: last?.reflection
      ? {
          skill: last.skill.name,
          title: last.title,
          situation: last.situation,
          completed: last.reflection.completed,
          whatHappened: last.reflection.whatHappened,
          painPoints: asStrings(last.reflection.analysis?.painPoints),
          nextFocus: last.reflection.analysis?.nextFocus,
        }
      : null,
    recentLevelUps: levelEvents
      .filter((e) => levelChange(e.newScore - e.delta, e.newScore).change > 0)
      .map((e) => `${e.skill.name}: now ${levelForScore(e.newScore).name}`),
    patterns: (await recallInsights(user.id, "", 4)).map(({ kind, text }) => ({ kind, text })),
  };

  let message: string;
  let focus: string;
  let modelVersion = "fallback";
  try {
    const res = await generateStructured(briefSchema, { system: BRIEF_SYSTEM, prompt: briefPrompt(input), temperature: 0.7, timeoutMs: 25_000 });
    ({ message, focus } = res.data);
    modelVersion = res.modelVersion;
  } catch (e) {
    console.warn("[brief] AI failed, using fallback:", (e as Error).message);
    ({ message, focus } = fallbackBrief(input));
  }

  if (existing) {
    // Retrying an old fallback: only replace it if the AI actually answered this time.
    if (modelVersion === "fallback") return existing;
    return db.dailyBrief.update({ where: { id: existing.id }, data: { message, focus, skillId: suggestedId, modelVersion, createdAt: new Date() } });
  }
  try {
    return await db.dailyBrief.create({
      data: { userId: user.id, date, message, focus, skillId: suggestedId, modelVersion },
    });
  } catch {
    // Created concurrently by another request — use that one.
    return db.dailyBrief.findUniqueOrThrow({ where: { userId_date: { userId: user.id, date } } });
  }
}

function fallbackBrief(i: BriefInput): { message: string; focus: string } {
  const hello = `Good ${i.partOfDay}, ${i.firstName}.`;
  if (!i.lastStep) {
    return {
      message: `${hello} Welcome to UnfoldAI. Open any skill, tell me what's going on, and I'll give you one practical task. When you've tried it, tell me how it went and I'll shape the next one around it.`,
      focus: i.suggestedSkill ? `Start with ${i.suggestedSkill.name}.` : "Pick one skill and a real situation.",
    };
  }
  const back = i.daysSinceLastActivity && i.daysSinceLastActivity > 1 ? " Good to see you back." : "";
  const rawPain = i.lastStep.painPoints[0]?.trim();
  const pain = rawPain && !/[.!?]$/.test(rawPain) ? `${rawPain}.` : rawPain;
  return {
    message: `${hello}${back} Last time you worked on ${i.lastStep.skill} ("${i.lastStep.title}").${
      pain ? ` The hard part was: ${pain}` : ""
    } Let's keep building on it today.`,
    focus: i.lastStep.nextFocus ?? (i.suggestedSkill ? `Practise ${i.suggestedSkill.name}.` : "Take one small step."),
  };
}

// ─── Weekly review ────────────────────────────────────────────────────────

/** This week's review; refreshed at most once a day, and only when there is activity. */
export async function getOrCreateWeeklyReview(user: UserLite): Promise<{ content: WeeklyContent; weekStart: string } | null> {
  const tz = safeTimeZone(user.timezone);
  const weekStart = weekStartKey(localDateKey(tz));
  const existing = await db.weeklyReview.findUnique({ where: { userId_weekStart: { userId: user.id, weekStart } } });
  if (existing && Date.now() - existing.updatedAt.getTime() < 24 * 3600_000) {
    return { content: existing.content as WeeklyContent, weekStart };
  }

  const since = new Date(Date.now() - 7 * 86_400_000);
  const steps = await db.challenge.findMany({
    where: { userId: user.id, reflection: { createdAt: { gte: since } } },
    include: { skill: true, reflection: { include: { analysis: true } } },
    orderBy: { assignedAt: "asc" },
  });
  if (steps.length === 0) return existing ? { content: existing.content as WeeklyContent, weekStart } : null;

  const events = await db.skillScoreEvent.findMany({
    where: { userId: user.id, source: "challenge", createdAt: { gte: since } },
    include: { skill: true },
  });
  const data = {
    steps: steps.map((s) => ({
      skill: s.skill.name,
      title: s.title,
      completed: s.reflection!.completed,
      outcome: s.reflection!.completionStatus,
      whatHappened: s.reflection!.whatHappened,
      whatWasHard: s.reflection!.whatWasHard,
      painPoints: asStrings(s.reflection!.analysis?.painPoints),
    })),
    levelChanges: events
      .map((e) => ({ skill: e.skill.name, ...levelChange(e.newScore - e.delta, e.newScore) }))
      .filter((c) => c.change !== 0)
      .map((c) => `${c.skill}: ${c.from.name} → ${c.to.name}`),
  };

  let content: WeeklyContent;
  let modelVersion = "fallback";
  try {
    const res = await generateStructured(weeklySchema, { system: WEEKLY_SYSTEM, prompt: weeklyPrompt(data), temperature: 0.4, timeoutMs: 45_000 });
    content = res.data;
    modelVersion = res.modelVersion;
  } catch (e) {
    console.warn("[weekly] AI failed, using fallback:", (e as Error).message);
    const done = data.steps.filter((s) => s.completed);
    const pains = data.steps.flatMap((s) => s.painPoints);
    content = {
      summary: `This week you worked on ${data.steps.length} practical step${data.steps.length === 1 ? "" : "s"} and completed ${done.length}.`,
      wins: [...data.levelChanges.filter((c) => c.includes("→")), ...done.slice(0, 3).map((s) => `Completed "${s.title}" (${s.skill})`)].slice(0, 4),
      mainPainPoint: pains[pains.length - 1] ?? "",
      nextWeekFocus: pains.length ? "Keep targeting your main sticking point with small steps." : "Keep the daily habit going.",
    };
  }

  await db.weeklyReview.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    create: { userId: user.id, weekStart, content, modelVersion },
    update: { content, modelVersion },
  });
  return { content, weekStart };
}

// ─── Ask your mentor ──────────────────────────────────────────────────────

const DAILY_MESSAGE_LIMIT = 30;

export async function getMentorMessages(userId: string, challengeId: string | null) {
  const rows = await db.mentorMessage.findMany({
    where: { userId, challengeId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.reverse();
}

export class MentorError extends Error {}

/** Answers a question with full context of the user's step, situation and patterns. */
export async function askMentor(user: UserLite, challengeId: string | null, question: string) {
  // Protects the free AI quota: max questions per rolling 24 hours.
  const usedToday = await db.mentorMessage.count({
    where: { userId: user.id, role: "user", createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (usedToday >= DAILY_MESSAGE_LIMIT) throw new MentorError("You've reached today's question limit. Your mentor will be back tomorrow.");

  const step = challengeId
    ? await db.challenge.findFirst({
        where: { id: challengeId, userId: user.id },
        include: { skill: true, reflection: { include: { analysis: true } } },
      })
    : await db.challenge.findFirst({
        where: { userId: user.id, status: { in: ["active", "done", "abandoned"] } },
        include: { skill: true, reflection: { include: { analysis: true } } },
        orderBy: { assignedAt: "desc" },
      });
  if (challengeId && !step) throw new MentorError("Step not found");

  const score = step
    ? await db.skillScore.findUnique({ where: { userId_skillId: { userId: user.id, skillId: step.skillId } } })
    : null;
  const history = (await getMentorMessages(user.id, challengeId)).slice(-8).map((m) => ({ role: m.role, content: m.content }));

  const context = {
    firstName: firstName(user.name),
    step: step
      ? {
          skill: step.skill.name,
          level: score ? levelForScore(score.score).name : undefined,
          situation: step.situation,
          title: step.title,
          instructions: step.instructions,
          status: step.status,
          feedback: step.reflection?.whatHappened,
          painPoints: asStrings(step.reflection?.analysis?.painPoints),
        }
      : null,
    patterns: (await recallInsights(user.id, step?.skillId ?? "", 4)).map(({ kind, text }) => ({ kind, text })),
  };

  let answer: string;
  try {
    const res = await generateText({ system: CHAT_SYSTEM, prompt: chatPrompt({ context, history, question }), temperature: 0.6, timeoutMs: 60_000 });
    answer = res.text.slice(0, 2000);
  } catch (e) {
    console.warn("[mentor-chat] AI failed:", (e as Error).message);
    throw new MentorError("Your mentor couldn't answer right now (the AI service is busy). Please try again in a minute.");
  }

  await db.mentorMessage.createMany({
    data: [
      { userId: user.id, challengeId, role: "user", content: question },
      { userId: user.id, challengeId, role: "mentor", content: answer },
    ],
  });
  return answer;
}

